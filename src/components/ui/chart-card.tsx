"use client";

import { cn } from "@/lib/utils";
import type React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { Skeleton } from "./skeleton";

interface ChartCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
  loading?: boolean;
  height?: number;
}

export function ChartCard({
  title,
  description,
  children,
  className,
  action,
  loading = false,
  height = 280,
}: ChartCardProps) {
  const isEmpty = !children || (Array.isArray(children) && children.length === 0);

  return (
    <Card className={cn("flex flex-col overflow-hidden", className)}>
      <CardHeader
        className="flex flex-row items-center justify-between space-y-0 pb-3 border-b border-border/40"
        style={{
          background: "var(--gradient-card)",
        }}
      >
        <div className="flex-1 min-w-0">
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          {description && (
            <CardDescription className="text-xs mt-0.5">{description}</CardDescription>
          )}
        </div>
        {action && <div className="ml-3 flex-shrink-0">{action}</div>}
      </CardHeader>

      <CardContent className="flex-1 pt-4">
        {loading ? (
          <div style={{ height: `${height}px` }} className="space-y-3">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-full w-full rounded-lg" />
          </div>
        ) : isEmpty ? (
          <div
            style={{ height: `${height}px` }}
            className="flex flex-col items-center justify-center gap-2"
          >
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
              <svg
                className="h-5 w-5 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
                />
              </svg>
            </div>
            <p className="text-sm text-muted-foreground">No data available</p>
          </div>
        ) : (
          <div style={{ height: `${height}px` }}>{children}</div>
        )}
      </CardContent>
    </Card>
  );
}
