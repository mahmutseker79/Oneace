// src/lib/movements/schema-idempotency-not-null.static.test.ts
//
// Pinned static-analysis test for P0-03 rc2.
//
// Invariant
// ---------
//   prisma/schema.prisma's StockMovement.idempotencyKey column MUST
//   remain `String` (NOT NULL), and a migration that flips it must
//   exist on disk.
//
// Why
// ---
// The flip is load-bearing: a partial-unique index (nullable column)
// lets two concurrent writes without a key both succeed. If a
// future refactor re-nulls the column, the postMovement seam's
// auto-gen + P0-03 backfill sentinel become dead code and webhook
// replay protection regresses silently.
//
// This test pins both halves of the invariant:
//   1. The schema declares `idempotencyKey String` on StockMovement.
//   2. The 20260424 migration directory exists and contains the
//      backfill + ALTER SQL shape we expect.

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

/**
 * Extract the StockMovement model body from schema.prisma. Returns
 * the source slice between `model StockMovement {` and the matching
 * closing `}`. A naive scan is sufficient — Prisma schemas don't
 * have nested braces in field definitions.
 */
function extractModelBody(schemaSrc: string, modelName: string): string | null {
  const header = new RegExp(`^model\\s+${modelName}\\s*\\{`, "m");
  const match = header.exec(schemaSrc);
  if (!match) return null;
  // Walk forward to the matching closing brace at column 0.
  const end = schemaSrc.indexOf("\n}\n", match.index);
  if (end === -1) return null;
  return schemaSrc.slice(match.index, end + 3);
}

describe("StockMovement.idempotencyKey — pinned NOT NULL (P0-03 rc2)", () => {
  it("schema.prisma declares idempotencyKey as String (not String?)", () => {
    const root = findRepoRoot();
    const src = fs.readFileSync(path.join(root, "prisma", "schema.prisma"), "utf8");
    const body = extractModelBody(src, "StockMovement");
    expect(body, "StockMovement model must exist in schema").not.toBeNull();

    // Match the field line. Tolerates arbitrary whitespace between
    // the name and the type; deliberately does NOT tolerate a `?`
    // on the type.
    const nullable = /idempotencyKey\s+String\?/m.test(body ?? "");
    const notNullable = /idempotencyKey\s+String(?!\?)\b/m.test(body ?? "");

    expect(nullable, "idempotencyKey must NOT be nullable on StockMovement").toBe(false);
    expect(notNullable, "idempotencyKey must be declared as non-null String").toBe(true);
  });

  it("the 20260424 migration exists with backfill + ALTER shape", () => {
    const root = findRepoRoot();
    const dir = path.join(
      root,
      "prisma",
      "migrations",
      "20260424000000_stock_movement_idempotency_not_null",
    );
    expect(fs.existsSync(dir), `expected migration dir at ${dir}`).toBe(true);

    const sqlPath = path.join(dir, "migration.sql");
    expect(fs.existsSync(sqlPath), `expected migration.sql in ${dir}`).toBe(true);

    const sql = fs.readFileSync(sqlPath, "utf8");

    // Backfill step: UPDATE … SET "idempotencyKey" = 'LEGACY:' || "id" WHERE … IS NULL.
    // We check for the two substrings rather than a full regex because
    // the migration may wrap them in a DO $$ block.
    expect(sql, "migration must backfill NULL rows with 'LEGACY:' prefix").toMatch(
      /UPDATE\s+"StockMovement"/i,
    );
    expect(sql).toMatch(/'LEGACY:'/);
    expect(sql).toMatch(/IS NULL/i);

    // ALTER step: must flip to NOT NULL.
    expect(sql, "migration must ALTER idempotencyKey to SET NOT NULL").toMatch(
      /ALTER\s+TABLE\s+"StockMovement"/i,
    );
    expect(sql).toMatch(/SET NOT NULL/i);

    // Ordering guard: backfill should appear before ALTER in the file.
    const updatePos = sql.search(/UPDATE\s+"StockMovement"/i);
    const alterPos = sql.search(/ALTER\s+COLUMN\s+"idempotencyKey"\s+SET NOT NULL/i);
    expect(updatePos).toBeGreaterThanOrEqual(0);
    expect(alterPos).toBeGreaterThan(updatePos);
  });

  it("migration is re-runnable (ALTER wrapped in a conditional)", () => {
    const root = findRepoRoot();
    const sql = fs.readFileSync(
      path.join(
        root,
        "prisma",
        "migrations",
        "20260424000000_stock_movement_idempotency_not_null",
        "migration.sql",
      ),
      "utf8",
    );
    // We expect a DO $$ BEGIN … END $$ block or an IF EXISTS guard
    // around the ALTER so a re-run on an already-flipped column
    // doesn't fail.
    const guarded =
      /DO\s*\$\$[\s\S]*?ALTER\s+TABLE/i.test(sql) ||
      /IF\s+.+?\s+THEN[\s\S]*?ALTER\s+TABLE/i.test(sql);
    expect(guarded, "ALTER must be guarded for idempotent re-runs").toBe(true);
  });
});
