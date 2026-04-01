export default function StatsBar({ stats }) {
  return (
    <div className="bg-[#0b0f17] border border-gray-800 rounded-xl p-3 flex justify-between text-sm text-gray-400">

      <div>Funding: {stats.fr}%</div>
      <div>OI Trend: {stats.oiTrend}</div>
      <div>CVD Trend: {stats.cvdTrend}</div>
      <div>Long Liq: {stats.longLiq}</div>
      <div>Short Liq: {stats.shortLiq}</div>

    </div>
  );
}