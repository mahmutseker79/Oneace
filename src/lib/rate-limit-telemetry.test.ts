/**
 * Audit v1.3 §5.52 F-08 — rate-limit 429 PostHog telemetry pin.
 *
 * Problem the audit flagged
 * -------------------------
 * Middleware rejects ~120 req/min/IP excess traffic with HTTP 429
 * but never emitted a PostHog/log-drain event, so a throttled
 * caller only reached us via a support ticket. Dashboards had
 * zero signal on rate-limit hits.
 *
 * v1.5.26 fix
 * -----------
 * 1. `AnalyticsEvents.RATE_LIMIT_HIT = "rate_limit.hit"` added to
 *    `src/lib/analytics/events.ts` so the taxonomy is one file.
 * 2. `src/middleware.ts` emits a structured `console.warn` with
 *    `tag: "rate_limit.hit"` inside the 429 branch BEFORE building
 *    the NextResponse. `console.warn` over `logger.warn` because
 *    middleware runs on Edge and we don't want to drag `env` into
 *    the Edge bundle.
 * 3. Payload shape: `{ level, tag, event, path, ip, limit,
 *    retryAfter, reset }`. Keys pinned by this file so future
 *    refactors can't silently drop a field that the log drain /
 *    PostHog relay filters on.
 *
 * Static-analysis only. Reads two source files, asserts shape.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const EVENTS_PATH = resolve(process.cwd(), "src/lib/analytics/events.ts");
const MIDDLEWARE_PATH = resolve(process.cwd(), "src/middleware.ts");

describe("§5.52 F-08 — rate-limit.hit event taxonomy", () => {
  it("AnalyticsEvents exports RATE_LIMIT_HIT with canonical value", async () => {
    // Runtime check — the constant value is what log-drain filters
    // match on. String drift here silently breaks the relay.
    const mod = await import("@/lib/analytics/events");
    expect(mod.AnalyticsEvents).toHaveProperty("RATE_LIMIT_HIT", "rate_limit.hit");
  });

  it("events.ts documents RATE_LIMIT_HIT inside the wired (not planned) block", () => {
    const text = readFileSync(EVENTS_PATH, "utf8");
    // The constant MUST live under `AnalyticsEvents` (wired), not
    // under `PlannedAnalyticsEvents` (not-wired). If someone moves
    // it into Planned, the taxonomy test in this suite still
    // passes — but the event becomes semantically "on the wishlist"
    // which is a lie. Source-position check catches that.
    const wiredIdx = text.indexOf("export const AnalyticsEvents");
    const plannedIdx = text.indexOf("export const PlannedAnalyticsEvents");
    const constIdx = text.indexOf("RATE_LIMIT_HIT:");
    expect(wiredIdx, "AnalyticsEvents block exists").toBeGreaterThan(-1);
    expect(plannedIdx, "PlannedAnalyticsEvents block exists").toBeGreaterThan(-1);
    expect(constIdx, "RATE_LIMIT_HIT constant exists").toBeGreaterThan(-1);
    expect(constIdx, "RATE_LIMIT_HIT is in the wired block").toBeGreaterThan(wiredIdx);
    expect(constIdx, "RATE_LIMIT_HIT is NOT in the planned block").toBeLessThan(plannedIdx);
  });
});

describe("§5.52 F-08 — middleware.ts emits rate-limit.hit inside 429 branch", () => {
  function readMw(): string {
    return readFileSync(MIDDLEWARE_PATH, "utf8");
  }

  it("middleware still returns 429 with status + Retry-After header", () => {
    // Guard: the telemetry fix must not accidentally delete the
    // 429 short-circuit. If this trips someone replaced the whole
    // branch and the rate limit stopped actually limiting.
    const text = readMw();
    expect(text).toContain("status: 429");
    expect(text).toMatch(/["']Retry-After["']:\s*String\(retryAfter\)/);
  });

  it("middleware emits a 'rate_limit.hit' tagged console.warn inside the 429 branch", () => {
    const text = readMw();
    // Locate the 429 branch by its status literal and slice a
    // window around it. The structured log must live in this slice
    // — not at module top-level, not inside the exempt check, not
    // after the NextResponse return. Window size is generous to
    // absorb formatting churn.
    const branchIdx = text.indexOf("if (!rl.ok) {");
    expect(branchIdx, "429 branch must exist").toBeGreaterThan(-1);
    const branchEnd = text.indexOf("return new NextResponse", branchIdx);
    expect(branchEnd, "NextResponse return must exist in branch").toBeGreaterThan(branchIdx);
    const branchSlice = text.slice(branchIdx, branchEnd);

    // The warn call must be present in the slice (before the
    // response is built / returned) so the event is emitted
    // regardless of how the response is constructed downstream.
    expect(branchSlice).toContain("console.warn(");
    expect(branchSlice).toContain('tag: "rate_limit.hit"');
  });

  it("console.warn payload carries the full pinned shape", () => {
    const text = readMw();
    // Extract the console.warn payload block and check each
    // canonical key appears. Missing any key would silently blind
    // the PostHog/log-drain relay filter.
    const warnIdx = text.indexOf('tag: "rate_limit.hit"');
    expect(warnIdx, "tag literal must be present").toBeGreaterThan(-1);
    const windowSlice = text.slice(Math.max(0, warnIdx - 200), warnIdx + 400);
    expect(windowSlice).toMatch(/level:\s*["']warn["']/);
    expect(windowSlice).toMatch(/event:\s*["']rate_limit\.hit["']/);
    expect(windowSlice).toMatch(/path:\s*pathname/);
    expect(windowSlice).toMatch(/ip(:|,)/);
    expect(windowSlice).toMatch(/limit:\s*rl\.limit/);
    expect(windowSlice).toMatch(/retryAfter(:|,)/);
    expect(windowSlice).toMatch(/reset:\s*rl\.reset/);
  });

  it("log line is JSON-stringified so log drains can parse it straight", () => {
    // Drain filters expect one JSON object per line. If someone
    // refactors to pass a raw object (which would go through
    // console's default object inspector and emit multi-line
    // output), the drain parser mis-counts the lines.
    const text = readMw();
    const warnIdx = text.indexOf("console.warn(");
    expect(warnIdx).toBeGreaterThan(-1);
    // Look at the next ~60 chars — should include `JSON.stringify({`.
    // Window is generous to absorb the formatter's line-break between
    // `console.warn(` and the `JSON.stringify(` call.
    const nextSlice = text.slice(warnIdx, warnIdx + 60);
    expect(nextSlice).toContain("JSON.stringify(");
  });

  it("telemetry emission precedes the NextResponse return", () => {
    // Source-order pin: console.warn must happen BEFORE the
    // `return new NextResponse` so a future refactor that moves
    // the warn AFTER the return (dead code) fails loud.
    const text = readMw();
    const branchIdx = text.indexOf("if (!rl.ok) {");
    const warnIdx = text.indexOf("console.warn(", branchIdx);
    const returnIdx = text.indexOf("return new NextResponse", branchIdx);
    expect(warnIdx, "warn in 429 branch").toBeGreaterThan(-1);
    expect(returnIdx, "return in 429 branch").toBeGreaterThan(-1);
    expect(warnIdx, "warn fires before response returns").toBeLessThan(returnIdx);
  });

  it("middleware does NOT import logger (Edge-safety)", () => {
    // Intentional: we use console.warn in middleware because
    // importing `@/lib/logger` drags `env.ts` into the Edge bundle
    // which has historically caused cold-start issues. Pin so a
    // future "let's use logger everywhere" sweep doesn't silently
    // regress.
    const text = readMw();
    expect(text).not.toMatch(/from\s+["']@\/lib\/logger["']/);
  });
});
