"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type LowStockTrendPoint = {
  date: string;
  count: number;
};

type LowStockTrendChartProps = {
  data: LowStockTrendPoint[];
};

export function LowStockTrendChart({ data }: LowStockTrendChartProps) {
  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="date"
          tickFormatter={(v: string) => v.slice(5)} // "MM-DD"
          fontSize={11}
          className="fill-muted-foreground"
        />
        <YAxis fontSize={11} allowDecimals={false} className="fill-muted-foreground" />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelFormatter={(v) => String(v)}
          formatter={(value) => [`${value} items`, "Below reorder point"]}
        />
        <Area
          type="monotone"
          dataKey="count"
          name="Below reorder point"
          fill="url(#colorCount)"
          stroke="hsl(0, 84%, 60%)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
