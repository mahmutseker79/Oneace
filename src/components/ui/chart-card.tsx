"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./card";

interface ChartCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}

export function ChartCard({
  title,
  description,
  children,
  className,
  action,
}: ChartCardProps) {
  const isEmpty = !children || (Array.isArray(children) && children.length === 0);

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader
        className="flex flex-row items-center justify-between space-y-0 pb-4"
        style={{
          background: "var(--gradient-card)",
        }}
      >
        <div className="flex-1">
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {action && <div className="ml-4 flex-shrink-0">{action}</div>}
      </CardHeader>

      <CardContent className="flex-1 pt-4">
        {isEmpty ? (
          <div className="flex h-[280px] items-center justify-center">
            <p className="text-sm text-muted-foreground">No data available</p>
          </div>
        ) : (
          <div className="h-[280px]">{children}</div>
        )}
      </CardContent>
    </Card>
  );
}
