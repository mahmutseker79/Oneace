"use client";

/**
 * ResponsiveTable — wraps a standard Table with mobile-friendly behavior.
 *
 * On desktop (md+): renders the table normally with horizontal scroll.
 * On mobile (<md): renders each row as a stacked card if `cardRenderer` is provided,
 * otherwise falls back to horizontal scroll.
 *
 * This is a progressive enhancement — existing tables work unchanged.
 * To enable card view, pass a `cardRenderer` function that receives a row index
 * and returns JSX for the mobile card layout.
 */

import { cn } from "@/lib/utils";
import { LayoutGrid, List } from "lucide-react";
import type React from "react";
import { useState } from "react";

interface ResponsiveTableProps {
  children: React.ReactNode;
  /** Optional card renderer for mobile view. Receives data items and renders cards. */
  cardView?: React.ReactNode;
  className?: string;
  /** Label for accessibility */
  label?: string;
}

export function ResponsiveTable({ children, cardView, className, label }: ResponsiveTableProps) {
  const [showCards, setShowCards] = useState(false);

  // If no card view provided, just render the table with scroll
  if (!cardView) {
    return (
      <div className={cn("relative w-full", className)} role="region" aria-label={label}>
        <div className="overflow-auto scrollbar-thin rounded-lg">{children}</div>
      </div>
    );
  }

  return (
    <div className={cn("relative w-full", className)}>
      {/* View toggle — only visible on mobile */}
      <div className="flex items-center justify-end gap-1 mb-2 md:hidden">
        <button
          type="button"
          onClick={() => setShowCards(false)}
          className={cn(
            "inline-flex items-center justify-center h-8 w-8 rounded-md transition-colors",
            !showCards ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
          )}
          aria-label="Table view"
        >
          <List className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setShowCards(true)}
          className={cn(
            "inline-flex items-center justify-center h-8 w-8 rounded-md transition-colors",
            showCards ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
          )}
          aria-label="Card view"
        >
          <LayoutGrid className="h-4 w-4" />
        </button>
      </div>

      {/* Table view (always visible on desktop, toggle on mobile) */}
      <div className={cn(showCards ? "hidden md:block" : "block")}>
        <div className="overflow-auto scrollbar-thin rounded-lg" role="region" aria-label={label}>
          {children}
        </div>
      </div>

      {/* Card view (only on mobile when toggled) */}
      {showCards && <div className="md:hidden space-y-2">{cardView}</div>}
    </div>
  );
}

/**
 * MobileCard — a single card in the mobile card view.
 * Displays key-value pairs in a clean, touch-friendly layout.
 */
interface MobileCardProps {
  /** Primary label (e.g., item name) */
  title: string;
  /** Secondary label (e.g., SKU) */
  subtitle?: string;
  /** Key-value pairs to display */
  fields?: Array<{ label: string; value: React.ReactNode }>;
  /** Optional status badge */
  badge?: React.ReactNode;
  /** Click handler or link */
  href?: string;
  /** Action buttons */
  actions?: React.ReactNode;
  className?: string;
}

export function MobileCard({
  title,
  subtitle,
  fields,
  badge,
  href,
  actions,
  className,
}: MobileCardProps) {
  const content = (
    <div className={cn("rounded-xl border bg-card p-4 space-y-2.5", className)}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{title}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground font-mono truncate">{subtitle}</p>
          )}
        </div>
        {badge}
      </div>

      {/* Fields */}
      {fields && fields.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {fields.map((field, i) => (
            <div key={i} className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {field.label}
              </p>
              <p className="text-sm tabular-nums truncate">{field.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {actions && (
        <div className="flex items-center gap-2 pt-1 border-t border-border/50">{actions}</div>
      )}
    </div>
  );

  if (href) {
    // Using a native link wrapper for the whole card
    const Link = require("next/link").default;
    return (
      <Link href={href} className="block card-interactive">
        {content}
      </Link>
    );
  }

  return content;
}
