"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type TopItemsData = {
  name: string;
  quantity: number;
};

type TopItemsChartProps = {
  data: TopItemsData[];
};

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
  padding: "10px 14px",
  boxShadow: "var(--shadow-elevated)",
};

export function TopItemsChart({ data }: TopItemsChartProps) {
  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 12, bottom: 4, left: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          className="fill-muted-foreground"
        />
        <YAxis
          dataKey="name"
          type="category"
          width={110}
          tick={{ fontSize: 11, width: 105 }}
          tickLine={false}
          axisLine={false}
          className="fill-muted-foreground"
        />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "currentColor", fillOpacity: 0.04 }}
          formatter={(value) => [value, "Total moved"]}
        />
        <Bar
          dataKey="quantity"
          name="Total moved"
          fill="var(--chart-info, #3b82f6)"
          radius={[0, 6, 6, 0]}
          maxBarSize={28}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
