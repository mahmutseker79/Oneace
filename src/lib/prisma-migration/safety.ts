// ADR-004 — Migration Snapshot & Baseline
//
// SQL-level safety checks for Prisma migrations. The `MIGRATION-TYPE`
// header says *how* a migration is meant to roll out (EXPAND / BACKFILL /
// CONTRACT); this module says *whether* the SQL body actually matches that
// claim. If a developer labels a migration `EXPAND` but the body drops a
// column, CI must fail before the migration goes near prod.
//
// The checks are intentionally conservative and string-based — not a full
// SQL parser. False positives are preferable to false negatives; a real
// destructive statement slipping through is the expensive failure mode.
// Escape hatch: a line-level `-- adr-004-safety: ignore` comment silences
// a single statement (used in the very rare case where a destructive
// change is truly safe, e.g. dropping a never-populated scratch table).
//
// Matches ADR-004 §6 rollback matrix:
//
//   EXPAND   → only additive statements (CREATE, ADD COLUMN NULLABLE,
//              CREATE INDEX, ADD CONSTRAINT with no existing violations)
//   BACKFILL → only data statements (UPDATE, INSERT, DELETE on data)
//   CONTRACT → destructive allowed (DROP, ALTER ... SET NOT NULL, RENAME)

import type { MigrationType } from "./header";

export type SafetyViolationSeverity = "ERROR" | "WARNING";

export interface SafetyViolation {
  severity: SafetyViolationSeverity;
  line: number;
  statement: string;
  rule: string;
  suggestion: string;
}

const IGNORE_MARKER = /--\s*adr-004-safety\s*:\s*ignore/i;

/**
 * Statements that mutate the schema in a way rollback cannot recover
 * without a snapshot restore. These MUST live in a CONTRACT migration.
 */
const DESTRUCTIVE_PATTERNS: Array<{
  rule: string;
  pattern: RegExp;
  suggestion: string;
}> = [
  {
    rule: "drop-table",
    pattern: /^\s*DROP\s+TABLE\b/i,
    suggestion:
      "DROP TABLE is destructive — label the migration MIGRATION-TYPE: CONTRACT and confirm the prior EXPAND + 7-day soak.",
  },
  {
    rule: "drop-column",
    pattern: /^\s*ALTER\s+TABLE\s+[^;]+?\s+DROP\s+COLUMN\b/i,
    suggestion:
      "DROP COLUMN is destructive — label the migration MIGRATION-TYPE: CONTRACT. Run the EXPAND that stops writing to the column first.",
  },
  {
    rule: "drop-index",
    pattern: /^\s*DROP\s+INDEX\b/i,
    suggestion:
      "DROP INDEX is destructive on hot tables — label MIGRATION-TYPE: CONTRACT. Use DROP INDEX CONCURRENTLY to avoid locks.",
  },
  {
    rule: "rename-column",
    pattern: /^\s*ALTER\s+TABLE\s+[^;]+?\s+RENAME\s+COLUMN\b/i,
    suggestion:
      "RENAME COLUMN breaks old app replicas mid-deploy — split into EXPAND (new column + dual-write) then CONTRACT (drop old).",
  },
  {
    rule: "rename-table",
    pattern: /^\s*ALTER\s+TABLE\s+[^;]+?\s+RENAME\s+TO\b/i,
    suggestion:
      "RENAME TABLE breaks old app replicas mid-deploy — use CREATE + dual-write + DROP pattern across three migrations.",
  },
  {
    rule: "set-not-null",
    pattern: /^\s*ALTER\s+TABLE\s+[^;]+?\s+ALTER\s+COLUMN\s+[^;]+?\s+SET\s+NOT\s+NULL\b/i,
    suggestion:
      "Flipping a column to NOT NULL on a populated table is destructive — label MIGRATION-TYPE: CONTRACT and confirm the BACKFILL migration landed >= 7 days ago.",
  },
];

/**
 * Statements that EXPAND migrations forbid. ADD COLUMN with NOT NULL and
 * no DEFAULT is the canonical multi-tenant trap — Postgres rewrites every
 * row under an exclusive lock, freezing the app for the duration.
 */
const EXPAND_VIOLATION_PATTERNS: Array<{
  rule: string;
  pattern: RegExp;
  suggestion: string;
}> = [
  {
    rule: "add-column-not-null-no-default",
    pattern: /^\s*ALTER\s+TABLE\s+[^;]+?\s+ADD\s+COLUMN\s+[^;]+?\s+NOT\s+NULL(?![^;]*\bDEFAULT\b)/i,
    suggestion:
      "ADD COLUMN ... NOT NULL without DEFAULT rewrites every row. Split into EXPAND (NULLABLE + DEFAULT) → BACKFILL → CONTRACT (SET NOT NULL).",
  },
];

/**
 * Split a SQL body into statement-like lines, preserving original line
 * numbers so violations point at the right file line. This is *not* a
 * full tokenizer — it treats each non-comment, non-blank line as a
 * candidate statement head, which is sufficient for the patterns above.
 */
interface StatementLine {
  lineNumber: number;
  text: string;
  ignored: boolean;
}

function splitLines(sql: string): StatementLine[] {
  const rawLines = sql.split(/\r?\n/);
  const out: StatementLine[] = [];
  for (let i = 0; i < rawLines.length; i += 1) {
    const raw = rawLines[i];
    if (raw === undefined) continue;
    const trimmed = raw.trim();
    if (trimmed.length === 0) continue;
    // Pure comment line — skip. An inline `-- adr-004-safety: ignore`
    // attached to a statement line is handled below.
    if (trimmed.startsWith("--") && !IGNORE_MARKER.test(trimmed)) continue;
    out.push({
      lineNumber: i + 1,
      text: trimmed,
      ignored: IGNORE_MARKER.test(trimmed),
    });
  }
  return out;
}

/**
 * Run SQL-level safety checks against `sql`, interpreting the body in the
 * context of the declared `type`. Returns an array of violations. An
 * empty array means the migration passed.
 */
export function checkMigrationSafety(sql: string, type: MigrationType | null): SafetyViolation[] {
  const violations: SafetyViolation[] = [];
  const lines = splitLines(sql);

  for (const { lineNumber, text, ignored } of lines) {
    if (ignored) continue;

    // Destructive patterns — always require CONTRACT.
    for (const { rule, pattern, suggestion } of DESTRUCTIVE_PATTERNS) {
      if (!pattern.test(text)) continue;
      if (type === "CONTRACT") continue;
      violations.push({
        severity: "ERROR",
        line: lineNumber,
        statement: text,
        rule,
        suggestion,
      });
    }

    // EXPAND-specific traps. These are still errors in any category
    // because the pattern itself is dangerous; the suggestion changes
    // based on the declared type.
    for (const { rule, pattern, suggestion } of EXPAND_VIOLATION_PATTERNS) {
      if (!pattern.test(text)) continue;
      violations.push({
        severity: "ERROR",
        line: lineNumber,
        statement: text,
        rule,
        suggestion,
      });
    }
  }

  // A BACKFILL migration that contains any DDL at all is suspicious —
  // data migrations should be UPDATE / INSERT / DELETE only.
  if (type === "BACKFILL") {
    for (const { lineNumber, text, ignored } of lines) {
      if (ignored) continue;
      if (/^\s*(CREATE|ALTER|DROP)\b/i.test(text)) {
        violations.push({
          severity: "WARNING",
          line: lineNumber,
          statement: text,
          rule: "backfill-contains-ddl",
          suggestion:
            "BACKFILL migrations should contain data statements only. If schema needs to change, split into a separate EXPAND or CONTRACT.",
        });
      }
    }
  }

  return violations;
}

/**
 * Convenience helper for tests and the CLI — formats a violation into a
 * single human-readable line with file context.
 */
export function formatViolation(filename: string, v: SafetyViolation): string {
  return `  [${v.severity}] ${filename}:${v.line} (${v.rule}) — ${v.statement}\n    ↳ ${v.suggestion}`;
}
