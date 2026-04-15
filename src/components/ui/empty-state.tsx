/**
 * EmptyState — shared empty-state card component.
 *
 * Codifies the pattern used across Items, Movements, Warehouses, Stock
 * Counts, Purchase Orders, Suppliers, and Bins pages into a single
 * reusable component so future pages don't copy-paste the Card structure.
 *
 * Three empty-state variants are supported (controlled by `variant` prop):
 *
 *   "empty"       — True first-use state. "You have nothing here yet."
 *                   Prominently features the primary CTA.
 *   "filtered"    — Data exists but the active filter/search has no results.
 *                   De-emphasises creation CTAs; shows a "clear filter" action.
 *   "unavailable" — Feature unavailable due to a missing precondition
 *                   (e.g. no warehouses yet → can't create stock count).
 *                   Guides the user to the prerequisite.
 *
 * All props other than `title` are optional so the component is usable at
 * every level of completeness — from a bare icon + message to a full
 * multi-CTA card.
 */

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EmptyStateAction = {
  label: string;
  href: string;
  /** Icon to render before the label (optional). */
  icon?: LucideIcon;
  /**
   * "primary"   → filled button (default)
   * "secondary" → outline button
   * "ghost"     → ghost button (for low-emphasis de-emphasised links)
   */
  variant?: "primary" | "secondary" | "ghost";
};

export type EmptyStateVariant = "empty" | "filtered" | "unavailable";

export type EmptyStateProps = {
  /** Lucide icon to render in the header circle. */
  icon: LucideIcon;
  /** Main heading. */
  title: string;
  /** Supporting paragraph below the title. */
  description?: string;
  /** Visual variant — affects icon/container treatment. Default: "empty". */
  variant?: EmptyStateVariant;
  /**
   * Action buttons rendered below the description, in order.
   * The first action with variant="primary" (or no variant) is the primary CTA.
   * Subsequent actions default to "secondary".
   */
  actions?: EmptyStateAction[];
  /**
   * Extra JSX slot — rendered after the action buttons. Use for inline
   * notes, links, or other content that doesn't fit a standard button.
   */
  footer?: ReactNode;
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
}: EmptyStateProps) {
  // Icon container colour varies slightly by variant to give a visual cue
  // without requiring separate icons or illustrations.
  const iconContainerClass =
    variant === "filtered"
      ? "bg-muted/60"
      : variant === "unavailable"
        ? "bg-amber-50 dark:bg-amber-950/30"
        : "bg-muted";

  const iconClass =
    variant === "unavailable" ? "h-6 w-6 text-amber-500" : "h-6 w-6 text-muted-foreground";

  const hasActions = actions && actions.length > 0;

  return (
    <Card>
      <CardHeader className="items-center text-center">
        <div
          className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${iconContainerClass}`}
        >
          <Icon className={iconClass} />
        </div>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>

      {hasActions || footer ? (
        <CardContent className="flex flex-col items-center gap-2">
          {hasActions
            ? actions.map((action, idx) => {
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
              })
            : null}
          {footer ? (
            <div className="text-center text-sm text-muted-foreground">{footer}</div>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}
