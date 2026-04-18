/**
 * v1.5 Navigation IA — wrapper tab definitions.
 *
 * Each primary sidebar wrapper (Inventory, Locations, Counts, Orders,
 * Team, Settings) has a tab row that collects its re-homed sub-pages.
 * The tab lists live here so every page renders the *same* shape,
 * and so adding a new sub-page is a one-line change.
 *
 * Label strings are i18n-resolved in the page that renders the tabs,
 * via `resolveWrapperTabs` helper. Callers pass their `t.nav` or
 * `t.wrapperTabs` slice and get back tabs with concrete `label`
 * strings.
 */

import type { WrapperTab } from "./wrapper-tabs";

// ─── Shape declarations (labels filled in at render time) ────────────

type TabSpec = Omit<WrapperTab, "label"> & {
  /** Dot-path into the caller's label source, e.g. "nav.categories". */
  labelKey: string;
  /** Fallback if the label lookup fails. */
  fallbackLabel: string;
};

export const INVENTORY_TAB_SPECS: readonly TabSpec[] = [
  {
    id: "items",
    labelKey: "nav.items",
    fallbackLabel: "Items",
    href: "/items",
  },
  {
    id: "activity",
    labelKey: "nav.movements",
    fallbackLabel: "Activity",
    href: "/movements",
    activePrefixes: ["/movements"],
  },
  {
    id: "categories",
    labelKey: "nav.categories",
    fallbackLabel: "Categories",
    href: "/categories",
  },
  {
    id: "labels",
    labelKey: "nav.labels",
    fallbackLabel: "Labels",
    href: "/labels",
  },
  {
    id: "pallets",
    labelKey: "nav.pallets",
    fallbackLabel: "Pallets",
    href: "/pallets",
  },
  {
    id: "kits",
    labelKey: "nav.kits",
    fallbackLabel: "Kits",
    href: "/kits",
  },
];

export const LOCATIONS_TAB_SPECS: readonly TabSpec[] = [
  {
    id: "locations",
    labelKey: "nav.warehouses",
    fallbackLabel: "Locations",
    href: "/warehouses",
  },
  {
    id: "transfers",
    labelKey: "nav.transfers",
    fallbackLabel: "Transfers",
    href: "/transfers",
  },
  {
    id: "vehicles",
    labelKey: "nav.vehicles",
    fallbackLabel: "Vehicles",
    href: "/vehicles",
  },
];

export const ORDERS_TAB_SPECS: readonly TabSpec[] = [
  {
    id: "purchase-orders",
    labelKey: "nav.purchaseOrders",
    fallbackLabel: "Purchase Orders",
    href: "/purchase-orders",
  },
  {
    id: "suppliers",
    labelKey: "nav.suppliers",
    fallbackLabel: "Vendors",
    href: "/suppliers",
  },
  {
    id: "sales-orders",
    labelKey: "nav.salesOrders",
    fallbackLabel: "Sales Orders",
    href: "/sales-orders",
  },
  {
    id: "picks",
    labelKey: "nav.picks",
    fallbackLabel: "Picks",
    href: "/picks",
  },
];

export const TEAM_TAB_SPECS: readonly TabSpec[] = [
  {
    id: "members",
    labelKey: "nav.users",
    fallbackLabel: "Members",
    href: "/users",
  },
  {
    id: "departments",
    labelKey: "nav.departments",
    fallbackLabel: "Departments",
    href: "/departments",
  },
];

export const SETTINGS_TAB_SPECS: readonly TabSpec[] = [
  {
    id: "general",
    labelKey: "nav.settings",
    fallbackLabel: "General",
    href: "/settings",
  },
  {
    id: "audit",
    labelKey: "nav.audit",
    fallbackLabel: "Audit",
    href: "/audit",
  },
  {
    id: "import",
    labelKey: "nav.import",
    fallbackLabel: "Import",
    href: "/import",
  },
  {
    id: "export",
    labelKey: "nav.export",
    fallbackLabel: "Export",
    href: "/export",
  },
  {
    id: "migrations",
    labelKey: "nav.migrations",
    fallbackLabel: "Migrations",
    href: "/migrations",
  },
];

// ─── Label resolution ────────────────────────────────────────────────

type LabelSource = Record<string, unknown>;

/**
 * Resolve a dot-path label ("nav.items") against a messages tree.
 * Returns undefined when the path is missing so the caller can fall
 * back to the TabSpec's fallbackLabel.
 */
function lookupLabel(source: LabelSource, path: string): string | undefined {
  const parts = path.split(".");
  let cursor: unknown = source;
  for (const part of parts) {
    if (cursor && typeof cursor === "object" && part in (cursor as LabelSource)) {
      cursor = (cursor as LabelSource)[part];
    } else {
      return undefined;
    }
  }
  return typeof cursor === "string" ? cursor : undefined;
}

/** Convert a list of tab specs into concrete WrapperTabs with labels. */
export function resolveWrapperTabs(specs: readonly TabSpec[], labels: LabelSource): WrapperTab[] {
  return specs.map((spec) => {
    const label = lookupLabel(labels, spec.labelKey) ?? spec.fallbackLabel;
    return {
      id: spec.id,
      label,
      href: spec.href,
      activePrefixes: spec.activePrefixes,
    };
  });
}
