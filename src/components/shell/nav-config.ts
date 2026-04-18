/**
 * P1-4 (audit v1.0 §5.9) — Canonical nav config.
 *
 * Background: `sidebar.tsx` (desktop) and `mobile-nav.tsx` (mobile)
 * each used to declare their own NavItem arrays, and they drifted —
 * mobile silently omitted Dashboard, Migrations, Integrations,
 * Vehicles, and Pallets, so users on phones literally could not
 * reach those pages from the nav. This module is the single source
 * of truth for both surfaces.
 *
 * Adding a new nav item: edit this file. Both surfaces pick it up
 * automatically. The render shape (collapsed vs always-open, where
 * the section heading sits, what icon, etc.) is encoded per group
 * so each surface can faithfully reproduce the layout without
 * forking the data.
 */

import {
  ArrowLeftRight,
  BarChart3,
  Boxes,
  ClipboardList,
  Database,
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

import type { SidebarLabels } from "./sidebar-labels";

export type NavItem = {
  /** Stable id for the group/item — used for keys + analytics, never shown. */
  id: string;
  /** Human label resolved from `labels.nav` at render time. */
  labelKey: keyof SidebarLabels["nav"];
  /** Fallback if the i18n key is missing. */
  fallbackLabel: string;
  href: `/${string}`;
  icon: React.ComponentType<{ className?: string }>;
  /** Badge slot key, looked up against `labels.badges`. */
  badgeKey?: keyof NonNullable<SidebarLabels["badges"]>;
};

export type NavGroup = {
  id: string;
  /** Section heading; omit for the always-visible Core group. */
  headingKey?: keyof SidebarLabels["nav"];
  fallbackHeading?: string;
  items: NavItem[];
  /**
   * Render hint:
   *   - "always" → expanded, no toggle (Core, Analytics, Data Tools)
   *   - "collapsible" → user can collapse (Inventory, Operations, Fulfillment)
   *   - "admin" → collapsible AND hidden when `showAdmin === false`
   */
  mode: "always" | "collapsible" | "admin";
  /** Path prefixes that mark this group as containing the active page. */
  activePathPrefixes?: string[];
};

// ─────────────────────────────────────────────────────────────────────
// The single source of truth. Order is the render order.
// ─────────────────────────────────────────────────────────────────────

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: "core",
    mode: "always",
    items: [
      {
        id: "dashboard",
        labelKey: "dashboard",
        fallbackLabel: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
      },
      {
        id: "items",
        labelKey: "items",
        fallbackLabel: "Items",
        href: "/items",
        icon: Package,
        badgeKey: "items",
      },
      {
        id: "warehouses",
        labelKey: "warehouses",
        fallbackLabel: "Warehouses",
        href: "/warehouses",
        icon: Warehouse,
      },
      {
        id: "stock-counts",
        labelKey: "counts",
        fallbackLabel: "Stock Counts",
        href: "/stock-counts",
        icon: ClipboardList,
      },
    ],
  },
  {
    id: "inventory",
    mode: "collapsible",
    headingKey: "inventory",
    fallbackHeading: "Inventory",
    activePathPrefixes: [
      "/categories",
      "/suppliers",
      "/purchase-orders",
      "/labels",
      "/pallets",
      "/scan",
    ],
    items: [
      {
        id: "categories",
        labelKey: "categories",
        fallbackLabel: "Categories",
        href: "/categories",
        icon: FolderOpen,
      },
      {
        id: "suppliers",
        labelKey: "suppliers",
        fallbackLabel: "Suppliers",
        href: "/suppliers",
        icon: Truck,
      },
      {
        id: "purchase-orders",
        labelKey: "purchaseOrders",
        fallbackLabel: "Purchase Orders",
        href: "/purchase-orders",
        icon: ShoppingCart,
      },
      {
        id: "labels",
        labelKey: "labels",
        fallbackLabel: "Labels",
        href: "/labels",
        icon: Tag,
      },
      {
        id: "pallets",
        labelKey: "pallets",
        fallbackLabel: "Pallets",
        href: "/pallets",
        icon: Boxes,
      },
      {
        id: "scan",
        labelKey: "scan",
        fallbackLabel: "Scan",
        href: "/scan",
        icon: ScanLine,
      },
    ],
  },
  {
    id: "operations",
    mode: "collapsible",
    headingKey: "operations",
    fallbackHeading: "Operations",
    activePathPrefixes: [
      "/movements",
      "/transfers",
      "/departments",
      "/inventory/status-change",
      "/vehicles",
    ],
    items: [
      {
        id: "movements",
        labelKey: "movements",
        fallbackLabel: "Movements",
        href: "/movements",
        icon: ArrowLeftRight,
      },
      {
        id: "transfers",
        labelKey: "transfers",
        fallbackLabel: "Transfers",
        href: "/transfers",
        icon: ArrowLeftRight,
      },
      {
        id: "departments",
        labelKey: "departments",
        fallbackLabel: "Departments",
        href: "/departments",
        icon: Warehouse,
      },
      {
        id: "status-change",
        labelKey: "statusChange",
        fallbackLabel: "Status Change",
        href: "/inventory/status-change",
        icon: ToggleRight,
      },
      {
        id: "vehicles",
        labelKey: "vehicles",
        fallbackLabel: "Vehicles",
        href: "/vehicles",
        icon: Truck,
      },
    ],
  },
  {
    id: "fulfillment",
    mode: "collapsible",
    headingKey: "fulfillment",
    fallbackHeading: "Fulfillment",
    activePathPrefixes: ["/sales-orders", "/kits", "/picks"],
    items: [
      {
        id: "sales-orders",
        labelKey: "salesOrders",
        fallbackLabel: "Sales Orders",
        href: "/sales-orders",
        icon: ShoppingCart,
      },
      {
        id: "kits",
        labelKey: "kits",
        fallbackLabel: "Kits & Bundles",
        href: "/kits",
        icon: Package,
      },
      {
        id: "picks",
        labelKey: "picks",
        fallbackLabel: "Pick Tasks",
        href: "/picks",
        icon: ClipboardList,
      },
    ],
  },
  {
    id: "analytics",
    mode: "always",
    headingKey: "analytics",
    fallbackHeading: "Analytics",
    items: [
      {
        id: "reports",
        labelKey: "reports",
        fallbackLabel: "Reports",
        href: "/reports",
        icon: BarChart3,
      },
    ],
  },
  {
    id: "data-tools",
    mode: "always",
    headingKey: "dataTools",
    fallbackHeading: "Data Tools",
    items: [
      {
        id: "import",
        labelKey: "import",
        fallbackLabel: "Import",
        href: "/import",
        icon: FileUp,
      },
      {
        id: "export",
        labelKey: "export",
        fallbackLabel: "Export",
        href: "/export",
        icon: FileDown,
      },
      {
        id: "migrations",
        labelKey: "migrations",
        fallbackLabel: "Göç / Migrations",
        href: "/migrations",
        icon: Database,
      },
    ],
  },
  {
    id: "admin",
    mode: "admin",
    headingKey: "admin",
    fallbackHeading: "Admin",
    activePathPrefixes: ["/users", "/audit", "/settings", "/integrations"],
    items: [
      {
        id: "users",
        labelKey: "users",
        fallbackLabel: "Users",
        href: "/users",
        icon: Users,
      },
      {
        id: "audit",
        labelKey: "audit",
        fallbackLabel: "Audit",
        href: "/audit",
        icon: History,
      },
      {
        id: "integrations",
        labelKey: "integrations",
        fallbackLabel: "Integrations",
        href: "/integrations",
        icon: Link2,
      },
      {
        id: "settings",
        labelKey: "settings",
        fallbackLabel: "Settings",
        href: "/settings",
        icon: Settings,
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────
// Render helpers — shared between desktop and mobile.
// ─────────────────────────────────────────────────────────────────────

export function resolveLabel(
  item: NavItem,
  labels: SidebarLabels,
): string {
  const value = labels.nav[item.labelKey];
  return typeof value === "string" && value.length > 0 ? value : item.fallbackLabel;
}

export function resolveHeading(group: NavGroup, labels: SidebarLabels): string {
  if (!group.headingKey) return "";
  const value = labels.nav[group.headingKey];
  if (typeof value === "string" && value.length > 0) return value;
  return group.fallbackHeading ?? "";
}

export function resolveBadge(item: NavItem, labels: SidebarLabels): string | undefined {
  if (!item.badgeKey) return undefined;
  return labels.badges?.[item.badgeKey];
}

export function isItemActive(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isGroupActive(group: NavGroup, pathname: string): boolean {
  if (!group.activePathPrefixes) return false;
  return group.activePathPrefixes.some((p) => pathname.startsWith(p));
}

/**
 * Filter out the admin group when the caller doesn't have permission.
 * Both surfaces should pipe NAV_GROUPS through this before rendering.
 */
export function visibleGroups(showAdmin: boolean): readonly NavGroup[] {
  if (showAdmin) return NAV_GROUPS;
  return NAV_GROUPS.filter((g) => g.mode !== "admin");
}
