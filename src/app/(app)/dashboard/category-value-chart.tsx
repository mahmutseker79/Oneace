"use client";

import { Cell, PieChart, Pie, ResponsiveContainer, Tooltip, Legend } from "recharts";

const COLORS = [
  "hsl(221, 83%, 53%)",  // blue
  "hsl(142, 71%, 45%)",  // green
  "hsl(0, 84%, 60%)",    // red
  "hsl(38, 92%, 50%)",   // amber
  "hsl(270, 70%, 50%)",  // purple
  "hsl(180, 60%, 50%)",  // cyan
  "hsl(25, 95%, 53%)",   // orange
  "hsl(340, 82%, 52%)",  // pink
  "hsl(45, 93%, 51%)",   // yellow
  "hsl(200, 100%, 50%)", // light blue
];

export type CategoryValueData = {
  category: string;
  value: number;
};

type CategoryValueChartProps = {
  data: CategoryValueData[];
};

export function CategoryValueChart({ data }: CategoryValueChartProps) {
  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Tooltip
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value) => {
            if (typeof value === "number") {
              return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
            }
            return value;
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12 }}
          verticalAlign="bottom"
          height={36}
        />
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={1}
          dataKey="value"
          nameKey="category"
          label={(entry: any) => {
            const percent = entry.percent ?? 0;
            return `${(percent * 100).toFixed(0)}%`;
          }}
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}
