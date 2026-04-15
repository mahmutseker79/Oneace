"use client";

import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, type LucideIcon, Minus } from "lucide-react";
import Link from "next/link";
import React from "react";
import { Badge } from "./badge";
import { Card } from "./card";

interface KpiCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  className?: string;
  href?: string;
}

export function KpiCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  className,
  href,
}: KpiCardProps) {
  const content = (
    <div className={cn("relative p-5", className)}>
      {/* Header: Icon + Title */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-overline text-muted-foreground">{title}</p>
        {Icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/8 text-primary">
            <Icon className="h-4.5 w-4.5" />
          </div>
        )}
      </div>

      {/* Value — premium metric display */}
      <p className="text-metric-sm text-foreground mb-1">{value}</p>

      {/* Trend + Description */}
      {(trend || description) && (
        <div className="flex items-center gap-2 mt-3">
          {trend && trend.value !== 0 && (
            <>
              {trend.value > 0 ? (
                <Badge
                  variant="success"
                  className="flex items-center gap-0.5 text-xs px-1.5 py-0.5"
                >
                  <ArrowUpRight className="h-3 w-3" />
                  {trend.value}%
                </Badge>
              ) : (
                <Badge
                  variant="destructive"
                  className="flex items-center gap-0.5 text-xs px-1.5 py-0.5"
                >
                  <ArrowDownRight className="h-3 w-3" />
                  {Math.abs(trend.value)}%
                </Badge>
              )}
              <span className="text-xs text-muted-foreground truncate">{trend.label}</span>
            </>
          )}

          {trend && trend.value === 0 && (
            <div className="flex items-center gap-1.5">
              <Minus className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{trend.label}</span>
            </div>
          )}

          {description && !trend && (
            <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="group block">
        <Card className="card-interactive overflow-hidden border-transparent hover:border-border/60">
          {content}
        </Card>
      </Link>
    );
  }

  return <Card className="overflow-hidden">{content}</Card>;
}
