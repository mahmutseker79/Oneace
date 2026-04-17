"use client";

import dynamic from "next/dynamic";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface DistributionChartProps {
  data: Array<{
    name: string;
    count: number;
    value: number;
  }>;
}

// Wrap heavy chart content in lazy-loaded boundary
const LazyDistributionChart = dynamic(
  () => Promise.resolve(({ data }: DistributionChartProps) => (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis
          yAxisId="left"
          label={{ value: "Count", angle: -90, position: "insideLeft" }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          label={{ value: "Value", angle: 90, position: "insideRight" }}
        />
        <Tooltip />
        <Legend />
        <Bar yAxisId="left" dataKey="count" fill="hsl(221, 83%, 53%)" name="Item Count" />
        <Bar yAxisId="right" dataKey="value" fill="hsl(142, 71%, 45%)" name="Total Value" />
      </BarChart>
    </ResponsiveContainer>
  )),
  {
    ssr: false,
    loading: () => <div className="h-[300px] bg-muted animate-pulse rounded" />,
  }
);

export function DistributionChart({ data }: DistributionChartProps) {
  return <LazyDistributionChart data={data} />;
}
