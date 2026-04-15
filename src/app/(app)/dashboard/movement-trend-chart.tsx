"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type TrendPoint = {
  day: string;
  receipts: number;
  issues: number;
  other: number;
};

type MovementTrendChartProps = {
  data: TrendPoint[];
  labels: {
    receipts: string;
    issues: string;
    other: string;
  };
};

export function MovementTrendChart({ data, labels }: MovementTrendChartProps) {
  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
        <XAxis
          dataKey="day"
          tickFormatter={(v: string) => v.slice(5)}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          className="fill-muted-foreground"
        />
        <YAxis
          fontSize={11}
          allowDecimals={false}
          tick={{ fontSize: 11 }}
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
          formatter={(value) => [value, ""]}
        />
        <Bar
          dataKey="receipts"
          name={labels.receipts}
          fill="hsl(142, 71%, 45%)"
          radius={[4, 4, 0, 0]}
        />
        <Bar dataKey="issues" name={labels.issues} fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="other" name={labels.other} fill="hsl(221, 83%, 53%)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
