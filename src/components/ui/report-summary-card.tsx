"use client";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import React from "react";

interface ReportSummaryMetric {
  label: string;
  value: string | number;
  /** Optional trend text like "+12%" or "-3 items" */
  trend?: string;
  /** Positive = green, negative = red, neutral = default */
  trendDirection?: "positive" | "negative" | "neutral";
  icon?: LucideIcon;
}

interface ReportSummaryCardProps {
  metrics: ReportSummaryMetric[];
  className?: string;
}

/**
 * Premium report summary bar — displays 3-4 KPI metrics in a horizontal row.
 * Used above report tables to provide at-a-glance context.
 */
export function ReportSummaryCard({ metrics, className }: ReportSummaryCardProps) {
  return (
    <div
      className={cn(
        "grid gap-px bg-border/50 rounded-xl overflow-hidden border",
        metrics.length <= 2
          ? "grid-cols-2"
          : metrics.length === 3
            ? "grid-cols-3"
            : "grid-cols-2 sm:grid-cols-4",
        className,
      )}
    >
      {metrics.map((metric, i) => {
        const Icon = metric.icon;
        return (
          <div key={i} className="bg-card px-4 py-3.5 sm:px-5 sm:py-4 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground truncate">
                {metric.label}
              </p>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-lg font-semibold tabular-nums tracking-tight sm:text-xl">
                {metric.value}
              </p>
              {metric.trend && (
                <span
                  className={cn(
                    "text-xs font-medium",
                    metric.trendDirection === "positive" &&
                      "text-emerald-600 dark:text-emerald-400",
                    metric.trendDirection === "negative" && "text-red-600 dark:text-red-400",
                    metric.trendDirection === "neutral" && "text-muted-foreground",
                    !metric.trendDirection && "text-muted-foreground",
                  )}
                >
                  {metric.trend}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
