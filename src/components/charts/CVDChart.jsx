import { useEffect, useRef } from "react";
import { createChart, HistogramSeries } from "lightweight-charts";
import { getCVD } from "../services/api";

export default function CVDChart() {
  const chartRef = useRef();

  useEffect(() => {
    async function loadChart() {
      const res = await getCVD();

      const data = (res?.data?.data || []).map((item) => {
        const value = Number(item.cum_vol_delta);

        return {
          time: item.time / 1000,
          value,
          color: value >= 0 ? "#22c55e" : "#ef4444", // 🔥 green/red
        };
      });

      chartRef.current.innerHTML = "";

      const chart = createChart(chartRef.current, {
        height: 150,
        layout: {
          background: { color: "#0b0f17" },
          textColor: "#aaa",
        },
        grid: {
          vertLines: { color: "#1f2937" },
          horzLines: { color: "#1f2937" },
        },
      });

      const series = chart.addSeries(HistogramSeries, {
        priceFormat: {
          type: "custom",
          formatter: (p) => (p / 1e6).toFixed(2) + "M",
        },
      });

      series.setData(data);

      chart.timeScale().fitContent();
    }

    loadChart();
  }, []);

  return (
    <div className="bg-[#111827] rounded-xl p-2">
      <div className="text-xs text-gray-400 mb-1">CVD</div>
      <div ref={chartRef} />
    </div>
  );
}