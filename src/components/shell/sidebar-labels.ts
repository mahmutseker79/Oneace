/**
 * P1-4 (audit v1.0 §5.9) — Shared label/badge contract for the
 * sidebar surfaces.
 *
 * Extracted from `sidebar.tsx` so both `sidebar.tsx` (desktop) and
 * `nav-config.ts` (the canonical nav structure) can reference the
 * type without a circular import. The shape is unchanged — only
 * the file it lives in moved.
 */

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
    migrations?: string;
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
