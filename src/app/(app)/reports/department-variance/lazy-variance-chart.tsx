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

interface DepartmentVariance {
  departmentId: string;
  departmentName: string;
  itemCount: number;
  variance: number;
  variancePercent: number;
  status: "good" | "warning" | "critical";
}

interface VarianceChartProps {
  data: DepartmentVariance[];
}

// Wrap heavy chart content in lazy-loaded boundary
const LazyVarianceChart = dynamic(
  () =>
    Promise.resolve(({ data }: VarianceChartProps) => (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="departmentName" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="variance" fill="hsl(0, 84%, 60%)" name="Variance Amount" />
          <Bar dataKey="variancePercent" fill="hsl(38, 92%, 50%)" name="Variance %" />
        </BarChart>
      </ResponsiveContainer>
    )),
  {
    ssr: false,
    loading: () => <div className="h-[300px] bg-muted animate-pulse rounded" />,
  },
);

export function VarianceChart({ data }: VarianceChartProps) {
  return <LazyVarianceChart data={data} />;
}
