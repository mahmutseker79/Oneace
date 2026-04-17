"use client";

import dynamic from "next/dynamic";

import type { CategoryValueData } from "./category-value-chart";
import type { LowStockTrendPoint } from "./low-stock-trend-chart";
import type { TopItemsData } from "./top-items-chart";

const TopItemsChart = dynamic(() => import("./top-items-chart").then((mod) => mod.TopItemsChart), {
  ssr: false,
  loading: () => (
    <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
      Loading chart...
    </div>
  ),
});

const CategoryValueChart = dynamic(
  () => import("./category-value-chart").then((mod) => mod.CategoryValueChart),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
        Loading chart...
      </div>
    ),
  },
);

const LowStockTrendChart = dynamic(
  () => import("./low-stock-trend-chart").then((mod) => mod.LowStockTrendChart),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
        Loading chart...
      </div>
    ),
  },
);

type LazyTopItemsChartProps = {
  data: TopItemsData[];
};

type LazyCategoryValueChartProps = {
  data: CategoryValueData[];
};

type LazyLowStockTrendChartProps = {
  data: LowStockTrendPoint[];
};

export function LazyTopItemsChart({ data }: LazyTopItemsChartProps) {
  return <TopItemsChart data={data} />;
}

export function LazyCategoryValueChart({ data }: LazyCategoryValueChartProps) {
  return <CategoryValueChart data={data} />;
}

export function LazyLowStockTrendChart({ data }: LazyLowStockTrendChartProps) {
  return <LowStockTrendChart data={data} />;
}
