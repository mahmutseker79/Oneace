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

interface TrendPoint {
  date: string;
  variance: number;
}

interface TrendChartProps {
  data: TrendPoint[];
}

// Wrap heavy chart content in lazy-loaded boundary
const LazyTrendChart = dynamic(
  () => Promise.resolve(({ data }: TrendChartProps) => (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line
          type="monotone"
          dataKey="variance"
          stroke="hsl(221, 83%, 53%)"
          dot={false}
          name="Variance"
        />
      </LineChart>
    </ResponsiveContainer>
  )),
  {
    ssr: false,
    loading: () => <div className="h-[300px] bg-muted animate-pulse rounded" />,
  }
);

export function VarianceTrendChart({ data }: TrendChartProps) {
  return <LazyTrendChart data={data} />;
}
