#!/usr/bin/env -S node --experimental-strip-types
// ADR-004 §13 rc1 — CLI gate for the `MIGRATION-TYPE` header policy.
//
// Intended use:
//
//   • Developer local — run before `git push` to fail fast instead of
//     waiting for the pinned vitest to catch it in CI.
//   • GitHub Actions — invoked from `.github/workflows/ci.yml` so a PR
//     that introduces a new migration without a valid header fails the
//     PR check even before the vitest job runs.
//
// This deliberately duplicates the `all-migrations-have-header.static.test.ts`
// logic *by using the same parser module* — if the rules drift in one
// place they drift in both, and the pinned unit test over `header.ts`
// keeps the rules themselves honest.
//
// Exits with:
//   0  ok
//   1  policy violation (at least one migration is non-compliant)
//   2  environmental error (migrations directory missing, etc.)
//
// Run with: `npx tsx scripts/check-migration-header.ts` (or the bare
// shebang above under Node 22+ with `--experimental-strip-types`).

import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import {
  findDuplicateHeaders,
  isSubjectToHeaderRequirement,
  parseMigrationHeader,
} from "../src/lib/prisma-migration/header";
import { checkMigrationSafety, formatViolation } from "../src/lib/prisma-migration/safety";

const REPO_ROOT = resolve(__dirname, "..");
const MIGRATIONS_DIR = resolve(REPO_ROOT, "prisma", "migrations");

function log(label: "ok" | "fail" | "info", message: string): void {
  const prefix = label === "ok" ? "  ✓" : label === "fail" ? "  ✗" : "  ·";
  console.log(`${prefix} ${message}`);
}

function main(): number {
  let dirents: string[];
  try {
    dirents = readdirSync(MIGRATIONS_DIR);
  } catch (err) {
    console.error(`error: cannot read ${MIGRATIONS_DIR}: ${String(err)}`);
    return 2;
  }

  const migrations = dirents.filter((name) => {
    if (name === "migration_lock.toml") return false;
    const abs = resolve(MIGRATIONS_DIR, name);
    try {
      return statSync(abs).isDirectory();
    } catch {
      return false;
    }
  });

  console.log(`\nADR-004 migration header check — scanning ${migrations.length} migration(s)\n`);

  const violations: string[] = [];
  let enforcedCount = 0;
  let grandfatheredCount = 0;

  for (const dirname of migrations) {
    const sqlPath = resolve(MIGRATIONS_DIR, dirname, "migration.sql");
    let sql: string;
    try {
      sql = readFileSync(sqlPath, "utf8");
    } catch {
      violations.push(`${dirname}: migration.sql missing or unreadable`);
      continue;
    }

    const enforced = isSubjectToHeaderRequirement(dirname);
    if (enforced) enforcedCount += 1;
    else grandfatheredCount += 1;

    const header = parseMigrationHeader(sql);
    const dupes = findDuplicateHeaders(sql);

    if (dupes.length > 1) {
      violations.push(
        `${dirname}: ${dupes.length} MIGRATION-TYPE declarations (lines ${dupes
          .map((i) => i + 1)
          .join(", ")})`,
      );
      continue;
    }

    if (enforced) {
      if (!header.present) {
        violations.push(
          `${dirname}: missing \`-- MIGRATION-TYPE: EXPAND|BACKFILL|CONTRACT\` header`,
        );
        continue;
      }
      if (header.type === null) {
        violations.push(
          `${dirname}: invalid MIGRATION-TYPE "${header.rawValue}" (must be EXPAND, BACKFILL, or CONTRACT)`,
        );
        continue;
      }
      // Header valid — run the body safety check.
      const safety = checkMigrationSafety(sql, header.type);
      const errors = safety.filter((v) => v.severity === "ERROR");
      if (errors.length > 0) {
        for (const v of errors) {
          violations.push(formatViolation(`${dirname}/migration.sql`, v));
        }
        continue;
      }
      log("ok", `${dirname} [${header.type}]`);
      continue;
    }

    // Grandfathered — still flag malformed headers, but silence the
    // "missing" case.
    if (header.present && header.type === null) {
      violations.push(
        `${dirname}: grandfathered, but has invalid MIGRATION-TYPE "${header.rawValue}"`,
      );
    }
  }

  console.log("");
  log("info", `${enforcedCount} enforced, ${grandfatheredCount} grandfathered`);

  if (violations.length > 0) {
    console.log("");
    for (const v of violations) log("fail", v);
    console.error(`\nADR-004 policy violation: ${violations.length} migration(s) non-compliant.`);
    console.error("See src/lib/prisma-migration/header.ts for the contract.\n");
    return 1;
  }

  console.log("\nADR-004 policy: OK\n");
  return 0;
}

process.exit(main());
