import { useEffect, useRef } from "react";
import { createChart, CandlestickSeries } from "lightweight-charts";
import { getPrice } from "../services/api";

export default function MiniChart({ onReady }) {
  const chartRef = useRef();

  useEffect(() => {
    async function load() {
      const res = await getPrice("4h");
      const raw = res?.data?.data || [];

      if (!raw.length) return;

      const data = raw.map((i) => ({
        time: i.time / 1000,
        open: Number(i.open),
        high: Number(i.high),
        low: Number(i.low),
        close: Number(i.close),
      }));

      chartRef.current.innerHTML = "";

      const chart = createChart(chartRef.current, {
        height: 200,
        layout: {
          background: { color: "#0b0f17" },
          textColor: "#aaa",
        },
        grid: {
          vertLines: { color: "#1f2937" },
          horzLines: { color: "#1f2937" },
        },
      });

      const series = chart.addSeries(CandlestickSeries, {
        upColor: "#22c55e",
        downColor: "#ef4444",
      });

      series.setData(data);
      chart.timeScale().fitContent();

      if (onReady) onReady(chart);
    }

    load();
  }, []);

  return <div className="h-[200px]" ref={chartRef} />;
}