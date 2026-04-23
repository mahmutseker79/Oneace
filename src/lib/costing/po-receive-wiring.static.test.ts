// src/lib/costing/po-receive-wiring.static.test.ts
//
// Pinned static-analysis test for P0-04 rc3.
//
// Invariant
// ---------
//   src/app/(app)/purchase-orders/actions.ts — the PO receive
//   action — MUST:
//     1. Import allocateLanded from src/lib/costing/landed
//     2. Call allocateLanded(...)
//     3. Pull landed-cost columns from the PO findFirst select
//        (freightCost, dutyCost, insuranceCost, otherLandedCost,
//        landedAllocationBasis)
//     4. Pass purchaseUnitCost + landedUnitCost into postMovement
//     5. Write LandedCostAllocation rows via createMany
//
// Why
// ---
// The allocator is a pure function — shipping it and NOT wiring it
// is the classic "code is ready, behaviour isn't" trap. This test
// makes the wiring load-bearing: if a refactor accidentally drops
// any of the steps, the P0-04 revenue path regresses and CI
// catches it.

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function findRepoRoot(): string {
  let dir = path.resolve(__dirname);
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error("repo root not found");
}

const PO_ACTIONS = "src/app/(app)/purchase-orders/actions.ts";

describe("PO-receive wiring — P0-04 rc3", () => {
  const root = findRepoRoot();
  const src = fs.readFileSync(path.join(root, PO_ACTIONS), "utf8");

  it("imports allocateLanded from the costing module", () => {
    expect(
      /import\s*\{[^}]*\ballocateLanded\b[^}]*\}\s*from\s*["']@\/lib\/costing\/landed["']/.test(src),
    ).toBe(true);
  });

  it("calls allocateLanded(...)", () => {
    expect(/\ballocateLanded\s*\(/.test(src)).toBe(true);
  });

  it("pulls the 5 landed-cost columns from the PO findFirst select", () => {
    // The select block includes freightCost / dutyCost /
    // insuranceCost / otherLandedCost / landedAllocationBasis.
    for (const col of [
      "freightCost",
      "dutyCost",
      "insuranceCost",
      "otherLandedCost",
      "landedAllocationBasis",
    ]) {
      expect(
        new RegExp(`\\b${col}\\s*:\\s*true`).test(src),
        `PO select missing ${col}: true`,
      ).toBe(true);
    }
  });

  it("pulls PO line unitCost in the select (allocator input)", () => {
    // `unitCost: true` inside a Prisma select is the allocator's
    // BY_VALUE denominator seed. It only appears in this file on
    // the PO-receive select (PO lines don't expose unitCost for
    // any other purpose here).
    expect(/\bunitCost\s*:\s*true\b/.test(src)).toBe(true);
  });

  it("passes purchaseUnitCost + landedUnitCost to postMovement", () => {
    // These two keys must appear within ~1kb of a postMovement call.
    // We check presence at file level (both keys AND a postMovement
    // call); a regex spanning the call body is brittle across
    // formatter changes.
    expect(/\bpostMovement\s*\(/.test(src)).toBe(true);
    expect(/\bpurchaseUnitCost\s*,/.test(src) || /\bpurchaseUnitCost:\s*/.test(src)).toBe(true);
    expect(/\blandedUnitCost\s*,/.test(src) || /\blandedUnitCost:\s*/.test(src)).toBe(true);
  });

  it("writes LandedCostAllocation rows via createMany", () => {
    // Matches either `tx.landedCostAllocation.createMany(` or a
    // re-export-through-helper call. The current implementation
    // uses the direct tx call.
    expect(/\blandedCostAllocation\.createMany\s*\(/.test(src)).toBe(true);
  });

  it("covers the 4 AllocationType values in the written rows", () => {
    // The implementation builds an object keyed on FREIGHT / DUTY /
    // INSURANCE / OTHER. A future refactor that drops one (e.g. by
    // accident) should be caught here.
    for (const v of ["FREIGHT", "DUTY", "INSURANCE", "OTHER"]) {
      expect(
        new RegExp(`\\b${v}\\b`).test(src),
        `AllocationType ${v} not referenced in PO receive action`,
      ).toBe(true);
    }
  });
});
