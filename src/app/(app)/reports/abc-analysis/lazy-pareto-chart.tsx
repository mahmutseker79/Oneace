"use client";

import dynamic from "next/dynamic";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface ParetoChartProps {
  data: Array<{
    name: string;
    value: number;
    cumulativePercent: number;
  }>;
}

// Wrap heavy chart content in lazy-loaded boundary
const LazyParetoChart = dynamic(
  () =>
    Promise.resolve(({ data }: ParetoChartProps) => (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data.slice(0, 50)}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
          <Legend />
          <Line
            type="monotone"
            dataKey="cumulativePercent"
            stroke="hsl(221, 83%, 53%)"
            dot={false}
            name="Cumulative %"
          />
        </LineChart>
      </ResponsiveContainer>
    )),
  {
    ssr: false,
    loading: () => <div className="h-[300px] bg-muted animate-pulse rounded" />,
  },
);

export function ParetoChart({ data }: ParetoChartProps) {
  return <LazyParetoChart data={data} />;
}
