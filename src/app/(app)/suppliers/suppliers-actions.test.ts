// P1-4 (audit v1.1 §5.19) — behavior pinning for
// `suppliers/actions.ts`.
//
// Suppliers is a representative "simple CRUD" action module: no
// plan limits, no transaction, no cache fan-out. The contracts
// being pinned are therefore the defaults that EVERY CRUD module
// should respect:
//
//   * RBAC — each of create/edit/delete has its own capability
//     key, not a single "suppliers.admin" umbrella.
//   * Tenancy — update/delete where-clause always includes
//     organizationId.
//   * Referential safety on delete — reject with a translated
//     error if the supplier has purchase orders, instead of
//     leaking the raw Prisma P2003 to the UI.
//   * Prisma error mapping — P2002 → codeExists (with field
//     mapping), P2025 → notFound, P2003 → inUse.
//
// If this test fires, a refactor has dropped one of those
// baselines and a similar regression is likely hiding in other
// CRUD modules. Treat red here as an audit trigger.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(resolve(__dirname, "actions.ts"), "utf8");

function sliceAction(start: string, end: string): string {
  const startIdx = SOURCE.indexOf(start);
  expect(startIdx, `${start} must appear in suppliers/actions.ts`).toBeGreaterThan(-1);
  const endIdx = SOURCE.indexOf(end, startIdx + start.length);
  expect(endIdx, `${end} must follow ${start}`).toBeGreaterThan(startIdx);
  return SOURCE.slice(startIdx, endIdx);
}

const CREATE = sliceAction(
  "export async function createSupplierAction",
  "export async function updateSupplierAction",
);
const UPDATE = sliceAction(
  "export async function updateSupplierAction",
  "export async function deleteSupplierAction",
);
const DELETE = sliceAction(
  "export async function deleteSupplierAction",
  // Tail-of-file sentinel: the last closing brace happens after
  // the final catch block returning deleteFailed. Any string
  // guaranteed to appear AFTER the delete catch works.
  "t.suppliers.errors.deleteFailed",
);

describe("P1-4 suppliers/actions.ts — baseline module shape", () => {
  it("is a 'use server' module", () => {
    expect(SOURCE.trimStart().startsWith('"use server"')).toBe(true);
  });

  it("imports the shared db singleton", () => {
    expect(SOURCE).toMatch(/from\s+["']@\/lib\/db["']/);
    expect(SOURCE).not.toMatch(/new\s+PrismaClient\s*\(/);
  });

  it("declares a typed ActionResult with fieldErrors", () => {
    expect(SOURCE).toMatch(
      /type\s+ActionResult[\s\S]*?fieldErrors\?:\s*Record<string,\s*string\[\]>/,
    );
  });
});

describe("P1-4 createSupplierAction", () => {
  it("requires suppliers.create capability", () => {
    expect(CREATE).toMatch(/hasCapability\(\s*membership\.role,\s*"suppliers\.create"\s*\)/);
  });

  it("validates with supplierInputSchema (Zod)", () => {
    expect(CREATE).toMatch(/supplierInputSchema\.safeParse\(/);
  });

  it("scopes create by organizationId", () => {
    expect(CREATE).toMatch(
      /db\.supplier\.create\(\s*\{[\s\S]*?organizationId:\s*membership\.organizationId/,
    );
  });

  it("revalidates /suppliers after create", () => {
    expect(CREATE).toMatch(/revalidatePath\("\/suppliers"\)/);
  });

  it("records supplier.created audit with name + code metadata", () => {
    expect(CREATE).toMatch(
      /recordAudit\([\s\S]*?action:\s*"supplier\.created"[\s\S]*?metadata:\s*\{\s*name:[\s\S]*?code:/,
    );
  });

  it("maps P2002 → codeExists with field-level mapping", () => {
    expect(CREATE).toMatch(/error\.code\s*===\s*"P2002"/);
    expect(CREATE).toMatch(/fieldErrors:\s*\{\s*code:/);
  });
});

describe("P1-4 updateSupplierAction", () => {
  it("requires suppliers.edit (not suppliers.create)", () => {
    expect(UPDATE).toMatch(/hasCapability\(\s*membership\.role,\s*"suppliers\.edit"\s*\)/);
  });

  it("scopes update by organizationId (prevents cross-tenant edits)", () => {
    expect(UPDATE).toMatch(
      /db\.supplier\.update\(\s*\{[\s\S]*?where:\s*\{\s*id,\s*organizationId:\s*membership\.organizationId/,
    );
  });

  it("revalidates both the index and the edit route", () => {
    expect(UPDATE).toMatch(/revalidatePath\("\/suppliers"\)/);
    expect(UPDATE).toMatch(/revalidatePath\(`\/suppliers\/\$\{id\}\/edit`\)/);
  });

  it("distinguishes P2025 (notFound) from P2002 (codeExists)", () => {
    expect(UPDATE).toMatch(/error\.code\s*===\s*"P2025"/);
    expect(UPDATE).toMatch(/error\.code\s*===\s*"P2002"/);
  });
});

describe("P1-4 deleteSupplierAction — referential safety", () => {
  it("requires suppliers.delete capability", () => {
    expect(DELETE).toMatch(/hasCapability\(\s*membership\.role,\s*"suppliers\.delete"\s*\)/);
  });

  it("blocks delete if the supplier has purchase orders (friendly error)", () => {
    // Pre-check via purchaseOrder.count prevents leaking the raw
    // Prisma P2003 constraint error to the UI. We want the user
    // to see "supplier in use", not "FK violation".
    expect(DELETE).toMatch(
      /db\.purchaseOrder\.count\(\s*\{[\s\S]*?organizationId:\s*membership\.organizationId,\s*supplierId:\s*id/,
    );
    expect(DELETE).toMatch(/poCount\s*>\s*0/);
    expect(DELETE).toMatch(/t\.suppliers\.errors\.inUse/);
  });

  it("scopes the delete by organizationId", () => {
    expect(DELETE).toMatch(
      /db\.supplier\.delete\(\s*\{[\s\S]*?where:\s*\{\s*id,\s*organizationId:\s*membership\.organizationId/,
    );
  });

  it("handles both P2025 (notFound) and P2003 (inUse) Prisma codes", () => {
    // Belt-and-suspenders: even if the pre-check is skipped by a
    // race, the P2003 catch maps to inUse, not deleteFailed.
    expect(DELETE).toMatch(/error\.code\s*===\s*"P2025"[\s\S]*?notFound/);
    expect(DELETE).toMatch(/error\.code\s*===\s*"P2003"[\s\S]*?inUse/);
  });

  it("records supplier.deleted audit with entityId preserved", () => {
    // Unlike items/warehouses, suppliers keep entityId on delete
    // because the supplier id is still referenced by historical
    // PurchaseOrder rows (soft delete pattern, even if the row
    // itself is hard-deleted on success).
    expect(DELETE).toMatch(
      /recordAudit\([\s\S]*?action:\s*"supplier\.deleted"[\s\S]*?entityId:\s*id/,
    );
  });
});
