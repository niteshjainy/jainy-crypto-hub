import { useEffect, useState } from "react";
import {
  getLiquidation,
  getOI,
  getFunding,
  getCVD,
} from "../../services/api";
import { getSignal } from "../../utils/signalEngine";

export default function SignalPanel() {
  const [signal, setSignal] = useState("Loading...");
  const [prevSignal, setPrevSignal] = useState("");
  const [stats, setStats] = useState({});

  useEffect(() => {
    async function fetchData() {
      try {
        const [liq, oi, fr, cvd] = await Promise.all([
          getLiquidation(),
          getOI(),
          getFunding(),
          getCVD(),
        ]);

        const liqData = liq?.data?.data || [];
        const oiData = oi?.data?.data || [];
        const frData = fr?.data?.data || [];
        const cvdData = cvd?.data?.data || [];

        // ✅ safety check
        if (
          liqData.length < 1 ||
          oiData.length < 3 ||
          frData.length < 1 ||
          cvdData.length < 3
        ) {
          setSignal("Loading...");
          return;
        }

        const latestLiq = liqData.at(-1);
        const latestFR = frData.at(-1);

        // 🔥 OI TREND (smarter)
        const last3OI = oiData.slice(-3);
        const oiTrendUp =
          Number(last3OI[2].close) >
          Number(last3OI[0].close);

        // 🔥 CVD TREND (smarter)
        const last3CVD = cvdData.slice(-3);
        const cvdTrendUp =
          Number(last3CVD[2].close) >
          Number(last3CVD[0].close);

        // 🔥 LIQUIDATION
        const longLiq = Number(
          latestLiq.aggregated_long_liquidation_usd
        );

        const shortLiq = Number(
          latestLiq.aggregated_short_liquidation_usd
        );

        // 🔥 FUNDING
        const frValue = Number(
          latestFR.close || latestFR.funding_rate
        );

        // 🔥 FINAL SIGNAL
        const result = getSignal({
          fr: frValue,
          oiTrendUp,
          cvdTrendUp,
          longLiq,
          shortLiq,
        });

        setSignal(result);

        // 📊 STATS (UI friendly)
        setStats({
          fr: (frValue * 100).toFixed(3),
          longLiq: (longLiq / 1e6).toFixed(2) + "M",
          shortLiq: (shortLiq / 1e6).toFixed(2) + "M",
          oi: oiTrendUp ? "↑" : "↓",
          cvd: cvdTrendUp ? "↑" : "↓",
        });
      } catch (err) {
        console.error("Signal error:", err);
        setSignal("Error");
      }
    }

    fetchData();

    const interval = setInterval(fetchData, 10000); // ✅ safe refresh

    return () => clearInterval(interval);
  }, []);

  // 🔔 ALERT SYSTEM
  useEffect(() => {
    if (signal !== prevSignal && prevSignal !== "") {
      console.log("New Signal:", signal);
      // ⚠️ optional alert (can disable later)
      // alert(`🚨 ${signal}`);
    }
    setPrevSignal(signal);
  }, [signal]);

  return (
  <div className="bg-[#0b0f17] border border-gray-800 rounded-xl p-4">

    <div className="flex justify-between items-center">

      <div>
        <h3 className="text-gray-400 text-sm">Smart Signal</h3>
        <h2 className="text-3xl font-bold mt-1">{signal}</h2>
      </div>

      <div className="text-right text-sm text-gray-400 space-y-1">
        <p>FR: {stats.fr}%</p>
        <p>OI: {stats.oiTrend}</p>
        <p>CVD: {stats.cvdTrend}</p>
      </div>

    </div>
  </div>
);
}