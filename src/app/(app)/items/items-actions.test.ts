// P1-4 (audit v1.1 §5.19) — behavior pinning for `items/actions.ts`.
//
// `items/actions.ts` is the highest-traffic action module in the
// app: it owns create/update/delete, plus bulk import with its own
// rate limit. The contract we pin here:
//
//   * tenancy — every write is scoped by `organizationId` so a
//     cross-tenant id handed to update/delete cannot match.
//   * plan limits — create and import both honor checkPlanLimit
//     BEFORE attempting the write (so a FREE tenant hitting the
//     cap gets a translated error, not a Prisma failure).
//   * RBAC — each action gates on the matching capability key
//     (items.create / items.edit / items.import / items.delete).
//   * low-stock cache — mutations that can flip low-stock
//     membership call revalidateLowStock(orgId) so the sidebar
//     badge doesn't lie.
//   * import — rate-limited per-user, cap-bounded, audited with
//     a structured summary payload.
//
// Source-level static analysis: same technique used by
// `sales-order-allocation.test.ts` and `receive-nonce-policy.test.ts`.
// The action has too many side effects to cheaply spin up in
// isolation (Prisma + i18n + rate limit + audit), so we read the
// source and assert the tokens exist in the right shape.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ACTIONS_SOURCE = readFileSync(resolve(__dirname, "actions.ts"), "utf8");

// Slice helper — we assert against one action's body at a time so
// that matches in a sibling action don't bleed into the wrong
// describe block.
function sliceAction(startMarker: string, endMarker: string): string {
  const start = ACTIONS_SOURCE.indexOf(startMarker);
  expect(start, `${startMarker} must appear in items/actions.ts`).toBeGreaterThan(-1);
  const end = ACTIONS_SOURCE.indexOf(endMarker, start + startMarker.length);
  expect(end, `${endMarker} must follow ${startMarker}`).toBeGreaterThan(start);
  return ACTIONS_SOURCE.slice(start, end);
}

const CREATE = sliceAction(
  "export async function createItemAction",
  "export async function updateItemAction",
);
const UPDATE = sliceAction(
  "export async function updateItemAction",
  "// --- CSV / bulk import",
);
const IMPORT = sliceAction(
  "export async function importItemsAction",
  "// --- delete",
);
// deleteItemAction is the last export in the file, so slice to end-of-file.
const DELETE = (() => {
  const start = ACTIONS_SOURCE.indexOf("export async function deleteItemAction");
  expect(start, "deleteItemAction must be exported").toBeGreaterThan(-1);
  return ACTIONS_SOURCE.slice(start);
})();

describe("P1-4 items/actions.ts — module-level invariants", () => {
  it("is a 'use server' module", () => {
    expect(ACTIONS_SOURCE.trimStart().startsWith('"use server"')).toBe(true);
  });

  it("imports the shared db singleton (no ad-hoc PrismaClient)", () => {
    expect(ACTIONS_SOURCE).toMatch(/from\s+["']@\/lib\/db["']/);
    expect(ACTIONS_SOURCE).not.toMatch(/new\s+PrismaClient\s*\(/);
  });

  it("declares a discriminated ActionResult with fieldErrors for form wiring", () => {
    expect(ACTIONS_SOURCE).toMatch(
      /type\s+ActionResult[\s\S]*?ok:\s*true;\s*id:\s*string[\s\S]*?ok:\s*false[\s\S]*?fieldErrors\?/,
    );
  });
});

describe("P1-4 createItemAction", () => {
  it("gates on active membership before any DB work", () => {
    expect(CREATE).toMatch(/await\s+requireActiveMembership\(\)/);
  });

  it("requires the items.create capability", () => {
    expect(CREATE).toMatch(/hasCapability\(\s*membership\.role,\s*"items\.create"\s*\)/);
  });

  it("runs checkPlanLimit against the current item count BEFORE create", () => {
    // Both the count and the plan check must happen before
    // db.item.create(...). Ordering matters — checking the plan
    // after a failed create wastes a round-trip and surfaces the
    // wrong error to the user.
    const countIdx = CREATE.indexOf("db.item.count");
    const checkIdx = CREATE.indexOf('checkPlanLimit(plan, "items"');
    const createIdx = CREATE.indexOf("db.item.create");
    expect(countIdx).toBeGreaterThan(-1);
    expect(checkIdx).toBeGreaterThan(countIdx);
    expect(createIdx).toBeGreaterThan(checkIdx);
  });

  it("parses input with itemInputSchema (Zod)", () => {
    expect(CREATE).toMatch(/itemInputSchema\.safeParse\(/);
  });

  it("scopes the create by organizationId (tenant safety)", () => {
    expect(CREATE).toMatch(
      /db\.item\.create\(\s*\{[\s\S]*?organizationId:\s*membership\.organizationId/,
    );
  });

  it("revalidates /items and busts the low-stock cache", () => {
    expect(CREATE).toMatch(/revalidatePath\("\/items"\)/);
    expect(CREATE).toMatch(/revalidateLowStock\(membership\.organizationId\)/);
  });

  it("records an item.created audit entry with sku+name+status metadata", () => {
    expect(CREATE).toMatch(
      /recordAudit\([\s\S]*?action:\s*"item\.created"[\s\S]*?metadata:\s*\{\s*sku:/,
    );
  });

  it("maps Prisma P2002 to the skuExists error (preserves field mapping)", () => {
    expect(CREATE).toMatch(/error\.code\s*===\s*"P2002"/);
    expect(CREATE).toMatch(/fieldErrors:\s*\{\s*sku:/);
  });
});

describe("P1-4 updateItemAction", () => {
  it("requires the items.edit capability", () => {
    expect(UPDATE).toMatch(/hasCapability\(\s*membership\.role,\s*"items\.edit"\s*\)/);
  });

  it("scopes the where clause by organizationId (prevents cross-tenant update)", () => {
    expect(UPDATE).toMatch(
      /db\.item\.update\(\s*\{[\s\S]*?where:\s*\{[\s\S]*?id,\s*organizationId:\s*membership\.organizationId/,
    );
  });

  it("revalidates both the index and the detail route", () => {
    expect(UPDATE).toMatch(/revalidatePath\("\/items"\)/);
    expect(UPDATE).toMatch(/revalidatePath\(`\/items\/\$\{id\}`\)/);
  });

  it("busts low-stock after update (reorderPoint/status can flip membership)", () => {
    expect(UPDATE).toMatch(/revalidateLowStock\(membership\.organizationId\)/);
  });

  it("handles P2025 (notFound) distinctly from P2002 (sku clash)", () => {
    expect(UPDATE).toMatch(/error\.code\s*===\s*"P2025"/);
    expect(UPDATE).toMatch(/error\.code\s*===\s*"P2002"/);
  });
});

describe("P1-4 importItemsAction", () => {
  it("requires the items.import capability (distinct from items.create)", () => {
    expect(IMPORT).toMatch(/hasCapability\(\s*membership\.role,\s*"items\.import"\s*\)/);
  });

  it("checks plan limit before rate limit before validation", () => {
    const planIdx = IMPORT.indexOf('checkPlanLimit(importPlan, "items"');
    const rateIdx = IMPORT.indexOf("rateLimit(");
    const validateIdx = IMPORT.indexOf("validateImportRows(");
    expect(planIdx).toBeGreaterThan(-1);
    expect(rateIdx).toBeGreaterThan(planIdx);
    expect(validateIdx).toBeGreaterThan(rateIdx);
  });

  it("keys the rate limit by user id (per-user, not per-tenant)", () => {
    expect(IMPORT).toMatch(/rateLimit\(`items:import:user:\$\{session\.user\.id\}`/);
  });

  it("enforces a row cap (IMPORT_ROW_HARD_CAP) before any DB work", () => {
    expect(IMPORT).toMatch(/input\.rows\.length\s*>\s*IMPORT_ROW_HARD_CAP/);
    // And the constant itself must exist and be a sane 4-figure cap.
    const capMatch = ACTIONS_SOURCE.match(/IMPORT_ROW_HARD_CAP\s*=\s*(\d+)/);
    expect(capMatch).not.toBeNull();
    const cap = Number(capMatch?.[1] ?? 0);
    expect(cap).toBeGreaterThanOrEqual(1000);
    expect(cap).toBeLessThanOrEqual(10000);
  });

  it("does in-file SKU dedup BEFORE hitting the DB (validateImportRows.valid)", () => {
    expect(IMPORT).toMatch(/validation\.valid/);
  });

  it("queries existing SKUs in the tenant before insert (double-dedup)", () => {
    expect(IMPORT).toMatch(
      /db\.item\.findMany\(\s*\{[\s\S]*?organizationId:\s*membership\.organizationId[\s\S]*?sku:\s*\{\s*in:\s*candidateSkus/,
    );
  });

  it("uses createMany with skipDuplicates (belt-and-suspenders on races)", () => {
    expect(IMPORT).toMatch(/db\.item\.createMany\(\s*\{[\s\S]*?skipDuplicates:\s*true/);
  });

  it("records the import audit with a structured summary payload", () => {
    expect(IMPORT).toMatch(
      /recordAudit\([\s\S]*?action:\s*"item\.imported"[\s\S]*?inserted:[\s\S]*?skippedInvalid:[\s\S]*?skippedConflicts:/,
    );
  });

  it("revalidates /items and low-stock after successful insert", () => {
    expect(IMPORT).toMatch(/revalidatePath\("\/items"\)/);
    expect(IMPORT).toMatch(/revalidateLowStock\(membership\.organizationId\)/);
  });
});

describe("P1-4 deleteItemAction", () => {
  it("requires the items.delete capability", () => {
    expect(DELETE).toMatch(/hasCapability\(\s*membership\.role,\s*"items\.delete"\s*\)/);
  });

  it("scopes the delete by organizationId", () => {
    expect(DELETE).toMatch(
      /db\.item\.delete\(\s*\{[\s\S]*?where:\s*\{[\s\S]*?id,\s*organizationId:\s*membership\.organizationId/,
    );
  });

  it("parks the original id in audit metadata (entityId is null post-delete)", () => {
    // entityId is set to null because the Item row is gone; the id
    // is durable via metadata.itemId for cross-reference.
    expect(DELETE).toMatch(
      /recordAudit\([\s\S]*?action:\s*"item\.deleted"[\s\S]*?entityId:\s*null[\s\S]*?metadata:\s*\{\s*itemId:\s*id/,
    );
  });

  it("returns t.items.errors.notFound on P2025 rather than a generic delete error", () => {
    expect(DELETE).toMatch(/error\.code\s*===\s*"P2025"[\s\S]*?t\.items\.errors\.notFound/);
  });

  it("busts low-stock after delete", () => {
    expect(DELETE).toMatch(/revalidateLowStock\(membership\.organizationId\)/);
  });
});
