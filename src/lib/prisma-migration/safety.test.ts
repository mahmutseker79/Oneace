// ADR-004 §12 pinned test — unit coverage for the migration safety
// validator. The companion static test
// (`all-migrations-pass-safety.static.test.ts`) runs `checkMigrationSafety`
// across the real migration tree; this file exercises every rule the
// validator knows about with hand-crafted SQL fixtures so the rules stay
// correct as they evolve.

import { describe, expect, it } from "vitest";
import { checkMigrationSafety, formatViolation } from "./safety";

describe("checkMigrationSafety — destructive statements require CONTRACT", () => {
  it("flags DROP TABLE in an EXPAND migration", () => {
    const sql = "-- MIGRATION-TYPE: EXPAND\nDROP TABLE legacy_carts;\n";
    const violations = checkMigrationSafety(sql, "EXPAND");
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("drop-table");
    expect(violations[0].severity).toBe("ERROR");
  });

  it("allows DROP TABLE in a CONTRACT migration", () => {
    const sql = "-- MIGRATION-TYPE: CONTRACT\nDROP TABLE legacy_carts;\n";
    expect(checkMigrationSafety(sql, "CONTRACT")).toHaveLength(0);
  });

  it("flags DROP COLUMN in EXPAND and allows it in CONTRACT", () => {
    const dropCol =
      'ALTER TABLE "User" DROP COLUMN "oldField";\n';
    expect(checkMigrationSafety(dropCol, "EXPAND")[0].rule).toBe(
      "drop-column"
    );
    expect(checkMigrationSafety(dropCol, "CONTRACT")).toHaveLength(0);
  });

  it("flags SET NOT NULL in EXPAND and allows it in CONTRACT", () => {
    const sql = 'ALTER TABLE "Product" ALTER COLUMN "lotTracked" SET NOT NULL;';
    expect(checkMigrationSafety(sql, "EXPAND")[0].rule).toBe("set-not-null");
    expect(checkMigrationSafety(sql, "CONTRACT")).toHaveLength(0);
  });

  it("flags RENAME COLUMN regardless of type (suggests split)", () => {
    const sql =
      'ALTER TABLE "User" RENAME COLUMN "email" TO "emailAddress";\n';
    // RENAME is destructive even in CONTRACT (see suggestion text) — but
    // we allow it in CONTRACT because there is a documented escape hatch.
    expect(checkMigrationSafety(sql, "EXPAND")[0].rule).toBe("rename-column");
    expect(checkMigrationSafety(sql, "CONTRACT")).toHaveLength(0);
  });

  it("flags RENAME TABLE", () => {
    const sql = 'ALTER TABLE "Customer" RENAME TO "Account";';
    expect(checkMigrationSafety(sql, "EXPAND")[0].rule).toBe("rename-table");
  });

  it("flags DROP INDEX in EXPAND", () => {
    const sql = 'DROP INDEX "User_email_idx";';
    expect(checkMigrationSafety(sql, "EXPAND")[0].rule).toBe("drop-index");
  });
});

describe("checkMigrationSafety — ADD COLUMN NOT NULL without DEFAULT", () => {
  it("flags the canonical multi-tenant lock trap", () => {
    const sql =
      'ALTER TABLE "Product" ADD COLUMN "lotTracked" BOOLEAN NOT NULL;\n';
    const violations = checkMigrationSafety(sql, "EXPAND");
    expect(violations[0].rule).toBe("add-column-not-null-no-default");
  });

  it("allows ADD COLUMN NOT NULL when a DEFAULT is supplied", () => {
    const sql =
      'ALTER TABLE "Product" ADD COLUMN "lotTracked" BOOLEAN NOT NULL DEFAULT false;\n';
    expect(checkMigrationSafety(sql, "EXPAND")).toHaveLength(0);
  });

  it("allows ADD COLUMN NULLABLE without DEFAULT (the safe expand)", () => {
    const sql = 'ALTER TABLE "Product" ADD COLUMN "lotTracked" BOOLEAN;';
    expect(checkMigrationSafety(sql, "EXPAND")).toHaveLength(0);
  });

  it("flags ADD COLUMN NOT NULL without DEFAULT regardless of type", () => {
    // Even CONTRACT shouldn't do the row rewrite trap directly.
    const sql =
      'ALTER TABLE "Product" ADD COLUMN "sku" TEXT NOT NULL;';
    expect(checkMigrationSafety(sql, "CONTRACT")).toHaveLength(1);
  });
});

describe("checkMigrationSafety — BACKFILL shape", () => {
  it("warns when a BACKFILL migration contains DDL", () => {
    const sql = [
      'CREATE INDEX "product_idx" ON "Product" ("sku");',
      'UPDATE "Product" SET "lotTracked" = false WHERE "lotTracked" IS NULL;',
    ].join("\n");
    const violations = checkMigrationSafety(sql, "BACKFILL");
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("backfill-contains-ddl");
    expect(violations[0].severity).toBe("WARNING");
  });

  it("accepts a pure UPDATE BACKFILL", () => {
    const sql =
      'UPDATE "Product" SET "lotTracked" = false WHERE "lotTracked" IS NULL;';
    expect(checkMigrationSafety(sql, "BACKFILL")).toHaveLength(0);
  });
});

describe("checkMigrationSafety — escape hatch", () => {
  it("respects `-- adr-004-safety: ignore` on a single line", () => {
    const sql =
      'DROP TABLE "scratch_legacy"; -- adr-004-safety: ignore\n';
    expect(checkMigrationSafety(sql, "EXPAND")).toHaveLength(0);
  });

  it("does not silence unrelated lines below the marker", () => {
    const sql = [
      'DROP TABLE "scratch_legacy"; -- adr-004-safety: ignore',
      'DROP TABLE "real_table";',
    ].join("\n");
    const violations = checkMigrationSafety(sql, "EXPAND");
    expect(violations).toHaveLength(1);
    expect(violations[0].line).toBe(2);
  });
});

describe("formatViolation", () => {
  it("produces a readable single-line message", () => {
    const formatted = formatViolation("20260420000000_demo/migration.sql", {
      severity: "ERROR",
      line: 5,
      statement: 'DROP TABLE "legacy";',
      rule: "drop-table",
      suggestion: "label MIGRATION-TYPE: CONTRACT",
    });
    expect(formatted).toContain("[ERROR]");
    expect(formatted).toContain("20260420000000_demo/migration.sql:5");
    expect(formatted).toContain("drop-table");
  });
});
