"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import {
  ArrowLeftRight,
  BarChart3,
  ChevronDown,
  ClipboardList,
  History,
  Package,
  Settings,
  Users,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { SidebarLabels } from "./sidebar";

type NavItem = {
  label: string;
  href: `/${string}`;
  icon: React.ComponentType<{ className?: string }>;
};

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

  const adminPaths = ["/users", "/audit", "/settings"];
  const isOnAdminPage = adminPaths.some((p) => pathname.startsWith(p));
  const [adminOpen, setAdminOpen] = useState(isOnAdminPage);

  const coreItems: NavItem[] = [
    { label: labels.nav.items, href: "/items", icon: Package },
    { label: labels.nav.warehouses, href: "/warehouses", icon: Warehouse },
    { label: labels.nav.counts, href: "/stock-counts", icon: ClipboardList },
  ];

  // P3.5 — Movements are operational history, separated from the core setup flow.
  const activityItems: NavItem[] = [
    { label: labels.nav.movements, href: "/movements", icon: ArrowLeftRight },
  ];

  const analyticsItems: NavItem[] = [
    { label: labels.nav.reports, href: "/reports", icon: BarChart3 },
  ];

  const adminItems: NavItem[] = [
    { label: labels.nav.users, href: "/users", icon: Users },
    { label: labels.nav.audit, href: "/audit", icon: History },
    { label: labels.nav.settings, href: "/settings", icon: Settings },
  ];

  function renderItem(item: NavItem) {
    const isActive = pathname.startsWith(item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => onOpenChange(false)}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
          isActive ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-accent/60",
        )}
      >
        <Icon className="h-4 w-4" />
        <span>{item.label}</span>
      </Link>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-sm">
              O
            </div>
            <span>{labels.brand}</span>
          </SheetTitle>
        </SheetHeader>

        <nav className="flex-1 overflow-y-auto p-4">
          {/* Core */}
          <div className="space-y-1">{coreItems.map(renderItem)}</div>

          {/* Activity — P3.5 */}
          <div className="mt-4 border-t pt-4">
            <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {labels.nav.activity}
            </p>
            <div className="space-y-1">{activityItems.map(renderItem)}</div>
          </div>

          {/* Analytics */}
          <div className="mt-4 border-t pt-4">
            <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {labels.nav.analytics}
            </p>
            <div className="space-y-1">{analyticsItems.map(renderItem)}</div>
          </div>

          {/* Admin — collapsible */}
          <div className="mt-4 border-t pt-4">
            <button
              type="button"
              onClick={() => setAdminOpen((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>{labels.nav.admin}</span>
              <ChevronDown
                className={cn("h-3.5 w-3.5 transition-transform", adminOpen && "rotate-180")}
              />
            </button>
            {adminOpen ? <div className="mt-1 space-y-1">{adminItems.map(renderItem)}</div> : null}
          </div>
        </nav>

        <div className="border-t p-4 text-xs text-muted-foreground">
          <p>{labels.versionLine}</p>
          <p>{labels.statusLine}</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
