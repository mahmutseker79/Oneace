// ADR-004 §12 pinned test — unit coverage for the MIGRATION-TYPE header
// parser. These tests exercise `parseMigrationHeader`, `extractMigrationDate`,
// and `isSubjectToHeaderRequirement` with hand-crafted fixtures so the
// parser stays correct independent of what's actually under
// `prisma/migrations/`. The companion static test
// (`all-migrations-have-header.static.test.ts`) applies the parser across
// the real migration tree and enforces the policy on new migrations.

import { describe, expect, it } from "vitest";
import {
  BASELINE_CUTOFF_DATE,
  extractMigrationDate,
  findDuplicateHeaders,
  isSubjectToHeaderRequirement,
  parseMigrationHeader,
} from "./header";

describe("parseMigrationHeader", () => {
  it("parses EXPAND from a canonical header", () => {
    const sql = "-- MIGRATION-TYPE: EXPAND\nCREATE TABLE foo (id TEXT);\n";
    expect(parseMigrationHeader(sql)).toEqual({
      type: "EXPAND",
      present: true,
      rawValue: "EXPAND",
    });
  });

  it("parses BACKFILL and CONTRACT too", () => {
    expect(parseMigrationHeader("-- MIGRATION-TYPE: BACKFILL\n").type).toBe(
      "BACKFILL"
    );
    expect(parseMigrationHeader("-- MIGRATION-TYPE: CONTRACT\n").type).toBe(
      "CONTRACT"
    );
  });

  it("is case-insensitive on the label and normalizes the value", () => {
    expect(parseMigrationHeader("-- migration-type: expand\n").type).toBe(
      "EXPAND"
    );
    expect(parseMigrationHeader("-- Migration-Type: Contract\n").type).toBe(
      "CONTRACT"
    );
  });

  it("tolerates leading whitespace and extra spaces around the colon", () => {
    const sql = "   --   MIGRATION-TYPE   :   EXPAND   \n";
    expect(parseMigrationHeader(sql).type).toBe("EXPAND");
  });

  it("returns present=true with type=null when the value is unknown", () => {
    const result = parseMigrationHeader("-- MIGRATION-TYPE: REFACTOR\n");
    expect(result.present).toBe(true);
    expect(result.type).toBeNull();
    expect(result.rawValue).toBe("REFACTOR");
  });

  it("returns present=false when no header is present", () => {
    const sql = "-- just a regular comment\nCREATE TABLE foo (id TEXT);\n";
    expect(parseMigrationHeader(sql)).toEqual({
      type: null,
      present: false,
      rawValue: null,
    });
  });

  it("ignores blank lines when counting the 20-line scan window", () => {
    // 19 real non-blank lines, then the header on line 20 of non-blank
    // content (with blanks sprinkled in). Should still be detected.
    const padding = Array.from({ length: 19 }, (_, i) => `-- note ${i}`).join(
      "\n\n"
    );
    const sql = `${padding}\n\n-- MIGRATION-TYPE: BACKFILL\n`;
    expect(parseMigrationHeader(sql).type).toBe("BACKFILL");
  });

  it("does not scan past 20 non-blank lines", () => {
    const padding = Array.from({ length: 25 }, (_, i) => `-- note ${i}`).join(
      "\n"
    );
    const sql = `${padding}\n-- MIGRATION-TYPE: EXPAND\n`;
    expect(parseMigrationHeader(sql).present).toBe(false);
  });

  it("returns the first match when multiple headers are present", () => {
    const sql =
      "-- MIGRATION-TYPE: EXPAND\n-- MIGRATION-TYPE: CONTRACT\nCREATE TABLE x (y TEXT);\n";
    expect(parseMigrationHeader(sql).type).toBe("EXPAND");
  });
});

describe("findDuplicateHeaders", () => {
  it("returns every line index carrying a MIGRATION-TYPE comment", () => {
    const sql = [
      "-- MIGRATION-TYPE: EXPAND",
      "CREATE TABLE a (id TEXT);",
      "-- MIGRATION-TYPE: CONTRACT",
    ].join("\n");
    expect(findDuplicateHeaders(sql)).toEqual([0, 2]);
  });

  it("returns empty when no header is declared", () => {
    expect(findDuplicateHeaders("CREATE TABLE a (id TEXT);")).toEqual([]);
  });
});

describe("extractMigrationDate", () => {
  it("extracts YYYYMMDD from a canonical Prisma migration directory name", () => {
    expect(extractMigrationDate("20260418100000_cron_idempotency")).toBe(
      "20260418"
    );
    expect(extractMigrationDate("20260418_audit_critical_fixes")).toBe(
      "20260418"
    );
  });

  it("returns null for non-dated directories (slug-only migrations)", () => {
    expect(extractMigrationDate("phase5a_additive_domain_model")).toBeNull();
    expect(extractMigrationDate("sprint2_performance_indexes")).toBeNull();
  });
});

describe("isSubjectToHeaderRequirement", () => {
  it("grandfathers migrations authored strictly before the cutoff", () => {
    expect(isSubjectToHeaderRequirement("20260413053718_p7_ui_state")).toBe(
      false
    );
    expect(
      isSubjectToHeaderRequirement("20260418100000_cron_idempotency")
    ).toBe(false);
  });

  it("requires a header on migrations at or after the cutoff", () => {
    // The cutoff itself is 2026-04-19 per ADR-004 §BASELINE_CUTOFF_DATE.
    expect(
      isSubjectToHeaderRequirement("20260419000000_next_migration")
    ).toBe(true);
    expect(
      isSubjectToHeaderRequirement("20260501100000_landed_cost_expand")
    ).toBe(true);
  });

  it("ignores non-dated directories (slug-only migrations)", () => {
    expect(
      isSubjectToHeaderRequirement("phase5a_additive_domain_model")
    ).toBe(false);
  });

  it("pins the cutoff so an accidental edit fails a review", () => {
    // Intentionally hard-coded here: if someone moves BASELINE_CUTOFF_DATE
    // without thinking, this test fails and the reviewer has to decide
    // whether the shift is intentional.
    expect(BASELINE_CUTOFF_DATE).toBe("20260419");
  });
});
