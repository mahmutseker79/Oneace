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
 *   MANAGER  → same as MEMBER (legacy enum value, unused in practice)
 *   MEMBER   → day-to-day inventory operations ("Operator" in UI)
 *   VIEWER   → read-only access
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
  // Movements
  | "movements.create"
  // Stock counts
  | "stockCounts.create"
  | "stockCounts.addEntry"
  | "stockCounts.reconcile"
  | "stockCounts.cancel"
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
  // Categories
  | "categories.create"
  | "categories.edit"
  | "categories.delete"
  // Reports & exports
  | "reports.export"
  // Reorder config
  | "reorderConfig.edit"
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
 */
const CAPABILITY_MAP: Record<Capability, ReadonlySet<Role>> = {
  // --- Items ---
  "items.create": new Set<Role>(["OWNER", "ADMIN", "MANAGER", "MEMBER"]),
  "items.edit": new Set<Role>(["OWNER", "ADMIN", "MANAGER", "MEMBER"]),
  "items.delete": new Set<Role>(["OWNER", "ADMIN"]),
  "items.import": new Set<Role>(["OWNER", "ADMIN", "MANAGER", "MEMBER"]),

  // --- Movements ---
  "movements.create": new Set<Role>(["OWNER", "ADMIN", "MANAGER", "MEMBER"]),

  // --- Stock counts ---
  "stockCounts.create": new Set<Role>(["OWNER", "ADMIN", "MANAGER", "MEMBER"]),
  "stockCounts.addEntry": new Set<Role>(["OWNER", "ADMIN", "MANAGER", "MEMBER"]),
  "stockCounts.reconcile": new Set<Role>(["OWNER", "ADMIN"]),
  "stockCounts.cancel": new Set<Role>(["OWNER", "ADMIN"]),

  // --- Purchase orders ---
  "purchaseOrders.create": new Set<Role>(["OWNER", "ADMIN", "MANAGER", "MEMBER"]),
  "purchaseOrders.edit": new Set<Role>(["OWNER", "ADMIN", "MANAGER", "MEMBER"]),
  "purchaseOrders.send": new Set<Role>(["OWNER", "ADMIN", "MANAGER", "MEMBER"]),
  "purchaseOrders.receive": new Set<Role>(["OWNER", "ADMIN", "MANAGER", "MEMBER"]),
  "purchaseOrders.cancel": new Set<Role>(["OWNER", "ADMIN"]),
  "purchaseOrders.delete": new Set<Role>(["OWNER", "ADMIN"]),

  // --- Suppliers ---
  "suppliers.create": new Set<Role>(["OWNER", "ADMIN", "MANAGER", "MEMBER"]),
  "suppliers.edit": new Set<Role>(["OWNER", "ADMIN", "MANAGER", "MEMBER"]),
  "suppliers.delete": new Set<Role>(["OWNER", "ADMIN"]),

  // --- Warehouses & bins ---
  "warehouses.create": new Set<Role>(["OWNER", "ADMIN"]),
  "warehouses.edit": new Set<Role>(["OWNER", "ADMIN"]),
  "warehouses.delete": new Set<Role>(["OWNER", "ADMIN"]),
  "bins.create": new Set<Role>(["OWNER", "ADMIN"]),
  "bins.edit": new Set<Role>(["OWNER", "ADMIN"]),
  "bins.delete": new Set<Role>(["OWNER", "ADMIN"]),
  "bins.transfer": new Set<Role>(["OWNER", "ADMIN", "MANAGER", "MEMBER"]),

  // --- Categories ---
  "categories.create": new Set<Role>(["OWNER", "ADMIN", "MANAGER", "MEMBER"]),
  "categories.edit": new Set<Role>(["OWNER", "ADMIN", "MANAGER", "MEMBER"]),
  "categories.delete": new Set<Role>(["OWNER", "ADMIN"]),

  // --- Reports & exports ---
  "reports.export": new Set<Role>(["OWNER", "ADMIN", "MANAGER", "MEMBER"]),

  // --- Reorder config ---
  "reorderConfig.edit": new Set<Role>(["OWNER", "ADMIN"]),

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
 * Check whether a role has a specific capability.
 *
 * This is the primary check used by server actions:
 * ```ts
 * if (!hasCapability(membership.role, "items.create")) {
 *   return { ok: false, error: t.permissions.forbidden };
 * }
 * ```
 */
export function hasCapability(role: Role, capability: Capability): boolean {
  return CAPABILITY_MAP[capability].has(role);
}

/**
 * Return all capabilities a role has. Useful for sending a capability
 * bag to the client so UI components can show/hide without a round trip.
 */
export function capabilitiesForRole(role: Role): Set<Capability> {
  const caps = new Set<Capability>();
  for (const [cap, roles] of Object.entries(CAPABILITY_MAP)) {
    if (roles.has(role)) {
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
 * The four user-facing roles (hides the legacy MANAGER value).
 * Used by the invite form and role-change dropdown.
 */
export const ASSIGNABLE_ROLES: readonly Role[] = ["OWNER", "ADMIN", "MEMBER", "VIEWER"];

/**
 * All capabilities as an array. Used in test assertions to verify
 * exhaustiveness.
 */
export const ALL_CAPABILITIES = Object.keys(CAPABILITY_MAP) as Capability[];
