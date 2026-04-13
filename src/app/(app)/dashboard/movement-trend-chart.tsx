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
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="day"
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
        />
        <Bar
          dataKey="receipts"
          name={labels.receipts}
          fill="hsl(142, 71%, 45%)"
          radius={[2, 2, 0, 0]}
        />
        <Bar dataKey="issues" name={labels.issues} fill="hsl(0, 84%, 60%)" radius={[2, 2, 0, 0]} />
        <Bar dataKey="other" name={labels.other} fill="hsl(221, 83%, 53%)" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
