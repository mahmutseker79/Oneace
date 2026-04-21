// v1.3 P1 §5.45 F-01 — webhook-health cron pin.
//
// Three moving parts to keep in sync:
//
//   1. Route handler — must be CRON_SECRET-gated, must read GitHub
//      main HEAD + prod /api/health commit, must emit the
//      `webhook-health.silent` tag on SHA mismatch + age past the
//      stale threshold, must have a distinct `webhook-health.prod-down`
//      tag for 5xx on health, must gracefully degrade when env is
//      missing, and must NOT use withCronIdempotency (would limit to
//      1 run/day — wrong cadence for a 30-min watchdog).
//   2. vercel.json — must register the cron at a sub-hour cadence
//      (every 30 min; higher frequency would burn cron budget, lower
//      frequency defeats the MTTD point of the cron).
//   3. docs/openapi.yaml — must declare /cron/vercel-webhook-health
//      with bearerToken security, matching the sibling crons.
//
// Static source reads + regex — no Prisma client, no HTTP, no timers.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..", "..", "..", "..");
const ROUTE = readFileSync(resolve(__dirname, "route.ts"), "utf8");
const VERCEL = JSON.parse(readFileSync(resolve(REPO_ROOT, "vercel.json"), "utf8")) as {
  crons?: Array<{ path: string; schedule: string }>;
};
const OPENAPI = readFileSync(resolve(REPO_ROOT, "docs", "openapi.yaml"), "utf8");

// ──────────────────────────────────────────────────────────────────
// 1. Route handler — auth, graceful degrade, alarm tags
// ──────────────────────────────────────────────────────────────────

describe("§5.45 F-01 — vercel-webhook-health route shape", () => {
  it("carries the @openapi-tag so openapi-parity covers the path", () => {
    expect(ROUTE).toMatch(/@openapi-tag:\s*\/cron\/vercel-webhook-health/);
  });

  it("enforces CRON_SECRET via Bearer header", () => {
    expect(ROUTE).toMatch(/request\.headers[\s\S]*?Authorization[\s\S]*?Bearer\s/);
    expect(ROUTE).toMatch(/process\.env\.CRON_SECRET/);
    expect(ROUTE).toMatch(/status:\s*401/);
  });

  it("declares maxDuration = 60 to match Vercel Hobby cron budget", () => {
    expect(ROUTE).toMatch(/export\s+const\s+maxDuration\s*=\s*60/);
  });

  it("pins runtime to nodejs", () => {
    expect(ROUTE).toMatch(/export\s+const\s+runtime\s*=\s*["']nodejs["']/);
  });

  it("does NOT wrap in withCronIdempotency (30-min cadence is not daily)", () => {
    // withCronIdempotency keys on a UTC-day bucket — using it here
    // would silence this cron after its first run each day and break
    // the ~30-min MTTD the audit requires.
    expect(ROUTE).not.toMatch(/withCronIdempotency\(/);
    expect(ROUTE).not.toMatch(/from\s*["']@\/lib\/cron\/with-idempotency["']/);
  });

  it("reads GitHub main HEAD via api.github.com commits endpoint", () => {
    expect(ROUTE).toMatch(/GITHUB_MAIN_REPO/);
    expect(ROUTE).toMatch(/api\.github\.com\/repos\/.*\/commits\/main/);
  });

  it("uses an optional GITHUB_TOKEN Bearer auth (repo may be private)", () => {
    expect(ROUTE).toMatch(/GITHUB_TOKEN/);
    expect(ROUTE).toMatch(/Authorization.*Bearer\s*\$\{ghToken\}/);
  });

  it("reads prod /api/health from PUBLIC_PROD_URL", () => {
    expect(ROUTE).toMatch(/PUBLIC_PROD_URL/);
    expect(ROUTE).toMatch(/\/api\/health/);
  });

  it("uses fetch with an AbortController-backed timeout", () => {
    // A flaky endpoint must not be able to eat the cron's 60s budget.
    expect(ROUTE).toMatch(/AbortController/);
    expect(ROUTE).toMatch(/FETCH_TIMEOUT_MS/);
  });

  it("compares SHA prefix (7-char) — matches /api/health `commit` shape", () => {
    // /api/health uses `VERCEL_GIT_COMMIT_SHA.slice(0, 7)`. We must
    // slice the same way or every single comparison would be a false-
    // positive silent alarm.
    expect(ROUTE).toMatch(/githubSha\.slice\(0,\s*7\)/);
  });

  it("emits `webhook-health.silent` tag on SHA mismatch past stale threshold", () => {
    // The ops alert rule watches for this exact tag. Do not change
    // the tag string without updating the alert rule in tandem.
    expect(ROUTE).toMatch(/tag:\s*["']webhook-health\.silent["']/);
    expect(ROUTE).toMatch(/WEBHOOK_STALE_MINUTES/);
  });

  it("emits `webhook-health.prod-down` as a distinct tag for 5xx health", () => {
    // Splitting silent-webhook vs prod-down lets alert routing send
    // the two to different escalation paths. Do not collapse them.
    expect(ROUTE).toMatch(/tag:\s*["']webhook-health\.prod-down["']/);
  });

  it("logs a match tag on the happy path (visible but non-noisy)", () => {
    expect(ROUTE).toMatch(/tag:\s*["']webhook-health\.match["']/);
  });

  it("degrades gracefully when config is missing (warn, not 500)", () => {
    // Missing env vars should yield a 200 `skipped/config` outcome
    // instead of a 5xx. A cron that 500s every tick is noise, not
    // signal.
    expect(ROUTE).toMatch(/status:\s*["']skipped["'][\s\S]*?reason:\s*["']config["']/);
  });

  it("degrades gracefully when the transport itself flakes", () => {
    // Single fetch failure → warn + `skipped/transport`, not alarm.
    expect(ROUTE).toMatch(/reason:\s*["']transport["']/);
  });

  it("declares WEBHOOK_STALE_MINUTES between 10 and 180", () => {
    const m = ROUTE.match(/WEBHOOK_STALE_MINUTES\s*=\s*(\d+)/);
    expect(m, "WEBHOOK_STALE_MINUTES constant must be declared").not.toBeNull();
    const mins = Number(m?.[1] ?? 0);
    // Lower bound: Vercel free-tier builds take ~3–5 min; anything
    // below 10 is guaranteed false-positive during normal deploys.
    // Upper bound: past 3h the alarm is too slow to matter.
    expect(mins).toBeGreaterThanOrEqual(10);
    expect(mins).toBeLessThanOrEqual(180);
  });
});

// ──────────────────────────────────────────────────────────────────
// 2. vercel.json — sub-hour cadence
// ──────────────────────────────────────────────────────────────────

describe("§5.45 F-01 — vercel.json registers the webhook-health cron", () => {
  it("has a cron entry for /api/cron/vercel-webhook-health", () => {
    const paths = (VERCEL.crons ?? []).map((c) => c.path);
    expect(paths).toContain("/api/cron/vercel-webhook-health");
  });

  it("runs sub-hourly (every N minutes, not daily/hourly top-of-hour)", () => {
    const entry = (VERCEL.crons ?? []).find(
      (c) => c.path === "/api/cron/vercel-webhook-health",
    );
    expect(entry, "webhook-health cron entry must exist").toBeDefined();
    // The cron expression must use the `*/N` minute form — this is
    // the only way to get a < 60 min MTTD on Vercel Cron. Reject a
    // plain "0 * * * *" (hourly) or daily pattern since those would
    // defeat the whole purpose of the detector.
    expect(entry?.schedule).toMatch(/^\*\/(\d+)\s+\*\s+\*\s+\*\s+\*$/);
    const m = entry?.schedule?.match(/^\*\/(\d+)\s/);
    const mins = Number(m?.[1] ?? 0);
    // Lower bound: 5 min keeps cron budget reasonable on free tier.
    // Upper bound: 30 min is the audit's MTTD target.
    expect(mins).toBeGreaterThanOrEqual(5);
    expect(mins).toBeLessThanOrEqual(30);
  });
});

// ──────────────────────────────────────────────────────────────────
// 3. OpenAPI parity
// ──────────────────────────────────────────────────────────────────

describe("§5.45 F-01 — docs/openapi.yaml declares /cron/vercel-webhook-health", () => {
  it("has a path entry for /cron/vercel-webhook-health", () => {
    expect(OPENAPI).toMatch(/\/cron\/vercel-webhook-health:/);
  });

  it("declares GET with bearerToken security", () => {
    const idx = OPENAPI.indexOf("/cron/vercel-webhook-health:");
    expect(idx).toBeGreaterThan(-1);
    const block = OPENAPI.slice(idx, idx + 2000);
    expect(block).toMatch(/get:/);
    expect(block).toMatch(/bearerToken:\s*\[\]/);
  });
});
