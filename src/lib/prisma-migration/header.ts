// ADR-004 — Migration Snapshot & Baseline
//
// `MIGRATION-TYPE` header parser. Every new Prisma migration authored after
// 2026-04-18 (the baseline cutoff for ADR-004) must declare its migration
// type in the first 20 non-blank lines of `migration.sql`, in a SQL comment
// of the form:
//
//   -- MIGRATION-TYPE: EXPAND
//   -- MIGRATION-TYPE: BACKFILL
//   -- MIGRATION-TYPE: CONTRACT
//
// The three values match the Expand–Contract rollout pattern:
//   EXPAND    → additive (new column / table / index), no destructive change
//   BACKFILL  → data-only (idempotent UPDATE batch), no schema change
//   CONTRACT  → destructive (NOT NULL flip, DROP COLUMN/TABLE, rename)
//
// `CONTRACT` migrations are point-of-no-return: rollback requires a snapshot
// restore. They must sit >= 7 days behind a matching `EXPAND` in prod and
// require manual approval on the Vercel deploy gate.
//
// This module is deliberately pure / dependency-free so the static pinned
// tests under `src/lib/prisma-migration/*.test.ts` can read and validate
// migrations without booting Prisma or Postgres. The CLI tool at
// `scripts/check-migration-header.ts` is a thin wrapper on top.

export type MigrationType = "EXPAND" | "BACKFILL" | "CONTRACT";

export const MIGRATION_TYPES: readonly MigrationType[] = ["EXPAND", "BACKFILL", "CONTRACT"];

/**
 * Migrations authored on or after this date (UTC) must carry a valid
 * `MIGRATION-TYPE` header. Earlier migrations are grandfathered by the
 * static pinned test so we do not need to retrofit historic headers.
 *
 * Prisma migration directory names start with `YYYYMMDDHHMMSS_…`. The
 * cutoff is inclusive, so a migration whose directory name sorts >=
 * `${BASELINE_CUTOFF_DATE}000000` is subject to the header requirement.
 */
export const BASELINE_CUTOFF_DATE = "20260419";

/** Parse a migration directory name of the form `YYYYMMDDHHMMSS_slug`. */
export function extractMigrationDate(dirname: string): string | null {
  const match = /^(\d{8})(\d{0,6})?_/.exec(dirname);
  return match?.[1] ?? null;
}

/** True when a migration directory is subject to ADR-004 header enforcement. */
export function isSubjectToHeaderRequirement(dirname: string): boolean {
  const date = extractMigrationDate(dirname);
  if (!date) return false;
  return date >= BASELINE_CUTOFF_DATE;
}

export interface HeaderParseResult {
  /** The declared type, if a valid header line was found. */
  type: MigrationType | null;
  /**
   * True when *some* `MIGRATION-TYPE` comment was present — even if the
   * value was unknown. Used to distinguish "missing" from "malformed".
   */
  present: boolean;
  /**
   * When `present` is true but `type` is null, the raw value that was
   * after the colon so the caller can produce a useful error message.
   */
  rawValue: string | null;
}

/**
 * Scan the first 20 non-blank lines of a migration.sql body for a
 * `-- MIGRATION-TYPE: <value>` comment. Returns the parsed result.
 *
 * Matching is case-insensitive on the header label so `migration-type`
 * and `Migration-Type` both work; the *value* is upper-cased before
 * comparison against `MIGRATION_TYPES`.
 *
 * Only the *first* matching line counts — duplicates beyond that are
 * silently ignored here and flagged by `findDuplicateHeaders` separately.
 */
export function parseMigrationHeader(sql: string): HeaderParseResult {
  const lines = sql.split(/\r?\n/);
  let scanned = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.length === 0) continue;
    scanned += 1;
    if (scanned > 20) break;
    const match = /^--\s*MIGRATION-TYPE\s*:\s*(.+?)\s*$/i.exec(line);
    if (!match) continue;
    // Regex capture group `(.+?)` with `$` anchor is required on a
    // successful match, but `noUncheckedIndexedAccess` still widens
    // the tuple slot to `string | undefined`. Guard explicitly so
    // callers see a clean `rawValue: string` on every present-branch.
    const rawValue = match[1];
    if (rawValue === undefined) continue;
    const normalized = rawValue.toUpperCase() as MigrationType;
    if ((MIGRATION_TYPES as readonly string[]).includes(normalized)) {
      return { type: normalized, present: true, rawValue };
    }
    return { type: null, present: true, rawValue };
  }
  return { type: null, present: false, rawValue: null };
}

/**
 * Return the line indexes of every `-- MIGRATION-TYPE: ...` comment in the
 * file. Used by the static pinned test to flag files that declare the
 * header more than once (which is ambiguous even if both values agree).
 */
export function findDuplicateHeaders(sql: string): number[] {
  const lines = sql.split(/\r?\n/);
  const matches: number[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line === undefined) continue;
    if (/^\s*--\s*MIGRATION-TYPE\s*:/i.test(line)) {
      matches.push(i);
    }
  }
  return matches;
}
