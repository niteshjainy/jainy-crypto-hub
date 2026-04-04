import { useEffect, useState, useRef } from "react";
import { getLiquidation, getOI, getFunding, getPrice } from "../services/api";

const TIMEFRAMES = ["4h", "1d", "1w"];

// =========================
// 🧠 MARKET REGIME
// =========================
function detectMarketRegime(oi, priceData, fr) {
  const last3OI = oi.slice(-3);
  const last3Price = priceData.slice(-3);
  const last3FR = fr.slice(-3);

  const oiMove = (last3OI[2]?.close - last3OI[0]?.close) / last3OI[0]?.close;

  const priceMove =
    Math.abs(last3Price[2]?.close - last3Price[0]?.close) /
    last3Price[0]?.close;

  const frValues = last3FR.map((f) => Number(f?.close || 0));
  const frFlat = Math.max(...frValues) - Math.min(...frValues) < 0.002;

  if (oiMove > 0.01 && priceMove > 0.005) return "TRENDING";
  if (frFlat && priceMove < 0.003) return "RANGING";

  return "NEUTRAL";
}

// =========================
// 🔥 SIGNAL ENGINE
// =========================
function calculateSignal(liq, oi, fr) {
  const latest = liq.at(-1);
  const prev = liq.at(-2) || {};
  const last3OI = oi.slice(-3);

  const longLiq = Number(latest?.aggregated_long_liquidation_usd || 0);
  const shortLiq = Number(latest?.aggregated_short_liquidation_usd || 0);

  const prevLong = Number(prev?.aggregated_long_liquidation_usd || 0);
  const prevShort = Number(prev?.aggregated_short_liquidation_usd || 0);

  const frValue = Number(fr.at(-1)?.close || 0);

  let score = 50;

  const longSweep = longLiq > prevLong * 2 && longLiq > 500000;
  const shortSweep = shortLiq > prevShort * 2 && shortLiq > 500000;

  if (Math.abs(frValue) < 0.002) return { score: 50, label: "NO TRADE" };

  if (longSweep) score += 25;
  if (shortSweep) score -= 25;

  if (shortLiq > longLiq) score += 15;
  else score -= 15;

  if (frValue < 0) score += 10;
  else score -= 10;

  let label = "NEUTRAL";

  if (longSweep) label = "SWEEP LONG";
  else if (shortSweep) label = "SWEEP SHORT";
  else if (score >= 65) label = "BULLISH";
  else if (score <= 35) label = "BEARISH";

  return { score, label };
}

// =========================
// 💰 TRADE GENERATION + POSITION SIZE
// =========================
function getTrade(score, price, direction, capital) {
  const riskPercent = 0.02; // 2%

  const volatility = price * 0.01;

  const sl =
    direction === "LONG" ? price - volatility * 1.2 : price + volatility * 1.2;

  const risk = Math.abs(price - sl);

  const positionSize = (capital * riskPercent) / risk;

  const final = direction === "LONG" ? price + risk * 2 : price - risk * 2;

  return {
    id: Date.now(),
    type: direction,
    entry: price,
    sl,
    final,
    size: positionSize,
    risk,
    startTime: Date.now(),
  };
}

export default function SmartDashboard() {
  const [price, setPrice] = useState(0);
  const [activeTrade, setActiveTrade] = useState(null);
  const [capital, setCapital] = useState(10000); // 🔥 starting capital
  const [confidence, setConfidence] = useState(0);

  const tradeRef = useRef(null);
  const pendingTradeRef = useRef(null);
  const lastTradeTimeRef = useRef(0);

  useEffect(() => {
    const saved = localStorage.getItem("capital");
    if (saved) setCapital(Number(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem("capital", capital);
  }, [capital]);

  useEffect(() => {
    let interval;

    async function run() {
      try {
        const res = {};
        let baseOI = [];
        let baseFR = [];

        for (let tf of TIMEFRAMES) {
          const [liq, oi, fr] = await Promise.all([
            getLiquidation(tf),
            getOI(tf),
            getFunding(tf),
          ]);

          res[tf] = calculateSignal(
            liq?.data?.data || [],
            oi?.data?.data || [],
            fr?.data?.data || [],
          );

          if (tf === "4h") {
            baseOI = oi?.data?.data || [];
            baseFR = fr?.data?.data || [];
          }
        }

        const priceRes = await getPrice("4h");
        const priceData = priceRes?.data?.data || [];
        const latest = Number(priceData.at(-1)?.close);

        if (!latest) return;

        setPrice(latest);

        const regime = detectMarketRegime(baseOI, priceData, baseFR);

        const weekly = res["1w"];
        const daily = res["1d"];
        const h4 = res["4h"];

        const weightedConfidence = Math.round(
          weekly.score * 0.5 + daily.score * 0.3 + h4.score * 0.2,
        );

        setConfidence(weightedConfidence);

        let trade = tradeRef.current;
        const now = Date.now();

        const sweepSignal = h4.label.includes("SWEEP");

        // ENTRY
        if (
          !trade &&
          !pendingTradeRef.current &&
          (sweepSignal ||
            (weekly.score >= 60 && daily.score >= 60 && h4.score >= 60)) &&
          weightedConfidence >= 70 &&
          regime !== "RANGING"
        ) {
          pendingTradeRef.current = {
            direction: sweepSignal
              ? h4.label.includes("LONG")
                ? "LONG"
                : "SHORT"
              : weekly.score >= 60
                ? "LONG"
                : "SHORT",
            price: latest,
            time: now,
          };

          return;
        }

        // CONFIRM ENTRY
        if (pendingTradeRef.current && !trade) {
          const p = pendingTradeRef.current;

          if (now - p.time < 20000) return;

          if (Math.abs(latest - p.price) / p.price > 0.01) {
            pendingTradeRef.current = null;
            return;
          }

          const confirm =
            (p.direction === "LONG" && latest > p.price) ||
            (p.direction === "SHORT" && latest < p.price);

          if (confirm) {
            const newTrade = getTrade(confidence, latest, p.direction, capital);

            setActiveTrade(newTrade);
            tradeRef.current = newTrade;
            lastTradeTimeRef.current = now;
          }

          pendingTradeRef.current = null;
        }

        // EXIT + CAPITAL UPDATE
        if (trade) {
          let result = null;

          if (trade.type === "LONG") {
            if (latest >= trade.final) result = "win";
            if (latest <= trade.sl) result = "loss";
          }

          if (trade.type === "SHORT") {
            if (latest <= trade.final) result = "win";
            if (latest >= trade.sl) result = "loss";
          }

          if (result) {
            let pnl =
              result === "win"
                ? trade.risk * 2 * trade.size
                : -trade.risk * trade.size;

            setCapital((prev) => prev + pnl);

            setActiveTrade(null);
            tradeRef.current = null;
          }
        }
      } catch (e) {
        console.log(e);
      }
    }

    run();
    interval = setInterval(run, 10000);

    return () => clearInterval(interval);
  }, [capital]);

  return (
    <div>
      <h2>Price: {price}</h2>
      <p>Confidence: {confidence}%</p>
      <p>Capital: ₹{capital.toFixed(2)}</p>
      <p>Active Trade: {activeTrade?.type || "None"}</p>
    </div>
  );
}
