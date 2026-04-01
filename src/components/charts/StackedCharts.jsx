import { useRef, useEffect, useState } from "react";
import {
  createChart,
  LineSeries,
  HistogramSeries,
  CandlestickSeries,
} from "lightweight-charts";
import useSyncedCharts from "../hooks/useSyncedCharts";
import { getCVD, getOI, getPrice } from "../../services/api";

const TIMEFRAMES = ["4h", "1d", "1w"];

export default function StackedCharts() {
  const priceRef = useRef();
  const oiRef = useRef();
  const cvdRef = useRef();

  const [charts, setCharts] = useState([]);
  const [interval, setInterval] = useState("4h");

  useSyncedCharts(charts);

  useEffect(() => {
    async function loadCharts() {
      const [priceRes, oiRes, cvdRes] = await Promise.all([
        getPrice(interval),
        getOI(interval),
        getCVD(interval),
      ]);

      // ✅ SORT DATA
      const priceRaw = priceRes.data.data.sort((a, b) => a.time - b.time);
      const oiRaw = oiRes.data.data.sort((a, b) => a.time - b.time);
      const cvdRaw = cvdRes.data.data.sort((a, b) => a.time - b.time);

      // 🔥 PRICE AS MASTER TIMELINE
      const priceData = priceRaw.map((i) => ({
        time: i.time / 1000,
        open: Number(i.open),
        high: Number(i.high),
        low: Number(i.low),
        close: Number(i.close),
      }));

      // 🔥 FAST LOOKUP MAPS
      const oiMap = Object.fromEntries(oiRaw.map((i) => [i.time, i]));
      const cvdMap = Object.fromEntries(cvdRaw.map((i) => [i.time, i]));

      // 🔥 ALIGN OI WITH PRICE
      const alignedOI = priceRaw.map((p) => {
        const match = oiMap[p.time];
        return {
          time: p.time / 1000,
          value: match ? Number(match.close) : null,
        };
      });

      const alignedCVD = priceRaw.map((p) => {
  const match = cvdMap[p.time];

  // 🔥 SCALE DOWN VALUE
  const rawValue = match
    ? Number(match.agg_taker_buy_vol) -
      Number(match.agg_taker_sell_vol)
    : 0;

  const value = rawValue / 1e6; // 👉 convert to Millions

  return {
    time: p.time / 1000,
    value,
    color: value >= 0 ? "#22c55e" : "#ef4444",
  };
});

      // 🧹 CLEAN
      priceRef.current.innerHTML = "";
      oiRef.current.innerHTML = "";
      cvdRef.current.innerHTML = "";

      const commonOptions = {
        layout: {
          background: { color: "#0b0f17" },
          textColor: "#aaa",
        },
        crosshair: {
  mode: 1,
},
        grid: {
          vertLines: { color: "#1f2937" },
          horzLines: { color: "#1f2937" },
        },
        timeScale: {
          borderColor: "#333",
          timeVisible: true,
        },
        handleScroll: {
  mouseWheel: true,
  pressedMouseMove: true,
},
handleScale: {
  axisPressedMouseMove: true,
  mouseWheel: true,
  pinch: true,
},
      };

      // 🔥 CREATE CHARTS
      const priceChart = createChart(priceRef.current, {
        ...commonOptions,
        height: 450,
      });

      const oiChart = createChart(oiRef.current, {
        ...commonOptions,
        height: 200,
      });

      const cvdChart = createChart(cvdRef.current, {
        ...commonOptions,
        height: 200,
      });

      // 🔥 SERIES
      const priceSeries = priceChart.addSeries(CandlestickSeries, {
        upColor: "#22c55e",
        downColor: "#ef4444",
        borderUpColor: "#22c55e",
        borderDownColor: "#ef4444",
        wickUpColor: "#22c55e",
        wickDownColor: "#ef4444",
      });

      const oiSeries = oiChart.addSeries(LineSeries, {
        color: "#facc15",
        lineWidth: 2,
        priceFormat: {
          type: "custom",
          formatter: (value) => (value / 1e9).toFixed(2) + "B",
        },
      });

      const cvdSeries = cvdChart.addSeries(HistogramSeries, {
  base: 0,
  priceFormat: {
    type: "custom",
    formatter: (v) => v.toFixed(2) + "M",
  },
});

      // 🔥 SET DATA
      priceSeries.setData(priceData);
      oiSeries.setData(alignedOI);
      cvdSeries.setData(alignedCVD);

      // 🔥 PERFECT SYNC
      priceChart.timeScale().fitContent();

      setTimeout(() => {
        const range = priceChart.timeScale().getVisibleLogicalRange();
        oiChart.timeScale().setVisibleLogicalRange(range);
        cvdChart.timeScale().setVisibleLogicalRange(range);
      }, 0);

      setCharts([priceChart, oiChart, cvdChart]);
    }

    loadCharts();
  }, [interval]);

  return (
    <div className="bg-[#0b0f17] p-4 rounded-xl border border-gray-800">

      {/* 🔥 TIMEFRAME BUTTONS */}
      <div className="flex gap-2 mb-4">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            onClick={() => setInterval(tf)}
            className={`px-3 py-1 rounded-lg text-sm ${
              interval === tf
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                : "bg-gray-800 text-gray-400"
            }`}
          >
            {tf.toUpperCase()}
          </button>
        ))}
      </div>

      {/* 🔥 STACKED CHARTS */}
      <div className="flex flex-col gap-3">
        <div className="h-[300px] md:h-[450px]" ref={priceRef} />
      <div className="h-[150px] md:h-[200px]" ref={oiRef} />
      <div className="h-[150px] md:h-[200px]" ref={cvdRef} />
      </div>
    </div>
  );
}