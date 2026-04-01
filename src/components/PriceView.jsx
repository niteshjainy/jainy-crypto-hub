import StackedCharts from "./charts/StackedCharts";

export default function PriceView() {
  return (
    <div className="bg-[#0b0f17] text-white min-h-screen p-4">
      
      <h1 className="text-xl font-bold mb-4">
        🚀 Smart Money Dashboard
      </h1>

      <StackedCharts />
      
    </div>
  );
}