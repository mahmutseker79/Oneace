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

export type SidebarLabels = {
  brand: string;
  versionLine: string;
  statusLine: string;
  nav: {
    items: string;
    warehouses: string;
    counts: string;
    movements: string;
    reports: string;
    users: string;
    audit: string;
    settings: string;
    activity: string;
    analytics: string;
    admin: string;
  };
};

type NavItem = {
  label: string;
  href: `/${string}`;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
};

type NavGroup = {
  heading?: string;
  items: NavItem[];
};

export function Sidebar({ labels }: { labels: SidebarLabels }) {
  const pathname = usePathname();

  // Admin section starts expanded if the user is on an admin page.
  const adminPaths = ["/users", "/audit", "/settings"];
  const isOnAdminPage = adminPaths.some((p) => pathname.startsWith(p));
  const [adminOpen, setAdminOpen] = useState(isOnAdminPage);

  const groups: NavGroup[] = [
    {
      // Core — no heading, always visible. The primary first-run flow:
      // Items → Locations → Stock Counts.
      items: [
        { label: labels.nav.items, href: "/items", icon: Package },
        { label: labels.nav.warehouses, href: "/warehouses", icon: Warehouse },
        { label: labels.nav.counts, href: "/stock-counts", icon: ClipboardList },
      ],
    },
    {
      // P3.5 — Movements are operational history, not a setup step.
      heading: labels.nav.activity,
      items: [
        { label: labels.nav.movements, href: "/movements", icon: ArrowLeftRight },
      ],
    },
    {
      heading: labels.nav.analytics,
      items: [{ label: labels.nav.reports, href: "/reports", icon: BarChart3 }],
    },
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
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent/60",
        )}
      >
        <Icon className="h-4 w-4" />
        <span>{item.label}</span>
        {item.badge ? (
          <span className="ml-auto rounded-full bg-sidebar-primary px-2 py-0.5 text-xs text-sidebar-primary-foreground">
            {item.badge}
          </span>
        ) : null}
      </Link>
    );
  }

  return (
    <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:z-30 border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground font-bold">
          O
        </div>
        <span className="text-lg font-semibold">{labels.brand}</span>
      </div>
      <nav className="flex-1 overflow-y-auto p-4">
        {groups.map((group, gi) => (
          <div key={gi} className={gi > 0 ? "mt-4" : undefined}>
            {group.heading ? (
              <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.heading}
              </p>
            ) : null}
            <div className="space-y-1">{group.items.map(renderItem)}</div>
          </div>
        ))}

        {/* Admin — collapsible group */}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setAdminOpen((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-sidebar-foreground transition-colors"
          >
            <span>{labels.nav.admin}</span>
            <ChevronDown
              className={cn("h-3.5 w-3.5 transition-transform", adminOpen && "rotate-180")}
            />
          </button>
          {adminOpen ? <div className="mt-1 space-y-1">{adminItems.map(renderItem)}</div> : null}
        </div>
      </nav>
      <div className="border-t border-sidebar-border p-4 text-xs text-muted-foreground">
        <p>{labels.versionLine}</p>
        <p>{labels.statusLine}</p>
      </div>
    </aside>
  );
}
