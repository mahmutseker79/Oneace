// ADR-004 §12 pinned test — static-analysis vitest that runs the safety
// validator (`checkMigrationSafety`) across every new Prisma migration.
//
// Scope:
//
//   • Only migrations at or after `BASELINE_CUTOFF_DATE` are enforced.
//     Pre-cutoff migrations are grandfathered for the same reason the
//     header test grandfathers them — retrofitting would churn git
//     history for no correctness benefit.
//   • A migration must first pass the header check. If the declared
//     type is invalid / missing, this test skips the body check and
//     lets `all-migrations-have-header.static.test.ts` fail it instead,
//     so failures stay readable.
//   • ERROR-level violations fail the test; WARNING-level violations
//     print to stdout but pass. This lets us tighten rules without
//     breaking the suite.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isSubjectToHeaderRequirement,
  parseMigrationHeader,
} from "./header";
import { checkMigrationSafety, formatViolation } from "./safety";

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const MIGRATIONS_DIR = resolve(REPO_ROOT, "prisma", "migrations");

interface MigrationFile {
  dirname: string;
  sqlPath: string;
  sql: string;
}

function listMigrations(): MigrationFile[] {
  const entries = readdirSync(MIGRATIONS_DIR).filter((name) => {
    if (name === "migration_lock.toml") return false;
    const abs = resolve(MIGRATIONS_DIR, name);
    return statSync(abs).isDirectory();
  });
  return entries.map((dirname) => {
    const sqlPath = resolve(MIGRATIONS_DIR, dirname, "migration.sql");
    return { dirname, sqlPath, sql: readFileSync(sqlPath, "utf8") };
  });
}

describe("ADR-004 — every post-cutoff migration passes the safety validator", () => {
  const migrations = listMigrations();

  it("runs the validator against every enforced migration", () => {
    const errors: string[] = [];
    const warnings: string[] = [];
    let enforcedCount = 0;

    for (const m of migrations) {
      if (!isSubjectToHeaderRequirement(m.dirname)) continue;
      const header = parseMigrationHeader(m.sql);
      if (header.type === null) {
        // Header is either missing or malformed — skip, let the header
        // test fail it.
        continue;
      }
      enforcedCount += 1;
      const violations = checkMigrationSafety(m.sql, header.type);
      for (const v of violations) {
        const formatted = formatViolation(`${m.dirname}/migration.sql`, v);
        if (v.severity === "ERROR") errors.push(formatted);
        else warnings.push(formatted);
      }
    }

    if (warnings.length > 0) {
      // Surface warnings in the test output without failing.
      console.warn(
        `\nADR-004 safety warnings (not fatal, ${warnings.length}):\n${warnings.join(
          "\n"
        )}\n`
      );
    }

    if (errors.length > 0) {
      throw new Error(
        `ADR-004 safety check failed for ${errors.length} violation(s) across ${enforcedCount} enforced migration(s):\n${errors.join(
          "\n"
        )}\n\nSee src/lib/prisma-migration/safety.ts for the rule set.`
      );
    }
  });

  it("never double-counts the same migration", () => {
    const names = new Set<string>();
    for (const m of migrations) names.add(m.dirname);
    expect(names.size).toBe(migrations.length);
  });
});
