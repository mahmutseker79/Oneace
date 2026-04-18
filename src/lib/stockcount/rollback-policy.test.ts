// P0-4 remediation test — pins the stock-count rollback policy.
//
// Background: `rollbackCountAction` previously flipped the count state
// to ROLLED_BACK but did NOT reverse the posted stock movements, so
// the ledger and inventory diverged for every "rolled back" count.
// Until a real inverse-movement implementation lands, rollback is
// refused for every state.
//
// These tests:
//
//   1. Assert `canRollback` returns false for every defined state.
//   2. Assert `canTransition` no longer allows COMPLETED → ROLLED_BACK.
//   3. Assert `rollbackDenialReason` returns the right code bucket so
//      the server action and page can surface a targeted message.
//
// When a real rollback lands, these tests should be updated to match
// the new policy — which is exactly the signal we want.

import { describe, expect, it } from "vitest";

import {
  type StockCountState,
  canRollback,
  canTransition,
  rollbackDenialReason,
} from "@/lib/stockcount/machine";

const ALL_STATES: StockCountState[] = [
  "OPEN",
  "IN_PROGRESS",
  "REQUIRES_RECOUNT",
  "COMPLETED",
  "CANCELLED",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "ROLLED_BACK",
];

describe("P0-4 — stock-count rollback policy", () => {
  it.each(ALL_STATES)("canRollback is false for every state (%s)", (state) => {
    expect(canRollback(state)).toBe(false);
  });

  it("removes the COMPLETED → ROLLED_BACK transition from the state machine", () => {
    // This was the only path that reached ROLLED_BACK. With the
    // transition gone, `canTransition` must refuse it.
    expect(canTransition("COMPLETED", "ROLLED_BACK")).toBe(false);
  });

  it("never allows any state to transition into ROLLED_BACK", () => {
    // Belt-and-braces: even a future state machine edit mustn't
    // re-introduce a path into ROLLED_BACK without re-enabling
    // `canRollback` and a real inverse-movement implementation.
    for (const from of ALL_STATES) {
      expect(canTransition(from, "ROLLED_BACK")).toBe(false);
    }
  });

  describe("rollbackDenialReason", () => {
    it("returns CANNOT_ROLLBACK_POST_POSTED for post-posted states", () => {
      expect(rollbackDenialReason("COMPLETED")).toBe("CANNOT_ROLLBACK_POST_POSTED");
      expect(rollbackDenialReason("APPROVED")).toBe("CANNOT_ROLLBACK_POST_POSTED");
    });

    it("returns CANNOT_ROLLBACK_TERMINAL for already-terminal states", () => {
      expect(rollbackDenialReason("ROLLED_BACK")).toBe("CANNOT_ROLLBACK_TERMINAL");
      expect(rollbackDenialReason("CANCELLED")).toBe("CANNOT_ROLLBACK_TERMINAL");
      expect(rollbackDenialReason("REJECTED")).toBe("CANNOT_ROLLBACK_TERMINAL");
    });

    it("returns CANNOT_ROLLBACK_PRE_POST for pre-post states", () => {
      // These states should use CANCEL or REJECT instead — there's
      // nothing posted to undo.
      expect(rollbackDenialReason("OPEN")).toBe("CANNOT_ROLLBACK_PRE_POST");
      expect(rollbackDenialReason("IN_PROGRESS")).toBe("CANNOT_ROLLBACK_PRE_POST");
      expect(rollbackDenialReason("REQUIRES_RECOUNT")).toBe("CANNOT_ROLLBACK_PRE_POST");
      expect(rollbackDenialReason("PENDING_APPROVAL")).toBe("CANNOT_ROLLBACK_PRE_POST");
    });
  });
});
