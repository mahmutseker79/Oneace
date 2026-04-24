// src/lib/sales-order/machine.test.ts
//
// GOD MODE roadmap 2026-04-23 — P1-03 test coverage ratchet.
//
// State-machine coverage for the sales-order lifecycle. Was 0%.
// Pure functions, type-only Prisma import — no I/O.
//
// Transition matrix:
//   DRAFT → CONFIRMED → ALLOCATED → (PARTIALLY_SHIPPED ↔) SHIPPED
//                                    ↘ CANCELLED                ↘ CANCELLED
//   DRAFT → CANCELLED
//
// Terminal: SHIPPED, CANCELLED.

import { describe, expect, it } from "vitest";

import {
  canAddLines,
  canAllocate,
  canCancel,
  canConfirm,
  canRemoveLines,
  canShip,
} from "./machine";

// We re-declare the SalesOrderStatus union locally so the test file
// doesn't need Prisma resolution. The machine.ts uses `import type`
// so there's no runtime coupling; this copy mirrors the schema enum.
type SalesOrderStatus =
  | "DRAFT"
  | "CONFIRMED"
  | "ALLOCATED"
  | "PARTIALLY_SHIPPED"
  | "SHIPPED"
  | "CANCELLED";

const ALL_STATUSES: SalesOrderStatus[] = [
  "DRAFT",
  "CONFIRMED",
  "ALLOCATED",
  "PARTIALLY_SHIPPED",
  "SHIPPED",
  "CANCELLED",
];

function assertOnly(fn: (s: SalesOrderStatus) => boolean, allowed: SalesOrderStatus[]) {
  for (const s of ALL_STATUSES) {
    const expected = allowed.includes(s);
    expect(fn(s), `${fn.name}(${s}) expected=${expected}`).toBe(expected);
  }
}

describe("SalesOrder machine — canConfirm", () => {
  it("allows only DRAFT → CONFIRMED", () => {
    assertOnly(canConfirm, ["DRAFT"]);
  });
});

describe("SalesOrder machine — canAllocate", () => {
  it("allows only CONFIRMED → ALLOCATED", () => {
    assertOnly(canAllocate, ["CONFIRMED"]);
  });
});

describe("SalesOrder machine — canShip", () => {
  it("allows ALLOCATED and PARTIALLY_SHIPPED", () => {
    assertOnly(canShip, ["ALLOCATED", "PARTIALLY_SHIPPED"]);
  });
});

describe("SalesOrder machine — canCancel", () => {
  it("allows DRAFT, CONFIRMED, ALLOCATED", () => {
    assertOnly(canCancel, ["DRAFT", "CONFIRMED", "ALLOCATED"]);
  });

  it("blocks cancel on terminal states (SHIPPED, CANCELLED)", () => {
    expect(canCancel("SHIPPED")).toBe(false);
    expect(canCancel("CANCELLED")).toBe(false);
  });

  it("blocks cancel on PARTIALLY_SHIPPED (stock already in-flight)", () => {
    expect(canCancel("PARTIALLY_SHIPPED")).toBe(false);
  });
});

describe("SalesOrder machine — line mutation guards", () => {
  it("canAddLines: only DRAFT", () => {
    assertOnly(canAddLines, ["DRAFT"]);
  });

  it("canRemoveLines: only DRAFT", () => {
    assertOnly(canRemoveLines, ["DRAFT"]);
  });
});

describe("SalesOrder machine — invariants across the matrix", () => {
  it("SHIPPED is truly terminal (no guard returns true)", () => {
    const guards = [canConfirm, canAllocate, canShip, canCancel, canAddLines, canRemoveLines];
    for (const g of guards) {
      expect(g("SHIPPED"), `${g.name}(SHIPPED) must be false`).toBe(false);
    }
  });

  it("CANCELLED is truly terminal", () => {
    const guards = [canConfirm, canAllocate, canShip, canCancel, canAddLines, canRemoveLines];
    for (const g of guards) {
      expect(g("CANCELLED"), `${g.name}(CANCELLED) must be false`).toBe(false);
    }
  });

  it("every status that allows ship also allows at least one other legal transition OR is post-ALLOCATED", () => {
    // Sanity check on the happy-path shape: the "can ship" set
    // must match the "allocated or after" stage.
    const canShipStates = ALL_STATUSES.filter((s) => canShip(s));
    expect(canShipStates.sort()).toEqual(["ALLOCATED", "PARTIALLY_SHIPPED"]);
  });
});
