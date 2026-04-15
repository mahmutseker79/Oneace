"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type TopItemsData = {
  name: string;
  quantity: number;
};

type TopItemsChartProps = {
  data: TopItemsData[];
};

export function TopItemsChart({ data }: TopItemsChartProps) {
  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 4, bottom: 4, left: 120 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
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
          width={115}
          tick={{ fontSize: 11, width: 110 }}
          tickLine={false}
          axisLine={false}
          className="fill-muted-foreground"
        />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
            padding: "8px 12px",
          }}
          labelFormatter={(v) => String(v)}
          formatter={(value) => [value, "Total moved"]}
        />
        <Bar
          dataKey="quantity"
          name="Total moved"
          fill="hsl(221, 83%, 53%)"
          radius={[0, 4, 4, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
