/**
 * EmptyState — shared empty-state card component.
 *
 * Three empty-state variants are supported (controlled by `variant` prop):
 *
 *   "empty"       — True first-use state. "You have nothing here yet."
 *   "filtered"    — Data exists but the active filter/search has no results.
 *   "unavailable" — Feature unavailable due to a missing precondition.
 *
 * God-Mode Design v1 — Enhanced with premium styling, better visual hierarchy,
 * subtle illustrations via icon treatment, and improved action layout.
 */

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EmptyStateAction = {
  label: string;
  href: string;
  icon?: LucideIcon;
  variant?: "primary" | "secondary" | "ghost";
};

export type EmptyStateVariant = "empty" | "filtered" | "unavailable";

export type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  variant?: EmptyStateVariant;
  actions?: EmptyStateAction[];
  footer?: ReactNode;
  /**
   * Sprint 12 PR #1 (UX/UI audit Apr-25 §B-7): when `true`, render WITHOUT
   * the outer `<Card>` wrapper. Use inside an existing CardContent (e.g.
   * panel-style empty state inside a settings or integrations card).
   */
  bare?: boolean;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EmptyState({
  icon: Icon,
  title,
  description,
  variant = "empty",
  actions,
  footer,
  bare = false,
}: EmptyStateProps) {
  const iconContainerClass =
    variant === "filtered"
      ? "bg-muted/60 ring-1 ring-border/30"
      : variant === "unavailable"
        ? "bg-warning-light ring-1 ring-warning/20"
        : "bg-primary/8 ring-1 ring-primary/10";

  const iconClass =
    variant === "unavailable"
      ? "h-6 w-6 text-warning"
      : variant === "filtered"
        ? "h-6 w-6 text-muted-foreground"
        : "h-6 w-6 text-primary";

  const hasActions = actions && actions.length > 0;

  const inner = (
    <>
      {/* Icon */}
      <div
        className={`flex h-14 w-14 items-center justify-center rounded-2xl ${iconContainerClass} mb-4`}
      >
        <Icon className={iconClass} />
      </div>

      {/* Title */}
      <h3 className="text-base font-semibold text-foreground mb-1">{title}</h3>

      {/* Description */}
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm leading-relaxed mb-5">
          {description}
        </p>
      )}

      {/* Actions */}
      {hasActions && (
        <div className="flex flex-col sm:flex-row items-center gap-2 mt-1">
          {actions.map((action, idx) => {
            const ActionIcon = action.icon;
            const buttonVariant =
              action.variant === "ghost"
                ? "ghost"
                : action.variant === "secondary"
                  ? "outline"
                  : idx === 0
                    ? "default"
                    : "outline";
            const buttonSize =
              action.variant === "ghost" || (idx > 0 && !action.variant) ? "sm" : "default";
            return (
              <Button key={action.href} asChild variant={buttonVariant} size={buttonSize}>
                <Link href={action.href}>
                  {ActionIcon ? <ActionIcon className="h-4 w-4" /> : null}
                  {action.label}
                </Link>
              </Button>
            );
          })}
        </div>
      )}

      {/* Footer */}
      {footer && <div className="text-center text-xs text-muted-foreground mt-4">{footer}</div>}
    </>
  );

  if (bare) {
    return (
      <div
        data-slot="empty-state"
        data-bare="true"
        className="flex flex-col items-center text-center py-8 px-4"
      >
        {inner}
      </div>
    );
  }

  return (
    <Card className="border-dashed" data-slot="empty-state">
      <CardContent className="flex flex-col items-center text-center py-12 px-6 sm:py-16">
        {inner}
      </CardContent>
    </Card>
  );
}
