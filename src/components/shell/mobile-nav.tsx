"use client";

// MobileNav — Renders the same `NAV_GROUPS` as the desktop sidebar
// so the two surfaces never drift again.
//
// P1-4 (audit v1.0 §5.9): the previous mobile nav declared its own
// item arrays and silently dropped Dashboard, Migrations,
// Integrations, Vehicles, and Pallets — items users on phones could
// not reach. Both surfaces now read from `./nav-config`.

import { useState } from "react";

import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

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

export function MobileNav({
  labels,
  open,
  onOpenChange,
}: {
  labels: SidebarLabels;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const groups = visibleGroups(labels.showAdmin !== false);

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
        onClick={() => onOpenChange(false)}
        className={cn(
          "flex items-center gap-3 rounded-md border-l-2 px-3 py-2.5 text-sm font-medium transition-colors duration-150",
          isActive
            ? "border-l-primary bg-accent text-accent-foreground"
            : "border-l-transparent text-foreground hover:bg-accent/60",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{label}</span>
        {badge ? (
          <span className="ml-auto shrink-0 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
            {badge}
          </span>
        ) : null}
      </Link>
    );
  }

  function renderGroup(group: NavGroup) {
    if (group.mode === "always") {
      const heading = resolveHeading(group, labels);
      const isCore = group.id === "core";
      return (
        <div
          key={group.id}
          className={cn(isCore ? "space-y-1" : "mt-4 border-t pt-4")}
        >
          {heading ? (
            <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {heading}
            </p>
          ) : null}
          <div className="space-y-1">{group.items.map(renderItem)}</div>
        </div>
      );
    }

    // Collapsible (and admin).
    const heading = resolveHeading(group, labels);
    const isOpen = openGroups[group.id] ?? false;
    return (
      <div key={group.id} className="mt-4 border-t pt-4">
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => toggleGroup(group.id)}
          className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>{heading}</span>
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")}
          />
        </button>
        {isOpen ? (
          <div className="mt-1 space-y-1">{group.items.map(renderItem)}</div>
        ) : null}
      </div>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-sm">
              O
            </div>
            <span className="truncate">{labels.brand}</span>
          </SheetTitle>
        </SheetHeader>

        <nav className="flex-1 overflow-y-auto p-4">{groups.map(renderGroup)}</nav>

        <div className="border-t p-4 text-xs text-muted-foreground">
          <p>{labels.versionLine}</p>
          <p>{labels.statusLine}</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
