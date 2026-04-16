/**
 * Phase 13.1 — Plan capability model.
 *
 * Single source of truth for what each plan can do.
 * Used by server actions (enforcement), route pages (guards), and
 * client components (upgrade prompts).
 *
 * Ground rules:
 *   - Zero DB calls. Pure logic over the Plan enum value.
 *   - Both server and client safe (no server-only imports).
 *   - Easy to extend without touching every call site.
 *   - Explicit: every capability is listed for every plan.
 *
 * Plan tiers (aligned with Prisma Plan enum and public pricing page):
 *
 *   FREE
 *     - Up to 100 items
 *     - 1 warehouse location
 *     - 3 team members (including owner)
 *     - Barcode scanning, stock counts, movements — core ops
 *     - No bins, no purchase orders, no exports, no reports, no audit
 *
 *   PRO ($29/mo)
 *     - Unlimited items
 *     - Unlimited warehouses
 *     - Up to 10 team members
 *     - Bins, purchase orders, transfers, putaway
 *     - Exports (CSV + Excel), standard reports, low-stock alerts
 *     - No audit log
 *
 *   BUSINESS ($79/mo)
 *     - Unlimited everything (practical limits only)
 *     - Unlimited team members
 *     - Audit log access
 *     - Priority support positioning
 *
 * Competitive context:
 *   Sortly Ultra = $149/mo for 2,000 items, 5 users, no bins, no offline.
 *   OneAce Pro   = $29/mo, unlimited items, 10 users, bins, offline.
 */

// ---------------------------------------------------------------------------
// Type aliases for the Plan enum — avoids importing from Prisma in client code
// ---------------------------------------------------------------------------

export type Plan = "FREE" | "PRO" | "BUSINESS";

// ---------------------------------------------------------------------------
// Capabilities (boolean feature flags)
// ---------------------------------------------------------------------------

export type PlanCapability =
  | "bins" // bin-level inventory tracking + putaway + bin transfer
  | "purchaseOrders" // purchase order creation and PO receiving
  | "exports" // CSV and Excel export endpoints
  | "reports" // stock value, movement history, bin inventory, supplier reports
  | "transfers" // inter-warehouse transfer wizard
  | "auditLog" // access to the audit log page
  | "lowStockAlerts" // low-stock alert notifications
  | "labels" // label template creation and customization
  | "abcAnalysis" // ABC classification and analysis reports
  | "scheduledReports" // automated scheduled report delivery
  | "kits" // kit assembly and disassembly operations
  | "picks" // pick task creation and management
  | "salesOrders"; // sales order creation and management

/**
 * Capability map — explicit for every plan/capability combination so
 * adding a new capability or tier doesn't silently leave gaps.
 */
const CAPABILITIES: Record<Plan, Record<PlanCapability, boolean>> = {
  FREE: {
    bins: false,
    purchaseOrders: false,
    exports: false,
    reports: false,
    transfers: false,
    auditLog: false,
    lowStockAlerts: false,
    labels: false,
    abcAnalysis: false,
    scheduledReports: false,
    kits: false,
    picks: false,
    salesOrders: false,
  },
  PRO: {
    bins: true,
    purchaseOrders: true,
    exports: true,
    reports: true,
    transfers: true,
    auditLog: false,
    lowStockAlerts: true,
    labels: true,
    abcAnalysis: true,
    scheduledReports: false,
    kits: true,
    picks: true,
    salesOrders: true,
  },
  BUSINESS: {
    bins: true,
    purchaseOrders: true,
    exports: true,
    reports: true,
    transfers: true,
    auditLog: true,
    lowStockAlerts: true,
    labels: true,
    abcAnalysis: true,
    scheduledReports: true,
    kits: true,
    picks: true,
    salesOrders: true,
  },
};

// ---------------------------------------------------------------------------
// Numeric limits
// ---------------------------------------------------------------------------

export type PlanLimit = "items" | "warehouses" | "members";

/** Sentinel value meaning "no limit" for a given plan/limit combination. */
export const UNLIMITED = Number.POSITIVE_INFINITY;

const LIMITS: Record<Plan, Record<PlanLimit, number>> = {
  FREE: {
    items: 100,
    warehouses: 1,
    members: 3,
  },
  PRO: {
    items: UNLIMITED,
    warehouses: UNLIMITED,
    members: 10,
  },
  BUSINESS: {
    items: UNLIMITED,
    warehouses: UNLIMITED,
    members: UNLIMITED,
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns true when the given plan has access to the capability.
 */
export function hasPlanCapability(plan: Plan, capability: PlanCapability): boolean {
  return CAPABILITIES[plan][capability];
}

/**
 * Returns the numeric limit for a given plan + limit combination.
 * Returns `UNLIMITED` (Infinity) when no limit applies.
 */
export function getPlanLimit(plan: Plan, limit: PlanLimit): number {
  return LIMITS[plan][limit];
}

/**
 * Checks whether a creation action is within the plan's numeric limit.
 *
 * Returns:
 *   { allowed: true }  — current count is below limit
 *   { allowed: false, limit, current } — at or above limit; include in error copy
 *
 * Usage in server actions:
 *   const check = checkPlanLimit(plan, "items", currentItemCount);
 *   if (!check.allowed) {
 *     return { ok: false, error: planLimitError("items", check) };
 *   }
 */
export type LimitCheckResult =
  | { allowed: true }
  | { allowed: false; limit: number; current: number };

export function checkPlanLimit(
  plan: Plan,
  limitKey: PlanLimit,
  currentCount: number,
): LimitCheckResult {
  const limit = getPlanLimit(plan, limitKey);
  if (limit === UNLIMITED) return { allowed: true };
  if (currentCount < limit) return { allowed: true };
  return { allowed: false, limit, current: currentCount };
}

// ---------------------------------------------------------------------------
// Human-readable upgrade messages
// These are returned by server actions so the client can show them as-is.
// Kept here so the copy is co-located with the enforcement model.
// ---------------------------------------------------------------------------

/**
 * Returns a plan-restriction error message for a capability.
 * Used when a user tries to access a feature not in their plan.
 */
export function planCapabilityError(capability: PlanCapability): string {
  switch (capability) {
    case "bins":
      return "Bin-level inventory tracking is available on Pro and Business plans. Upgrade to continue.";
    case "purchaseOrders":
      return "Purchase orders are available on Pro and Business plans. Upgrade to continue.";
    case "exports":
      return "Exports are available on Pro and Business plans. Upgrade to unlock CSV and Excel exports.";
    case "reports":
      return "Advanced reports are available on Pro and Business plans. Upgrade to access.";
    case "transfers":
      return "Inter-warehouse transfers are available on Pro and Business plans. Upgrade to continue.";
    case "auditLog":
      return "The audit log is available on the Business plan. Upgrade to access your full activity history.";
    case "lowStockAlerts":
      return "Low-stock alerts are available on Pro and Business plans. Upgrade to enable notifications.";
    case "labels":
      return "Label customization is available on Pro and Business plans. Upgrade to continue.";
    case "abcAnalysis":
      return "ABC analysis and classification are available on Pro and Business plans. Upgrade to access.";
    case "scheduledReports":
      return "Scheduled reports are available on the Business plan. Upgrade to automate report delivery.";
    case "kits":
      return "Kit management is available on Pro and Business plans. Upgrade to continue.";
    case "picks":
      return "Pick task management is available on Pro and Business plans. Upgrade to continue.";
    case "salesOrders":
      return "Sales orders are available on Pro and Business plans. Upgrade to continue.";
  }
}

/**
 * Returns a plan-restriction error message for a numeric limit.
 * Used when a creation action would exceed the plan's limit.
 */
export function planLimitError(
  limitKey: PlanLimit,
  result: Extract<LimitCheckResult, { allowed: false }>,
): string {
  switch (limitKey) {
    case "items":
      return `Your current plan includes up to ${result.limit} items. You have ${result.current}. Upgrade to Pro for unlimited items.`;
    case "warehouses":
      return `Your current plan includes ${result.limit} warehouse location. Upgrade to Pro for unlimited locations.`;
    case "members":
      return `Your current plan includes up to ${result.limit} team members. You have ${result.current}. Upgrade to ${result.limit <= 3 ? "Pro" : "Business"} to add more.`;
  }
}

/**
 * Returns the minimum plan required to unlock a capability.
 * Used by upgrade prompt copy.
 */
export function requiredPlanFor(capability: PlanCapability): Exclude<Plan, "FREE"> {
  if (capability === "auditLog" || capability === "scheduledReports") return "BUSINESS";
  return "PRO";
}

// ---------------------------------------------------------------------------
// Phase B/C/D/E — Extended plan capabilities (arrays + new booleans).
//
// Backward-compatible addition: the existing boolean `CAPABILITIES` record
// is preserved. This extended map lists methodology-level access so pages
// can show "this methodology is Pro+" messaging without a second lookup.
//
// Call sites:
//   - Count creation wizard (countMethodologies)
//   - Count scope selector (countScope)
//   - Import wizard (importSources)
//   - Export dropdown (exportFormats)
//   - Approval workflow toggle (approvalWorkflow)
//   - Count comparison page (countComparison)
//   - Outbound webhook UI (webhooks)
//   - Department management page (departments)
//   - Sync Center (integrations)
//   - Template library (countTemplates)
// ---------------------------------------------------------------------------

// Aligned with Prisma CountMethodology enum (schema.prisma).
export type CountMethodology =
  | "CYCLE"
  | "FULL"
  | "SPOT"
  | "BLIND"
  | "DOUBLE_BLIND"
  | "DIRECTED"
  | "PARTIAL";
export type CountScope = "FULL" | "PARTIAL" | "DEPARTMENT";
export type ImportSource =
  | "CSV"
  | "XLSX"
  | "QBO"
  | "QBD"
  | "SHOPIFY"
  | "WOOCOMMERCE"
  | "XERO"
  | "AMAZON";
export type ExportFormat = "CSV" | "XLSX" | "PDF" | "JSON";

export type ExtendedCapability =
  | "approvalWorkflow"
  | "countComparison"
  | "webhooks"
  | "departments"
  | "integrations"
  | "countTemplates";

export interface PlanCapabilityExtended {
  countMethodologies: readonly CountMethodology[];
  countScope: readonly CountScope[];
  importSources: readonly ImportSource[];
  exportFormats: readonly ExportFormat[];
  approvalWorkflow: boolean;
  countComparison: boolean;
  webhooks: boolean;
  departments: boolean;
  integrations: boolean;
  countTemplates: boolean;
}

export const PLAN_CAPABILITIES_EXTENDED: Record<Plan, PlanCapabilityExtended> = {
  FREE: {
    // Basic: full warehouse or spot checks, blind-count only
    countMethodologies: ["FULL", "SPOT", "BLIND"],
    countScope: ["FULL", "PARTIAL"],
    importSources: ["CSV"],
    exportFormats: ["CSV"],
    approvalWorkflow: false,
    countComparison: false,
    webhooks: false,
    departments: false,
    integrations: false,
    countTemplates: false,
  },
  PRO: {
    // Adds cycle counts, directed counts, and partial methodology
    countMethodologies: ["FULL", "SPOT", "BLIND", "CYCLE", "DIRECTED", "PARTIAL"],
    countScope: ["FULL", "PARTIAL", "DEPARTMENT"],
    importSources: ["CSV", "XLSX", "QBO", "SHOPIFY", "WOOCOMMERCE"],
    exportFormats: ["CSV", "XLSX", "PDF"],
    approvalWorkflow: true,
    countComparison: true,
    webhooks: false,
    departments: true,
    integrations: true,
    countTemplates: true,
  },
  BUSINESS: {
    // All methodologies including double-blind for high-value audits
    countMethodologies: ["CYCLE", "FULL", "SPOT", "BLIND", "DOUBLE_BLIND", "DIRECTED", "PARTIAL"],
    countScope: ["FULL", "PARTIAL", "DEPARTMENT"],
    importSources: ["CSV", "XLSX", "QBO", "QBD", "SHOPIFY", "WOOCOMMERCE", "XERO", "AMAZON"],
    exportFormats: ["CSV", "XLSX", "PDF", "JSON"],
    approvalWorkflow: true,
    countComparison: true,
    webhooks: true,
    departments: true,
    integrations: true,
    countTemplates: true,
  },
};

/**
 * Returns true if the plan supports a specific count methodology.
 */
export function supportsCountMethodology(plan: Plan, methodology: CountMethodology): boolean {
  return PLAN_CAPABILITIES_EXTENDED[plan].countMethodologies.includes(methodology);
}

/**
 * Returns true if the plan supports a specific count scope.
 */
export function supportsCountScope(plan: Plan, scope: CountScope): boolean {
  return PLAN_CAPABILITIES_EXTENDED[plan].countScope.includes(scope);
}

/**
 * Returns true if the plan supports a specific import source.
 */
export function supportsImportSource(plan: Plan, source: ImportSource): boolean {
  return PLAN_CAPABILITIES_EXTENDED[plan].importSources.includes(source);
}

/**
 * Returns true if the plan supports a specific export format.
 */
export function supportsExportFormat(plan: Plan, format: ExportFormat): boolean {
  return PLAN_CAPABILITIES_EXTENDED[plan].exportFormats.includes(format);
}

/**
 * Returns true when the plan has access to the extended capability.
 * Mirrors `hasPlanCapability` but for the Phase B/C/D/E feature set.
 */
export function hasExtendedCapability(plan: Plan, capability: ExtendedCapability): boolean {
  return PLAN_CAPABILITIES_EXTENDED[plan][capability];
}
