// v1.2 P2 §5.36 — Transfer state machine neighbor table.
//
// Phase L4 shipped the transfer state machine with a header comment
// describing the legal transitions:
//   DRAFT → SHIPPED → IN_TRANSIT → RECEIVED
//   DRAFT → SHIPPED → IN_TRANSIT → CANCELLED
//   DRAFT → SHIPPED → CANCELLED
//   DRAFT → CANCELLED
// Terminal states: RECEIVED, CANCELLED.
//
// The three mutating predicates (canShip, canReceive, canCancel)
// were only indirectly exercised through `transfers/actions.ts`. A
// change to any predicate would silently shift the reachability
// surface of the ship/receive/cancel actions. This test locks the
// neighbor table so a future change is a readable test diff, not a
// surprise regression in a server action.
//
// Also pins the two presentational helpers (statusLabel,
// statusBadgeVariant) because they are `Record<TransferStatus, ...>`
// maps and will typecheck-fail silently if a new enum value lands
// without a matching key — we want a loud test, not a ts-quiet map.

import { describe, expect, it } from "vitest";

import type { TransferStatus } from "@/generated/prisma";
import {
  canCancel,
  canReceive,
  canShip,
  isTerminal,
  statusBadgeVariant,
  statusLabel,
} from "./machine";

// Mirror of `enum TransferStatus` in prisma/schema.prisma.
const ALL_STATUSES: readonly TransferStatus[] = [
  "DRAFT",
  "SHIPPED",
  "IN_TRANSIT",
  "RECEIVED",
  "CANCELLED",
] as const;

type PredicateTable = Readonly<Record<TransferStatus, boolean>>;

function assertNeighborTable(
  helperName: string,
  helper: (s: TransferStatus) => boolean,
  table: PredicateTable,
): void {
  describe(`${helperName} — neighbor table`, () => {
    for (const status of ALL_STATUSES) {
      const expected = table[status];
      it(`${helperName}(${status}) → ${expected}`, () => {
        expect(
          helper(status),
          `${helperName}(${status}) expected ${expected}; transfer machine widening / narrowing must update this table`,
        ).toBe(expected);
      });
    }
  });
}

assertNeighborTable("canShip", canShip, {
  DRAFT: true,
  // Once shipped, the only forward moves are IN_TRANSIT (carrier
  // pickup) or CANCELLED (recall before pickup). Re-shipping would
  // duplicate stock moves, so reject.
  SHIPPED: false,
  IN_TRANSIT: false,
  RECEIVED: false,
  CANCELLED: false,
});

assertNeighborTable("canReceive", canReceive, {
  DRAFT: false,
  SHIPPED: false,
  // Receiving is only valid after the carrier-pickup step, i.e.
  // IN_TRANSIT. SHIPPED-but-not-picked-up transfers must move to
  // IN_TRANSIT first (no fast-path to RECEIVED).
  IN_TRANSIT: true,
  RECEIVED: false,
  CANCELLED: false,
});

assertNeighborTable("canCancel", canCancel, {
  DRAFT: true,
  SHIPPED: true,
  // Pre-receipt cancellation is still legal; the action reverses the
  // outbound stock move and, if applicable, the carrier-pickup.
  IN_TRANSIT: true,
  RECEIVED: false,
  CANCELLED: false,
});

assertNeighborTable("isTerminal", isTerminal, {
  DRAFT: false,
  SHIPPED: false,
  IN_TRANSIT: false,
  RECEIVED: true,
  CANCELLED: true,
});

describe("transfer state machine — invariants across the table", () => {
  it("terminal states (RECEIVED, CANCELLED) block every mutating helper", () => {
    for (const terminal of ["RECEIVED", "CANCELLED"] as const) {
      expect(canShip(terminal)).toBe(false);
      expect(canReceive(terminal)).toBe(false);
      expect(canCancel(terminal)).toBe(false);
      expect(isTerminal(terminal)).toBe(true);
    }
  });

  it("isTerminal and canCancel are mutually exclusive", () => {
    // A terminal transfer cannot be cancelled. If a future change
    // adds a compensating-cancel flow for a RECEIVED transfer, that
    // belongs in a separate reversal action — not in canCancel.
    for (const status of ALL_STATUSES) {
      if (isTerminal(status)) {
        expect(canCancel(status), `${status} is terminal yet cancel was permitted`).toBe(false);
      }
    }
  });

  it("DRAFT is the only state that permits an initial ship", () => {
    // This is the critical safety pin: only DRAFT transfers can
    // create the outbound stock move. If canShip widens to include
    // IN_TRANSIT or SHIPPED, the outbound move would double-debit
    // source stock. Fail loudly here before that lands.
    for (const status of ALL_STATUSES) {
      expect(canShip(status), `canShip must stay DRAFT-only; ${status} leaked`).toBe(
        status === "DRAFT",
      );
    }
  });

  it("IN_TRANSIT is the only state that permits receive", () => {
    // Mirror pin for receive: only IN_TRANSIT transfers complete the
    // inbound stock move. Widening to SHIPPED would let the receive
    // flow skip the carrier-pickup audit step.
    for (const status of ALL_STATUSES) {
      expect(canReceive(status), `canReceive must stay IN_TRANSIT-only; ${status} leaked`).toBe(
        status === "IN_TRANSIT",
      );
    }
  });

  it("every declared status produces a boolean from every predicate", () => {
    for (const status of ALL_STATUSES) {
      expect(typeof canShip(status)).toBe("boolean");
      expect(typeof canReceive(status)).toBe("boolean");
      expect(typeof canCancel(status)).toBe("boolean");
      expect(typeof isTerminal(status)).toBe("boolean");
    }
  });
});

describe("transfer state machine — presentational maps are complete", () => {
  it("statusLabel covers every declared status with a non-empty label", () => {
    for (const status of ALL_STATUSES) {
      const label = statusLabel(status);
      expect(typeof label, `statusLabel(${status}) must return a string`).toBe("string");
      expect(label.length, `statusLabel(${status}) must be non-empty`).toBeGreaterThan(0);
    }
  });

  it("statusBadgeVariant returns a known shadcn-style variant per status", () => {
    // Declaration in machine.ts uses: outline, secondary, blue,
    // success, destructive. A new status that falls off the map
    // would surface here rather than as a silent `undefined` css class.
    const known = new Set(["outline", "secondary", "blue", "success", "destructive"]);
    for (const status of ALL_STATUSES) {
      const variant = statusBadgeVariant(status);
      expect(typeof variant).toBe("string");
      expect(
        known.has(variant),
        `statusBadgeVariant(${status}) returned '${variant}' — unknown badge variant`,
      ).toBe(true);
    }
  });
});
