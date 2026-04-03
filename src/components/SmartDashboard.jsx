import { useEffect, useState } from "react";
import { getLiquidation, getOI, getFunding } from "../services/api";

// 🔊 SOUND
const alertSound = new Audio("/alert.mp3");

// 🔥 SIGNAL ENGINE (same)
function calculateSignal(liqData, oiData, frData) {
  const latestLiq = liqData.at(-1);
  const last3OI = oiData.slice(-3);
  const latestFR = frData.at(-1);

  const longLiq = Number(latestLiq.aggregated_long_liquidation_usd);
  const shortLiq = Number(latestLiq.aggregated_short_liquidation_usd);

  const oiTrendUp = Number(last3OI[2].close) > Number(last3OI[0].close);

  const frValue = Number(latestFR.close || latestFR.funding_rate);

  let score = 0;
  let reasons = [];

  const liqRatio =
    shortLiq > longLiq ? shortLiq / (longLiq + 1) : longLiq / (shortLiq + 1);

  if (shortLiq > longLiq) {
    score += Math.min(40, liqRatio * 10);
    reasons.push("Short liquidation dominance");
  } else {
    score -= Math.min(40, liqRatio * 10);
    reasons.push("Long liquidation dominance");
  }

  if (oiTrendUp) {
    score += 20;
    reasons.push("OI increasing");
  } else {
    score -= 15;
    reasons.push("OI decreasing");
  }

  if (frValue < 0) {
    score += 15;
    reasons.push("Funding negative");
  } else {
    score -= 10;
    reasons.push("Funding positive");
  }

  let signal = "⚖️ NEUTRAL";
  if (score >= 35) signal = "🚀 SHORT SQUEEZE";
  else if (score <= -35) signal = "📉 LONG LIQUIDATION";

  let confidence = Math.abs(score);
  confidence = Math.min(95, Math.max(55, confidence));

  return {
    signal,
    confidence: Math.round(confidence),
    reasons,
  };
}

const TIMEFRAMES = ["4h", "1d", "1w"];

export default function SmartDashboard() {
  const [signals, setSignals] = useState({});
  const [lastAlert, setLastAlert] = useState("");

  useEffect(() => {
    if ("Notification" in window) {
      Notification.requestPermission();
    }
  }, []);

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

          const liqData = liq?.data?.data || [];
          const oiData = oi?.data?.data || [];
          const frData = fr?.data?.data || [];

          if (!liqData.length || !oiData.length || !frData.length) continue;

          results[tf] = calculateSignal(liqData, oiData, frData);
        } catch (err) {
          console.error(`Error ${tf}`, err);
        }
      }

      setSignals(results);

      // 🔥 FINAL BIAS
      let totalScore = 0;

      Object.entries(results).forEach(([tf, s]) => {
        const weight = tf === "1w" ? 3 : tf === "1d" ? 2 : 1;

        if (s.signal.includes("SHORT")) {
          totalScore += weight * s.confidence;
        } else if (s.signal.includes("LONG")) {
          totalScore -= weight * s.confidence;
        }
      });

      let finalSignal = "⚖️ NEUTRAL";

      if (totalScore > 100) finalSignal = "🚀 STRONG BULLISH";
      else if (totalScore > 50) finalSignal = "🚀 BULLISH";
      else if (totalScore < -100) finalSignal = "📉 STRONG BEARISH";
      else if (totalScore < -50) finalSignal = "📉 BEARISH";

      if (finalSignal !== lastAlert && finalSignal !== "⚖️ NEUTRAL") {
        if (Notification.permission === "granted") {
          new Notification(`🚨 ${finalSignal}`, {
            body: "Multi-timeframe signal detected",
          });
        }
        alertSound.play().catch(() => {});
        setLastAlert(finalSignal);
      }
    }

    fetchAll();
    const interval = setInterval(fetchAll, 15000);
    return () => clearInterval(interval);
  }, [lastAlert]);

  return (
    <div className="space-y-5">
      {/* 🔥 HERO CARD */}
      <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-xl hover:scale-[1.02] transition">
        <h2 className="text-2xl font-bold tracking-wide">
          ⚡ Smart Money Signal
        </h2>

        <p className="text-gray-400 text-sm mt-2">
          Multi-timeframe AI analysis
        </p>
      </div>

      {/* 📊 CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {TIMEFRAMES.map((tf) => {
          const s = signals[tf];
          if (!s) return null;

          return (
            <div
              key={tf}
              className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-4 shadow-md hover:shadow-xl hover:-translate-y-1 transition duration-300"
            >
              <p className="text-xs text-gray-400 mb-1">{tf.toUpperCase()}</p>

              <h3 className="text-lg font-semibold mb-1">{s.signal}</h3>

              <p className="text-xs text-gray-400">
                Confidence: {s.confidence}%
              </p>

              <div className="mt-2 text-xs text-gray-500 space-y-1">
                {s.reasons.map((r, i) => (
                  <p key={i}>• {r}</p>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
