"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight, ArrowDownRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "./card";
import { Badge } from "./badge";

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
    <div className={cn("space-y-4", className)}>
      {Icon && (
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon className="h-5 w-5" />
        </div>
      )}

      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </p>
        <p className="text-2xl font-bold">{value}</p>
      </div>

      {(trend || description) && (
        <div className="flex items-center justify-between">
          {trend && (
            <div className="flex items-center gap-2">
              {trend.value > 0 ? (
                <Badge variant="success" className="flex items-center gap-1 text-xs">
                  <ArrowUpRight className="h-3 w-3" />
                  {trend.value}%
                </Badge>
              ) : trend.value < 0 ? (
                <Badge variant="destructive" className="flex items-center gap-1 text-xs">
                  <ArrowDownRight className="h-3 w-3" />
                  {Math.abs(trend.value)}%
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">
                  {trend.label}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">{trend.label}</span>
            </div>
          )}

          {description && !trend && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href}>
        <Card className="cursor-pointer transition-all hover:shadow-lg hover:shadow-card-hover">
          {content}
        </Card>
      </Link>
    );
  }

  return <Card>{content}</Card>;
}
