"use client";

// Sidebar — Professional navigation rendered from the canonical
// `nav-config.ts` so desktop and mobile stay in lockstep.
//
// P1-4 (audit v1.0 §5.9): the desktop and mobile nav used to declare
// their own NavItem arrays. Mobile silently omitted Dashboard,
// Migrations, Integrations, Vehicles, and Pallets — items users on
// phones simply could not reach. Both surfaces now render from
// `NAV_GROUPS` in `./nav-config`. Adding a new nav item only
// requires editing that single file.

import { useState } from "react";

import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  type NavGroup,
  type NavItem,
  isGroupActive,
  isItemActive,
  resolveBadge,
  resolveHeading,
  resolveLabel,
  visibleGroups,
} from "./nav-config";
import type { SidebarLabels } from "./sidebar-labels";

// Re-export for callers that imported the type from this module
// before P1-4. Keeps the public surface stable.
export type { SidebarLabels } from "./sidebar-labels";

export function Sidebar({ labels }: { labels: SidebarLabels }) {
  const pathname = usePathname();
  const groups = visibleGroups(labels.showAdmin !== false);

  // Track open state per collapsible group, defaulting to "open if
  // a child page is currently active" so the user lands on a panel
  // that already shows where they are.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const g of groups) {
      if (g.mode === "collapsible" || g.mode === "admin") {
        initial[g.id] = isGroupActive(g, pathname);
      }
    }
    return initial;
  });

  function toggleGroup(id: string) {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function renderItem(item: NavItem) {
    const href = item.href;
    const isActive = isItemActive(href, pathname);
    const Icon = item.icon;
    const label = resolveLabel(item, labels);
    const badge = resolveBadge(item, labels);
    return (
      <Link
        key={item.id}
        href={href}
        className={cn(
          "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
          isActive
            ? "bg-primary/10 text-primary border-l-2 border-l-primary -ml-[2px] pl-[14px]"
            : "text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
        )}
      >
        <Icon
          className={cn(
            "h-4 w-4 shrink-0",
            isActive
              ? "text-primary"
              : "text-muted-foreground group-hover:text-sidebar-accent-foreground",
          )}
        />
        <span className="truncate">{label}</span>
        {badge ? (
          <span className="ml-auto shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground tabular-nums">
            {badge}
          </span>
        ) : null}
      </Link>
    );
  }

  function renderGroup(group: NavGroup) {
    if (group.mode === "always") {
      // The "core" group has no heading; other always-on groups do.
      const heading = resolveHeading(group, labels);
      const isCore = group.id === "core";
      const isFirstAfterCore = group.id === "data-tools";
      return (
        <div
          key={group.id}
          className={cn(
            isCore ? "space-y-0.5" : "mt-5",
            isFirstAfterCore && "mt-4 pt-3 border-t border-sidebar-border/50",
          )}
        >
          {heading ? (
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {heading}
            </p>
          ) : null}
          <div className="space-y-0.5">{group.items.map(renderItem)}</div>
        </div>
      );
    }

    // Collapsible (and admin, which is also collapsible).
    const heading = resolveHeading(group, labels);
    const open = openGroups[group.id] ?? false;
    return (
      <div key={group.id} className="mt-4">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => toggleGroup(group.id)}
          className="flex w-full items-center justify-between px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-sidebar-foreground transition-colors rounded-md"
        >
          <span>{heading}</span>
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")}
          />
        </button>
        <div
          className={cn(
            "mt-1 space-y-0.5 overflow-hidden transition-all duration-200",
            open ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0",
          )}
        >
          {group.items.map(renderItem)}
        </div>
      </div>
    );
  }

  // ── Layout ─────────────────────────────────────────────────────

  return (
    <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:z-[var(--z-sidebar)] border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-[var(--shadow-card)]">
      {/* Brand Header */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold shadow-sm">
          O
        </div>
        <div className="flex flex-col min-w-0">
          <span className="truncate text-sm font-semibold tracking-tight">{labels.brand}</span>
          {labels.planLabel && (
            <span className="text-[10px] font-medium text-primary uppercase tracking-wider">
              {labels.planLabel}
            </span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4">
        {groups.map(renderGroup)}
      </nav>

      {/* Footer */}
      {/* P1-6 (audit v1.0 §5.12): drop the "Sprint 0 scaffold" status line.
          We still render `statusLine` when a non-empty value is supplied so
          callers can surface a real status (e.g. "Maintenance window") but
          the default case renders version-only. */}
      <div className="border-t border-sidebar-border px-5 py-3">
        <p className="text-[11px] text-muted-foreground">{labels.versionLine}</p>
        {labels.statusLine ? (
          <p className="text-[10px] text-muted-foreground/70">{labels.statusLine}</p>
        ) : null}
      </div>
    </aside>
  );
}
