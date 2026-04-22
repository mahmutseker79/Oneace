// v1.3 P1 §5.48 F-04 — platform-quota-health cron pin (Faz 2 rename).
//
// Renamed from `vercel-quota-health` as part of the platform-agnostic
// refactor. The route no longer calls Vercel's API directly; instead
// it dispatches through `src/lib/hosting-platform` which picks the
// right adapter (Vercel / Netlify) based on `detectPlatform()`. The
// alarm policy (80/100/≥100 of the billing-period ceiling, expressed
// as a ratio so it works for both "deploys/day" and "minutes/month")
// is enforced here.
//
// Three moving parts to keep in sync:
//
//   1. Route handler — CRON_SECRET-gated, calls `getQuotaProvider()`,
//      decides against WARN_RATIO, emits platform-quota.{ok|warn|exceeded},
//      degrades gracefully on `unknown` platform + missing config +
//      transport flakes.
//   2. vercel.json — sub-hour cadence.
//   3. docs/openapi.yaml — path declaration with bearerToken security.

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
// 1. Route handler — auth, dispatch, alarm tags, degrade
// ──────────────────────────────────────────────────────────────────

describe("§5.48 F-04 — platform-quota-health route shape", () => {
  it("carries the @openapi-tag so openapi-parity covers the path", () => {
    expect(ROUTE).toMatch(/@openapi-tag:\s*\/cron\/platform-quota-health/);
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

  it("dispatches via src/lib/hosting-platform — NOT direct Vercel API", () => {
    // The whole point of Faz 2 is that this route is a thin threshold
    // decider. Calling api.vercel.com directly here would re-couple the
    // route to Vercel and defeat the refactor.
    expect(ROUTE).toMatch(/detectPlatform/);
    expect(ROUTE).toMatch(/getQuotaProvider/);
    expect(ROUTE).toMatch(/from\s*["']@\/lib\/hosting-platform["']/);
    expect(ROUTE).not.toMatch(/api\.vercel\.com\/v6\/deployments/);
    expect(ROUTE).not.toMatch(/api\.netlify\.com\//);
  });

  it("degrades gracefully when platform adapter is null (unknown platform)", () => {
    // Local dev / self-host → getQuotaProvider returns null. The route
    // must not throw; it logs and 200s with skipped/config.
    expect(ROUTE).toMatch(/if\s*\(!provider\)/);
    expect(ROUTE).toMatch(/tag:\s*["']platform-quota\.skipped\.config["']/);
    expect(ROUTE).toMatch(/no-adapter:\$\{platform\}/);
  });

  it("declares WARN_RATIO as a fraction strictly between 0.5 and 1.0", () => {
    const m = ROUTE.match(/WARN_RATIO\s*=\s*([\d.]+)/);
    expect(m, "WARN_RATIO constant must be declared").not.toBeNull();
    const ratio = Number(m?.[1] ?? 0);
    // Lower bound: 0.5 means the warn zone is half the ceiling —
    // anything below that fires constantly.
    // Upper bound: 1.0 collapses warn into exceeded.
    expect(ratio).toBeGreaterThanOrEqual(0.5);
    expect(ratio).toBeLessThan(1.0);
  });

  it("emits `platform-quota.exceeded` tag when count >= ceiling", () => {
    expect(ROUTE).toMatch(/tag:\s*["']platform-quota\.exceeded["']/);
    expect(ROUTE).toMatch(/count\s*>=\s*ceiling/);
  });

  it("emits `platform-quota.warn` tag when count in [warnAt, ceiling)", () => {
    expect(ROUTE).toMatch(/tag:\s*["']platform-quota\.warn["']/);
    expect(ROUTE).toMatch(/count\s*>=\s*warnAt/);
  });

  it("emits `platform-quota.ok` tag on the happy path", () => {
    expect(ROUTE).toMatch(/tag:\s*["']platform-quota\.ok["']/);
  });

  it("emits `platform-quota.skipped.api` tag on transport failures", () => {
    // The tag string may be assigned via a ternary on `result.reason`
    // (config → "...skipped.config", else → "...skipped.api") rather
    // than appearing inline after `tag:`. Match the literal presence.
    expect(ROUTE).toMatch(/["']platform-quota\.skipped\.api["']/);
  });

  it("degrades gracefully when config is missing", () => {
    // Either a literal `reason: "config"` in the skipped return, or
    // the skipped return passes through `result.reason` from the
    // adapter — the adapter code already returns that string. Match
    // either flavor.
    expect(ROUTE).toMatch(
      /(status:\s*["']skipped["'][\s\S]*?reason:\s*["']config["'])|(reason:\s*result\.reason)/,
    );
    // And the literal "config" string must still appear in the file
    // (either from the ternary above or a static return).
    expect(ROUTE).toMatch(/["']config["']/);
  });

  it("degrades gracefully when the adapter reports transport error", () => {
    // The adapter returns `{ok:false, reason:"transport"}` — the
    // route may forward that via `reason: result.reason` (computed)
    // or re-emit a literal. The contract we care about is that the
    // route has branching on the transport failure mode; the easiest
    // invariant to pin is that the tag "platform-quota.skipped.api"
    // exists (emitted when reason !== "config", i.e. transport).
    expect(ROUTE).toMatch(/["']platform-quota\.skipped\.api["']/);
    // And the skipped return payload must forward the adapter's
    // reason so consumers can split config vs. transport.
    expect(ROUTE).toMatch(/reason:\s*result\.reason/);
  });

  it("surfaces `platform` on every outbound payload", () => {
    // Faz 3 cutover window may have both Vercel and Netlify watching
    // concurrently. Log consumers need to split by platform.
    expect(ROUTE).toMatch(/platform:\s*provider\.platform/);
  });
});

// ──────────────────────────────────────────────────────────────────
// 2. vercel.json — sub-hour cadence
// ──────────────────────────────────────────────────────────────────

describe("§5.48 F-04 — vercel.json registers platform-quota-health cron", () => {
  it("has a cron entry for /api/cron/platform-quota-health", () => {
    const paths = (VERCEL.crons ?? []).map((c) => c.path);
    expect(paths).toContain("/api/cron/platform-quota-health");
  });

  it("runs sub-hourly so the warn alarm has headroom", () => {
    const entry = (VERCEL.crons ?? []).find(
      (c) => c.path === "/api/cron/platform-quota-health",
    );
    expect(entry, "platform-quota-health cron entry must exist").toBeDefined();
    expect(entry?.schedule).toMatch(/^\*\/(\d+)\s+\*\s+\*\s+\*\s+\*$/);
    const m = entry?.schedule?.match(/^\*\/(\d+)\s/);
    const mins = Number(m?.[1] ?? 0);
    expect(mins).toBeGreaterThanOrEqual(5);
    expect(mins).toBeLessThanOrEqual(60);
  });

  it("does not retain the legacy `vercel-quota-health` path", () => {
    const paths = (VERCEL.crons ?? []).map((c) => c.path);
    expect(paths).not.toContain("/api/cron/vercel-quota-health");
  });
});

// ──────────────────────────────────────────────────────────────────
// 3. OpenAPI parity
// ──────────────────────────────────────────────────────────────────

describe("§5.48 F-04 — docs/openapi.yaml declares /cron/platform-quota-health", () => {
  it("has a path entry for /cron/platform-quota-health", () => {
    expect(OPENAPI).toMatch(/\/cron\/platform-quota-health:/);
  });

  it("declares GET with bearerToken security", () => {
    const idx = OPENAPI.indexOf("/cron/platform-quota-health:");
    expect(idx).toBeGreaterThan(-1);
    const block = OPENAPI.slice(idx, idx + 2000);
    expect(block).toMatch(/get:/);
    expect(block).toMatch(/bearerToken:\s*\[\]/);
  });

  it("no longer declares the legacy /cron/vercel-quota-health path", () => {
    expect(OPENAPI).not.toMatch(/\/cron\/vercel-quota-health:/);
  });
});
