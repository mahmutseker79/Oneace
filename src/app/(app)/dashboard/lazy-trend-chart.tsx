"use client";

import dynamic from "next/dynamic";

import type { TrendPoint } from "./movement-trend-chart";

const MovementTrendChart = dynamic(
  () => import("./movement-trend-chart").then((mod) => mod.MovementTrendChart),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
        Loading chart...
      </div>
    ),
  },
);

type LazyTrendChartProps = {
  data: TrendPoint[];
  labels: { receipts: string; issues: string; other: string };
};

export function LazyTrendChart({ data, labels }: LazyTrendChartProps) {
  return <MovementTrendChart data={data} labels={labels} />;
}
