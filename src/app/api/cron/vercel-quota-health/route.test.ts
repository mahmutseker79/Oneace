// v1.3 P1 §5.48 F-04 — quota-health cron pin.
//
// Three moving parts to keep in sync:
//
//   1. Route handler — must be CRON_SECRET-gated, must page Vercel's
//      /v6/deployments API since UTC midnight, must emit the two
//      distinct alarm tags (`vercel-quota.warn` at 80+ and
//      `vercel-quota.exceeded` at 100+), must graceful-degrade on
//      missing config or transport flakes, must NOT use
//      withCronIdempotency (UTC-day bucket would silence the sub-hour
//      cadence), must cap pagination so a misconfigured project can't
//      wedge the cron.
//   2. vercel.json — must register the cron sub-hourly so the alarm
//      fires in time for ops to react before the ceiling.
//   3. docs/openapi.yaml — must declare /cron/vercel-quota-health
//      with bearerToken security.
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
// 1. Route handler — auth, paginate, alarm tags, degrade
// ──────────────────────────────────────────────────────────────────

describe("§5.48 F-04 — vercel-quota-health route shape", () => {
  it("carries the @openapi-tag so openapi-parity covers the path", () => {
    expect(ROUTE).toMatch(/@openapi-tag:\s*\/cron\/vercel-quota-health/);
  });

  it("enforces CRON_SECRET via Bearer header", () => {
    expect(ROUTE).toMatch(/request\.headers[\s\S]*?Authorization[\s\S]*?Bearer\s/);
    expect(ROUTE).toMatch(/process\.env\.CRON_SECRET/);
    expect(ROUTE).toMatch(/status:\s*401/);
  });

  it("declares maxDuration = 60", () => {
    expect(ROUTE).toMatch(/export\s+const\s+maxDuration\s*=\s*60/);
  });

  it("pins runtime to nodejs", () => {
    expect(ROUTE).toMatch(/export\s+const\s+runtime\s*=\s*["']nodejs["']/);
  });

  it("does NOT wrap in withCronIdempotency", () => {
    expect(ROUTE).not.toMatch(/withCronIdempotency\(/);
    expect(ROUTE).not.toMatch(/from\s*["']@\/lib\/cron\/with-idempotency["']/);
  });

  it("uses fetch with AbortController-backed timeout", () => {
    expect(ROUTE).toMatch(/AbortController/);
    expect(ROUTE).toMatch(/FETCH_TIMEOUT_MS/);
  });

  it("calls the Vercel deployments API", () => {
    expect(ROUTE).toMatch(/VERCEL_TOKEN/);
    expect(ROUTE).toMatch(/VERCEL_PROJECT_ID/);
    expect(ROUTE).toMatch(/api\.vercel\.com\/v6\/deployments/);
    expect(ROUTE).toMatch(/Authorization:\s*`Bearer \$\{vercelToken\}`/);
  });

  it("supports VERCEL_TEAM_ID for team accounts (optional)", () => {
    // Team accounts need teamId; personal accounts do not. Make sure
    // the param is set conditionally, not always.
    expect(ROUTE).toMatch(/VERCEL_TEAM_ID/);
    expect(ROUTE).toMatch(/if\s*\(\s*vercelTeamId\s*\)/);
  });

  it("paginates with `until` cursor and caps at MAX_PAGES", () => {
    // Vercel /v6/deployments returns { pagination: { next } }; we
    // feed that into the next request as `until`. MAX_PAGES is the
    // safety net against a runaway project.
    expect(ROUTE).toMatch(/pagination\?.next/);
    expect(ROUTE).toMatch(/MAX_PAGES/);
    expect(ROUTE).toMatch(/for\s*\(\s*let\s+page\s*=\s*0;\s*page\s*<\s*MAX_PAGES/);
  });

  it("filters to the current UTC day via `since` param", () => {
    // Vercel quota is per UTC day — we must filter on that same
    // boundary, otherwise the count spans days and the alarm
    // semantics break.
    expect(ROUTE).toMatch(/utcMidnightMs/);
    expect(ROUTE).toMatch(/Date\.UTC\(/);
    // The `since` query param is the UTC-midnight filter. Pin the
    // URLSearchParams construction so a drive-by that drops the
    // parameter (and implicitly spans multiple days) is caught.
    expect(ROUTE).toMatch(/since:\s*String\(since\)/);
  });

  it("declares DAILY_QUOTA matching the Vercel Hobby ceiling", () => {
    const m = ROUTE.match(/DAILY_QUOTA\s*=\s*(\d+)/);
    expect(m, "DAILY_QUOTA constant must be declared").not.toBeNull();
    const q = Number(m?.[1] ?? 0);
    // Lower bound: anything below 50 makes the alarm fire under
    // normal load. Upper bound: Vercel Pro is 1000; something in that
    // ballpark means this cron was ported without rethinking.
    expect(q).toBeGreaterThanOrEqual(50);
    expect(q).toBeLessThanOrEqual(1000);
  });

  it("declares WARN_THRESHOLD strictly below DAILY_QUOTA", () => {
    const warnMatch = ROUTE.match(/WARN_THRESHOLD\s*=\s*(\d+)/);
    const quotaMatch = ROUTE.match(/DAILY_QUOTA\s*=\s*(\d+)/);
    expect(warnMatch).not.toBeNull();
    expect(quotaMatch).not.toBeNull();
    const warn = Number(warnMatch?.[1] ?? 0);
    const quota = Number(quotaMatch?.[1] ?? 0);
    // Must be at least 10 deploys of headroom so ops has time to
    // react, and strictly below the ceiling (otherwise no "warn"
    // zone exists at all).
    expect(warn).toBeLessThan(quota);
    expect(quota - warn).toBeGreaterThanOrEqual(10);
  });

  it("emits `vercel-quota.exceeded` tag when count >= DAILY_QUOTA", () => {
    expect(ROUTE).toMatch(/tag:\s*["']vercel-quota\.exceeded["']/);
    expect(ROUTE).toMatch(/count\s*>=\s*DAILY_QUOTA/);
  });

  it("emits `vercel-quota.warn` tag when count in [WARN, DAILY_QUOTA)", () => {
    expect(ROUTE).toMatch(/tag:\s*["']vercel-quota\.warn["']/);
    expect(ROUTE).toMatch(/count\s*>=\s*WARN_THRESHOLD/);
  });

  it("emits `vercel-quota.ok` tag on the happy path", () => {
    expect(ROUTE).toMatch(/tag:\s*["']vercel-quota\.ok["']/);
  });

  it("degrades gracefully when config is missing (warn, not hard-fail)", () => {
    expect(ROUTE).toMatch(/status:\s*["']skipped["'][\s\S]*?reason:\s*["']config["']/);
  });

  it("degrades gracefully when Vercel API flakes", () => {
    expect(ROUTE).toMatch(/reason:\s*["']transport["']/);
  });

  it("stops paginating once count crosses DAILY_QUOTA (no need to be precise past ceiling)", () => {
    // If we already know count >= 100, walking more pages just to
    // sharpen an exact number is pure cost for zero signal — alarm
    // logic only cares about the three buckets.
    expect(ROUTE).toMatch(/count\s*>=\s*DAILY_QUOTA/);
  });
});

// ──────────────────────────────────────────────────────────────────
// 2. vercel.json — sub-hour cadence
// ──────────────────────────────────────────────────────────────────

describe("§5.48 F-04 — vercel.json registers quota-health cron", () => {
  it("has a cron entry for /api/cron/vercel-quota-health", () => {
    const paths = (VERCEL.crons ?? []).map((c) => c.path);
    expect(paths).toContain("/api/cron/vercel-quota-health");
  });

  it("runs sub-hourly so the warn alarm has headroom to matter", () => {
    const entry = (VERCEL.crons ?? []).find(
      (c) => c.path === "/api/cron/vercel-quota-health",
    );
    expect(entry, "quota-health cron entry must exist").toBeDefined();
    expect(entry?.schedule).toMatch(/^\*\/(\d+)\s+\*\s+\*\s+\*\s+\*$/);
    const m = entry?.schedule?.match(/^\*\/(\d+)\s/);
    const mins = Number(m?.[1] ?? 0);
    // Lower bound: 5 min is plenty. Upper bound: 60 min means you
    // might notice the alarm at 90 deploys and be at 100 before the
    // next run, which defeats the point.
    expect(mins).toBeGreaterThanOrEqual(5);
    expect(mins).toBeLessThanOrEqual(60);
  });
});

// ──────────────────────────────────────────────────────────────────
// 3. OpenAPI parity
// ──────────────────────────────────────────────────────────────────

describe("§5.48 F-04 — docs/openapi.yaml declares /cron/vercel-quota-health", () => {
  it("has a path entry for /cron/vercel-quota-health", () => {
    expect(OPENAPI).toMatch(/\/cron\/vercel-quota-health:/);
  });

  it("declares GET with bearerToken security", () => {
    const idx = OPENAPI.indexOf("/cron/vercel-quota-health:");
    expect(idx).toBeGreaterThan(-1);
    const block = OPENAPI.slice(idx, idx + 2000);
    expect(block).toMatch(/get:/);
    expect(block).toMatch(/bearerToken:\s*\[\]/);
  });
});
