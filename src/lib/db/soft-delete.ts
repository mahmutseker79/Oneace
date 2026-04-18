/**
 * Canonical "not soft-deleted" filter fragments.
 *
 * P2-4 (audit v1.0 §11.4) — the codebase has three different soft-
 * delete conventions that all mean the same thing ("hide this row
 * from end-user lists without losing history"):
 *
 *   | Model               | Field       | "alive" predicate      |
 *   |---------------------|-------------|------------------------|
 *   | Item                | status      | status === "ACTIVE"    |
 *   | Warehouse, Bin      | isArchived  | isArchived === false   |
 *   | Supplier            | isActive    | isActive === true      |
 *
 * The audit called out two report queries that forgot to apply the
 * filter, which meant "archived" suppliers were still showing up in
 * performance reports even though they are hidden on /suppliers.
 * Having a named fragment per model lets every list query
 * import and reuse the exact same filter so they can't drift.
 *
 * Contracts for callers:
 *
 *   - These fragments are spread into a `where` alongside scoping
 *     predicates like `organizationId`. They deliberately do NOT
 *     carry the org scope — pair each fragment with the scope.
 *   - **When NOT to use them**: look-ups by primary key (e.g.
 *     `findUnique({ id })`, or `findMany({ where: { id: { in: ... } } })`
 *     used to hydrate metadata for a movement report) must NOT
 *     apply the filter — otherwise archived-then-referenced rows
 *     render as "(deleted item)" in UI surfaces that legitimately
 *     want historical lookup.
 *
 * Keep the fragments as plain objects (not functions) so `Prisma`
 * treats them as narrow literals in argument inference — a
 * function would erase the `"ACTIVE"` literal into `ItemStatus`
 * and trip the generated client.
 */

export const itemActiveWhere = { status: "ACTIVE" } as const;

export const supplierActiveWhere = { isActive: true } as const;

export const warehouseActiveWhere = { isArchived: false } as const;

export const binActiveWhere = { isArchived: false } as const;
