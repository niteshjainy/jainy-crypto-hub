import { useEffect, useRef, useState } from "react";
import { createChart, HistogramSeries } from "lightweight-charts";
import { getLiquidation } from "../../services/api";

const TIMEFRAMES = ["4h", "1d", "1w"];

export default function LiquidationMapPro() {
  const chartRef = useRef();
  const [interval, setInterval] = useState("4h");

  useEffect(() => {
    async function load() {
      const res = await getLiquidation(interval);
      const liqData = res?.data?.data || [];

      // 🔥 CLEAN DATA (NO CONFUSION)
      const longData = [];
      const shortData = [];

      liqData.forEach((i) => {
        const time = i.time / 1000;

        longData.push({
          time,
          value: Number(i.aggregated_long_liquidation_usd) / 1e6,
          color: "#ef4444",
        });

        shortData.push({
          time,
          value: Number(i.aggregated_short_liquidation_usd) / 1e6,
          color: "#22c55e",
        });
      });

      // 🧹 CLEAN
      chartRef.current.innerHTML = "";

      const chart = createChart(chartRef.current, {
        height: 400,
        layout: {
          background: { color: "#0b0f17" },
          textColor: "#aaa",
        },
        grid: {
          vertLines: { color: "#1f2937" },
          horzLines: { color: "#1f2937" },
        },
        crosshair: {
          mode: 1, // 🔥 vertical line
        },
        timeScale: {
          timeVisible: true,
        },
        handleScroll: true,
        handleScale: true,
      });

      const longSeries = chart.addSeries(HistogramSeries);
      const shortSeries = chart.addSeries(HistogramSeries);

      longSeries.setData(longData);
      shortSeries.setData(shortData);

      chart.timeScale().fitContent();
    }

    load();
  }, [interval]);

  return (
    <div>

      {/* HEADER */}
      <div className="flex justify-between mb-3">
        <h3 className="text-gray-400 text-sm">
          🔥 Liquidation Map
        </h3>

        <div className="flex gap-2">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setInterval(tf)}
              className={`px-3 py-1 rounded-lg text-sm ${
                interval === tf
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400"
              }`}
            >
              {tf.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* CHART */}
      <div ref={chartRef} />
    </div>
  );
}