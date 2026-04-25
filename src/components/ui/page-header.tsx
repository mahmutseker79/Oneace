"use client";

import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type React from "react";
import { Breadcrumb, type BreadcrumbItem } from "./breadcrumb";
import { Button } from "./button";

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumb?: BreadcrumbItem[];
  actions?: React.ReactNode;
  className?: string;
  /** Show a back button linking to this URL */
  backHref?: string;
  /** Optional badge/status to show next to the title */
  badge?: React.ReactNode;
  /**
   * Sprint 1 PR #7 (UX/UI audit Apr-25 §B-6): optional class names
   * applied to the `<h1>` element so callers that need a brand-only
   * accent (e.g. dashboard's `text-gradient-primary`) can migrate to
   * the canonical primitive without losing their visual identity.
   * Keep usage rare — generic title styling lives in this primitive.
   */
  titleClassName?: string;
}

export function PageHeader({
  title,
  description,
  breadcrumb,
  actions,
  className,
  backHref,
  badge,
  titleClassName,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-6 space-y-3", className)}>
      {/* Breadcrumb */}
      {breadcrumb && breadcrumb.length > 0 && <Breadcrumb items={breadcrumb} className="mb-1" />}

      {/* Title Row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {/* Back button */}
          {backHref && (
            <Button variant="ghost" size="icon" asChild className="h-9 w-9 shrink-0 -ml-1 mt-0.5">
              <Link href={backHref}>
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Back</span>
              </Link>
            </Button>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1
                className={cn(
                  "text-xl font-semibold tracking-tight sm:text-2xl",
                  titleClassName,
                )}
              >
                {title}
              </h1>
              {badge}
            </div>
            {description && (
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed max-w-2xl">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        {actions && (
          <div className="flex items-center gap-2 w-full sm:w-auto sm:flex-shrink-0">{actions}</div>
        )}
      </div>
    </div>
  );
}
