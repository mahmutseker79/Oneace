"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type LowStockTrendPoint = {
  date: string;
  count: number;
};

type LowStockTrendChartProps = {
  data: LowStockTrendPoint[];
};

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
  padding: "10px 14px",
  boxShadow: "var(--shadow-elevated)",
};

export function LowStockTrendChart({ data }: LowStockTrendChartProps) {
  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <defs>
          <linearGradient id="lowStockGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--chart-danger, #ef4444)" stopOpacity={0.2} />
            <stop offset="95%" stopColor="var(--chart-danger, #ef4444)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="currentColor"
          strokeOpacity={0.06}
          vertical={false}
        />
        <XAxis
          dataKey="date"
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
          cursor={{ stroke: "var(--border)", strokeDasharray: "3 3" }}
          labelFormatter={(v) => String(v)}
          formatter={(value) => [`${value} items`, "Below reorder point"]}
        />
        <Area
          type="monotone"
          dataKey="count"
          name="Below reorder point"
          fill="url(#lowStockGradient)"
          stroke="var(--chart-danger, #ef4444)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
