import StackedCharts from "./components/charts/StackedCharts";
import SignalPanel from "./components/panels/SignalPanel";
import LiquidationMapPro from "./components/charts/LiquidationMapPro";

export default function App() {
  return (
    <div className="bg-[#020617] min-h-screen text-white p-4">

      {/* HEADER */}
      <h1 className="text-2xl font-bold mb-4">
        🚀 Smart Money Dashboard
      </h1>

      {/* SIGNAL */}
      <div className="mb-4">
        <SignalPanel />
      </div>

      {/* CHART SECTION (SCROLL FIX) */}
      <div className="mb-6 bg-[#0b0f17] p-3 rounded-xl border border-gray-800 overflow-x-auto">
        <StackedCharts />
      </div>

      {/* LIQUIDATION MAP */}
      <div className="mb-6 bg-[#0b0f17] p-3 rounded-xl border border-gray-800 overflow-x-auto">
        <LiquidationMapPro />
      </div>

    </div>
  );
}