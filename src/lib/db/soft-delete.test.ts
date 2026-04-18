/**
 * P2-4 (audit v1.0 §11.4) — pin the soft-delete policy and the
 * two report queries the audit called out.
 *
 * The audit found that `/reports/suppliers` and its CSV export
 * were returning archived suppliers even though the UI page
 * promised "active only". The fix: centralize the "alive"
 * predicate per model in `soft-delete.ts`, then have the report
 * queries spread the canonical fragment into their `where`.
 *
 * These tests are static-analysis — cheap, deterministic, and
 * they fail in CI the moment someone removes the filter again.
 * They deliberately do NOT try to run the queries: the goal is
 * to pin the *shape* of the queries so the policy can't drift
 * without showing up on the diff.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  binActiveWhere,
  itemActiveWhere,
  supplierActiveWhere,
  warehouseActiveWhere,
} from "./soft-delete";

function readSrc(relative: string): string {
  return readFileSync(join(process.cwd(), relative), "utf8");
}

describe("soft-delete filter fragments", () => {
  it("itemActiveWhere keeps the ACTIVE literal (not the full ItemStatus union)", () => {
    expect(itemActiveWhere).toEqual({ status: "ACTIVE" });
  });

  it("supplierActiveWhere asks for isActive === true", () => {
    expect(supplierActiveWhere).toEqual({ isActive: true });
  });

  it("warehouseActiveWhere asks for isArchived === false", () => {
    // Note the inversion: Warehouse uses the "archived" pole while
    // Supplier uses the "active" pole. The helper hides that
    // asymmetry from callers.
    expect(warehouseActiveWhere).toEqual({ isArchived: false });
  });

  it("binActiveWhere asks for isArchived === false", () => {
    expect(binActiveWhere).toEqual({ isArchived: false });
  });
});

describe("supplier performance report filters archived suppliers (§11.4)", () => {
  const page = readSrc("src/app/(app)/reports/suppliers/page.tsx");
  const exportRoute = readSrc("src/app/(app)/reports/suppliers/export/route.ts");

  it("reports/suppliers/page.tsx imports supplierActiveWhere", () => {
    expect(page).toMatch(/from\s+"@\/lib\/db\/soft-delete"/);
    expect(page).toMatch(/supplierActiveWhere/);
  });

  it("reports/suppliers/page.tsx spreads the fragment into the list query", () => {
    // The whole point — a plain supplier.findMany without the
    // spread was the exact regression the audit flagged.
    expect(page).toMatch(
      /db\.supplier\.findMany\s*\(\s*\{\s*where:\s*\{[^}]*\.\.\.supplierActiveWhere/,
    );
  });

  it("reports/suppliers/export/route.ts imports supplierActiveWhere", () => {
    expect(exportRoute).toMatch(/from\s+"@\/lib\/db\/soft-delete"/);
    expect(exportRoute).toMatch(/supplierActiveWhere/);
  });

  it("reports/suppliers/export/route.ts spreads the fragment into the list query", () => {
    expect(exportRoute).toMatch(
      /db\.supplier\.findMany\s*\(\s*\{\s*where:\s*\{[^}]*\.\.\.supplierActiveWhere/,
    );
  });
});
