/**
 * P10.1 — Centralized role-based permission system.
 *
 * Single source of truth for what each role can do. Every server action
 * and UI component should check capabilities through the helpers exported
 * here — never scatter inline `membership.role === "OWNER"` checks.
 *
 * Role hierarchy (highest → lowest):
 *   OWNER    → full org control
 *   ADMIN    → manage operational config + team + all inventory ops
 *   MANAGER  → DEPRECATED alias for MEMBER (see below)
 *   MEMBER   → day-to-day inventory operations ("Operator" in UI)
 *   VIEWER   → read-only access
 *
 * P2-3 (audit v1.0 §5.16) — ghost MANAGER cleanup.
 * The MANAGER enum value survives for historical data, but it is
 * no longer assignable (see `ASSIGNABLE_ROLES`) and no longer
 * carries any bespoke capability in `CAPABILITY_MAP`. Capability
 * lookups for MANAGER are normalised through `normalizeLegacyRole`
 * and resolved against the MEMBER row, so an org that still has a
 * MANAGER membership in the database keeps exactly the access an
 * Operator has. A later migration will collapse MANAGER → MEMBER
 * at the schema level; until then, keeping the alias live is the
 * backwards-compatible path.
 *
 * The enum values come from `prisma/schema.prisma` and MUST NOT be
 * changed here — this module consumes them, never redefines them.
 */

import type { Role } from "@/generated/prisma";

// ---------------------------------------------------------------------------
// Capability definitions
// ---------------------------------------------------------------------------

/**
 * Every permission-gated action in the app maps to exactly one capability.
 * Names follow the `resource.verb` convention so they sort naturally and
 * read well in test assertions.
 */
export type Capability =
  // Items
  | "items.create"
  | "items.edit"
  | "items.delete"
  | "items.import"
  // Item attachments
  | "items.attachments.create"
  | "items.attachments.edit"
  | "items.attachments.delete"
  // Item serials
  | "items.serials.create"
  | "items.serials.edit"
  | "items.serials.delete"
  // Locations (hierarchy)
  | "locations.create"
  | "locations.edit"
  | "locations.delete"
  // Settings
  | "settings.manage"
  // Movements
  | "movements.create"
  // Stock counts
  | "stockCounts.create"
  | "stockCounts.addEntry"
  | "stockCounts.reconcile"
  | "stockCounts.cancel"
  | "stockCounts.submitForApproval"
  | "stockCounts.approve"
  | "stockCounts.reject"
  | "stockCounts.rollback"
  // Purchase orders
  | "purchaseOrders.create"
  | "purchaseOrders.edit"
  | "purchaseOrders.send"
  | "purchaseOrders.receive"
  | "purchaseOrders.cancel"
  | "purchaseOrders.delete"
  // Suppliers
  | "suppliers.create"
  | "suppliers.edit"
  | "suppliers.delete"
  // Warehouses & bins
  | "warehouses.create"
  | "warehouses.edit"
  | "warehouses.delete"
  | "bins.create"
  | "bins.edit"
  | "bins.delete"
  | "bins.transfer"
  // Labels
  | "labels.create"
  | "labels.edit"
  | "labels.delete"
  // Categories
  | "categories.create"
  | "categories.edit"
  | "categories.delete"
  // Departments (Phase B)
  | "departments.create"
  | "departments.edit"
  | "departments.delete"
  // Count assignments (Phase B)
  | "countAssignments.create"
  | "countAssignments.remove"
  // Count templates (Phase B)
  | "countTemplates.create"
  | "countTemplates.edit"
  | "countTemplates.delete"
  // Reports & exports
  | "reports.export"
  | "reports.schedule"
  | "reports.abcClassify"
  // Reorder config
  | "reorderConfig.edit"
  // Phase E: Integrations
  | "integrations.connect"
  | "integrations.disconnect"
  | "integrations.sync"
  // Phase E: Imports
  | "imports.create"
  | "imports.cancel"
  // Migrations (competitor data migration)
  | "migrations.create"
  | "migrations.start"
  | "migrations.cancel"
  | "migrations.rollback"
  | "migrations.delete"
  // Phase E: Webhooks
  | "webhooks.create"
  | "webhooks.edit"
  | "webhooks.delete"
  // Inventory management
  | "inventory.manageStatus"
  // Transfers
  | "transfers.create"
  | "transfers.ship"
  | "transfers.receive"
  | "transfers.cancel"
  // Sales orders
  | "salesOrders.create"
  | "salesOrders.edit"
  | "salesOrders.confirm"
  | "salesOrders.allocate"
  | "salesOrders.ship"
  | "salesOrders.cancel"
  // Kits
  | "kits.create"
  | "kits.edit"
  | "kits.assemble"
  | "kits.disassemble"
  // Pick tasks
  | "picks.create"
  | "picks.assign"
  | "picks.start"
  | "picks.complete"
  | "picks.verify"
  // Assets
  | "assets.create"
  | "assets.edit"
  | "assets.assign"
  // Org admin
  | "org.editProfile"
  | "org.editDefaults"
  | "org.delete"
  | "org.transfer"
  | "org.billing"
  // Team management
  | "team.invite"
  | "team.changeRole"
  | "team.remove"
  // Audit log
  | "audit.view";

// ---------------------------------------------------------------------------
// Capability map
// ---------------------------------------------------------------------------

/**
 * The capability map. A role has a capability if and only if it appears
 * in that capability's set. Checked via `hasCapability(role, cap)`.
 *
 * Design principle: VIEWER can only read. MEMBER (Operator) can do all
 * day-to-day inventory work. ADMIN adds org/team management. OWNER
 * adds destructive org operations. MANAGER is a legacy alias for MEMBER.
 * APPROVER can approve counts and adjustments but cannot create items.
 * COUNTER can perform assigned counts but cannot approve or manage settings.
 */
const CAPABILITY_MAP: Record<Capability, ReadonlySet<Role>> = {
  // --- Items ---
  "items.create": new Set<Role>(["OWNER", "ADMIN", "MEMBER"]),
  "items.edit": new Set<Role>(["OWNER", "ADMIN", "MEMBER"]),
  "items.delete": new Set<Role>(["OWNER", "ADMIN"]),
  "items.import": new Set<Role>(["OWNER", "ADMIN", "MEMBER"]),

  // --- Item attachments ---
  "items.attachments.create": new Set<Role>(["OWNER", "ADMIN", "MEMBER"]),
  "items.attachments.edit": new Set<Role>(["OWNER", "ADMIN", "MEMBER"]),
  "items.attachments.delete": new Set<Role>(["OWNER", "ADMIN"]),

  // --- Item serials ---
  "items.serials.create": new Set<Role>(["OWNER", "ADMIN", "MEMBER"]),
  "items.serials.edit": new Set<Role>(["OWNER", "ADMIN", "MEMBER"]),
  "items.serials.delete": new Set<Role>(["OWNER", "ADMIN"]),

  // --- Locations (hierarchy) ---
  "locations.create": new Set<Role>(["OWNER", "ADMIN"]),
  "locations.edit": new Set<Role>(["OWNER", "ADMIN"]),
  "locations.delete": new Set<Role>(["OWNER", "ADMIN"]),

  // --- Settings ---
  "settings.manage": new Set<Role>(["OWNER", "ADMIN"]),

  // --- Movements ---
  "movements.create": new Set<Role>(["OWNER", "ADMIN", "MEMBER"]),

  // --- Stock counts ---
  "stockCounts.create": new Set<Role>(["OWNER", "ADMIN", "MEMBER"]),
  "stockCounts.addEntry": new Set<Role>(["OWNER", "ADMIN", "MEMBER", "COUNTER"]),
  "stockCounts.reconcile": new Set<Role>(["OWNER", "ADMIN"]),
  "stockCounts.cancel": new Set<Role>(["OWNER", "ADMIN"]),
  "stockCounts.submitForApproval": new Set<Role>([
    "OWNER",
    "ADMIN",
    "MEMBER",
    "COUNTER",
  ]),
  "stockCounts.approve": new Set<Role>(["OWNER", "ADMIN", "APPROVER"]),
  "stockCounts.reject": new Set<Role>(["OWNER", "ADMIN", "APPROVER"]),
  "stockCounts.rollback": new Set<Role>(["OWNER", "ADMIN"]),

  // --- Purchase orders ---
  "purchaseOrders.create": new Set<Role>(["OWNER", "ADMIN", "MEMBER"]),
  "purchaseOrders.edit": new Set<Role>(["OWNER", "ADMIN", "MEMBER"]),
  "purchaseOrders.send": new Set<Role>(["OWNER", "ADMIN", "MEMBER"]),
  "purchaseOrders.receive": new Set<Role>(["OWNER", "ADMIN", "MEMBER"]),
  "purchaseOrders.cancel": new Set<Role>(["OWNER", "ADMIN"]),
  "purchaseOrders.delete": new Set<Role>(["OWNER", "ADMIN"]),

  // --- Suppliers ---
  "suppliers.create": new Set<Role>(["OWNER", "ADMIN", "MEMBER"]),
  "suppliers.edit": new Set<Role>(["OWNER", "ADMIN", "MEMBER"]),
  "suppliers.delete": new Set<Role>(["OWNER", "ADMIN"]),

  // --- Warehouses & bins ---
  "warehouses.create": new Set<Role>(["OWNER", "ADMIN"]),
  "warehouses.edit": new Set<Role>(["OWNER", "ADMIN"]),
  "warehouses.delete": new Set<Role>(["OWNER", "ADMIN"]),
  "bins.create": new Set<Role>(["OWNER", "ADMIN"]),
  "bins.edit": new Set<Role>(["OWNER", "ADMIN"]),
  "bins.delete": new Set<Role>(["OWNER", "ADMIN"]),
  "bins.transfer": new Set<Role>(["OWNER", "ADMIN", "MEMBER"]),

  // --- Labels ---
  "labels.create": new Set<Role>(["OWNER", "ADMIN"]),
  "labels.edit": new Set<Role>(["OWNER", "ADMIN"]),
  "labels.delete": new Set<Role>(["OWNER", "ADMIN"]),

  // --- Categories ---
  "categories.create": new Set<Role>(["OWNER", "ADMIN", "MEMBER"]),
  "categories.edit": new Set<Role>(["OWNER", "ADMIN", "MEMBER"]),
  "categories.delete": new Set<Role>(["OWNER", "ADMIN"]),

  // --- Departments (Phase B) ---
  "departments.create": new Set<Role>(["OWNER", "ADMIN"]),
  "departments.edit": new Set<Role>(["OWNER", "ADMIN"]),
  "departments.delete": new Set<Role>(["OWNER", "ADMIN"]),

  // --- Count assignments (Phase B) ---
  "countAssignments.create": new Set<Role>(["OWNER", "ADMIN", "MEMBER"]),
  "countAssignments.remove": new Set<Role>(["OWNER", "ADMIN"]),

  // --- Count templates (Phase B) ---
  "countTemplates.create": new Set<Role>(["OWNER", "ADMIN", "MEMBER"]),
  "countTemplates.edit": new Set<Role>(["OWNER", "ADMIN", "MEMBER"]),
  "countTemplates.delete": new Set<Role>(["OWNER", "ADMIN"]),

  // --- Reports & exports ---
  "reports.export": new Set<Role>(["OWNER", "ADMIN", "MEMBER"]),
  "reports.schedule": new Set<Role>(["OWNER", "ADMIN"]),
  "reports.abcClassify": new Set<Role>(["OWNER", "ADMIN", "MEMBER"]),

  // --- Reorder config ---
  "reorderConfig.edit": new Set<Role>(["OWNER", "ADMIN"]),

  // --- Phase E: Integrations ---
  "integrations.connect": new Set<Role>(["OWNER", "ADMIN"]),
  "integrations.disconnect": new Set<Role>(["OWNER", "ADMIN"]),
  "integrations.sync": new Set<Role>(["OWNER", "ADMIN", "MEMBER"]),

  // --- Phase E: Imports ---
  "imports.create": new Set<Role>(["OWNER", "ADMIN", "MEMBER"]),
  "imports.cancel": new Set<Role>(["OWNER", "ADMIN"]),

  // --- Migrations (competitor data migration) ---
  "migrations.create": new Set<Role>(["OWNER", "ADMIN"]),
  "migrations.start": new Set<Role>(["OWNER", "ADMIN"]),
  "migrations.cancel": new Set<Role>(["OWNER", "ADMIN"]),
  "migrations.rollback": new Set<Role>(["OWNER", "ADMIN"]),
  "migrations.delete": new Set<Role>(["OWNER", "ADMIN"]),

  // --- Phase E: Webhooks ---
  "webhooks.create": new Set<Role>(["OWNER", "ADMIN"]),
  "webhooks.edit": new Set<Role>(["OWNER", "ADMIN"]),
  "webhooks.delete": new Set<Role>(["OWNER", "ADMIN"]),

  // --- Inventory management ---
  "inventory.manageStatus": new Set<Role>(["OWNER", "ADMIN", "MEMBER"]),

  // --- Transfers ---
  "transfers.create": new Set<Role>(["OWNER", "ADMIN", "MEMBER"]),
  "transfers.ship": new Set<Role>(["OWNER", "ADMIN", "MEMBER"]),
  "transfers.receive": new Set<Role>(["OWNER", "ADMIN", "MEMBER"]),
  "transfers.cancel": new Set<Role>(["OWNER", "ADMIN"]),

  // --- Sales orders ---
  "salesOrders.create": new Set<Role>(["OWNER", "ADMIN", "MEMBER"]),
  "salesOrders.edit": new Set<Role>(["OWNER", "ADMIN", "MEMBER"]),
  "salesOrders.confirm": new Set<Role>(["OWNER", "ADMIN"]),
  "salesOrders.allocate": new Set<Role>(["OWNER", "ADMIN"]),
  "salesOrders.ship": new Set<Role>(["OWNER", "ADMIN", "MEMBER"]),
  "salesOrders.cancel": new Set<Role>(["OWNER", "ADMIN"]),

  // --- Kits ---
  "kits.create": new Set<Role>(["OWNER", "ADMIN", "MEMBER"]),
  "kits.edit": new Set<Role>(["OWNER", "ADMIN", "MEMBER"]),
  "kits.assemble": new Set<Role>(["OWNER", "ADMIN", "MEMBER"]),
  "kits.disassemble": new Set<Role>(["OWNER", "ADMIN", "MEMBER"]),

  // --- Pick tasks ---
  "picks.create": new Set<Role>(["OWNER", "ADMIN", "MEMBER"]),
  "picks.assign": new Set<Role>(["OWNER", "ADMIN"]),
  "picks.start": new Set<Role>(["OWNER", "ADMIN", "MEMBER"]),
  "picks.complete": new Set<Role>(["OWNER", "ADMIN", "MEMBER"]),
  "picks.verify": new Set<Role>(["OWNER", "ADMIN"]),

  // --- Assets ---
  "assets.create": new Set<Role>(["OWNER", "ADMIN"]),
  "assets.edit": new Set<Role>(["OWNER", "ADMIN"]),
  "assets.assign": new Set<Role>(["OWNER", "ADMIN"]),

  // --- Org admin ---
  "org.editProfile": new Set<Role>(["OWNER", "ADMIN"]),
  "org.editDefaults": new Set<Role>(["OWNER", "ADMIN"]),
  "org.delete": new Set<Role>(["OWNER"]),
  "org.transfer": new Set<Role>(["OWNER"]),
  "org.billing": new Set<Role>(["OWNER", "ADMIN"]),

  // --- Team management ---
  "team.invite": new Set<Role>(["OWNER", "ADMIN"]),
  "team.changeRole": new Set<Role>(["OWNER", "ADMIN"]),
  "team.remove": new Set<Role>(["OWNER", "ADMIN"]),

  // --- Audit log ---
  "audit.view": new Set<Role>(["OWNER", "ADMIN"]),
};

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/**
 * P2-3 (audit v1.0 §5.16) — collapse the legacy MANAGER alias.
 *
 * Historical memberships may still carry `role === "MANAGER"`. The
 * capability map no longer lists MANAGER in any set, so a raw lookup
 * would silently return `false` for every capability and break those
 * users. This helper is the single place we translate MANAGER into
 * its live equivalent (MEMBER) before touching `CAPABILITY_MAP`.
 *
 * Exported so tests can pin the behavior explicitly. Leave this
 * function in place until the accompanying schema migration
 * rewrites `Membership.role` from MANAGER to MEMBER org-wide.
 */
export function normalizeLegacyRole(role: Role): Role {
  return role === "MANAGER" ? "MEMBER" : role;
}

/**
 * Check whether a role has a specific capability.
 *
 * This is the primary check used by server actions:
 * ```ts
 * if (!hasCapability(membership.role, "items.create")) {
 *   return { ok: false, error: t.permissions.forbidden };
 * }
 * ```
 *
 * MANAGER is normalised to MEMBER — see `normalizeLegacyRole`.
 */
export function hasCapability(role: Role, capability: Capability): boolean {
  return CAPABILITY_MAP[capability].has(normalizeLegacyRole(role));
}

/**
 * Return all capabilities a role has. Useful for sending a capability
 * bag to the client so UI components can show/hide without a round trip.
 *
 * MANAGER is normalised to MEMBER — see `normalizeLegacyRole`.
 */
export function capabilitiesForRole(role: Role): Set<Capability> {
  const effectiveRole = normalizeLegacyRole(role);
  const caps = new Set<Capability>();
  for (const [cap, roles] of Object.entries(CAPABILITY_MAP)) {
    if (roles.has(effectiveRole)) {
      caps.add(cap as Capability);
    }
  }
  return caps;
}

/**
 * Convenience: does this role have ANY write capability?
 * Used by the sidebar to decide whether to show action buttons vs.
 * a read-only indicator.
 */
export function isReadOnly(role: Role): boolean {
  return role === "VIEWER";
}

/**
 * The assignable user-facing roles (hides the legacy MANAGER value).
 * Used by the invite form and role-change dropdown.
 */
export const ASSIGNABLE_ROLES: readonly Role[] = [
  "OWNER",
  "ADMIN",
  "MEMBER",
  "APPROVER",
  "COUNTER",
  "VIEWER",
];

/**
 * All capabilities as an array. Used in test assertions to verify
 * exhaustiveness.
 */
export const ALL_CAPABILITIES = Object.keys(CAPABILITY_MAP) as Capability[];
