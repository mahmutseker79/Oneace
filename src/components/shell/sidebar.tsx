"use client";

// Sidebar — Professional navigation with 6 logical groups:
//   Core → Inventory → Operations → Fulfillment → Analytics/Data → Admin

import { useState } from "react";

import { cn } from "@/lib/utils";
import {
  ArrowLeftRight,
  BarChart3,
  Boxes,
  ChevronDown,
  ClipboardList,
  FileDown,
  FileUp,
  FolderOpen,
  History,
  LayoutDashboard,
  Link2,
  Package,
  ScanLine,
  Settings,
  ShoppingCart,
  Tag,
  ToggleRight,
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
    dashboard?: string;
    items: string;
    warehouses: string;
    counts: string;
    movements: string;
    reports: string;
    users: string;
    audit: string;
    settings: string;
    // Section headings
    inventory?: string;
    operations?: string;
    fulfillment?: string;
    analytics?: string;
    admin: string;
    dataTools?: string;
    // Inventory
    categories: string;
    suppliers: string;
    scan: string;
    purchaseOrders: string;
    labels?: string;
    pallets?: string;
    // Operations
    transfers?: string;
    departments?: string;
    statusChange?: string;
    vehicles?: string;
    // Fulfillment
    salesOrders?: string;
    kits?: string;
    picks?: string;
    // Data tools
    import?: string;
    export?: string;
    // Integrations
    integrations?: string;
    // Legacy aliases
    activity?: string;
    warehouse?: string;
    commerce?: string;
  };
  badges?: {
    items?: string;
  };
  showAdmin?: boolean;
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

  // ── Group expansion state ──────────────────────────────────────
  const inventoryPaths = ["/categories", "/suppliers", "/purchase-orders", "/labels", "/pallets", "/scan"];
  const operationsPaths = ["/movements", "/transfers", "/departments", "/inventory/status-change", "/vehicles"];
  const fulfillmentPaths = ["/sales-orders", "/kits", "/picks"];
  const adminPaths = ["/users", "/audit", "/settings", "/integrations"];

  const [inventoryOpen, setInventoryOpen] = useState(
    inventoryPaths.some((p) => pathname.startsWith(p)),
  );
  const [operationsOpen, setOperationsOpen] = useState(
    operationsPaths.some((p) => pathname.startsWith(p)),
  );
  const [fulfillmentOpen, setFulfillmentOpen] = useState(
    fulfillmentPaths.some((p) => pathname.startsWith(p)),
  );
  const [adminOpen, setAdminOpen] = useState(
    adminPaths.some((p) => pathname.startsWith(p)),
  );

  // ── Core — always visible, no heading ──────────────────────────
  const coreGroup: NavGroup = {
    items: [
      { label: labels.nav.dashboard ?? "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: labels.nav.items, href: "/items", icon: Package, badge: labels.badges?.items },
      { label: labels.nav.warehouses, href: "/warehouses", icon: Warehouse },
      { label: labels.nav.counts, href: "/stock-counts", icon: ClipboardList },
    ],
  };

  // ── Inventory — procurement & catalog ──────────────────────────
  const inventoryItems: NavItem[] = [
    { label: labels.nav.categories, href: "/categories", icon: FolderOpen },
    { label: labels.nav.suppliers, href: "/suppliers", icon: Truck },
    { label: labels.nav.purchaseOrders, href: "/purchase-orders", icon: ShoppingCart },
    { label: labels.nav.labels ?? "Labels", href: "/labels", icon: Tag },
    { label: labels.nav.pallets ?? "Pallets", href: "/pallets", icon: Boxes },
    { label: labels.nav.scan, href: "/scan", icon: ScanLine },
  ];

  // ── Operations — warehouse moves & logistics ───────────────────
  const operationsItems: NavItem[] = [
    { label: labels.nav.movements, href: "/movements", icon: ArrowLeftRight },
    { label: labels.nav.transfers ?? "Transfers", href: "/transfers", icon: ArrowLeftRight },
    { label: labels.nav.departments ?? "Departments", href: "/departments", icon: Warehouse },
    { label: labels.nav.statusChange ?? "Status Change", href: "/inventory/status-change", icon: ToggleRight },
    { label: labels.nav.vehicles ?? "Vehicles", href: "/vehicles", icon: Truck },
  ];

  // ── Fulfillment — commerce & shipping ──────────────────────────
  const fulfillmentItems: NavItem[] = [
    { label: labels.nav.salesOrders ?? "Sales Orders", href: "/sales-orders", icon: ShoppingCart },
    { label: labels.nav.kits ?? "Kits & Bundles", href: "/kits", icon: Package },
    { label: labels.nav.picks ?? "Pick Tasks", href: "/picks", icon: ClipboardList },
  ];

  // ── Analytics — reports & insights ─────────────────────────────
  const analyticsGroup: NavGroup = {
    heading: labels.nav.analytics ?? "Analytics",
    items: [{ label: labels.nav.reports, href: "/reports", icon: BarChart3 }],
  };

  // ── Data Tools — import/export ─────────────────────────────────
  const dataToolsItems: NavItem[] = [
    { label: labels.nav.import ?? "Import", href: "/import", icon: FileUp },
    { label: labels.nav.export ?? "Export", href: "/export", icon: FileDown },
  ];

  // ── Admin — users, audit, integrations, settings ───────────────
  const adminItems: NavItem[] = [
    { label: labels.nav.users, href: "/users", icon: Users },
    { label: labels.nav.audit, href: "/audit", icon: History },
    { label: labels.nav.integrations ?? "Integrations", href: "/integrations", icon: Link2 },
    { label: labels.nav.settings, href: "/settings", icon: Settings },
  ];

  // ── Render helpers ─────────────────────────────────────────────

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

  function renderCollapsible(
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
            open ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0",
          )}
        >
          {items.map(renderItem)}
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
        {/* Core — always visible */}
        <div className="space-y-0.5">{coreGroup.items.map(renderItem)}</div>

        {/* Inventory — procurement & catalog */}
        {renderCollapsible(
          labels.nav.inventory ?? "Inventory",
          inventoryItems,
          inventoryOpen,
          setInventoryOpen,
        )}

        {/* Operations — warehouse moves & logistics */}
        {renderCollapsible(
          labels.nav.operations ?? "Operations",
          operationsItems,
          operationsOpen,
          setOperationsOpen,
        )}

        {/* Fulfillment — commerce & shipping */}
        {renderCollapsible(
          labels.nav.fulfillment ?? "Fulfillment",
          fulfillmentItems,
          fulfillmentOpen,
          setFulfillmentOpen,
        )}

        {/* Analytics — always visible, single item */}
        <div className="mt-5">
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {analyticsGroup.heading}
          </p>
          <div className="space-y-0.5">{analyticsGroup.items.map(renderItem)}</div>
        </div>

        {/* Data Tools — import/export, subtle separator */}
        <div className="mt-4 pt-3 border-t border-sidebar-border/50">
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {labels.nav.dataTools ?? "Data Tools"}
          </p>
          <div className="space-y-0.5">{dataToolsItems.map(renderItem)}</div>
        </div>

        {/* Admin — collapsible, hidden for non-admin roles */}
        {labels.showAdmin !== false
          ? renderCollapsible(labels.nav.admin, adminItems, adminOpen, setAdminOpen)
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
