"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

// Premium color palette — harmonious, accessible, dark-mode friendly
const COLORS = [
  "var(--chart-info, #3b82f6)",
  "var(--chart-success, #10b981)",
  "var(--chart-danger, #ef4444)",
  "var(--chart-warning, #f59e0b)",
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#f97316", // orange
  "#ec4899", // pink
  "#eab308", // yellow
  "#14b8a6", // teal
];

export type CategoryValueData = {
  category: string;
  value: number;
};

type CategoryValueChartProps = {
  data: CategoryValueData[];
};

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
  padding: "10px 14px",
  boxShadow: "var(--shadow-elevated)",
};

export function CategoryValueChart({ data }: CategoryValueChartProps) {
  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value) => {
            if (typeof value === "number") {
              return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
            }
            return value;
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
          verticalAlign="bottom"
          height={36}
          iconType="circle"
          iconSize={8}
        />
        <Pie
          data={data}
          cx="50%"
          cy="45%"
          innerRadius="45%"
          outerRadius="75%"
          paddingAngle={2}
          dataKey="value"
          nameKey="category"
          label={(entry: any) => {
            const percent = entry.percent ?? 0;
            return percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : "";
          }}
          labelLine={false}
          strokeWidth={2}
          stroke="var(--card)"
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}
