// P2-2 (audit v1.1 §5.24) — static-analysis pin for the
// notification retention story.
//
// Three moving parts to keep in sync, pinned here so a future
// refactor can't quietly break one of them:
//
//   1. Prisma `Notification` model — must expose `expiresAt`,
//      `dedupKey`, and the compound `Notification_dedup` unique
//      index. Without the unique, `skipDuplicates: true` on
//      `createMany` silently becomes a no-op guard.
//   2. Producer (`alerts.ts`) — must set `expiresAt` + `dedupKey`
//      on every fan-out and pass `skipDuplicates: true`.
//   3. Cleanup cron (this directory) — must be CRON_SECRET-gated,
//      must honor `?dryRun=1`, and must `deleteMany` by both
//      `expiresAt` and aged `readAt`.
//
// Static source reads + regex — no app runtime needed.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..", "..", "..", "..");
const SCHEMA = readFileSync(resolve(REPO_ROOT, "prisma", "schema.prisma"), "utf8");
const ALERTS = readFileSync(resolve(REPO_ROOT, "src", "lib", "alerts.ts"), "utf8");
const ROUTE = readFileSync(resolve(__dirname, "route.ts"), "utf8");
const VERCEL = JSON.parse(readFileSync(resolve(REPO_ROOT, "vercel.json"), "utf8")) as {
  crons?: Array<{ path: string; schedule: string }>;
};

function sliceModel(name: string): string {
  const marker = `model ${name} {`;
  const start = SCHEMA.indexOf(marker);
  expect(start, `model ${name} must exist in schema.prisma`).toBeGreaterThan(-1);
  // Nested braces are not expected inside a Prisma model body, so a
  // simple next-'}' lookup is enough. We start the search AFTER the
  // opening '{' so we find the model's own closing brace, not the
  // opening one.
  const bodyStart = start + marker.length;
  const end = SCHEMA.indexOf("\n}", bodyStart);
  expect(end, `model ${name} must have a closing brace`).toBeGreaterThan(bodyStart);
  return SCHEMA.slice(start, end + 2);
}

const NOTIFICATION_MODEL = sliceModel("Notification");

describe("P2-2 §5.24 — Notification model retention + dedup shape", () => {
  it("declares `expiresAt DateTime?` (nullable TTL for cron to prune)", () => {
    expect(NOTIFICATION_MODEL).toMatch(/expiresAt\s+DateTime\?/);
  });

  it("declares `dedupKey String?` (nullable, opt-in dedup per producer)", () => {
    expect(NOTIFICATION_MODEL).toMatch(/dedupKey\s+String\?/);
  });

  it("has compound unique index `Notification_dedup` on (org, user, dedupKey)", () => {
    // The exact shape that makes createMany({skipDuplicates:true})
    // collapse same-day fan-outs. If this drifts (wrong fields,
    // missing name), the dedup silently stops working.
    expect(NOTIFICATION_MODEL).toMatch(
      /@@unique\(\s*\[\s*organizationId\s*,\s*userId\s*,\s*dedupKey\s*\]\s*,\s*name:\s*"Notification_dedup"\s*\)/,
    );
  });

  it("has an index on `expiresAt` so cleanup's range scan is cheap", () => {
    expect(NOTIFICATION_MODEL).toMatch(/@@index\(\s*\[\s*expiresAt\s*\]\s*\)/);
  });
});

describe("P2-2 §5.24 — alerts.ts producer pins expiresAt + dedupKey", () => {
  it("imports node:crypto (used by notificationDedupKey)", () => {
    expect(ALERTS).toMatch(/from\s+["']node:crypto["']/);
  });

  it("declares NOTIFICATION_TTL_DAYS with a sane value (30-365)", () => {
    const m = ALERTS.match(/NOTIFICATION_TTL_DAYS\s*=\s*(\d+)/);
    expect(m, "NOTIFICATION_TTL_DAYS constant must be declared").not.toBeNull();
    const days = Number(m?.[1] ?? 0);
    expect(days).toBeGreaterThanOrEqual(30);
    expect(days).toBeLessThanOrEqual(365);
  });

  it("computes a UTC day-bucketed dedupKey (hash of source + user + day)", () => {
    // Matching the day-bucket shape is what keeps the dedup window
    // at 1 day. If someone swaps `.slice(0, 10)` for `.slice(0, 7)`
    // (month!) or removes the slice, the window explodes.
    expect(ALERTS).toMatch(/toISOString\(\)\.slice\(0,\s*10\)/);
    // The hash recipe is asserted piecewise — single-line regexes
    // don't handle method chains across lines well, so we split.
    expect(ALERTS).toMatch(/createHash\(\s*["']sha256["']\s*\)/);
    expect(ALERTS).toMatch(/\$\{source\}:\$\{userId\}:\$\{day\}/);
    expect(ALERTS).toMatch(/\.digest\(\s*["']hex["']\s*\)/);
  });

  it("passes dedupKey + expiresAt + skipDuplicates to createMany", () => {
    // All three must land together or the retention+dedup story
    // breaks silently:
    //   - no dedupKey → every fan-out is a new row (storm).
    //   - no expiresAt → cleanup cron can't prune (growth).
    //   - no skipDuplicates → the unique index throws P2002 and
    //     the whole createMany fails even on legit duplicates.
    expect(ALERTS).toMatch(/db\.notification\.createMany\(/);
    expect(ALERTS).toMatch(/dedupKey:\s*notificationDedupKey\(/);
    expect(ALERTS).toMatch(/expiresAt,/);
    expect(ALERTS).toMatch(/skipDuplicates:\s*true/);
  });
});

describe("P2-2 §5.24 — cleanup-notifications route", () => {
  it("enforces CRON_SECRET via Bearer header", () => {
    expect(ROUTE).toMatch(/request\.headers[\s\S]*?Authorization[\s\S]*?Bearer\s/);
    expect(ROUTE).toMatch(/process\.env\.CRON_SECRET/);
    expect(ROUTE).toMatch(/status:\s*401/);
  });

  it("supports a dryRun branch that only counts (no deletes)", () => {
    // The dryRun branch is the operational safety net — always test
    // retention changes in dry run first.
    expect(ROUTE).toMatch(/dryRun\s*=\s*request\.nextUrl\.searchParams\.get/);
    expect(ROUTE).toMatch(/db\.notification\.count\(/);
  });

  it("deletes rows whose `expiresAt` has passed", () => {
    // The filter is extracted to a `const expiredFilter = ...` so
    // Prisma's type inference behaves, so we pin the filter shape
    // and then the deleteMany reference to it, rather than insisting
    // they live inline.
    expect(ROUTE).toMatch(
      /expiredFilter\s*=\s*\{\s*expiresAt:\s*\{\s*lt:\s*now[\s\S]*?not:\s*null/,
    );
    expect(ROUTE).toMatch(/db\.notification\.deleteMany\(\s*\{\s*where:\s*expiredFilter\b/);
  });

  it("also ages out read notifications past the retention horizon", () => {
    // Belt-and-suspenders pass so legacy rows (producers that
    // forgot to set expiresAt) still get pruned once the user
    // clears them.
    expect(ROUTE).toMatch(/READ_RETENTION_DAYS/);
    expect(ROUTE).toMatch(/readAt:\s*\{\s*lt:\s*readCutoff[\s\S]*?not:\s*null/);
  });

  it("caps delete loops so a runaway producer can't spin forever", () => {
    // The `for (let pass = 0; pass < N; pass++)` bound is the
    // circuit breaker. If it disappears, a producer inserting
    // pre-expired rows during the cron run could lock the worker.
    expect(ROUTE).toMatch(/for\s*\(\s*let\s+pass\s*=\s*0;\s*pass\s*<\s*\d+/);
  });

  it("declares maxDuration = 60 to match Vercel Hobby cron budget", () => {
    expect(ROUTE).toMatch(/export\s+const\s+maxDuration\s*=\s*60/);
  });
});

describe("P2-2 §5.24 — vercel.json registers the cleanup cron", () => {
  it("has a cron entry for /api/cron/cleanup-notifications", () => {
    const paths = (VERCEL.crons ?? []).map((c) => c.path);
    expect(paths).toContain("/api/cron/cleanup-notifications");
  });

  it("runs the cleanup cron daily (valid cron expression)", () => {
    const entry = (VERCEL.crons ?? []).find((c) => c.path === "/api/cron/cleanup-notifications");
    expect(entry, "cleanup-notifications cron entry must exist").toBeDefined();
    // 5 cron fields, day and month as '*', hour+minute numeric,
    // weekday '*'. That's the daily shape.
    expect(entry?.schedule).toMatch(/^\d+\s+\d+\s+\*\s+\*\s+\*$/);
  });
});
