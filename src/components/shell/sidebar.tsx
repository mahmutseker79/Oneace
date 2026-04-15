"use client";

// Phase 2 UX — Sidebar now includes Operations group:
//   Movements | Purchase Orders | Scan | Suppliers | Categories
// God-Mode Design v1 — Premium sidebar with refined grouping,
// better active states, visual hierarchy, and plan badge.

import { useState } from "react";

import { cn } from "@/lib/utils";
import {
  ArrowLeftRight,
  BarChart3,
  ChevronDown,
  ClipboardList,
  FileDown,
  FileUp,
  FolderOpen,
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
    items: string;
    warehouses: string;
    counts: string;
    movements: string;
    reports: string;
    users: string;
    audit: string;
    settings: string;
    // Section headings
    activity: string;
    analytics: string;
    admin: string;
    // Phase 2 — new nav items
    operations: string;
    purchaseOrders: string;
    suppliers: string;
    categories: string;
    scan: string;
    // Phase 2A — Warehouse and Commerce groups
    warehouse?: string;
    transfers?: string;
    departments?: string;
    commerce?: string;
    salesOrders?: string;
    kits?: string;
    picks?: string;
    import?: string;
    export?: string;
    // God-Mode — dashboard nav item
    dashboard?: string;
  };
  // P8.2 — optional badge counts passed from the layout
  badges?: {
    items?: string;
  };
  // P10.1 — hide admin section for roles without admin capabilities
  showAdmin?: boolean;
  // Plan badge for sidebar footer
  planLabel?: string;
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
  collapsible?: boolean;
  defaultOpen?: boolean;
};

export function Sidebar({ labels }: { labels: SidebarLabels }) {
  const pathname = usePathname();

  // Admin section starts expanded if the user is on an admin page.
  const adminPaths = ["/users", "/audit", "/settings"];
  const isOnAdminPage = adminPaths.some((p) => pathname.startsWith(p));
  const [adminOpen, setAdminOpen] = useState(isOnAdminPage);

  // Warehouse & Commerce collapsed by default unless user is on those pages
  const warehousePaths = ["/transfers", "/departments"];
  const commercePaths = ["/sales-orders", "/kits", "/picks"];
  const isOnWarehousePage = warehousePaths.some((p) => pathname.startsWith(p));
  const isOnCommercePage = commercePaths.some((p) => pathname.startsWith(p));
  const [warehouseOpen, setWarehouseOpen] = useState(isOnWarehousePage);
  const [commerceOpen, setCommerceOpen] = useState(isOnCommercePage);

  const groups: NavGroup[] = [
    {
      // Core — no heading, always visible. The primary first-run flow:
      // Dashboard → Items → Locations → Stock Counts.
      items: [
        { label: labels.nav.dashboard ?? "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: labels.nav.items, href: "/items", icon: Package, badge: labels.badges?.items },
        { label: labels.nav.warehouses, href: "/warehouses", icon: Warehouse },
        { label: labels.nav.counts, href: "/stock-counts", icon: ClipboardList },
      ],
    },
    {
      // Operations — all transactional and procurement workflows.
      heading: labels.nav.operations,
      items: [
        { label: labels.nav.movements, href: "/movements", icon: ArrowLeftRight },
        { label: labels.nav.purchaseOrders, href: "/purchase-orders", icon: ShoppingCart },
        { label: labels.nav.scan, href: "/scan", icon: ScanLine },
        { label: labels.nav.suppliers, href: "/suppliers", icon: Truck },
        { label: labels.nav.categories, href: "/categories", icon: FolderOpen },
      ],
    },
    {
      heading: labels.nav.analytics,
      items: [{ label: labels.nav.reports, href: "/reports", icon: BarChart3 }],
    },
  ];

  const warehouseItems: NavItem[] = [
    { label: labels.nav.transfers ?? "Transfers", href: "/transfers", icon: ArrowLeftRight },
    { label: labels.nav.departments ?? "Departments", href: "/departments", icon: Warehouse },
  ];

  const commerceItems: NavItem[] = [
    { label: labels.nav.salesOrders ?? "Sales Orders", href: "/sales-orders", icon: ShoppingCart },
    { label: labels.nav.kits ?? "Kits", href: "/kits", icon: Package },
    { label: labels.nav.picks ?? "Picks", href: "/picks", icon: ClipboardList },
  ];

  const utilityItems: NavItem[] = [
    { label: labels.nav.import ?? "Import", href: "/import", icon: FileUp },
    { label: labels.nav.export ?? "Export", href: "/export", icon: FileDown },
  ];

  const adminItems: NavItem[] = [
    { label: labels.nav.users, href: "/users", icon: Users },
    { label: labels.nav.audit, href: "/audit", icon: History },
    { label: labels.nav.settings, href: "/settings", icon: Settings },
  ];

  function renderItem(item: NavItem) {
    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
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
        <span className="truncate">{item.label}</span>
        {item.badge ? (
          <span className="ml-auto shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground tabular-nums">
            {item.badge}
          </span>
        ) : null}
      </Link>
    );
  }

  function renderCollapsibleGroup(
    heading: string,
    items: NavItem[],
    open: boolean,
    setOpen: (v: boolean | ((v: boolean) => boolean)) => void,
  ) {
    return (
      <div className="mt-4">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
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
            open ? "max-h-96 opacity-100" : "max-h-0 opacity-0",
          )}
        >
          {items.map(renderItem)}
        </div>
      </div>
    );
  }

  return (
    <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:z-[var(--z-sidebar)] border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
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
        {/* Main groups */}
        {groups.map((group, gi) => (
          <div key={gi} className={gi === 0 ? undefined : "mt-5"}>
            {group.heading ? (
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.heading}
              </p>
            ) : null}
            <div className="space-y-0.5">{group.items.map(renderItem)}</div>
          </div>
        ))}

        {/* Warehouse — collapsible */}
        {renderCollapsibleGroup(
          labels.nav.warehouse ?? "Warehouse",
          warehouseItems,
          warehouseOpen,
          setWarehouseOpen,
        )}

        {/* Commerce — collapsible */}
        {renderCollapsibleGroup(
          labels.nav.commerce ?? "Commerce",
          commerceItems,
          commerceOpen,
          setCommerceOpen,
        )}

        {/* Utilities — small, subtle */}
        <div className="mt-4 pt-3 border-t border-sidebar-border/50">
          <div className="space-y-0.5">{utilityItems.map(renderItem)}</div>
        </div>

        {/* Admin — collapsible group (P10.1: hidden for non-admin roles) */}
        {labels.showAdmin !== false
          ? renderCollapsibleGroup(labels.nav.admin, adminItems, adminOpen, setAdminOpen)
          : null}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border px-5 py-3">
        <p className="text-[11px] text-muted-foreground">{labels.versionLine}</p>
        <p className="text-[10px] text-muted-foreground/70">{labels.statusLine}</p>
      </div>
    </aside>
  );
}
