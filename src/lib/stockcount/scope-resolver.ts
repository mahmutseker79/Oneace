/**
 * Phase B: Scope Resolver — determine which items to include in a count.
 *
 * Supports multiple scoping strategies:
 *   FULL      → Every item in the org
 *   PARTIAL   → Explicit item list (from form or template)
 *   DEPARTMENT → All items assigned to a department
 *
 * Returns item IDs suitable for snapshot insertion (max 10,000 items).
 */

import { db } from "@/lib/db";

export type CountScope = "FULL" | "PARTIAL" | "DEPARTMENT";

export interface ResolveScopeInput {
  orgId: string;
  scope: CountScope;
  departmentId?: string | null;
  itemIds?: string[];
}

/**
 * Resolve scope to a list of item IDs.
 * Returns at most 10,000 items (enforced for snapshot transaction safety).
 *
 * Throws if:
 *   - DEPARTMENT scope specified but department not found or doesn't belong to org
 *   - PARTIAL scope with empty itemIds array
 */
export async function resolveScopeItems(input: ResolveScopeInput): Promise<string[]> {
  const { orgId, scope, departmentId, itemIds } = input;

  switch (scope) {
    case "FULL":
      return resolveFull(orgId);

    case "PARTIAL":
      return resolvePartial(itemIds);

    case "DEPARTMENT":
      return resolveDepartment(orgId, departmentId);

    default: {
      // TypeScript exhaustiveness check; should never reach here.
      const _exhaustive: never = scope;
      throw new Error(`Unknown scope: ${_exhaustive}`);
    }
  }
}

/**
 * FULL scope: every item in the org, limited to 10,000.
 */
async function resolveFull(orgId: string): Promise<string[]> {
  const items = await db.item.findMany({
    where: { organizationId: orgId, status: "ACTIVE" },
    select: { id: true },
    take: 10_000,
  });
  return items.map((i) => i.id);
}

/**
 * PARTIAL scope: explicit item list (usually from form selection).
 */
function resolvePartial(itemIds?: string[]): string[] {
  if (!itemIds || itemIds.length === 0) {
    throw new Error("PARTIAL scope requires itemIds");
  }
  // Dedup and limit to 10,000
  const unique = Array.from(new Set(itemIds));
  return unique.slice(0, 10_000);
}

/**
 * DEPARTMENT scope: all items assigned to a department.
 */
async function resolveDepartment(orgId: string, departmentId?: string | null): Promise<string[]> {
  if (!departmentId) {
    throw new Error("DEPARTMENT scope requires departmentId");
  }

  // Verify department belongs to org
  const department = await db.department.findFirst({
    where: { id: departmentId, organizationId: orgId, isActive: true },
    select: { id: true },
  });

  if (!department) {
    throw new Error("Department not found");
  }

  // Fetch all items in this department
  const items = await db.item.findMany({
    where: { departmentId, status: "ACTIVE" },
    select: { id: true },
    take: 10_000,
  });

  return items.map((i) => i.id);
}
