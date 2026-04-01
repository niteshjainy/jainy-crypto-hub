import { useEffect, useRef, useState } from "react";
import { createChart, CandlestickSeries } from "lightweight-charts";
import { getPrice } from "../services/api";

const TIMEFRAMES = ["4h", "1d", "1w"];

export default function PriceChart() {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const seriesRef = useRef(null);

  const [interval, setInterval] = useState("4h");

  useEffect(() => {
    async function loadChart() {
      const res = await getPrice(interval);

      let rawData = res?.data?.data || [];

      // 🔥 IMPORTANT: sort data (most critical bug fix)
      rawData = rawData.sort((a, b) => a.time - b.time);

      const data = rawData
        .map((item) => ({
          time: item.time / 1000,
          open: Number(item.open),
          high: Number(item.high),
          low: Number(item.low),
          close: Number(item.close),
        }))
        .filter(
          (d) =>
            !isNaN(d.open) &&
            !isNaN(d.high) &&
            !isNaN(d.low) &&
            !isNaN(d.close)
        );

      // 🧹 remove old chart properly
      if (chartInstance.current) {
        chartInstance.current.remove();
        chartInstance.current = null;
      }

      const chart = createChart(chartRef.current, {
        width: chartRef.current.clientWidth, // 🔥 FIX WIDTH
        height: 400,
        layout: {
          background: { color: "#0b0f17" },
          textColor: "#aaa",
        },
        grid: {
          vertLines: { color: "#1f2937" },
          horzLines: { color: "#1f2937" },
        },
        timeScale: {
          borderColor: "#333",
          timeVisible: true,
        },
        rightPriceScale: {
          borderColor: "#333",
        },
      });

      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: "#22c55e",
        downColor: "#ef4444",
        borderUpColor: "#22c55e",
        borderDownColor: "#ef4444",
        wickUpColor: "#22c55e",
        wickDownColor: "#ef4444",
      });

      candleSeries.setData(data);

      chart.timeScale().fitContent();

      // 🔥 resize fix
      window.addEventListener("resize", () => {
        chart.applyOptions({
          width: chartRef.current.clientWidth,
        });
      });

      chartInstance.current = chart;
      seriesRef.current = candleSeries;
    }

    loadChart();
  }, [interval]);

  return (
    <div className="bg-[#111827] rounded-2xl p-4">

      {/* 🔥 TIMEFRAME BUTTONS */}
      <div className="flex gap-2 mb-3">
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

      {/* 📊 CHART */}
      <div ref={chartRef} style={{ width: "100%" }} />
    </div>
  );
}