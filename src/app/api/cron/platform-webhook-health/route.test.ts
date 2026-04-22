// v1.3 P1 §5.45 F-01 — platform-webhook-health cron pin (Faz 2 rename).
//
// Renamed from the original `vercel-webhook-health` route as part of
// the platform-agnostic refactor. The logic was always platform-
// agnostic (compare GitHub main HEAD to the deployed /api/health
// commit); only the URL + log tag prefix moved from `vercel-*` to
// `platform-*` so the same alarm fires regardless of where the site is
// actually hosted.
//
// Three moving parts to keep in sync:
//
//   1. Route handler — CRON_SECRET-gated, reads GitHub main HEAD +
//      prod /api/health, emits `platform-webhook.silent` on SHA
//      mismatch past the stale threshold, `platform-webhook.prod-down`
//      on 5xx, degrades gracefully on missing config / transport
//      flakes, and does NOT use withCronIdempotency.
//   2. vercel.json — registers the cron at a sub-hour cadence.
//   3. docs/openapi.yaml — declares /cron/platform-webhook-health
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
// 1. Route handler — auth, graceful degrade, alarm tags
// ──────────────────────────────────────────────────────────────────

describe("§5.45 F-01 — platform-webhook-health route shape", () => {
  it("carries the @openapi-tag so openapi-parity covers the path", () => {
    expect(ROUTE).toMatch(/@openapi-tag:\s*\/cron\/platform-webhook-health/);
  });

  it("enforces CRON_SECRET via Bearer header", () => {
    expect(ROUTE).toMatch(/request\.headers[\s\S]*?Authorization[\s\S]*?Bearer\s/);
    expect(ROUTE).toMatch(/process\.env\.CRON_SECRET/);
    expect(ROUTE).toMatch(/status:\s*401/);
  });

  it("declares maxDuration = 60 (Vercel + Netlify cron timeout)", () => {
    expect(ROUTE).toMatch(/export\s+const\s+maxDuration\s*=\s*60/);
  });

  it("pins runtime to nodejs", () => {
    expect(ROUTE).toMatch(/export\s+const\s+runtime\s*=\s*["']nodejs["']/);
  });

  it("does NOT wrap in withCronIdempotency (30-min cadence is not daily)", () => {
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
    expect(ROUTE).toMatch(/AbortController/);
    expect(ROUTE).toMatch(/FETCH_TIMEOUT_MS/);
  });

  it("compares SHA prefix (7-char) — matches /api/health `commit` shape", () => {
    expect(ROUTE).toMatch(/githubSha\.slice\(0,\s*7\)/);
  });

  it("emits `platform-webhook.silent` tag on SHA mismatch past stale threshold", () => {
    // Ops alert rule watches for this exact tag.
    expect(ROUTE).toMatch(/tag:\s*["']platform-webhook\.silent["']/);
    expect(ROUTE).toMatch(/WEBHOOK_STALE_MINUTES/);
  });

  it("emits `platform-webhook.prod-down` as a distinct tag for 5xx health", () => {
    expect(ROUTE).toMatch(/tag:\s*["']platform-webhook\.prod-down["']/);
  });

  it("logs a match tag on the happy path (visible but non-noisy)", () => {
    expect(ROUTE).toMatch(/tag:\s*["']platform-webhook\.match["']/);
  });

  it("degrades gracefully when config is missing (warn, not 500)", () => {
    expect(ROUTE).toMatch(/status:\s*["']skipped["'][\s\S]*?reason:\s*["']config["']/);
  });

  it("degrades gracefully when the transport itself flakes", () => {
    expect(ROUTE).toMatch(/reason:\s*["']transport["']/);
  });

  it("annotates log payloads with the detected platform", () => {
    // The platform field is what lets ops split alerts by host in
    // Faz 3 when the same alarm might fire on either Vercel or Netlify
    // during the cutover window.
    expect(ROUTE).toMatch(/detectPlatform/);
    expect(ROUTE).toMatch(/from\s*["']@\/lib\/hosting-platform["']/);
    expect(ROUTE).toMatch(/platform,/);
  });

  it("declares WEBHOOK_STALE_MINUTES between 10 and 180", () => {
    const m = ROUTE.match(/WEBHOOK_STALE_MINUTES\s*=\s*(\d+)/);
    expect(m, "WEBHOOK_STALE_MINUTES constant must be declared").not.toBeNull();
    const mins = Number(m?.[1] ?? 0);
    expect(mins).toBeGreaterThanOrEqual(10);
    expect(mins).toBeLessThanOrEqual(180);
  });
});

// ──────────────────────────────────────────────────────────────────
// 2. vercel.json — sub-hour cadence
// ──────────────────────────────────────────────────────────────────

describe("§5.45 F-01 — vercel.json registers the platform-webhook-health cron", () => {
  it("has a cron entry for /api/cron/platform-webhook-health", () => {
    const paths = (VERCEL.crons ?? []).map((c) => c.path);
    expect(paths).toContain("/api/cron/platform-webhook-health");
  });

  it("runs sub-hourly (every N minutes, not daily/hourly top-of-hour)", () => {
    const entry = (VERCEL.crons ?? []).find(
      (c) => c.path === "/api/cron/platform-webhook-health",
    );
    expect(entry, "platform-webhook-health cron entry must exist").toBeDefined();
    expect(entry?.schedule).toMatch(/^\*\/(\d+)\s+\*\s+\*\s+\*\s+\*$/);
    const m = entry?.schedule?.match(/^\*\/(\d+)\s/);
    const mins = Number(m?.[1] ?? 0);
    expect(mins).toBeGreaterThanOrEqual(5);
    expect(mins).toBeLessThanOrEqual(30);
  });

  it("does not retain the legacy `vercel-webhook-health` path", () => {
    // Faz 2 rename: the old path must be gone. If both exist, the
    // bridges and openapi parity will flap.
    const paths = (VERCEL.crons ?? []).map((c) => c.path);
    expect(paths).not.toContain("/api/cron/vercel-webhook-health");
  });
});

// ──────────────────────────────────────────────────────────────────
// 3. OpenAPI parity
// ──────────────────────────────────────────────────────────────────

describe("§5.45 F-01 — docs/openapi.yaml declares /cron/platform-webhook-health", () => {
  it("has a path entry for /cron/platform-webhook-health", () => {
    expect(OPENAPI).toMatch(/\/cron\/platform-webhook-health:/);
  });

  it("declares GET with bearerToken security", () => {
    const idx = OPENAPI.indexOf("/cron/platform-webhook-health:");
    expect(idx).toBeGreaterThan(-1);
    const block = OPENAPI.slice(idx, idx + 2000);
    expect(block).toMatch(/get:/);
    expect(block).toMatch(/bearerToken:\s*\[\]/);
  });

  it("no longer declares the legacy /cron/vercel-webhook-health path", () => {
    expect(OPENAPI).not.toMatch(/\/cron\/vercel-webhook-health:/);
  });
});
