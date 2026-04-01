import { useEffect, useState } from "react";
import { getFunding } from "../services/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

export default function FundingChart() {
  const [data, setData] = useState([]);

  useEffect(() => {
    async function fetchData() {
      const res = await getFunding();

      const formatted = (res?.data?.data || []).map((item) => ({
        time: new Date(item.time).toLocaleString(),
        fr: Number(item.close) * 100
      }));

      setData(formatted);
    }

    fetchData();
  }, []);

  return (
    <div style={{ flex: 1, background: "#111", padding: "10px", color: "#fff" }}>
      <h3>Funding Rate (%)</h3>

      <LineChart width={350} height={200} data={data}>
        <XAxis dataKey="time" hide  minTickGap={30}/>

        <YAxis domain={[-1, 1]} />

        <Tooltip />

        <Line
          type="monotone"
          dataKey="fr"
          stroke="#38bdf8"
          dot={false}
        />
      </LineChart>
    </div>
  );
}