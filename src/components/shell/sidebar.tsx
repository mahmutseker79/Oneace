"use client";

import { cn } from "@/lib/utils";
import {
  ArrowLeftRight,
  BarChart3,
  ClipboardList,
  FolderTree,
  History,
  LayoutDashboard,
  Package,
  ScanLine,
  Settings,
  ShoppingCart,
  Truck,
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
    dashboard: string;
    items: string;
    categories: string;
    warehouses: string;
    counts: string;
    scan: string;
    movements: string;
    suppliers: string;
    purchaseOrders: string;
    reports: string;
    users: string;
    audit: string;
    settings: string;
  };
};

type NavItem = {
  label: string;
  href: `/${string}`;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
};

export function Sidebar({ labels }: { labels: SidebarLabels }) {
  const pathname = usePathname();

  const navItems: NavItem[] = [
    { label: labels.nav.dashboard, href: "/dashboard", icon: LayoutDashboard },
    { label: labels.nav.items, href: "/items", icon: Package },
    { label: labels.nav.categories, href: "/categories", icon: FolderTree },
    { label: labels.nav.warehouses, href: "/warehouses", icon: Warehouse },
    { label: labels.nav.counts, href: "/stock-counts", icon: ClipboardList },
    { label: labels.nav.scan, href: "/scan", icon: ScanLine },
    { label: labels.nav.movements, href: "/movements", icon: ArrowLeftRight },
    { label: labels.nav.suppliers, href: "/suppliers", icon: Truck },
    { label: labels.nav.purchaseOrders, href: "/purchase-orders", icon: ShoppingCart },
    { label: labels.nav.reports, href: "/reports", icon: BarChart3 },
    { label: labels.nav.users, href: "/users", icon: Users },
    { label: labels.nav.audit, href: "/audit", icon: History },
    { label: labels.nav.settings, href: "/settings", icon: Settings },
  ];

  return (
    <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:z-30 border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground font-bold">
          O
        </div>
        <span className="text-lg font-semibold">{labels.brand}</span>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
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
        })}
      </nav>
      <div className="border-t border-sidebar-border p-4 text-xs text-muted-foreground">
        <p>{labels.versionLine}</p>
        <p>{labels.statusLine}</p>
      </div>
    </aside>
  );
}
