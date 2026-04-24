// src/lib/costing/schema-landed-cost.static.test.ts
//
// Pinned static-analysis test for P0-04 rc2.
//
// Invariant
// ---------
//   prisma/schema.prisma MUST declare the landed-cost surface:
//     - PurchaseOrder: freightCost / dutyCost / insuranceCost /
//       otherLandedCost / landedCostCurrency / landedAllocationBasis
//     - StockMovement: purchaseUnitCost / landedUnitCost
//     - LandedCostAllocation model (with sourceMovementId etc.)
//     - AllocationBasis enum (4 values)
//     - AllocationType enum (4 values)
//
//   The 20260425 migration MUST exist with the matching shape
//   (new enums, ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT EXISTS).

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

function extractModelBody(src: string, name: string): string | null {
  const header = new RegExp(`^model\\s+${name}\\s*\\{`, "m");
  const match = header.exec(src);
  if (!match) return null;
  const end = src.indexOf("\n}\n", match.index);
  if (end === -1) return null;
  return src.slice(match.index, end + 3);
}

describe("Schema — P0-04 landed-cost surface (ADR-002 §5)", () => {
  const root = findRepoRoot();
  const schema = fs.readFileSync(path.join(root, "prisma", "schema.prisma"), "utf8");

  it("PurchaseOrder carries all 6 landed-cost columns", () => {
    const body = extractModelBody(schema, "PurchaseOrder") ?? "";
    for (const marker of [
      /freightCost\s+Decimal\?\s+@db\.Decimal\(18,\s*4\)/,
      /dutyCost\s+Decimal\?\s+@db\.Decimal\(18,\s*4\)/,
      /insuranceCost\s+Decimal\?\s+@db\.Decimal\(18,\s*4\)/,
      /otherLandedCost\s+Decimal\?\s+@db\.Decimal\(18,\s*4\)/,
      /landedCostCurrency\s+String\?\s+@default\("USD"\)/,
      /landedAllocationBasis\s+AllocationBasis\s+@default\(BY_VALUE\)/,
    ]) {
      expect(marker.test(body), `PurchaseOrder missing ${marker}`).toBe(true);
    }
  });

  it("StockMovement carries purchaseUnitCost + landedUnitCost", () => {
    const body = extractModelBody(schema, "StockMovement") ?? "";
    expect(/purchaseUnitCost\s+Decimal\?\s+@db\.Decimal\(18,\s*6\)/.test(body)).toBe(true);
    expect(/landedUnitCost\s+Decimal\?\s+@db\.Decimal\(18,\s*6\)/.test(body)).toBe(true);
  });

  it("LandedCostAllocation model exists with audit fields", () => {
    const body = extractModelBody(schema, "LandedCostAllocation") ?? "";
    expect(body.length).toBeGreaterThan(0);
    for (const marker of [
      /organizationId\s+String/,
      /sourceMovementId\s+String/,
      /allocationType\s+AllocationType/,
      /allocationBasis\s+AllocationBasis/,
      /allocatedAmount\s+Decimal\s+@db\.Decimal\(18,\s*6\)/,
      /isRevaluation\s+Boolean\s+@default\(false\)/,
      /appliedAt\s+DateTime/,
    ]) {
      expect(marker.test(body), `LandedCostAllocation missing ${marker}`).toBe(true);
    }
  });

  it("AllocationBasis enum has all 4 bases", () => {
    // String-match on the enum block; tolerates multi-line spacing.
    const block = schema.match(/enum\s+AllocationBasis\s*\{([\s\S]+?)\}/);
    expect(block, "AllocationBasis enum missing").not.toBeNull();
    const body = block?.[1] ?? "";
    for (const v of ["BY_VALUE", "BY_QTY", "BY_WEIGHT", "BY_VOLUME"]) {
      expect(new RegExp(`\\b${v}\\b`).test(body), `missing ${v}`).toBe(true);
    }
  });

  it("AllocationType enum has all 4 types", () => {
    const block = schema.match(/enum\s+AllocationType\s*\{([\s\S]+?)\}/);
    expect(block, "AllocationType enum missing").not.toBeNull();
    const body = block?.[1] ?? "";
    for (const v of ["FREIGHT", "DUTY", "INSURANCE", "OTHER"]) {
      expect(new RegExp(`\\b${v}\\b`).test(body), `missing ${v}`).toBe(true);
    }
  });

  it("Organization back-ref is wired", () => {
    const body = extractModelBody(schema, "Organization") ?? "";
    expect(/landedCostAllocations\s+LandedCostAllocation\[\]/.test(body)).toBe(true);
  });
});

describe("Migration — 20260425_landed_cost", () => {
  const root = findRepoRoot();
  const migDir = path.join(root, "prisma", "migrations", "20260425000000_landed_cost");

  it("migration directory + sql exist", () => {
    expect(fs.existsSync(migDir)).toBe(true);
    expect(fs.existsSync(path.join(migDir, "migration.sql"))).toBe(true);
  });

  it("migration creates both enums (idempotent)", () => {
    const sql = fs.readFileSync(path.join(migDir, "migration.sql"), "utf8");
    expect(/CREATE TYPE\s+"AllocationBasis"/.test(sql)).toBe(true);
    expect(/CREATE TYPE\s+"AllocationType"/.test(sql)).toBe(true);
    // Both must be wrapped in a DO block for re-runnability.
    expect(/DO\s*\$\$[\s\S]*?CREATE TYPE\s+"AllocationBasis"/.test(sql)).toBe(true);
    expect(/DO\s*\$\$[\s\S]*?CREATE TYPE\s+"AllocationType"/.test(sql)).toBe(true);
  });

  it("migration adds PO columns with ADD COLUMN IF NOT EXISTS", () => {
    const sql = fs.readFileSync(path.join(migDir, "migration.sql"), "utf8");
    const poBlock = sql.match(/ALTER TABLE\s+"PurchaseOrder"([\s\S]*?);/)?.[0] ?? "";
    for (const col of [
      "freightCost",
      "dutyCost",
      "insuranceCost",
      "otherLandedCost",
      "landedCostCurrency",
      "landedAllocationBasis",
    ]) {
      expect(
        new RegExp(`ADD COLUMN IF NOT EXISTS\\s+"${col}"`).test(poBlock),
        `PO column ${col} missing from ALTER`,
      ).toBe(true);
    }
  });

  it("migration adds StockMovement cost columns", () => {
    const sql = fs.readFileSync(path.join(migDir, "migration.sql"), "utf8");
    const smBlock = sql.match(/ALTER TABLE\s+"StockMovement"([\s\S]*?);/)?.[0] ?? "";
    expect(/ADD COLUMN IF NOT EXISTS\s+"purchaseUnitCost"/.test(smBlock)).toBe(true);
    expect(/ADD COLUMN IF NOT EXISTS\s+"landedUnitCost"/.test(smBlock)).toBe(true);
  });

  it("migration creates LandedCostAllocation table + FKs", () => {
    const sql = fs.readFileSync(path.join(migDir, "migration.sql"), "utf8");
    expect(/CREATE TABLE IF NOT EXISTS\s+"LandedCostAllocation"/.test(sql)).toBe(true);
    // Three required FKs.
    for (const col of ["organizationId", "sourceMovementId", "purchaseOrderId"]) {
      expect(
        new RegExp(`"LandedCostAllocation_${col}_fkey"`).test(sql),
        `missing FK LandedCostAllocation_${col}_fkey`,
      ).toBe(true);
    }
  });
});
