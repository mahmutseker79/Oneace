// P1-4 (audit v1.1 §5.19) — behavior pinning for
// `warehouses/actions.ts`.
//
// The warehouse CRUD surface has two load-bearing invariants that
// are easy to regress:
//
//   1. Single-default invariant — at most one warehouse per tenant
//      may have `isDefault: true`. Flipping `isDefault` must happen
//      in the same `db.$transaction` as the setMany(false) that
//      clears the old default, otherwise a crash between the two
//      writes leaves the tenant with two defaults (or none).
//
//   2. Default-protected delete — deleting the last remaining
//      warehouse of a tenant is forbidden (the default-required
//      guard). When you delete the current default and others
//      remain, the oldest sibling takes over as default — again,
//      in a single transaction.
//
// These don't live in the schema; they live in the action. If a
// refactor moves the flip outside the transaction, or drops the
// guard, this test catches it before it ships.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(resolve(__dirname, "actions.ts"), "utf8");

function sliceAction(start: string, end: string): string {
  const startIdx = SOURCE.indexOf(start);
  expect(startIdx, `${start} must appear in warehouses/actions.ts`).toBeGreaterThan(-1);
  const endIdx = SOURCE.indexOf(end, startIdx + start.length);
  expect(endIdx, `${end} must follow ${start}`).toBeGreaterThan(startIdx);
  return SOURCE.slice(startIdx, endIdx);
}

const CREATE = sliceAction(
  "export async function createWarehouseAction",
  "export async function updateWarehouseAction",
);
const UPDATE = sliceAction(
  "export async function updateWarehouseAction",
  "export async function deleteWarehouseAction",
);
const DELETE = sliceAction(
  "export async function deleteWarehouseAction",
  "export async function assignWarehouseBarcodeAction",
);
const BARCODE = sliceAction(
  "export async function assignWarehouseBarcodeAction",
  // Tail-of-file sentinel: the last closing brace after the barcode
  // action. Any throwaway string guaranteed to appear after the
  // whole function works; we use the final closing catch shape.
  "t.warehouses.errors.updateFailed",
);

describe("P1-4 warehouses/actions.ts — module-level invariants", () => {
  it("is a 'use server' module", () => {
    expect(SOURCE.trimStart().startsWith('"use server"')).toBe(true);
  });

  it("uses the shared db singleton (no ad-hoc PrismaClient)", () => {
    expect(SOURCE).toMatch(/from\s+["']@\/lib\/db["']/);
    expect(SOURCE).not.toMatch(/new\s+PrismaClient\s*\(/);
  });
});

describe("P1-4 createWarehouseAction — plan limits + default flip", () => {
  it("gates on active membership + warehouses.create capability", () => {
    expect(CREATE).toMatch(/requireActiveMembership\(\)/);
    expect(CREATE).toMatch(/hasCapability\(\s*membership\.role,\s*"warehouses\.create"\s*\)/);
  });

  it('consults checkPlanLimit("warehouses") before the create (FREE cap = 1)', () => {
    expect(CREATE).toMatch(/checkPlanLimit\(whPlan,\s*"warehouses"/);
  });

  it("counts only non-archived warehouses when checking the plan limit", () => {
    // isArchived:true rows do not occupy a slot on the tenant's
    // plan — pinning this since a naive refactor could drop the
    // filter and suddenly stop letting tenants replace a retired
    // warehouse.
    expect(CREATE).toMatch(/db\.warehouse\.count\(\s*\{[\s\S]*?isArchived:\s*false/);
  });

  it("runs the default-flip and the create inside a single db.$transaction", () => {
    // The clearing updateMany(isDefault:false) and the
    // warehouse.create must share one transaction so we never end
    // up with zero defaults if the create throws after the flip.
    expect(CREATE).toMatch(/db\.\$transaction\(\s*async\s*\(tx\)\s*=>/);
    expect(CREATE).toMatch(
      /tx\.warehouse\.updateMany\(\s*\{[\s\S]*?isDefault:\s*true[\s\S]*?data:\s*\{\s*isDefault:\s*false/,
    );
    expect(CREATE).toMatch(/tx\.warehouse\.create\(/);
  });

  it("records a warehouse.created audit with name + code + isDefault", () => {
    expect(CREATE).toMatch(
      /recordAudit\([\s\S]*?action:\s*"warehouse\.created"[\s\S]*?isDefault:\s*input\.isDefault/,
    );
  });

  it("maps Prisma P2002 to the codeExists error with field-level mapping", () => {
    expect(CREATE).toMatch(/error\.code\s*===\s*"P2002"/);
    expect(CREATE).toMatch(/fieldErrors:\s*\{\s*code:/);
  });
});

describe("P1-4 updateWarehouseAction — default-flip excludes self", () => {
  it("scopes the update by organizationId (prevents cross-tenant edit)", () => {
    expect(UPDATE).toMatch(
      /tx\.warehouse\.update\(\s*\{[\s\S]*?where:\s*\{\s*id,\s*organizationId:\s*membership\.organizationId/,
    );
  });

  it("clears the previous default via id:{not:id} to avoid clearing self", () => {
    // If a user re-saves their current default without changes we
    // must not clear their own isDefault flag, which would leave
    // the tenant with zero defaults. The id:{not:id} filter is the
    // guard.
    expect(UPDATE).toMatch(
      /updateMany\(\s*\{[\s\S]*?isDefault:\s*true[\s\S]*?id:\s*\{\s*not:\s*id\s*\}[\s\S]*?data:\s*\{\s*isDefault:\s*false/,
    );
  });

  it("revalidates both /warehouses and the detail route", () => {
    expect(UPDATE).toMatch(/revalidatePath\("\/warehouses"\)/);
    expect(UPDATE).toMatch(/revalidatePath\(`\/warehouses\/\$\{id\}`\)/);
  });
});

describe("P1-4 deleteWarehouseAction — last-default guard + failover", () => {
  it("checks remaining count BEFORE letting the default be deleted", () => {
    // The pre-delete `count({ id:{not:id} })` is what lets the
    // guard reject "delete the last warehouse".
    expect(DELETE).toMatch(/db\.warehouse\.count\(\s*\{[\s\S]*?id:\s*\{\s*not:\s*id\s*\}/);
  });

  it("rejects deleting the last default with defaultRequired error", () => {
    expect(DELETE).toMatch(/target\.isDefault\s*&&\s*remaining\s*===\s*0/);
    expect(DELETE).toMatch(/t\.warehouses\.errors\.defaultRequired/);
  });

  it("promotes the oldest sibling to default in the SAME transaction", () => {
    // If we delete the current default and others remain, the
    // oldest sibling gets promoted — all inside one $transaction
    // so we don't leave the tenant defaultless mid-flight.
    expect(DELETE).toMatch(/db\.\$transaction\(\s*async\s*\(tx\)\s*=>/);
    expect(DELETE).toMatch(
      /tx\.warehouse\.findFirst\(\s*\{[\s\S]*?orderBy:\s*\{\s*createdAt:\s*"asc"/,
    );
    expect(DELETE).toMatch(/tx\.warehouse\.update\(\s*\{[\s\S]*?data:\s*\{\s*isDefault:\s*true/);
  });

  it("records warehouse.deleted with entityId:null and wasDefault flag", () => {
    expect(DELETE).toMatch(
      /recordAudit\([\s\S]*?action:\s*"warehouse\.deleted"[\s\S]*?entityId:\s*null[\s\S]*?wasDefault:/,
    );
  });
});

describe("P1-4 assignWarehouseBarcodeAction — tenant + barcode schema", () => {
  it("requires the warehouses.edit capability (not a separate barcode cap)", () => {
    expect(BARCODE).toMatch(/hasCapability\(\s*membership\.role,\s*"warehouses\.edit"\s*\)/);
  });

  it("confirms the warehouse belongs to this tenant before mutating", () => {
    expect(BARCODE).toMatch(
      /db\.warehouse\.findFirst\(\s*\{[\s\S]*?id:\s*warehouseId,\s*organizationId:\s*membership\.organizationId/,
    );
  });

  it("parses the barcode with barcodeValueSchema", () => {
    expect(BARCODE).toMatch(/barcodeValueSchema\.safeParse\(/);
  });

  it("scopes the barcode update by organizationId", () => {
    expect(BARCODE).toMatch(
      /db\.warehouse\.update\(\s*\{[\s\S]*?where:\s*\{[\s\S]*?id:\s*warehouseId,\s*organizationId:\s*membership\.organizationId/,
    );
  });

  it("records a warehouse.barcode_assigned audit with the value", () => {
    expect(BARCODE).toMatch(
      /recordAudit\([\s\S]*?action:\s*"warehouse\.barcode_assigned"[\s\S]*?barcodeValue:\s*parsed\.data/,
    );
  });
});
