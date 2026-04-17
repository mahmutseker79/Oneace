/**
 * Phase MIG-S1 — MigrationScopeOptions: per-job user choices.
 *
 * The migration wizard's "Göç Kapsamı" step asks the user a few questions
 * about what they want to bring over from the source system. Those answers
 * are persisted as a JSON blob on MigrationJob.scopeOptions so that:
 *
 *   1. A paused / failed import can be resumed with identical intent.
 *   2. Audit and rollback can explain what was *supposed* to come in.
 *   3. The UI can round-trip: load → edit → save → re-validate.
 *
 * Why JSON instead of an enum per flag? Future sprints will add more
 * scope toggles (salesOrderHistory, serialNumberHistory, kitHistory).
 * Each new toggle as a new enum variant would mean a schema migration;
 * inside JSON we just bump the Zod schema.
 *
 * Validation happens at every boundary (server action input, API route
 * body, job deserialization) — never trust what's in the DB without
 * parsing it through {@link parseScopeOptions}.
 */
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────────────────────

/**
 * How far back in time the PO (purchase order) history should reach.
 *
 *   ALL              — bring every PO the source system has.
 *   LAST_12_MONTHS   — only POs with orderDate within the last 12 months
 *                      (default; balances signal vs. volume).
 *   OPEN_ONLY        — only POs whose status is not a closed state
 *                      (RECEIVED, CLOSED, CANCELLED).
 *   SKIP             — don't touch POs at all.
 */
export const PO_HISTORY_SCOPES = [
  "ALL",
  "LAST_12_MONTHS",
  "OPEN_ONLY",
  "SKIP",
] as const;
export type PoHistoryScope = (typeof PO_HISTORY_SCOPES)[number];

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonical shape. The zod schema is the source of truth — types
 * derive from it to prevent drift.
 */
export const MigrationScopeOptionsSchema = z
  .object({
    poHistory: z.enum(PO_HISTORY_SCOPES).default("LAST_12_MONTHS"),
    includeCustomFields: z.boolean().default(true),
    includeAttachments: z.boolean().default(true),
    includeArchivedItems: z.boolean().default(false),
    /**
     * ISO 8601 string. When `poHistory` is "LAST_12_MONTHS" this is
     * filled in by the server at job start so the client and server
     * agree on the cutoff instant. Clients pass `undefined`; the
     * server stamps it.
     */
    dateRangeStart: z
      .string()
      .datetime({ offset: true })
      .optional(),
  })
  .strict();

export type MigrationScopeOptions = z.infer<typeof MigrationScopeOptionsSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Factories & helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Default options for a brand-new migration. Chosen to match what the
 * wizard preselects for a first-time user.
 */
export function defaultScopeOptions(): MigrationScopeOptions {
  return MigrationScopeOptionsSchema.parse({});
}

/**
 * Parse a value that came out of Postgres JSONB. Returns `null` (not
 * throws) for invalid shapes so callers can fall back to defaults
 * without crashing an in-flight job.
 */
export function tryParseScopeOptions(
  raw: unknown,
): MigrationScopeOptions | null {
  const result = MigrationScopeOptionsSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/**
 * Strict version — throws on malformed input. Use at trust boundaries
 * (HTTP body, server action param) where invalid input is a bug.
 */
export function parseScopeOptions(raw: unknown): MigrationScopeOptions {
  return MigrationScopeOptionsSchema.parse(raw);
}

/**
 * Convert the user-facing `poHistory` choice into a concrete ISO
 * cutoff timestamp, stamped at job-start time. Returns `null` for
 * scopes that don't imply a date filter (ALL, OPEN_ONLY, SKIP).
 *
 *   ALL              → null (no cutoff)
 *   OPEN_ONLY        → null (caller filters by status instead)
 *   SKIP             → null (caller skips PO import entirely)
 *   LAST_12_MONTHS   → now - 365 days
 */
export function resolvePoHistoryCutoff(
  scope: PoHistoryScope,
  now: Date = new Date(),
): Date | null {
  if (scope === "LAST_12_MONTHS") {
    const cutoff = new Date(now);
    cutoff.setUTCDate(cutoff.getUTCDate() - 365);
    return cutoff;
  }
  return null;
}

/**
 * Should the importer touch purchase orders at all under these options?
 * Convenience helper the orchestrator uses to short-circuit the PO
 * phase without re-reading the scope blob.
 */
export function shouldImportPurchaseOrders(
  opts: MigrationScopeOptions,
): boolean {
  return opts.poHistory !== "SKIP";
}
