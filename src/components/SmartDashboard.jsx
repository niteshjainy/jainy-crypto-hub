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

  if (!last3OI.length || !last3Price.length || !last3FR.length)
    return "NEUTRAL";

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
// 💰 TRADE GENERATION
// =========================
function getTrade(price, direction, capital, rr = 2) {
  const riskPercent = 0.02;
  const volatility = price * 0.01;

  const sl =
    direction === "LONG" ? price - volatility * 1.2 : price + volatility * 1.2;

  const risk = Math.abs(price - sl);
  if (!risk) return null;

  const size = (capital * riskPercent) / risk;

  const final = direction === "LONG" ? price + risk * rr : price - risk * rr;

  return {
    id: Date.now(),
    type: direction,
    entry: price,
    sl,
    final,
    size,
    risk,
    rr,
    startTime: Date.now(),
  };
}

export default function SmartDashboard() {
  const [longCapital, setLongCapital] = useState(1000);
  const [shortCapital, setShortCapital] = useState(1000);

  const [longHistory, setLongHistory] = useState([]);
  const [shortHistory, setShortHistory] = useState([]);

  const longTradeRef = useRef(null);
  const shortTradeRef = useRef(null);
  const pendingRef = useRef(null);

  // ✅ FIX: refs for lint-safe capital usage
  const longCapitalRef = useRef(longCapital);
  const shortCapitalRef = useRef(shortCapital);

  useEffect(() => {
    longCapitalRef.current = longCapital;
    shortCapitalRef.current = shortCapital;
  }, [longCapital, shortCapital]);

  // LOAD
  useEffect(() => {
    const lc = localStorage.getItem("longCapital");
    const sc = localStorage.getItem("shortCapital");
    const lh = localStorage.getItem("longHistory");
    const sh = localStorage.getItem("shortHistory");

    if (lc) setLongCapital(Number(lc));
    if (sc) setShortCapital(Number(sc));
    if (lh) setLongHistory(JSON.parse(lh));
    if (sh) setShortHistory(JSON.parse(sh));

    Notification.requestPermission();
  }, []);

  // SAVE
  useEffect(() => {
    localStorage.setItem("longCapital", longCapital);
    localStorage.setItem("shortCapital", shortCapital);
    localStorage.setItem("longHistory", JSON.stringify(longHistory));
    localStorage.setItem("shortHistory", JSON.stringify(shortHistory));
  }, [longCapital, shortCapital, longHistory, shortHistory]);

  useEffect(() => {
    let interval;

    const run = async () => {
      try {
        const res = {};
        let baseOI = [],
          baseFR = [];

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
        if (!priceData.length) return;

        const latest = Number(priceData.at(-1)?.close);
        if (!latest) return;

        const regime = detectMarketRegime(baseOI, priceData, baseFR);

        const h4 = res["4h"];
        const sweep = h4.label.includes("SWEEP");

        const direction = sweep
          ? h4.label.includes("LONG")
            ? "LONG"
            : "SHORT"
          : h4.score >= 60
            ? "LONG"
            : "SHORT";

        // ENTRY FIXED
        if (
          !pendingRef.current &&
          !longTradeRef.current &&
          !shortTradeRef.current &&
          regime !== "RANGING"
        ) {
          pendingRef.current = {
            direction,
            price: latest,
            time: Date.now(),
          };
          return;
        }

        // CONFIRM
        if (pendingRef.current) {
          const p = pendingRef.current;

          if (Date.now() - p.time < 15000) return;

          const confirm =
            (p.direction === "LONG" && latest > p.price) ||
            (p.direction === "SHORT" && latest < p.price);

          if (!confirm) {
            pendingRef.current = null;
            return;
          }

          const rr = p.direction === "LONG" ? 2 : 1.2;

          const trade = getTrade(
            latest,
            p.direction,
            p.direction === "LONG"
              ? longCapitalRef.current
              : shortCapitalRef.current,
            rr,
          );

          if (!trade) return;

          if (p.direction === "LONG") {
            longTradeRef.current = trade;
            new Notification("🚀 LONG ENTRY");
          } else {
            shortTradeRef.current = trade;
            new Notification("🔴 SHORT ENTRY");
          }

          pendingRef.current = null;
        }

        // EXIT
        const handleExit = (trade, setCap, setHistory) => {
          let result = null;

          if (trade.type === "LONG") {
            if (latest >= trade.final) result = "win";
            if (latest <= trade.sl) result = "loss";
          } else {
            if (latest <= trade.final) result = "win";
            if (latest >= trade.sl) result = "loss";
          }

          if (result) {
            const pnl =
              result === "win"
                ? trade.risk * trade.size * trade.rr
                : -trade.risk * trade.size;

            setCap((prev) => prev + pnl);

            setHistory((prev) => [
              {
                ...trade,
                exit: latest,
                pnl,
                result,
                date: new Date().toLocaleString(),
              },
              ...prev,
            ]);

            new Notification(result === "win" ? "🎯 TP" : "❌ SL");
            return null;
          }

          return trade;
        };

        longTradeRef.current = longTradeRef.current
          ? handleExit(longTradeRef.current, setLongCapital, setLongHistory)
          : null;

        shortTradeRef.current = shortTradeRef.current
          ? handleExit(shortTradeRef.current, setShortCapital, setShortHistory)
          : null;
      } catch (e) {
        console.log(e);
      }
    };

    run();
    interval = setInterval(run, 10000);

    return () => clearInterval(interval);
  }, []);

  const deleteTrade = (id, type) => {
    if (type === "LONG") {
      setLongHistory((prev) => prev.filter((t) => t.id !== id));
    } else {
      setShortHistory((prev) => prev.filter((t) => t.id !== id));
    }
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="bg-green-900/20 p-3">
        <h2>LONG SYSTEM</h2>
        <p>Capital: ${longCapital.toFixed(2)}</p>
        <button onClick={() => setLongHistory([])}>Clear All</button>

        {longHistory.map((t) => (
          <div key={t.id} className="bg-black/20 p-2 my-2">
            <p>
              {t.type} | {t.result}
            </p>
            <p>Entry: {t.entry.toFixed(0)}</p>
            <p>Exit: {t.exit.toFixed(0)}</p>
            <p>PnL: ${t.pnl.toFixed(2)}</p>
            <button onClick={() => deleteTrade(t.id, "LONG")}>❌</button>
          </div>
        ))}
      </div>

      <div className="bg-red-900/20 p-3">
        <h2>SHORT SYSTEM</h2>
        <p>Capital: ${shortCapital.toFixed(2)}</p>
        <button onClick={() => setShortHistory([])}>Clear All</button>

        {shortHistory.map((t) => (
          <div key={t.id} className="bg-black/20 p-2 my-2">
            <p>
              {t.type} | {t.result}
            </p>
            <p>Entry: {t.entry.toFixed(0)}</p>
            <p>Exit: {t.exit.toFixed(0)}</p>
            <p>PnL: ${t.pnl.toFixed(2)}</p>
            <button onClick={() => deleteTrade(t.id, "SHORT")}>❌</button>
          </div>
        ))}
      </div>
    </div>
  );
}
