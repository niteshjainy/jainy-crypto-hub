import { useEffect, useRef, useState } from "react";
import { createChart, HistogramSeries } from "lightweight-charts";
import { getLiquidation } from "../services/api";

export default function LiquidationChart({ interval = "4h", onReady }) {
  const chartRef = useRef();
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
    async function load() {
      const res = await getLiquidation(interval);
     const raw = res?.data?.data || [];

if (!raw.length) {
  console.error("Liquidation API empty:", res);
  return;
}

const sorted = raw.sort((a, b) => a.time - b.time);

      // 🔥 DATA
      const data = sorted.map((i) => {
        const long = Number(i.aggregated_long_liquidation_usd);
        const short = Number(i.aggregated_short_liquidation_usd);

        const value = (short - long) / 1e5;

        return {
          time: i.time / 1000,
          value,
          long,
          short,
          color: value >= 0 ? "#22c55e" : "#ef4444",
        };
      });

      // 🔥 FAST LOOKUP MAP
      const dataMap = Object.fromEntries(
        data.map((d) => [d.time, d])
      );

      chartRef.current.innerHTML = "";

      const chart = createChart(chartRef.current, {
        height: 250,
        layout: {
          background: { color: "#0b0f17" },
          textColor: "#aaa",
        },
        crosshair: { mode: 1 },
        grid: {
          vertLines: { color: "#1f2937" },
          horzLines: { color: "#1f2937" },
        },
        timeScale: {
          timeVisible: true,
        },
      });

      const series = chart.addSeries(HistogramSeries, {
        base: 0,
        priceFormat: {
          type: "custom",
          formatter: (v) => v.toFixed(2) + "M",
        },
      });

      series.setData(data);
      chart.timeScale().fitContent();

      // 🔥 TOOLTIP (FIXED VERSION)
      chart.subscribeCrosshairMove((param) => {
        if (!param.time) {
          setTooltip(null);
          return;
        }

        const point = dataMap[param.time];
        if (!point) return;

        setTooltip({
          time: new Date(param.time * 1000).toLocaleString(),
          long: (point.long / 1e6).toFixed(2),
          short: (point.short / 1e6).toFixed(2),
          net: point.value.toFixed(2),
        });
      });

      if (onReady) onReady(chart);
    }

    load();
  }, [interval]);

  return (
    <div className="bg-[#0b0f17] border border-gray-800 rounded-xl p-3">
      <h3 className="text-gray-400 text-sm mb-2">
        Liquidation Map (🔴 Longs | 🟢 Shorts)
      </h3>

      <div className="h-[200px]" ref={chartRef} />

      {/* 🔥 TOOLTIP UI */}
      {tooltip && (
        <div className="mt-2 p-2 rounded-lg bg-gray-900 border border-gray-700 text-xs space-y-1">
          <p className="text-gray-400">🕒 {tooltip.time}</p>
          <p className="text-red-400">🔴 Long: {tooltip.long}M</p>
          <p className="text-green-400">🟢 Short: {tooltip.short}M</p>
          <p className="text-yellow-400">⚖️ Net: {tooltip.net}</p>
        </div>
      )}
    </div>
  );
}