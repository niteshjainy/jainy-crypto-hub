import { useEffect, useState, useRef } from "react";
import { getLiquidation, getOI, getFunding, getPrice } from "../services/api";

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

  return score;
}

function getTrade(signalScore, price) {
  if (signalScore < 60) return null;

  const bullish = signalScore >= 60;

  if (bullish) {
    return {
      type: "LONG",
      entry: price,
      sl: price * 0.985,
      tp1: price * 1.02,
      final: price * 1.04,
      partial: false,
      startTime: Date.now(),
      confidence: signalScore,
    };
  } else {
    return {
      type: "SHORT",
      entry: price,
      sl: price * 1.015,
      tp1: price * 0.98,
      final: price * 0.96,
      partial: false,
      startTime: Date.now(),
      confidence: signalScore,
    };
  }
}

export default function SmartDashboard() {
  const [price, setPrice] = useState(0);
  const [activeTrade, setActiveTrade] = useState(null);
  const [stats, setStats] = useState({ wins: 0, losses: 0 });
  const [history, setHistory] = useState([]);
  const [confidence, setConfidence] = useState(0);

  const cachedSignal = useRef(null);

  useEffect(() => {
    const s = localStorage.getItem("stats");
    const h = localStorage.getItem("history");

    if (s) setStats(JSON.parse(s));
    if (h) setHistory(JSON.parse(h));

    Notification.requestPermission();
  }, []);

  // 🔥 SIGNAL FETCH (30 sec)
  useEffect(() => {
    async function fetchSignal() {
      const [liq, oi, fr] = await Promise.all([
        getLiquidation("4h"),
        getOI("4h"),
        getFunding("4h"),
      ]);

      const score = calculateSignal(
        liq?.data?.data || [],
        oi?.data?.data || [],
        fr?.data?.data || [],
      );

      setConfidence(score);
      cachedSignal.current = score;
    }

    fetchSignal();
    const interval = setInterval(fetchSignal, 30000);
    return () => clearInterval(interval);
  }, []);

  // 🔥 PRICE FETCH (5 sec)
  useEffect(() => {
    async function fetchPrice() {
      const res = await getPrice("4h");
      const latest = Number(res?.data?.data?.at(-1)?.close || 0);

      setPrice(latest);

      const score = cachedSignal.current;

      // ENTRY
      if (!activeTrade && score) {
        const newTrade = getTrade(score, latest);

        if (newTrade) {
          setActiveTrade(newTrade);

          new Notification("🚀 New Trade", {
            body: `${newTrade.type} | Conf: ${score}%`,
          });
        }
      }

      // TRACK
      if (activeTrade) {
        let trade = { ...activeTrade };

        // PARTIAL
        if (!trade.partial) {
          if (
            (trade.type === "LONG" && latest >= trade.tp1) ||
            (trade.type === "SHORT" && latest <= trade.tp1)
          ) {
            trade.partial = true;
            trade.sl = trade.entry;
          }
        }

        // TRAIL
        if (trade.partial) {
          if (trade.type === "LONG") {
            trade.sl = Math.max(trade.sl, latest * 0.995);
          } else {
            trade.sl = Math.min(trade.sl, latest * 1.005);
          }
        }

        // EXIT
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
          const duration = ((Date.now() - trade.startTime) / 60000).toFixed(1);

          const record = {
            ...trade,
            exit: latest,
            result,
            duration,
          };

          const updatedHistory = [record, ...history].slice(0, 20);

          const updatedStats =
            result === "win"
              ? { ...stats, wins: stats.wins + 1 }
              : { ...stats, losses: stats.losses + 1 };

          setStats(updatedStats);
          setHistory(updatedHistory);

          localStorage.setItem("stats", JSON.stringify(updatedStats));
          localStorage.setItem("history", JSON.stringify(updatedHistory));

          new Notification(result === "win" ? "🎯 TP Hit" : "❌ SL Hit");

          setActiveTrade(null);
        } else {
          setActiveTrade(trade);
        }
      }
    }

    fetchPrice();
    const interval = setInterval(fetchPrice, 5000);
    return () => clearInterval(interval);
  }, [activeTrade, stats, history]);

  const total = stats.wins + stats.losses;
  const winRate = total ? ((stats.wins / total) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-4">
      <h2>Price: {price}</h2>
      <p>Confidence: {confidence}%</p>

      {activeTrade && (
        <div>
          <p>{activeTrade.type}</p>
          <p>Entry: {activeTrade.entry.toFixed(0)}</p>
          <p>SL: {activeTrade.sl.toFixed(0)}</p>
          <p>TP1: {activeTrade.tp1.toFixed(0)}</p>
          <p>Final: {activeTrade.final.toFixed(0)}</p>
          <p>
            Hold: {((Date.now() - activeTrade.startTime) / 60000).toFixed(1)}{" "}
            min
          </p>
        </div>
      )}

      <p>Win Rate: {winRate}%</p>

      <h3>History</h3>
      {history.map((t, i) => (
        <div key={i} className="flex justify-between text-sm">
          <span>{t.type}</span>
          <span>{t.result === "win" ? "🟢" : "🔴"}</span>
          <span>
            {t.entry.toFixed(0)} → {t.exit.toFixed(0)}
          </span>
          <span>{t.confidence}%</span>
          <span>{t.duration}m</span>
        </div>
      ))}
    </div>
  );
}
