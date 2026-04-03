import { useEffect, useState } from "react";
import { getLiquidation, getOI, getFunding, getPrice } from "../services/api";

const TIMEFRAMES = ["4h", "1d", "1w"];

function calculateSignal(liqData, oiData, frData) {
  const latestLiq = liqData.at(-1);
  const last3OI = oiData.slice(-3);
  const latestFR = frData.at(-1);

  const longLiq = Number(latestLiq?.aggregated_long_liquidation_usd || 0);
  const shortLiq = Number(latestLiq?.aggregated_short_liquidation_usd || 0);

  const oiTrendUp =
    Number(last3OI?.[2]?.close || 0) > Number(last3OI?.[0]?.close || 0);

  const frValue = Number(latestFR?.close || latestFR?.funding_rate || 0);

  let score = 0;

  if (shortLiq > longLiq) score += 30;
  else score -= 30;

  if (oiTrendUp) score += 20;
  else score -= 15;

  if (frValue < 0) score += 15;
  else score -= 10;

  if (score >= 35) return "🚀 BULLISH";
  if (score <= -35) return "📉 BEARISH";

  return "⚖️ NEUTRAL";
}

function getTradeSetup(signal, price) {
  if (!price) return null;

  if (signal.includes("BULLISH")) {
    return {
      entry: price,
      sl: price * 0.98,
      target: price * 1.03,
      type: "LONG",
    };
  }

  if (signal.includes("BEARISH")) {
    return {
      entry: price,
      sl: price * 1.02,
      target: price * 0.97,
      type: "SHORT",
    };
  }

  return null;
}

export default function SmartDashboard() {
  const [signals, setSignals] = useState({});
  const [price, setPrice] = useState(0);
  const [activeTrade, setActiveTrade] = useState(null);
  const [stats, setStats] = useState({ wins: 0, losses: 0 });

  useEffect(() => {
    async function fetchAll() {
      const results = {};

      for (let tf of TIMEFRAMES) {
        try {
          const [liq, oi, fr] = await Promise.all([
            getLiquidation(tf),
            getOI(tf),
            getFunding(tf),
          ]);

          results[tf] = calculateSignal(
            liq?.data?.data || [],
            oi?.data?.data || [],
            fr?.data?.data || [],
          );
        } catch {}
      }

      const priceRes = await getPrice("4h");
      const latestPrice = Number(priceRes?.data?.data?.at(-1)?.close) || 0;

      setSignals(results);
      setPrice(latestPrice);

      // 🔥 FINAL SIGNAL (multi TF)
      const values = Object.values(results);

      const bullish = values.filter((s) => s?.includes("BULLISH")).length;

      const bearish = values.filter((s) => s?.includes("BEARISH")).length;

      let finalSignal = "⚖️ NEUTRAL";

      if (bullish >= 2) finalSignal = "🚀 BULLISH";
      else if (bearish >= 2) finalSignal = "📉 BEARISH";

      const newTrade = getTradeSetup(finalSignal, latestPrice);

      // ✅ only 1 trade
      if (!activeTrade && newTrade && finalSignal !== "⚖️ NEUTRAL") {
        setActiveTrade({
          ...newTrade,
          time: new Date().toLocaleTimeString(),
        });
      }

      // 🔥 result tracking
      if (activeTrade) {
        if (activeTrade.type === "LONG") {
          if (latestPrice >= activeTrade.target) {
            setStats((s) => ({ ...s, wins: s.wins + 1 }));
            setActiveTrade(null);
          } else if (latestPrice <= activeTrade.sl) {
            setStats((s) => ({ ...s, losses: s.losses + 1 }));
            setActiveTrade(null);
          }
        }

        if (activeTrade.type === "SHORT") {
          if (latestPrice <= activeTrade.target) {
            setStats((s) => ({ ...s, wins: s.wins + 1 }));
            setActiveTrade(null);
          } else if (latestPrice >= activeTrade.sl) {
            setStats((s) => ({ ...s, losses: s.losses + 1 }));
            setActiveTrade(null);
          }
        }
      }
    }

    fetchAll();
    const interval = setInterval(fetchAll, 60000);
    return () => clearInterval(interval);
  }, [activeTrade]);

  const total = stats.wins + stats.losses;
  const winRate = total ? ((stats.wins / total) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-5">
      {/* 🔥 FINAL SIGNAL */}
      <div className="bg-[#0b0f17] p-5 rounded-xl border">
        <h2 className="text-xl font-bold">Smart Signal</h2>
        <p className="text-gray-400">Price: {price}</p>
      </div>

      {/* 📊 TIMEFRAME SIGNALS */}
      <div className="grid grid-cols-3 gap-3">
        {TIMEFRAMES.map((tf) => (
          <div
            key={tf}
            className="bg-[#0b0f17] p-3 rounded-lg border text-center"
          >
            <p className="text-xs text-gray-400">{tf.toUpperCase()}</p>
            <p className="font-bold">{signals[tf] || "..."}</p>
          </div>
        ))}
      </div>

      {/* 🎯 ACTIVE TRADE */}
      {activeTrade && (
        <div className="bg-green-900/20 p-5 rounded-xl border">
          <h3 className="font-bold">Active Trade</h3>
          <p>{activeTrade.type}</p>
          <p>Entry: {activeTrade.entry.toFixed(0)}</p>
          <p>SL: {activeTrade.sl.toFixed(0)}</p>
          <p>Target: {activeTrade.target.toFixed(0)}</p>
        </div>
      )}

      {/* 📊 STATS */}
      <div className="bg-[#0b0f17] p-5 rounded-xl border">
        <h3 className="font-bold">Performance</h3>
        <p>Win Rate: {winRate}%</p>
        <p>Wins: {stats.wins}</p>
        <p>Losses: {stats.losses}</p>
      </div>
    </div>
  );
}
