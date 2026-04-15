"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
  padding: "10px 14px",
  boxShadow: "var(--shadow-elevated)",
};

export function MovementTrendChart({ data, labels }: MovementTrendChartProps) {
  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} vertical={false} />
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
          width={40}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "currentColor", fillOpacity: 0.04 }}
          labelFormatter={(v) => String(v)}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          iconType="circle"
          iconSize={8}
        />
        <Bar
          dataKey="receipts"
          name={labels.receipts}
          fill="var(--chart-receipt, #10b981)"
          radius={[4, 4, 0, 0]}
          maxBarSize={32}
        />
        <Bar
          dataKey="issues"
          name={labels.issues}
          fill="var(--chart-issue, #ef4444)"
          radius={[4, 4, 0, 0]}
          maxBarSize={32}
        />
        <Bar
          dataKey="other"
          name={labels.other}
          fill="var(--chart-other, #6366f1)"
          radius={[4, 4, 0, 0]}
          maxBarSize={32}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
