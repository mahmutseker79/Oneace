"use client";

// Phase 2 UX — Sidebar now includes Operations group:
//   Movements | Purchase Orders | Scan | Suppliers | Categories
// Previously PO, Suppliers, Categories, and Scan were only reachable
// via dashboard shortcuts or direct navigation. They now have persistent
// nav entries so they're always one click away.

import { useState } from "react";

import { cn } from "@/lib/utils";
import {
  ArrowLeftRight,
  BarChart3,
  ChevronDown,
  ClipboardList,
  Download,
  FileDown,
  FileUp,
  FolderOpen,
  History,
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
  };
  // P8.2 — optional badge counts passed from the layout
  badges?: {
    items?: string;
  };
  // P10.1 — hide admin section for roles without admin capabilities
  showAdmin?: boolean;
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
      // Warehouse — transfers and departments
      heading: labels.nav.warehouse ?? "Warehouse",
      items: [
        { label: labels.nav.transfers ?? "Transfers", href: "/transfers", icon: ArrowLeftRight },
        { label: labels.nav.departments ?? "Departments", href: "/departments", icon: Warehouse },
      ],
    },
    {
      // Commerce — sales orders, kits, picks
      heading: labels.nav.commerce ?? "Commerce",
      items: [
        { label: labels.nav.salesOrders ?? "Sales Orders", href: "/sales-orders", icon: ShoppingCart },
        { label: labels.nav.kits ?? "Kits", href: "/kits", icon: Package },
        { label: labels.nav.picks ?? "Picks", href: "/picks", icon: ClipboardList },
      ],
    },
    {
      // Utilities — import/export
      heading: undefined,
      items: [
        { label: labels.nav.import ?? "Import", href: "/import", icon: FileUp },
        { label: labels.nav.export ?? "Export", href: "/export", icon: FileDown },
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
    // Active when the current pathname starts with the item href.
    // Exception: /items should not match /items/import or /items/new
    // when those are deeper — but startsWith is correct here because
    // /items IS a prefix of /items/new (both should highlight "Items").
    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "flex items-center gap-3 rounded-md border-l-2 px-3 py-2 text-sm font-medium transition-colors duration-150",
          isActive
            ? "border-l-primary bg-sidebar-accent text-sidebar-accent-foreground"
            : "border-l-transparent text-sidebar-foreground hover:bg-sidebar-accent/60",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{item.label}</span>
        {item.badge ? (
          <span className="ml-auto shrink-0 rounded-full bg-sidebar-primary px-2 py-0.5 text-xs text-sidebar-primary-foreground">
            {item.badge}
          </span>
        ) : null}
      </Link>
    );
  }

  return (
    <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:z-30 border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground font-bold">
          O
        </div>
        <span className="truncate text-lg font-semibold">{labels.brand}</span>
      </div>
      <nav className="flex-1 overflow-y-auto p-4">
        {groups.map((group, gi) => (
          <div key={gi} className={gi === 0 ? undefined : gi === 1 ? "mt-6" : "mt-4"}>
            {group.heading ? (
              <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.heading}
              </p>
            ) : null}
            <div className="space-y-1">{group.items.map(renderItem)}</div>
          </div>
        ))}

        {/* Admin — collapsible group (P10.1: hidden for non-admin roles) */}
        {labels.showAdmin !== false ? (
          <div className="mt-4">
            <button
              type="button"
              aria-expanded={adminOpen}
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
        ) : null}
      </nav>
      <div className="border-t border-sidebar-border p-4 text-xs text-muted-foreground">
        <p>{labels.versionLine}</p>
        <p>{labels.statusLine}</p>
      </div>
    </aside>
  );
}
