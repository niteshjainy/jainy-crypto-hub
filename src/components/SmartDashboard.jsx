import { useEffect, useState, useRef } from "react";
import { getLiquidation, getOI, getFunding, getPrice } from "../services/api";

const TIMEFRAMES = ["4h", "1d", "1w"];

function calculateSignal(liq, oi, fr) {
  const latestLiq = liq.at(-1);
  const last3OI = oi.slice(-3);
  const latestFR = fr.at(-1);

  const longLiq = Number(latestLiq?.aggregated_long_liquidation_usd || 0);
  const shortLiq = Number(latestLiq?.aggregated_short_liquidation_usd || 0);
  const oiTrendUp = Number(last3OI[2]?.close) > Number(last3OI[0]?.close);
  const frValue = Number(latestFR?.close || 0);

  let score = 50;

  if (shortLiq > longLiq) score += 20;
  else score -= 20;

  if (oiTrendUp) score += 15;
  else score -= 15;

  if (frValue < 0) score += 10;
  else score -= 10;

  let label = "⚖️ NEUTRAL";
  if (score >= 65) label = "🟢 BULLISH";
  else if (score <= 35) label = "🔴 BEARISH";

  return { score, label };
}

function getTrade(score, price) {
  if (!price || score < 60) return null;

  const bullish = score >= 60;

  return {
    id: Date.now(),
    type: bullish ? "LONG" : "SHORT",
    entry: price,
    sl: bullish ? price * 0.98 : price * 1.02,
    tp1: bullish ? price * 1.02 : price * 0.98,
    final: bullish ? price * 1.04 : price * 0.96,
    partial: false,
    startTime: Date.now(),
    confidence: score,
  };
}

export default function SmartDashboard() {
  const [price, setPrice] = useState(0);
  const [signals, setSignals] = useState({});
  const [activeTrade, setActiveTrade] = useState(null);
  const [stats, setStats] = useState({ wins: 0, losses: 0 });
  const [history, setHistory] = useState([]);
  const [confidence, setConfidence] = useState(0);

  const tradeRef = useRef(null);

  // LOAD STORAGE
  useEffect(() => {
    const s = localStorage.getItem("stats");
    const h = localStorage.getItem("history");
    const t = localStorage.getItem("activeTrade");

    if (s) setStats(JSON.parse(s));
    if (h) setHistory(JSON.parse(h));
    if (t) {
      setActiveTrade(JSON.parse(t));
      tradeRef.current = JSON.parse(t);
    }

    Notification.requestPermission();
  }, []);

  // SAVE TRADE
  useEffect(() => {
    if (activeTrade) {
      localStorage.setItem("activeTrade", JSON.stringify(activeTrade));
      tradeRef.current = activeTrade;
    } else {
      localStorage.removeItem("activeTrade");
      tradeRef.current = null;
    }
  }, [activeTrade]);

  // 🔥 MAIN LOOP
  useEffect(() => {
    let interval;

    async function run() {
      try {
        // SIGNAL
        const res = {};
        let total = 0;

        for (let tf of TIMEFRAMES) {
          const [liq, oi, fr] = await Promise.all([
            getLiquidation(tf),
            getOI(tf),
            getFunding(tf),
          ]);

          const result = calculateSignal(
            liq?.data?.data || [],
            oi?.data?.data || [],
            fr?.data?.data || [],
          );

          res[tf] = result;
          total += result.score;
        }

        const avg = Math.round(total / TIMEFRAMES.length);
        setSignals(res);
        setConfidence(avg);

        // PRICE
        const priceRes = await getPrice("4h");
        const latestRaw = priceRes?.data?.data?.at(-1)?.close;

        if (!latestRaw || isNaN(latestRaw)) return;

        const latest = Number(latestRaw);

        if (latest < 10000) return;

        setPrice(latest);

        let trade = tradeRef.current;

        // ENTRY
        if (!trade && avg >= 60) {
          const newTrade = getTrade(avg, latest);

          if (newTrade) {
            setActiveTrade(newTrade);

            new Notification("🚀 New Trade", {
              body: `${newTrade.type} | Conf: ${avg}%`,
            });

            return;
          }
        }

        // TRACK
        if (trade) {
          let updated = { ...trade };

          // PARTIAL
          if (!updated.partial) {
            if (
              (updated.type === "LONG" && latest >= updated.tp1) ||
              (updated.type === "SHORT" && latest <= updated.tp1)
            ) {
              updated.partial = true;
              updated.sl = updated.entry;
            }
          }

          // TRAILING
          if (updated.partial) {
            if (updated.type === "LONG") {
              updated.sl = Math.max(updated.sl, latest * 0.995);
            } else {
              updated.sl = Math.min(updated.sl, latest * 1.005);
            }
          }

          // EXIT
          let result = null;

          if (updated.type === "LONG") {
            if (latest >= updated.final) result = "win";
            if (latest <= updated.sl) result = "loss";
          }

          if (updated.type === "SHORT") {
            if (latest <= updated.final) result = "win";
            if (latest >= updated.sl) result = "loss";
          }

          if (result) {
            const duration = ((Date.now() - updated.startTime) / 60000).toFixed(
              1,
            );

            const record = {
              ...updated,
              exit: latest,
              result,
              duration,
              date: new Date().toLocaleString(),
            };

            const exists = history.find((h) => h.id === updated.id);

            if (!exists) {
              const updatedHistory = [record, ...history].slice(0, 50);
              setHistory(updatedHistory);
              localStorage.setItem("history", JSON.stringify(updatedHistory));
            }

            const updatedStats =
              result === "win"
                ? { ...stats, wins: stats.wins + 1 }
                : { ...stats, losses: stats.losses + 1 };

            setStats(updatedStats);
            localStorage.setItem("stats", JSON.stringify(updatedStats));

            new Notification(result === "win" ? "🎯 TP Hit" : "❌ SL Hit");

            setActiveTrade(null);
          } else {
            setActiveTrade(updated);
          }
        }
      } catch (e) {
        console.log("Loop error:", e);
      }
    }

    run();
    interval = setInterval(run, 10000);

    return () => clearInterval(interval);
  }, [history, stats]);

  const total = stats.wins + stats.losses;
  const winRate = total ? ((stats.wins / total) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-5">
      <div className="bg-[#0b0f17] p-4 rounded">
        <h2>Price: {price}</h2>
        <p>Confidence: {confidence}%</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {Object.entries(signals).map(([tf, val]) => (
          <div key={tf} className="bg-[#111] p-2 rounded text-center">
            <p>{tf.toUpperCase()}</p>
            <p>{val.label}</p>
          </div>
        ))}
      </div>

      {activeTrade && (
        <div className="bg-green-900/20 p-3 rounded">
          <p>{activeTrade.type}</p>
          <p>Entry: {activeTrade.entry.toFixed(0)}</p>
          <p>SL: {activeTrade.sl.toFixed(0)}</p>
          <p>TP1: {activeTrade.tp1.toFixed(0)}</p>
          <p>Final: {activeTrade.final.toFixed(0)}</p>
          <p>
            Hold: {((Date.now() - activeTrade.startTime) / 60000).toFixed(1)}m
          </p>
        </div>
      )}

      <div className="bg-[#111] p-3 rounded">
        <p>Win Rate: {winRate}%</p>
        <p>Wins: {stats.wins}</p>
        <p>Losses: {stats.losses}</p>
      </div>

      <div className="bg-[#111] p-3 rounded">
        <h3>History</h3>
        {history.map((t, i) => (
          <div key={i} className="bg-[#1a1f2e] p-2 rounded mb-2">
            <p>
              {t.type} {t.result === "win" ? "🟢" : "🔴"}
            </p>
            <p>Entry: {t.entry.toFixed(0)}</p>
            <p>Exit: {t.exit.toFixed(0)}</p>
            <p>Conf: {t.confidence}%</p>
            <p>Time: {t.duration}m</p>
          </div>
        ))}
      </div>
    </div>
  );
}
