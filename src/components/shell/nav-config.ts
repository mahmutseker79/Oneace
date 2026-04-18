/**
 * P1-4 (audit v1.0 §5.9) — Canonical nav config.
 * v1.5 Navigation IA refactor — zero-regression wrapper-tab model.
 *
 * Background: `sidebar.tsx` (desktop) and `mobile-nav.tsx` (mobile)
 * each used to declare their own NavItem arrays, and they drifted —
 * mobile silently omitted Dashboard, Migrations, Integrations,
 * Vehicles, and Pallets, so users on phones literally could not
 * reach those pages from the nav. This module is the single source
 * of truth for both surfaces.
 *
 * v1.5 brief (UX/UI proposal — 2026-04):
 *   - Main sidebar collapses from 26 → 6 items (Dashboard, Inventory,
 *     Locations, Counts, Orders, Reports).
 *   - Secondary section at the bottom has 4 items (Team, Integrations,
 *     Settings, Help).
 *   - All previously sidebar-only pages remain reachable; they are
 *     re-homed as tabs inside the six wrapper pages (and Settings).
 *   - No routes are renamed or removed — this is a pure IA refactor.
 *
 * Mandatory renames:
 *   Items           → Inventory  (route `/items` kept)
 *   Warehouses      → Locations  (route `/warehouses` kept)
 *   Stock Counts    → Counts     (route `/stock-counts` kept)
 *   Purchase Orders → Orders     (route `/purchase-orders` kept, now hosts
 *                                 Purchase Orders / Receiving / Vendors /
 *                                 Sales Orders tabs)
 *   Members (Users) → Team       (route `/users` kept, hosts Members /
 *                                 Departments / Roles tabs)
 *
 * Adding a new nav item: edit this file. Both surfaces pick it up
 * automatically. `adminOnly` gates an item to admin users;
 * `activePathPrefixes` on an item lets a top-level entry (e.g.
 * Inventory) light up when the user is on any of its sub-pages
 * (/items, /movements, /categories, …).
 */

import {
  BarChart3,
  ClipboardList,
  HelpCircle,
  LayoutDashboard,
  Link2,
  Package,
  Settings,
  ShoppingCart,
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
  /**
   * Extra path prefixes that should mark this item as the active
   * sidebar entry. Used by wrapper pages that own several sub-routes
   * (e.g. Inventory owns /items, /movements, /categories, …).
   */
  activePathPrefixes?: string[];
  /** Gate this item behind the showAdmin flag. */
  adminOnly?: boolean;
};

export type NavGroup = {
  id: string;
  /** Section heading; omit for the always-visible primary group. */
  headingKey?: keyof SidebarLabels["nav"];
  fallbackHeading?: string;
  items: NavItem[];
  /**
   * Render hint:
   *   - "always"      → expanded, no toggle (v1.5 primary + secondary)
   *   - "collapsible" → user can collapse (legacy IA; kept for the
   *                     type but unused in v1.5)
   *   - "admin"       → collapsible AND hidden when `showAdmin === false`
   *                     (legacy IA; v1.5 gates per-item via `adminOnly`)
   */
  mode: "always" | "collapsible" | "admin";
  /**
   * Where the group renders.
   *   - "primary"   → main sidebar column (top)
   *   - "secondary" → bottom alt-section, separated by a divider
   * Defaults to "primary" when omitted.
   */
  placement?: "primary" | "secondary";
  /** Path prefixes that mark this group as containing the active page. */
  activePathPrefixes?: string[];
};

// ─────────────────────────────────────────────────────────────────────
// The single source of truth. Order is the render order.
// ─────────────────────────────────────────────────────────────────────

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: "primary",
    mode: "always",
    placement: "primary",
    items: [
      {
        id: "dashboard",
        labelKey: "dashboard",
        fallbackLabel: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
      },
      {
        // Inventory wrapper: /items is the list page; Activity /
        // Low Stock / Categories / Labels / Pallets / Kits live as
        // in-page tabs inside the wrapper.
        id: "inventory",
        labelKey: "inventory",
        fallbackLabel: "Inventory",
        href: "/items",
        icon: Package,
        badgeKey: "items",
        activePathPrefixes: [
          "/items",
          "/movements",
          "/categories",
          "/labels",
          "/pallets",
          "/kits",
          "/inventory",
        ],
      },
      {
        // Locations wrapper: /warehouses hosts Overview / Bins /
        // Activity / Counts / Transfers / Vehicles tabs.
        id: "locations",
        labelKey: "locations",
        fallbackLabel: "Locations",
        href: "/warehouses",
        icon: Warehouse,
        activePathPrefixes: ["/warehouses", "/transfers", "/vehicles"],
      },
      {
        id: "counts",
        labelKey: "counts",
        fallbackLabel: "Counts",
        href: "/stock-counts",
        icon: ClipboardList,
      },
      {
        // Orders wrapper: /purchase-orders hosts Purchase Orders /
        // Receiving / Vendors (Suppliers) / Sales Orders / Picks tabs.
        id: "orders",
        labelKey: "orders",
        fallbackLabel: "Orders",
        href: "/purchase-orders",
        icon: ShoppingCart,
        activePathPrefixes: ["/purchase-orders", "/suppliers", "/sales-orders", "/picks"],
      },
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
    id: "secondary",
    mode: "always",
    placement: "secondary",
    items: [
      {
        // Team wrapper: /users hosts Members / Departments / Roles.
        id: "team",
        labelKey: "team",
        fallbackLabel: "Team",
        href: "/users",
        icon: Users,
        adminOnly: true,
        activePathPrefixes: ["/users", "/departments"],
      },
      {
        id: "integrations",
        labelKey: "integrations",
        fallbackLabel: "Integrations",
        href: "/integrations",
        icon: Link2,
        adminOnly: true,
      },
      {
        // Settings hosts General / Audit / Data (Import/Export/
        // Migrations) / Integrations tabs.
        id: "settings",
        labelKey: "settings",
        fallbackLabel: "Settings",
        href: "/settings",
        icon: Settings,
        adminOnly: true,
        activePathPrefixes: ["/settings", "/audit", "/import", "/export", "/migrations"],
      },
      {
        id: "help",
        labelKey: "help",
        fallbackLabel: "Help",
        href: "/help",
        icon: HelpCircle,
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────
// Render helpers — shared between desktop and mobile.
// ─────────────────────────────────────────────────────────────────────

export function resolveLabel(item: NavItem, labels: SidebarLabels): string {
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

/**
 * v1.5: an item is "active" if the current pathname matches its
 * `href` OR any of its `activePathPrefixes`. Wrapper items (Inventory,
 * Locations, Orders) use the prefix list to light up whenever the
 * user is on any re-homed sub-page.
 */
export function isItemActive(item: NavItem, pathname: string): boolean {
  if (pathname === item.href || pathname.startsWith(`${item.href}/`)) return true;
  if (item.activePathPrefixes) {
    return item.activePathPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  }
  return false;
}

export function isGroupActive(group: NavGroup, pathname: string): boolean {
  if (!group.activePathPrefixes) return false;
  return group.activePathPrefixes.some((p) => pathname.startsWith(p));
}

/**
 * v1.5: admin gating is now per-item (`adminOnly: true`). `visibleGroups`
 * strips those items when `showAdmin === false`, and drops any group
 * left empty as a result. Legacy `mode: "admin"` groups (if any were
 * re-introduced) are still dropped wholesale.
 */
export function visibleGroups(showAdmin: boolean): readonly NavGroup[] {
  return NAV_GROUPS.filter((g) => showAdmin || g.mode !== "admin")
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => showAdmin || !item.adminOnly),
    }))
    .filter((g) => g.items.length > 0);
}

/**
 * Partition groups by their rendered placement (top vs bottom section).
 * The sidebar uses this to draw a divider between the primary column
 * and the Team/Integrations/Settings/Help alt section.
 */
export function primaryGroups(groups: readonly NavGroup[]): readonly NavGroup[] {
  return groups.filter((g) => (g.placement ?? "primary") === "primary");
}

export function secondaryGroups(groups: readonly NavGroup[]): readonly NavGroup[] {
  return groups.filter((g) => g.placement === "secondary");
}
