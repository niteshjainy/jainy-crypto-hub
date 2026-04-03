import { useRef, useEffect, useState } from "react";
import {
  createChart,
  LineSeries,
  CandlestickSeries,
} from "lightweight-charts";
import useSyncedCharts from "../hooks/useSyncedCharts";
import { getOI, getPrice, getLiquidation } from "../../services/api";

const TIMEFRAMES = ["4h", "1d", "1w"];

export default function StackedCharts({ onReady }) {
  const priceRef = useRef();
  const oiRef = useRef();

  const [charts, setCharts] = useState([]);
  const [interval, setInterval] = useState("4h");

  useSyncedCharts(charts);

  useEffect(() => {
    async function loadCharts() {
      const [priceRes, oiRes, liqRes] = await Promise.all([
        getPrice(interval),
        getOI(interval),
        getLiquidation(interval),
      ]);

      // ✅ SAFE DATA
      const priceRaw = priceRes?.data?.data || [];
      const oiRaw = oiRes?.data?.data || [];
      const liqRaw = liqRes?.data?.data || [];

      console.log("🔥 LIQ RAW SAMPLE:", liqRaw[0]);

      if (!priceRaw.length || !oiRaw.length) {
        console.error("Chart API error");
        return;
      }

      const sortedPrice = priceRaw.sort((a, b) => a.time - b.time);
      const sortedOI = oiRaw.sort((a, b) => a.time - b.time);

      const priceData = sortedPrice.map((i) => ({
        time: i.time / 1000,
        open: Number(i.open),
        high: Number(i.high),
        low: Number(i.low),
        close: Number(i.close),
      }));

      const oiMap = Object.fromEntries(
        sortedOI.map((i) => [i.time, i])
      );

      const alignedOI = sortedPrice.map((p) => {
        const match = oiMap[p.time];
        return {
          time: p.time / 1000,
          value: match ? Number(match.close) : null,
        };
      });

      priceRef.current.innerHTML = "";
      oiRef.current.innerHTML = "";

      const commonOptions = {
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
          borderColor: "#333",
          timeVisible: true,
        },
      };

      const priceChart = createChart(priceRef.current, {
        ...commonOptions,
        height: 450,
      });

      const oiChart = createChart(oiRef.current, {
        ...commonOptions,
        height: 200,
      });

      const priceSeries = priceChart.addSeries(CandlestickSeries, {
        upColor: "#22c55e",
        downColor: "#ef4444",
      });

      const oiSeries = oiChart.addSeries(LineSeries, {
        color: "#facc15",
        lineWidth: 2,
      });

      priceSeries.setData(priceData);
      oiSeries.setData(alignedOI);

      priceChart.timeScale().fitContent();

      setTimeout(() => {
        const range = priceChart.timeScale().getVisibleLogicalRange();
        oiChart.timeScale().setVisibleLogicalRange(range);
      }, 0);

      // 🔥 SYNC
      if (onReady) {
        onReady(priceChart);
        onReady(oiChart);
      }

      setCharts([priceChart, oiChart]);
    }

    loadCharts();
  }, [interval]);

  return (
    <div className="bg-[#0b0f17] p-4 rounded-xl border border-gray-800">
      <div className="flex gap-2 mb-4">
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

      <div className="flex flex-col gap-3">
        <div className="h-[300px]" ref={priceRef} />
        <div className="h-[150px]" ref={oiRef} />
      </div>
    </div>
  );
}