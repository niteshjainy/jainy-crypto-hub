import { useEffect, useState } from "react";
import useSyncedCharts from "./components/hooks/useSyncedCharts";
import SmartDashboard from "./components/SmartDashboard";
import MiniChart from "./components/MiniChart";

export default function App() {
  const [charts, setCharts] = useState([]);

  useSyncedCharts(charts);

  const handleChartReady = (chart) => {
    setCharts((prev) => {
      if (prev.includes(chart)) return prev;
      return [...prev, chart];
    });
  };

  return (
    <div className="bg-[#020617] min-h-screen text-white px-3 py-4 md:px-6">

      {/* 🔥 HEADER */}
      <div className="mb-4">
        <h1 className="text-xl md:text-2xl font-bold">
          🚀 Smart Money Dashboard
        </h1>
        <p className="text-gray-400 text-sm">
          Real-time Smart Money Signals
        </p>
      </div>

      {/* 📊 OPTIONAL MINI CHART */}
      <div className="mb-4 bg-[#0b0f17] rounded-xl border border-gray-800 p-2">
        <MiniChart onReady={handleChartReady} />
      </div>

      {/* 🧠 MAIN DASHBOARD */}
      <div className="mb-6">
        <SmartDashboard />
      </div>

    </div>
  );
}