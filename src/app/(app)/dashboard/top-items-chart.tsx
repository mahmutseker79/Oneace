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
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis type="number" fontSize={11} className="fill-muted-foreground" />
        <YAxis
          dataKey="name"
          type="category"
          width={115}
          fontSize={10}
          className="fill-muted-foreground"
          tick={{ width: 110 }}
        />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelFormatter={(v) => String(v)}
        />
        <Bar
          dataKey="quantity"
          name="Total moved"
          fill="hsl(221, 83%, 53%)"
          radius={[0, 2, 2, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
