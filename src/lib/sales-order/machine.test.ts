// v1.2 P2 §5.36 — Sales-order state machine neighbor table.
//
// Pre-remediation, the only test that exercised the sales-order
// state machine was `sales-order-allocation.test.ts`, which pins
// `canAllocate` on DRAFT/CONFIRMED/ALLOCATED/PARTIALLY_SHIPPED/
// SHIPPED/CANCELLED. Every other helper (canConfirm, canShip,
// canCancel, canAddLines, canRemoveLines, isReadOnly) was only
// exercised indirectly through `actions.ts` — which means a change
// to the helper's predicate would silently change every action's
// reachability surface without a test firing.
//
// This file is the flat neighbor table. For every (helper × status)
// pair, we assert the expected boolean. Widening or narrowing the
// machine in a future PR has to update the table, which makes the
// change reviewable instead of invisible.
//
// Canonical transitions from `machine.ts` header:
//   DRAFT → CONFIRMED → ALLOCATED → PARTIALLY_SHIPPED → SHIPPED
//                                                     → CANCELLED
// Terminal states: SHIPPED, CANCELLED.
//
// Static-analysis flavored: the test imports the helpers directly;
// no DB, no JSDOM, no network. Runs in a few ms.

import { describe, expect, it } from "vitest";

import type { SalesOrderStatus } from "@/generated/prisma";
import {
  canAddLines,
  canAllocate,
  canCancel,
  canConfirm,
  canRemoveLines,
  canShip,
  isReadOnly,
} from "./machine";

// The full set of enum values — also enforced in prisma/schema.prisma
// `enum SalesOrderStatus`. If a value lands here, a row must be added
// to every table below.
const ALL_STATUSES: readonly SalesOrderStatus[] = [
  "DRAFT",
  "CONFIRMED",
  "ALLOCATED",
  "PARTIALLY_SHIPPED",
  "SHIPPED",
  "CANCELLED",
] as const;

type PredicateTable = Readonly<Record<SalesOrderStatus, boolean>>;

/**
 * Assert a predicate across every status. Using a flat table instead
 * of `it.each` keeps the Vitest tree readable: one describe per
 * helper, one `it` per status row.
 */
function assertNeighborTable(
  helperName: string,
  helper: (s: SalesOrderStatus) => boolean,
  table: PredicateTable,
): void {
  describe(`${helperName} — neighbor table`, () => {
    for (const status of ALL_STATUSES) {
      const expected = table[status];
      it(`${helperName}(${status}) → ${expected}`, () => {
        expect(
          helper(status),
          `${helperName}(${status}) expected ${expected}; widening or narrowing the sales-order state machine must update this table`,
        ).toBe(expected);
      });
    }
  });
}

assertNeighborTable("canConfirm", canConfirm, {
  DRAFT: true,
  CONFIRMED: false,
  ALLOCATED: false,
  PARTIALLY_SHIPPED: false,
  SHIPPED: false,
  CANCELLED: false,
});

assertNeighborTable("canAllocate", canAllocate, {
  DRAFT: false,
  CONFIRMED: true,
  ALLOCATED: false,
  PARTIALLY_SHIPPED: false,
  SHIPPED: false,
  CANCELLED: false,
});

assertNeighborTable("canShip", canShip, {
  DRAFT: false,
  CONFIRMED: false,
  ALLOCATED: true,
  // Partial shipment allows subsequent shipments of remaining qty —
  // this is the key non-obvious edge in the shipping path.
  PARTIALLY_SHIPPED: true,
  SHIPPED: false,
  CANCELLED: false,
});

assertNeighborTable("canCancel", canCancel, {
  DRAFT: true,
  CONFIRMED: true,
  ALLOCATED: true,
  // Once any shipment has left the warehouse we cannot cancel.
  // Reversal has to go through a return flow, not the cancel path.
  PARTIALLY_SHIPPED: false,
  SHIPPED: false,
  CANCELLED: false,
});

assertNeighborTable("canAddLines", canAddLines, {
  DRAFT: true,
  CONFIRMED: false,
  ALLOCATED: false,
  PARTIALLY_SHIPPED: false,
  SHIPPED: false,
  CANCELLED: false,
});

assertNeighborTable("canRemoveLines", canRemoveLines, {
  DRAFT: true,
  CONFIRMED: false,
  ALLOCATED: false,
  PARTIALLY_SHIPPED: false,
  SHIPPED: false,
  CANCELLED: false,
});

assertNeighborTable("isReadOnly", isReadOnly, {
  DRAFT: false,
  CONFIRMED: false,
  ALLOCATED: false,
  PARTIALLY_SHIPPED: false,
  SHIPPED: true,
  CANCELLED: true,
});

describe("sales-order state machine — invariants across the table", () => {
  it("terminal states (SHIPPED, CANCELLED) block every mutating helper", () => {
    // Any helper whose truthy states overlap with a terminal state
    // would let a terminal order mutate. Pin the contract: for every
    // terminal status, the mutating predicates must all return false.
    for (const terminal of ["SHIPPED", "CANCELLED"] as const) {
      expect(canConfirm(terminal)).toBe(false);
      expect(canAllocate(terminal)).toBe(false);
      expect(canShip(terminal)).toBe(false);
      expect(canCancel(terminal)).toBe(false);
      expect(canAddLines(terminal)).toBe(false);
      expect(canRemoveLines(terminal)).toBe(false);
      expect(isReadOnly(terminal)).toBe(true);
    }
  });

  it("DRAFT is the only state that permits structural line edits", () => {
    for (const status of ALL_STATUSES) {
      const structural = canAddLines(status) || canRemoveLines(status);
      expect(structural, `structural edits must be DRAFT-only; ${status} leaked`).toBe(
        status === "DRAFT",
      );
    }
  });

  it("isReadOnly and canCancel are mutually exclusive", () => {
    // A terminal order cannot be cancelled (isReadOnly=true implies
    // canCancel=false). This is the single invariant that a future
    // widening of canCancel to include SHIPPED/CANCELLED would break.
    for (const status of ALL_STATUSES) {
      if (isReadOnly(status)) {
        expect(canCancel(status), `${status} is read-only yet cancel was permitted`).toBe(false);
      }
    }
  });

  it("every declared status is covered by every helper (completeness)", () => {
    // If the enum gains a new value in schema.prisma and the machine
    // forgets to handle it, the helpers will likely return `false`
    // silently. We pin completeness by asserting each helper produces
    // a boolean for every known status — a helper that throws or
    // returns undefined fires this test.
    for (const status of ALL_STATUSES) {
      expect(typeof canConfirm(status)).toBe("boolean");
      expect(typeof canAllocate(status)).toBe("boolean");
      expect(typeof canShip(status)).toBe("boolean");
      expect(typeof canCancel(status)).toBe("boolean");
      expect(typeof canAddLines(status)).toBe("boolean");
      expect(typeof canRemoveLines(status)).toBe("boolean");
      expect(typeof isReadOnly(status)).toBe("boolean");
    }
  });
});
