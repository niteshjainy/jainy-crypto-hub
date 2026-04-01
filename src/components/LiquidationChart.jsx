import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { formatLiquidation } from "../utils/formatLiquidation";
import { useEffect, useState } from "react";
import { getLiquidation } from "../services/api";

export default function LiquidationChart() {
  const [data, setData] = useState([]);

  useEffect(() => {
    async function fetchData() {
      const res = await getLiquidation();
      const formatted = formatLiquidation(res.data.data);
      setData(formatted);
    }

    fetchData();
  }, []);

  return (
   <div className="bg-[#111827] rounded-2xl p-4 h-[250px]">
    <h3 className="text-gray-300 mb-2">📉 Liquidation</h3>

    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <XAxis dataKey="time" hide />
        <YAxis />
        <Tooltip />
        <Bar dataKey="long" fill="#ef4444" />
        <Bar dataKey="short" fill="#22c55e" />
      </BarChart>
    </ResponsiveContainer>
  </div>
);
}