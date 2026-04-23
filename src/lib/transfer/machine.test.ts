// src/lib/transfer/machine.test.ts
//
// GOD MODE roadmap 2026-04-23 — P1-03 test coverage ratchet.
//
// State-machine coverage for the inventory transfer lifecycle.
// Was 0%. Pure functions + static label maps; no I/O.
//
// Legal transitions:
//   DRAFT → SHIPPED → IN_TRANSIT → RECEIVED  (terminal)
//                                ↘ CANCELLED (terminal)
//   DRAFT → SHIPPED → CANCELLED
//   DRAFT → CANCELLED

import { describe, expect, it } from "vitest";

import {
  canCancel,
  canReceive,
  canShip,
  isTerminal,
  statusBadgeVariant,
  statusLabel,
} from "./machine";

type TransferStatus = "DRAFT" | "SHIPPED" | "IN_TRANSIT" | "RECEIVED" | "CANCELLED";

const ALL: TransferStatus[] = ["DRAFT", "SHIPPED", "IN_TRANSIT", "RECEIVED", "CANCELLED"];

function assertOnly(fn: (s: TransferStatus) => boolean, allowed: TransferStatus[]) {
  for (const s of ALL) {
    expect(fn(s), `${fn.name}(${s})`).toBe(allowed.includes(s));
  }
}

describe("Transfer machine — canShip", () => {
  it("allows only DRAFT → SHIPPED", () => {
    assertOnly(canShip, ["DRAFT"]);
  });
});

describe("Transfer machine — canReceive", () => {
  it("allows only IN_TRANSIT → RECEIVED", () => {
    assertOnly(canReceive, ["IN_TRANSIT"]);
  });

  it("blocks SHIPPED (IN_TRANSIT is a real distinct state — receive requires transit hand-off)", () => {
    expect(canReceive("SHIPPED")).toBe(false);
  });
});

describe("Transfer machine — canCancel", () => {
  it("allows DRAFT, SHIPPED, IN_TRANSIT", () => {
    assertOnly(canCancel, ["DRAFT", "SHIPPED", "IN_TRANSIT"]);
  });

  it("blocks cancel on terminal states", () => {
    expect(canCancel("RECEIVED")).toBe(false);
    expect(canCancel("CANCELLED")).toBe(false);
  });
});

describe("Transfer machine — isTerminal", () => {
  it("flags RECEIVED + CANCELLED", () => {
    expect(isTerminal("RECEIVED")).toBe(true);
    expect(isTerminal("CANCELLED")).toBe(true);
  });

  it("does NOT flag in-progress states", () => {
    for (const s of ["DRAFT", "SHIPPED", "IN_TRANSIT"] as TransferStatus[]) {
      expect(isTerminal(s)).toBe(false);
    }
  });

  it("no action guard returns true on a terminal state", () => {
    for (const s of ["RECEIVED", "CANCELLED"] as TransferStatus[]) {
      expect(canShip(s)).toBe(false);
      expect(canReceive(s)).toBe(false);
      expect(canCancel(s)).toBe(false);
    }
  });
});

describe("Transfer machine — statusLabel", () => {
  it("returns a human-readable label for every state", () => {
    for (const s of ALL) {
      const label = statusLabel(s);
      expect(typeof label).toBe("string");
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it("returns the expected labels", () => {
    expect(statusLabel("DRAFT")).toBe("Draft");
    expect(statusLabel("SHIPPED")).toBe("Shipped");
    expect(statusLabel("IN_TRANSIT")).toBe("In Transit");
    expect(statusLabel("RECEIVED")).toBe("Received");
    expect(statusLabel("CANCELLED")).toBe("Cancelled");
  });
});

describe("Transfer machine — statusBadgeVariant", () => {
  it("maps every state to a non-empty variant token", () => {
    for (const s of ALL) {
      const v = statusBadgeVariant(s);
      expect(typeof v).toBe("string");
      expect(v.length).toBeGreaterThan(0);
    }
  });

  it("uses distinct variants for successful vs destructive terminals", () => {
    expect(statusBadgeVariant("RECEIVED")).toBe("success");
    expect(statusBadgeVariant("CANCELLED")).toBe("destructive");
  });
});
