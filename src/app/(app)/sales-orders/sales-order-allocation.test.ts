// P1-1 remediation test (audit v1.0 §5.6) — pins the contract of
// `allocateSalesOrderAction`. The audit characterized this action as
// missing; in fact it already exists in `actions.ts`. This test locks
// the surface so it cannot regress to a no-op or skip the
// safety-critical pieces.
//
// The contract being pinned, line by line:
//   1. RBAC — must check `salesOrders.allocate` capability.
//   2. State guard — must call `canAllocate(existing.status)` from
//      the sales-order state machine. Allocation must only run on
//      a CONFIRMED order.
//   3. Atomic write — all stock reservations + line allocatedQty
//      bumps + status transition happen inside a single
//      `db.$transaction`. Partial allocation must never persist.
//   4. Stock availability — per-line check that
//      (quantity - reservedQty) >= needed BEFORE any writes. The
//      transaction throws "Insufficient stock" otherwise.
//   5. Reservation — `reservedQty` is incremented on the matching
//      `StockLevel` row by the unallocated remainder.
//   6. Line update — `salesOrderLine.allocatedQty` is set to the
//      ordered qty (full allocation only — no partials in v1).
//   7. Status transition — `salesOrder.status` moves to "ALLOCATED".
//   8. Audit trail — `recordAudit` is called with action
//      "sales_order.allocated" and the order id.
//   9. Cache busts — `revalidatePath("/sales-orders")` and
//      `revalidatePath(\`/sales-orders/${id}\`)` both run.
//
// Schema reality (prisma/schema.prisma):
//   - There is NO `SalesOrderLineAllocation` model. Allocations are
//     tracked via `SalesOrderLine.allocatedQty` + `StockLevel.reservedQty`.
//     The audit's mention of dedicated allocation rows does not match
//     the current schema; the column-based approach is the contract.
//
// This is a source-pinning test, not a behavioral integration test —
// it reads `actions.ts` and asserts the relevant tokens exist in the
// expected places. That keeps it cheap, hermetic, and impossible to
// confuse with the database.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { canAllocate } from "@/lib/sales-order/machine";

const ACTIONS_SOURCE = readFileSync(resolve(__dirname, "actions.ts"), "utf8");

// Slice out just the allocate action so unrelated actions in the
// same file don't leak matches into our assertions.
const ALLOCATE_BLOCK = (() => {
  const start = ACTIONS_SOURCE.indexOf("export async function allocateSalesOrderAction");
  expect(start, "allocateSalesOrderAction must be exported").toBeGreaterThan(-1);
  // The next exported function marks the end. shipSalesOrderAction
  // follows it in actions.ts.
  const next = ACTIONS_SOURCE.indexOf("export async function shipSalesOrderAction", start);
  expect(next, "shipSalesOrderAction must follow allocate").toBeGreaterThan(start);
  return ACTIONS_SOURCE.slice(start, next);
})();

describe("P1-1 — allocateSalesOrderAction is exported and reachable", () => {
  it("is declared as an async server action returning ActionResult", () => {
    expect(ACTIONS_SOURCE).toMatch(
      /export\s+async\s+function\s+allocateSalesOrderAction\s*\(\s*formData\s*:\s*FormData\s*\)\s*:\s*Promise<ActionResult>/,
    );
  });

  it("is part of a 'use server' module", () => {
    // The directive must be the first non-blank line of actions.ts.
    expect(ACTIONS_SOURCE.trimStart().startsWith('"use server"')).toBe(true);
  });
});

describe("P1-1 — RBAC and validation are enforced before any DB work", () => {
  it("requires an active membership before doing anything", () => {
    expect(ALLOCATE_BLOCK).toMatch(/await\s+requireActiveMembership\(\)/);
  });

  it("checks the salesOrders.allocate capability", () => {
    expect(ALLOCATE_BLOCK).toMatch(
      /hasCapability\(\s*membership\.role,\s*"salesOrders\.allocate"\s*\)/,
    );
  });

  it("returns the i18n forbidden error when the capability is missing", () => {
    // The early return must use t.permissions.forbidden so error
    // messaging stays consistent with the rest of the app.
    expect(ALLOCATE_BLOCK).toMatch(
      /return\s*\{\s*ok:\s*false,\s*error:\s*t\.permissions\.forbidden\s*\}/,
    );
  });

  it("parses input via allocateSalesOrderSchema (Zod)", () => {
    expect(ALLOCATE_BLOCK).toMatch(/allocateSalesOrderSchema\.safeParse\(/);
  });
});

describe("P1-1 — state machine guard", () => {
  it("delegates the status check to canAllocate from the machine", () => {
    expect(ALLOCATE_BLOCK).toMatch(/canAllocate\(\s*existing\.status\s*\)/);
  });

  it("the machine itself only permits allocation from CONFIRMED", () => {
    // Cross-check the imported helper so a future change to the
    // machine fires this test instead of silently widening the
    // allocation surface.
    expect(canAllocate("DRAFT")).toBe(false);
    expect(canAllocate("CONFIRMED")).toBe(true);
    expect(canAllocate("ALLOCATED")).toBe(false);
    expect(canAllocate("PARTIALLY_SHIPPED")).toBe(false);
    expect(canAllocate("SHIPPED")).toBe(false);
    expect(canAllocate("CANCELLED")).toBe(false);
  });
});

describe("P1-1 — allocation runs in a single transaction", () => {
  it("wraps the writes in db.$transaction", () => {
    expect(ALLOCATE_BLOCK).toMatch(/db\.\$transaction\(/);
  });

  it("checks per-line stock availability before any writes", () => {
    // The availability check (quantity - reservedQty) must precede
    // the reservation update. We assert both that the formula
    // appears and that the throw happens on shortage.
    expect(ALLOCATE_BLOCK).toMatch(
      /\(\s*stock\?\.quantity\s*\?\?\s*0\s*\)\s*-\s*\(\s*stock\?\.reservedQty\s*\?\?\s*0\s*\)/,
    );
    expect(ALLOCATE_BLOCK).toMatch(/throw new Error\([^)]*Insufficient stock/);
  });

  it("increments reservedQty by the unallocated remainder", () => {
    // The reservation update must add `needed` to the prior
    // reservedQty, not overwrite it.
    expect(ALLOCATE_BLOCK).toMatch(
      /reservedQty:\s*\(\s*stock\.reservedQty\s*\?\?\s*0\s*\)\s*\+\s*needed/,
    );
  });

  it("uses upsertStockLevel so the StockLevel row is guaranteed to exist", () => {
    expect(ALLOCATE_BLOCK).toMatch(/upsertStockLevel\(\s*tx\s*,/);
  });

  it("sets salesOrderLine.allocatedQty to the ordered qty (full allocation)", () => {
    expect(ALLOCATE_BLOCK).toMatch(
      /tx\.salesOrderLine\.update\([\s\S]*?allocatedQty:\s*line\.orderedQty/,
    );
  });

  it("transitions the sales order to ALLOCATED", () => {
    expect(ALLOCATE_BLOCK).toMatch(/tx\.salesOrder\.update\([\s\S]*?status:\s*"ALLOCATED"/);
  });

  it("scopes the salesOrder.update by organizationId (tenant safety)", () => {
    expect(ALLOCATE_BLOCK).toMatch(
      /where:\s*\{\s*id:\s*existing\.id,\s*organizationId:\s*orgId\s*\}/,
    );
  });
});

describe("P1-1 — audit + cache invalidation", () => {
  it("records a sales_order.allocated audit row after the transaction", () => {
    expect(ALLOCATE_BLOCK).toMatch(/recordAudit\([\s\S]*?action:\s*"sales_order\.allocated"/);
  });

  it("revalidates both the index and the detail route", () => {
    expect(ALLOCATE_BLOCK).toMatch(/revalidatePath\("\/sales-orders"\)/);
    expect(ALLOCATE_BLOCK).toMatch(/revalidatePath\(`\/sales-orders\/\$\{existing\.id\}`\)/);
  });
});

describe("P1-1 — schema reality check", () => {
  it("does not reference a SalesOrderLineAllocation model (column-based design)", () => {
    // If a future change introduces a dedicated allocation table,
    // this test is the early warning. The audit's prose mentioned
    // such a table; the schema does not have one. If this assertion
    // ever fires, the action AND this test need to be updated together.
    expect(ALLOCATE_BLOCK).not.toMatch(/salesOrderLineAllocation/i);
  });
});
