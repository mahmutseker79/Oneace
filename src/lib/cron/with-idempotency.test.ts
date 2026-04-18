// P2-5 (audit v1.1 §5.27) — cron idempotency pins.
//
// Four moving parts must stay in sync:
//
//   1. Prisma `CronRun` model — runId pk, nullable completedAt, indexed
//      by name + startedAt. Without this, the helper crashes at runtime.
//   2. `with-idempotency.ts` helper — build a UTC-day runId, upsert,
//      skip if completedAt already set, stamp error + rethrow on crash.
//   3. Each daily cron route — imports the helper, wraps the job body.
//      If a route forgets the wrap, a Vercel retry re-fires the job.
//   4. Migration SQL — mirrors the Prisma model 1:1 (DDL for prod DB).
//
// Static source reads + small unit test for the internals (pure logic).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

// ─── Static source reads ──────────────────────────────────────────────

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const SCHEMA = readFileSync(resolve(REPO_ROOT, "prisma", "schema.prisma"), "utf8");
const HELPER = readFileSync(resolve(__dirname, "with-idempotency.ts"), "utf8");
const MIGRATION = readFileSync(
  resolve(REPO_ROOT, "prisma", "migrations", "20260418100000_cron_idempotency", "migration.sql"),
  "utf8",
);

const STOCK_COUNT_ROUTE = readFileSync(
  resolve(REPO_ROOT, "src", "app", "api", "cron", "stock-count-triggers", "route.ts"),
  "utf8",
);
const CLEANUP_MIGRATION_ROUTE = readFileSync(
  resolve(REPO_ROOT, "src", "app", "api", "cron", "cleanup-migration-files", "route.ts"),
  "utf8",
);
const CLEANUP_NOTIFICATIONS_ROUTE = readFileSync(
  resolve(REPO_ROOT, "src", "app", "api", "cron", "cleanup-notifications", "route.ts"),
  "utf8",
);

function sliceModel(name: string): string {
  const marker = `model ${name} {`;
  const start = SCHEMA.indexOf(marker);
  expect(start, `model ${name} must exist in schema.prisma`).toBeGreaterThan(-1);
  const bodyStart = start + marker.length;
  const end = SCHEMA.indexOf("\n}", bodyStart);
  return SCHEMA.slice(start, end + 2);
}

const CRON_RUN_MODEL = sliceModel("CronRun");

// ─── Prisma model shape ───────────────────────────────────────────────

describe("P2-5 §5.27 — CronRun Prisma model", () => {
  it("has `runId` as the primary key (String @id)", () => {
    // runId *is* the semantic dedup key; if this drifted to a generated
    // id column the upsert would need a compound unique instead, and
    // the helper's upsert-where would need to change in lockstep.
    expect(CRON_RUN_MODEL).toMatch(/runId\s+String\s+@id/);
  });

  it("has `name` (for querying all runs of a cron)", () => {
    expect(CRON_RUN_MODEL).toMatch(/\bname\s+String\b/);
  });

  it("has `startedAt DateTime @default(now())`", () => {
    expect(CRON_RUN_MODEL).toMatch(/startedAt\s+DateTime\s+@default\(now\(\)\)/);
  });

  it("has a nullable `completedAt DateTime?` — null means 'still running or crashed'", () => {
    // The helper relies on completedAt != null to short-circuit. If
    // this becomes non-null with a default, every run would appear
    // already-completed on create and the cron would never fire.
    expect(CRON_RUN_MODEL).toMatch(/completedAt\s+DateTime\?/);
  });

  it("has nullable `error String?` and `result Json?` for observability", () => {
    expect(CRON_RUN_MODEL).toMatch(/error\s+String\?/);
    expect(CRON_RUN_MODEL).toMatch(/result\s+Json\?/);
  });

  it("has indexes on `name` and `startedAt` so dashboards are cheap", () => {
    expect(CRON_RUN_MODEL).toMatch(/@@index\(\s*\[\s*name\s*\]\s*\)/);
    expect(CRON_RUN_MODEL).toMatch(/@@index\(\s*\[\s*startedAt\s*\]\s*\)/);
  });
});

// ─── Helper source invariants ─────────────────────────────────────────

describe("P2-5 §5.27 — with-idempotency helper source shape", () => {
  it("exports `withCronIdempotency`", () => {
    expect(HELPER).toMatch(/export\s+async\s+function\s+withCronIdempotency\b/);
  });

  it("builds runId as `cron:<name>:<UTC-day>`", () => {
    // Must slice(0, 10) the ISO string for the day bucket — anything
    // else (e.g. .slice(0, 7) for month, or .slice(0, 13) for hour)
    // would either widen or narrow the dedup window disastrously.
    expect(HELPER).toMatch(/cron:\$\{name\}:\$\{/);
    expect(HELPER).toMatch(/toISOString\(\)\.slice\(0,\s*10\)/);
  });

  it("upserts into `db.cronRun` (this is the ledger insert)", () => {
    expect(HELPER).toMatch(/db\.cronRun\.upsert\(/);
  });

  it("short-circuits when `completedAt` is set (skipped: true)", () => {
    expect(HELPER).toMatch(/if\s*\(\s*row\.completedAt\s*\)/);
    expect(HELPER).toMatch(/skipped:\s*true/);
  });

  it("stamps `completedAt` on success", () => {
    expect(HELPER).toMatch(/db\.cronRun\.update[\s\S]*?completedAt:\s*new Date\(\)/);
  });

  it("stamps `error` and rethrows on failure (so retries can recover)", () => {
    // Leaving completedAt null on failure is what lets tomorrow's
    // Vercel retry re-enter the job body. If we stamped completedAt
    // here, the next tick would skip and the job would stay broken.
    expect(HELPER).toMatch(/error:\s*truncateError\(/);
    expect(HELPER).toMatch(/\bthrow\s+err\b/);
  });
});

// ─── Migration SQL mirrors the Prisma model ───────────────────────────

describe("P2-5 §5.27 — CronRun migration SQL matches Prisma", () => {
  it("creates the CronRun table with IF NOT EXISTS (idempotent reapply)", () => {
    expect(MIGRATION).toMatch(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+"CronRun"/i);
  });

  it("has the same columns as the Prisma model", () => {
    // Mismatch here means `prisma db push` would report drift.
    expect(MIGRATION).toMatch(/"runId"\s+TEXT\s+NOT\s+NULL/i);
    expect(MIGRATION).toMatch(/"name"\s+TEXT\s+NOT\s+NULL/i);
    expect(MIGRATION).toMatch(/"startedAt"\s+TIMESTAMP/i);
    expect(MIGRATION).toMatch(/"completedAt"\s+TIMESTAMP\b(?!.*NOT NULL)/i);
    expect(MIGRATION).toMatch(/"error"\s+TEXT\b(?!.*NOT NULL)/i);
    expect(MIGRATION).toMatch(/"result"\s+JSONB\b(?!.*NOT NULL)/i);
  });

  it("has the two indexes declared on the model", () => {
    expect(MIGRATION).toMatch(/"CronRun_name_idx"\s+ON\s+"CronRun"\("name"\)/i);
    expect(MIGRATION).toMatch(/"CronRun_startedAt_idx"\s+ON\s+"CronRun"\("startedAt"\)/i);
  });
});

// ─── Each daily cron route wires the helper ───────────────────────────

describe("P2-5 §5.27 — all daily cron routes import the helper", () => {
  it("stock-count-triggers wraps the job body", () => {
    expect(STOCK_COUNT_ROUTE).toMatch(/from\s+["']@\/lib\/cron\/with-idempotency["']/);
    expect(STOCK_COUNT_ROUTE).toMatch(/withCronIdempotency\(\s*["']stock-count-triggers["']/);
  });

  it("cleanup-migration-files wraps the real-delete body (not dryRun)", () => {
    expect(CLEANUP_MIGRATION_ROUTE).toMatch(/from\s+["']@\/lib\/cron\/with-idempotency["']/);
    expect(CLEANUP_MIGRATION_ROUTE).toMatch(
      /withCronIdempotency\(\s*\n?\s*["']cleanup-migration-files["']/,
    );
  });

  it("cleanup-notifications wraps the real-delete body (not dryRun)", () => {
    expect(CLEANUP_NOTIFICATIONS_ROUTE).toMatch(/from\s+["']@\/lib\/cron\/with-idempotency["']/);
    expect(CLEANUP_NOTIFICATIONS_ROUTE).toMatch(
      /withCronIdempotency\(\s*\n?\s*["']cleanup-notifications["']/,
    );
  });
});

// ─── Pure-function unit tests on the internals ────────────────────────

vi.mock("@/lib/db", () => ({
  db: {
    cronRun: {
      upsert: vi.fn(),
      update: vi.fn(),
    },
  },
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe("P2-5 §5.27 — internals (pure functions)", () => {
  it("builds the runId with a stable UTC-day bucket", async () => {
    const mod = await import("./with-idempotency");
    const { buildRunId, utcDayBucket } = mod.__internals;

    const at = new Date("2026-04-18T23:59:59.999Z");
    expect(utcDayBucket(at)).toBe("2026-04-18");
    expect(buildRunId("stock-count-triggers", at)).toBe("cron:stock-count-triggers:2026-04-18");
  });

  it("day bucket does not depend on local TZ (uses UTC)", async () => {
    const mod = await import("./with-idempotency");
    // 01:00 Istanbul on the 19th is 22:00 UTC on the 18th. The bucket
    // must follow Vercel Cron's UTC clock, not the operator's wall.
    const at = new Date("2026-04-18T22:00:00.000Z");
    expect(mod.__internals.utcDayBucket(at)).toBe("2026-04-18");
  });

  it("truncates long error messages so the `error` column stays sane", async () => {
    const mod = await import("./with-idempotency");
    const long = new Error("x".repeat(5000));
    const out = mod.__internals.truncateError(long);
    expect(out.length).toBeLessThanOrEqual(2100); // 2000 + truncation marker
    expect(out).toContain("[truncated]");
  });

  it("leaves short errors unchanged", async () => {
    const mod = await import("./with-idempotency");
    const out = mod.__internals.truncateError(new Error("short"));
    expect(out).toContain("short");
    expect(out).not.toContain("[truncated]");
  });
});
