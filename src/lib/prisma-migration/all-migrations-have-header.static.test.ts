// ADR-004 §12 pinned test — static-analysis vitest that reads
// `prisma/migrations/**/migration.sql` and enforces the policy from
// `header.ts`:
//
//   • Every migration whose directory date sits at or after
//     `BASELINE_CUTOFF_DATE` (2026-04-19) must declare a valid
//     `-- MIGRATION-TYPE: EXPAND | BACKFILL | CONTRACT` header in the
//     first 20 non-blank lines.
//   • No migration may declare the header more than once.
//   • Historic migrations authored before the cutoff are grandfathered —
//     the test does not fail if they lack a header, but *does* fail if
//     they declare a malformed one (you shouldn't be editing them anyway).
//
// The point of doing this in the static test suite (instead of a shell
// check in CI) is that failures show up in `vitest run` locally the same
// way a code regression does, with a precise line reference. That keeps
// ADR-004 compliance enforced in the same loop as every other pinned test.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  findDuplicateHeaders,
  isSubjectToHeaderRequirement,
  parseMigrationHeader,
} from "./header";

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

describe("ADR-004 — every new Prisma migration declares a MIGRATION-TYPE", () => {
  const migrations = listMigrations();

  it("finds at least one migration to validate", () => {
    // Smoke check — if the glob pattern breaks, no other assertion fires.
    expect(migrations.length).toBeGreaterThan(0);
  });

  it("enforces the header on every migration dated on or after the cutoff", () => {
    const failures: string[] = [];
    for (const m of migrations) {
      if (!isSubjectToHeaderRequirement(m.dirname)) continue;
      const result = parseMigrationHeader(m.sql);
      if (!result.present) {
        failures.push(
          `  ✗ ${m.dirname}: missing \`-- MIGRATION-TYPE: EXPAND|BACKFILL|CONTRACT\` header`
        );
        continue;
      }
      if (result.type === null) {
        failures.push(
          `  ✗ ${m.dirname}: invalid MIGRATION-TYPE value "${result.rawValue}" (must be EXPAND, BACKFILL, or CONTRACT)`
        );
      }
    }
    if (failures.length > 0) {
      throw new Error(
        `ADR-004 header policy violated for ${failures.length} migration(s):\n${failures.join(
          "\n"
        )}\n\nSee src/lib/prisma-migration/header.ts for the contract.`
      );
    }
  });

  it("rejects malformed MIGRATION-TYPE values even on grandfathered migrations", () => {
    // A historic migration without a header is fine, but if it goes out of
    // its way to declare one then the value still has to be valid. This
    // catches typos on migrations that land right before the cutoff.
    const failures: string[] = [];
    for (const m of migrations) {
      if (isSubjectToHeaderRequirement(m.dirname)) continue;
      const result = parseMigrationHeader(m.sql);
      if (result.present && result.type === null) {
        failures.push(
          `  ✗ ${m.dirname}: has MIGRATION-TYPE comment with invalid value "${result.rawValue}"`
        );
      }
    }
    if (failures.length > 0) {
      throw new Error(
        `ADR-004 grandfathered migration declared an invalid header:\n${failures.join(
          "\n"
        )}`
      );
    }
  });

  it("disallows duplicate MIGRATION-TYPE declarations within a single file", () => {
    const failures: string[] = [];
    for (const m of migrations) {
      const dupes = findDuplicateHeaders(m.sql);
      if (dupes.length > 1) {
        failures.push(
          `  ✗ ${m.dirname}: ${dupes.length} MIGRATION-TYPE declarations at lines ${dupes
            .map((i) => i + 1)
            .join(", ")}`
        );
      }
    }
    if (failures.length > 0) {
      throw new Error(
        `ADR-004 header policy violated — duplicate headers:\n${failures.join(
          "\n"
        )}`
      );
    }
  });
});
