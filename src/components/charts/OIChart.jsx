import { useEffect, useRef } from "react";
import { createChart, HistogramSeries } from "lightweight-charts";
import { getOI } from "../services/api";

export default function OIChart() {
  const chartRef = useRef();

  useEffect(() => {
    async function loadChart() {
      const res = await getOI();

      const data = (res?.data?.data || []).map((item) => {
        const value = Number(item.close);

        return {
          time: item.time / 1000,
          value,
          color: "#facc15", // yellow
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

      const series = chart.addSeries(HistogramSeries, {});

      series.setData(data);

      chart.timeScale().fitContent();
    }

    loadChart();
  }, []);

  return (
    <div className="bg-[#111827] rounded-xl p-2">
      <div className="text-xs text-gray-400 mb-1">OI</div>
      <div ref={chartRef} />
    </div>
  );
}