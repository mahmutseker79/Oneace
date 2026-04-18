// v1.2 P3 §5.44 — CronRun ledger retention pin.
//
// Three moving parts to keep in sync:
//
//   1. Prisma `CronRun` model — must expose `startedAt` with an index
//      so the retention deleteMany is cheap (without the index, each
//      cleanup pass would full-scan the table as it grows).
//   2. Route handler — must be CRON_SECRET-gated, must honor
//      `?dryRun=1`, must filter on `startedAt < cutoff` (NOT
//      `completedAt`, so failed-but-never-retried rows still prune),
//      and must cap the deleteMany loop.
//   3. vercel.json — must register the cron entry at 04:00 UTC so
//      it runs after the other three crons have finished writing.
//
// Static source reads + regex — no Prisma client, no HTTP, no timers.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..", "..", "..", "..");
const SCHEMA = readFileSync(resolve(REPO_ROOT, "prisma", "schema.prisma"), "utf8");
const ROUTE = readFileSync(resolve(__dirname, "route.ts"), "utf8");
const VERCEL = JSON.parse(readFileSync(resolve(REPO_ROOT, "vercel.json"), "utf8")) as {
  crons?: Array<{ path: string; schedule: string }>;
};
const OPENAPI = readFileSync(resolve(REPO_ROOT, "docs", "openapi.yaml"), "utf8");

function sliceModel(name: string): string {
  const marker = `model ${name} {`;
  const start = SCHEMA.indexOf(marker);
  expect(start, `model ${name} must exist in schema.prisma`).toBeGreaterThan(-1);
  const bodyStart = start + marker.length;
  const end = SCHEMA.indexOf("\n}", bodyStart);
  expect(end, `model ${name} must have a closing brace`).toBeGreaterThan(bodyStart);
  return SCHEMA.slice(start, end + 2);
}

const CRONRUN_MODEL = sliceModel("CronRun");

// ──────────────────────────────────────────────────────────────────
// 1. Prisma model — index on startedAt
// ──────────────────────────────────────────────────────────────────

describe("§5.44 — CronRun model supports retention scans", () => {
  it("declares `startedAt DateTime` with a default of now()", () => {
    // The retention filter is `startedAt < cutoff`, so the column
    // must exist and default to the write time — otherwise new rows
    // could land with a null startedAt and silently never prune.
    expect(CRONRUN_MODEL).toMatch(/startedAt\s+DateTime\s+@default\(now\(\)\)/);
  });

  it("has an index on `startedAt` so the retention deleteMany is cheap", () => {
    // Without this, each cleanup pass full-scans CronRun. Fine while
    // the table is small; painful once ops accidentally double a
    // cron's frequency and we need to prune fast.
    expect(CRONRUN_MODEL).toMatch(/@@index\(\s*\[\s*startedAt\s*\]\s*\)/);
  });
});

// ──────────────────────────────────────────────────────────────────
// 2. Route handler — auth, dryRun, filter shape, loop cap
// ──────────────────────────────────────────────────────────────────

describe("§5.44 — cleanup-cronruns route", () => {
  it("carries the @openapi-tag so openapi-parity covers the path", () => {
    // Audit §5.32 — every route.ts under src/app/api MUST declare
    // an @openapi-tag that matches a path in docs/openapi.yaml.
    expect(ROUTE).toMatch(/@openapi-tag:\s*\/cron\/cleanup-cronruns/);
  });

  it("enforces CRON_SECRET via Bearer header", () => {
    expect(ROUTE).toMatch(/request\.headers[\s\S]*?Authorization[\s\S]*?Bearer\s/);
    expect(ROUTE).toMatch(/process\.env\.CRON_SECRET/);
    expect(ROUTE).toMatch(/status:\s*401/);
  });

  it("supports a dryRun branch that only counts (no deletes)", () => {
    // The dryRun branch is the operational safety net — always test
    // retention changes in dry run first.
    expect(ROUTE).toMatch(/dryRun\s*=\s*request\.nextUrl\.searchParams\.get/);
    expect(ROUTE).toMatch(/db\.cronRun\.count\(/);
  });

  it("deletes rows whose `startedAt` is past the retention horizon", () => {
    // The filter is extracted to `const agedFilter = ...` and
    // referenced by deleteMany — pin both halves so a drive-by that
    // inlines the filter but changes the field (e.g. to completedAt)
    // still fails this pin.
    expect(ROUTE).toMatch(/agedFilter\s*=\s*\{\s*startedAt:\s*\{\s*lt:\s*cutoff/);
    expect(ROUTE).toMatch(/db\.cronRun\.deleteMany\(\s*\{\s*where:\s*agedFilter\b/);
  });

  it("does NOT filter on `completedAt` (would skip failed-but-aged rows)", () => {
    // Failed runs leave completedAt null. Filtering on completedAt
    // would leak them past the retention horizon forever — so make
    // sure the delete filter never touches that column.
    expect(ROUTE).not.toMatch(/completedAt:\s*\{\s*lt:/);
  });

  it("declares a retention horizon between 30 and 365 days", () => {
    const m = ROUTE.match(/CRONRUN_RETENTION_DAYS\s*=\s*(\d+)/);
    expect(m, "CRONRUN_RETENTION_DAYS constant must be declared").not.toBeNull();
    const days = Number(m?.[1] ?? 0);
    // Lower bound: a quarter keeps a useful forensic window.
    // Upper bound: anything longer defeats the point of pruning.
    expect(days).toBeGreaterThanOrEqual(30);
    expect(days).toBeLessThanOrEqual(365);
  });

  it("caps delete loops so a runaway fast-ticking cron can't spin forever", () => {
    // If ops accidentally drops a `* * * * *` schedule, the cleanup
    // could keep finding fresh rows to prune. The MAX_PASSES cap
    // bounds the run's worst-case duration.
    expect(ROUTE).toMatch(/MAX_PASSES\s*=\s*\d+/);
    expect(ROUTE).toMatch(/for\s*\(\s*let\s+pass\s*=\s*0;\s*pass\s*<\s*MAX_PASSES/);
  });

  it("wraps real deletes in withCronIdempotency (retry-safe)", () => {
    // Vercel Cron is at-least-once. Without the wrapper a 5xx retry
    // would re-enter the deleteMany loop. The dryRun branch
    // deliberately bypasses the helper so read-only dry runs don't
    // consume today's idempotency slot.
    expect(ROUTE).toMatch(/from\s*["']@\/lib\/cron\/with-idempotency["']/);
    expect(ROUTE).toMatch(/withCronIdempotency\(\s*["']cleanup-cronruns["']/);
  });

  it("declares maxDuration = 60 to match Vercel Hobby cron budget", () => {
    expect(ROUTE).toMatch(/export\s+const\s+maxDuration\s*=\s*60/);
  });
});

// ──────────────────────────────────────────────────────────────────
// 3. vercel.json — daily schedule
// ──────────────────────────────────────────────────────────────────

describe("§5.44 — vercel.json registers the cleanup-cronruns cron", () => {
  it("has a cron entry for /api/cron/cleanup-cronruns", () => {
    const paths = (VERCEL.crons ?? []).map((c) => c.path);
    expect(paths).toContain("/api/cron/cleanup-cronruns");
  });

  it("runs the cleanup cron daily (valid daily cron expression)", () => {
    const entry = (VERCEL.crons ?? []).find((c) => c.path === "/api/cron/cleanup-cronruns");
    expect(entry, "cleanup-cronruns cron entry must exist").toBeDefined();
    expect(entry?.schedule).toMatch(/^\d+\s+\d+\s+\*\s+\*\s+\*$/);
  });

  it("runs AFTER the other cleanup crons (so it prunes yesterday's rows)", () => {
    // The three pre-existing cleanups run at 00:00, 03:00, 03:15.
    // This one must run strictly later than the latest of those so
    // it prunes what they wrote, not what they're about to write.
    const entry = (VERCEL.crons ?? []).find((c) => c.path === "/api/cron/cleanup-cronruns");
    expect(entry, "cleanup-cronruns cron entry must exist").toBeDefined();
    const [minute, hour] = (entry?.schedule ?? "").split(/\s+/).map((s) => Number(s));
    // 03:15 is the latest pre-existing cleanup — require ≥ 03:30
    // equivalent, i.e. (hour*60 + minute) ≥ 210.
    const minuteOfDay = hour * 60 + minute;
    expect(
      minuteOfDay,
      `schedule ${entry?.schedule} must run after 03:30 UTC`,
    ).toBeGreaterThanOrEqual(210);
  });
});

// ──────────────────────────────────────────────────────────────────
// 4. OpenAPI parity (keeps §5.32 happy for the new path)
// ──────────────────────────────────────────────────────────────────

describe("§5.44 — docs/openapi.yaml declares /cron/cleanup-cronruns", () => {
  it("has a path entry for /cron/cleanup-cronruns", () => {
    expect(OPENAPI).toMatch(/\/cron\/cleanup-cronruns:/);
  });

  it("declares GET with bearerToken security", () => {
    // Pin the auth requirement on the doc side so a drift where the
    // handler enforces CRON_SECRET but the spec drops the bearer
    // definition gets caught here.
    const idx = OPENAPI.indexOf("/cron/cleanup-cronruns:");
    expect(idx).toBeGreaterThan(-1);
    // Look at the next ~40 lines of the path block for the shape
    // we expect. Slicing a fixed window keeps this regex robust to
    // unrelated edits elsewhere in the YAML.
    const block = OPENAPI.slice(idx, idx + 2000);
    expect(block).toMatch(/get:/);
    expect(block).toMatch(/bearerToken:\s*\[\]/);
  });
});
