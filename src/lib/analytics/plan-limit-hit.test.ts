// v1.3 §5.51 F-07 — PLAN_LIMIT_HIT analytics event wiring.
//
// What this test pins (and why):
//
//   1. `AnalyticsEvents.PLAN_LIMIT_HIT` has the exact value the
//      dashboard queries. PostHog insights hard-code event names, so
//      a drive-by rename would silently break the funnel.
//   2. `planLimitHitResponse` returns a discriminated shape the client
//      form can branch on: `ok:false`, `code:"PLAN_LIMIT"`, and a
//      `planLimit: { limitKey, limit, current }` payload. If any of
//      those field names drift, the client-side `track()` call sends
//      `undefined` and PostHog records a useless row.
//   3. The three server actions that enforce plan limits (items,
//      warehouses, members) route their refusal through
//      `planLimitHitResponse` — NOT the legacy bare
//      `{ ok:false, error: planLimitError(...) }` shape. A regression
//      here is silent: the error message still reaches the user, but
//      the event never fires.
//   4. The canonical client call site (`items/item-form.tsx`) actually
//      reads `result.code === "PLAN_LIMIT"` and calls
//      `track(AnalyticsEvents.PLAN_LIMIT_HIT, result.planLimit)`.
//
// Implementation note: the existing events-coverage.test.ts already
// grep-pins that `plan_limit_hit` appears in a non-taxonomy file.
// This test is tighter — it asserts the specific shape of the wire,
// not just that the constant is referenced somewhere.
//
// Static source-reads only — no Prisma client, no fetch, no JSDOM.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { AnalyticsEvents } from "@/lib/analytics/events";
import { planLimitHitResponse } from "@/lib/plans";

const SRC_DIR = resolve(__dirname, "..", "..");

// ────────────────────────────────────────────────────────────────────
// 1. The event constant itself
// ────────────────────────────────────────────────────────────────────

describe("§5.51 F-07 — AnalyticsEvents.PLAN_LIMIT_HIT constant", () => {
  it("exposes the exact string value the PostHog insight expects", () => {
    expect(AnalyticsEvents.PLAN_LIMIT_HIT).toBe("plan_limit_hit");
  });

  it("is declared in AnalyticsEvents, not PlannedAnalyticsEvents", () => {
    // If this lands in Planned by accident the events-coverage test
    // won't enforce a call site, and the constant becomes dead weight.
    const source = readFileSync(resolve(SRC_DIR, "lib", "analytics", "events.ts"), "utf8");
    const wiredBlock = source.slice(
      source.indexOf("export const AnalyticsEvents"),
      source.indexOf("export type AnalyticsEventName"),
    );
    expect(wiredBlock).toMatch(/PLAN_LIMIT_HIT:\s*["']plan_limit_hit["']/);

    const plannedBlock = source.slice(source.indexOf("export const PlannedAnalyticsEvents"));
    expect(plannedBlock).not.toMatch(/PLAN_LIMIT_HIT/);
  });
});

// ────────────────────────────────────────────────────────────────────
// 2. The server-side helper
// ────────────────────────────────────────────────────────────────────

describe("§5.51 F-07 — planLimitHitResponse() shape", () => {
  it("returns ok:false + code:PLAN_LIMIT + full planLimit payload", () => {
    const out = planLimitHitResponse("items", {
      allowed: false,
      limit: 100,
      current: 100,
    });
    expect(out).toEqual({
      ok: false,
      // Error string is whatever planLimitError returns — we don't
      // pin the exact copy here (would be churn-bait), just that
      // *some* non-empty string is present.
      error: expect.stringContaining("100"),
      code: "PLAN_LIMIT",
      planLimit: {
        limitKey: "items",
        limit: 100,
        current: 100,
      },
    });
  });

  it("carries the limitKey verbatim for warehouses / members too", () => {
    const wh = planLimitHitResponse("warehouses", { allowed: false, limit: 1, current: 1 });
    expect(wh.planLimit.limitKey).toBe("warehouses");
    const mb = planLimitHitResponse("members", { allowed: false, limit: 3, current: 3 });
    expect(mb.planLimit.limitKey).toBe("members");
  });
});

// ────────────────────────────────────────────────────────────────────
// 3. Server actions route their refusals through the new helper
// ────────────────────────────────────────────────────────────────────

describe("§5.51 F-07 — server actions use planLimitHitResponse", () => {
  const callSites: Array<{ path: string; label: string }> = [
    { path: "app/(app)/items/actions.ts", label: "items/actions.ts" },
    { path: "app/(app)/warehouses/actions.ts", label: "warehouses/actions.ts" },
    { path: "app/(app)/users/actions.ts", label: "users/actions.ts" },
  ];

  for (const site of callSites) {
    it(`${site.label} calls planLimitHitResponse on limit-hit`, () => {
      const source = readFileSync(resolve(SRC_DIR, site.path), "utf8");
      expect(source).toMatch(/planLimitHitResponse\(/);
    });

    it(`${site.label} does NOT fall back to legacy { ok:false, error: planLimitError(...) }`, () => {
      // This is the regression we are paranoid about — the old return
      // shape still "works" (user sees the error) but silently drops
      // the analytics event. Anyone re-introducing the old pattern
      // should see red in CI.
      const source = readFileSync(resolve(SRC_DIR, site.path), "utf8");
      expect(source).not.toMatch(/error:\s*planLimitError\(/);
    });
  }
});

// ────────────────────────────────────────────────────────────────────
// 4. The canonical client form wires the event
// ────────────────────────────────────────────────────────────────────

describe("§5.51 F-07 — items/item-form.tsx fires PLAN_LIMIT_HIT", () => {
  const FORM = readFileSync(resolve(SRC_DIR, "app", "(app)", "items", "item-form.tsx"), "utf8");

  it("branches on result.code === 'PLAN_LIMIT'", () => {
    expect(FORM).toMatch(/result\.code\s*===\s*["']PLAN_LIMIT["']/);
  });

  it("calls track(AnalyticsEvents.PLAN_LIMIT_HIT, result.planLimit)", () => {
    expect(FORM).toMatch(/track\(\s*AnalyticsEvents\.PLAN_LIMIT_HIT\s*,\s*result\.planLimit\s*\)/);
  });

  it("fires BEFORE setError, so the event captures even if the UI re-renders", () => {
    const trackIdx = FORM.indexOf("AnalyticsEvents.PLAN_LIMIT_HIT");
    const setErrorIdx = FORM.indexOf("setError(result.error)");
    expect(trackIdx).toBeGreaterThan(-1);
    expect(setErrorIdx).toBeGreaterThan(-1);
    expect(trackIdx).toBeLessThan(setErrorIdx);
  });
});
