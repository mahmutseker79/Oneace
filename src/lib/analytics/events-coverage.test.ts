// P1-§5.20 (audit v1.1) — analytics event taxonomy coverage.
//
// Problem at v1.0 close: 19 event constants were declared in
// `AnalyticsEvents`, but only 1 call site fired any of them. The
// taxonomy *looked* complete in review but was effectively empty in
// PostHog — textbook measurement theater.
//
// Remediation split the list into two objects:
//   - `AnalyticsEvents` — events with at least one call site via
//     `track()` from `@/lib/instrumentation`. Anything in here that
//     isn't grepable in source is a bug (gap in wiring OR dead code).
//   - `PlannedAnalyticsEvents` — events blocked on missing
//     infrastructure (e.g. first-event detection, Stripe webhook).
//     Allowed to have no call site, but must stay out of
//     `AnalyticsEvents` until they're wired.
//
// This test pins those invariants so the taxonomy can't silently drift
// back into the "lots of constants, no dashboards" state.

import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AnalyticsEvents,
  PlannedAnalyticsEvents,
} from "@/lib/analytics/events";

const SRC_DIR = resolve(__dirname, "..", "..");

// Grep the src tree for references to an event. We match EITHER the
// literal string value ("signup_completed") OR the constant name
// reference (AnalyticsEvents.SIGNUP_COMPLETED), so callers using the
// typed constant count as wired — which is the recommended form.
function findCallSites(eventKey: string, eventValue: string): string[] {
  const constantRef = `AnalyticsEvents.${eventKey}`;
  try {
    const result = execSync(
      `grep -rlnE --include='*.ts' --include='*.tsx' ${JSON.stringify(
        `(${constantRef.replace(".", "\\.")}|${eventValue})`,
      )} ${SRC_DIR}`,
      { encoding: "utf8" },
    );
    return result
      .split("\n")
      .filter(Boolean)
      // Exclude the events.ts declaration itself + this test file.
      .filter(
        (p) =>
          !p.endsWith("src/lib/analytics/events.ts") &&
          !p.endsWith("src/lib/analytics/events-coverage.test.ts"),
      );
  } catch {
    return [];
  }
}

describe("Analytics event coverage (audit v1.1 §5.20)", () => {
  describe("AnalyticsEvents — every entry has at least one call site", () => {
    for (const [key, value] of Object.entries(AnalyticsEvents)) {
      it(`${key} (${value}) is fired from at least one non-taxonomy file`, () => {
        const sites = findCallSites(key, value);
        expect(
          sites.length,
          `Event "${value}" declared but never fired — wire it or move to PlannedAnalyticsEvents`,
        ).toBeGreaterThan(0);
      });
    }
  });

  describe("PlannedAnalyticsEvents — must not accidentally duplicate a wired event", () => {
    const wired = new Set(Object.values(AnalyticsEvents));
    for (const [key, value] of Object.entries(PlannedAnalyticsEvents)) {
      it(`${key} (${value}) is not also in AnalyticsEvents`, () => {
        expect(
          wired.has(value as (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents]),
          `"${value}" lives in both AnalyticsEvents and PlannedAnalyticsEvents — pick one`,
        ).toBe(false);
      });
    }
  });

  describe("track() facade is the canonical entry point", () => {
    it("track is exported from @/lib/instrumentation with sync signature", () => {
      const source = readFileSync(
        resolve(SRC_DIR, "lib", "instrumentation.ts"),
        "utf8",
      );
      expect(source).toMatch(
        /export function track\(event: string, props\?: Record<string, unknown>\): void/,
      );
    });

    it("deprecated trackEvent carries a @deprecated JSDoc tag", () => {
      const source = readFileSync(
        resolve(SRC_DIR, "lib", "analytics", "events.ts"),
        "utf8",
      );
      // Match the @deprecated tag anywhere above the function declaration.
      expect(
        source,
        "trackEvent() must carry @deprecated tag pointing to track()",
      ).toMatch(
        /@deprecated[\s\S]*?Use `track\(\)`[\s\S]*?export function trackEvent/,
      );
    });

    it("AnalyticsEvents exports a type-level union (AnalyticsEventName)", () => {
      const source = readFileSync(
        resolve(SRC_DIR, "lib", "analytics", "events.ts"),
        "utf8",
      );
      expect(source).toMatch(/export type AnalyticsEventName =/);
    });
  });

  describe("High-signal events wired to the right seams", () => {
    it("signup_completed fires from register-form.tsx", () => {
      const sites = findCallSites("SIGNUP_COMPLETED", AnalyticsEvents.SIGNUP_COMPLETED);
      expect(
        sites.some((p) => p.endsWith("register-form.tsx")),
        `expected register-form.tsx in call sites, got: ${sites.join(", ")}`,
      ).toBe(true);
    });

    it("onboarding_completed fires from onboarding-form.tsx", () => {
      const sites = findCallSites(
        "ONBOARDING_COMPLETED",
        AnalyticsEvents.ONBOARDING_COMPLETED,
      );
      expect(
        sites.some((p) => p.endsWith("onboarding-form.tsx")),
        `expected onboarding-form.tsx in call sites, got: ${sites.join(", ")}`,
      ).toBe(true);
    });

    it("two_factor_enabled fires from two-factor-setup.tsx", () => {
      const sites = findCallSites(
        "TWO_FACTOR_ENABLED",
        AnalyticsEvents.TWO_FACTOR_ENABLED,
      );
      expect(
        sites.some((p) => p.endsWith("two-factor-setup.tsx")),
        `expected two-factor-setup.tsx in call sites, got: ${sites.join(", ")}`,
      ).toBe(true);
    });

    it("item_image_uploaded fires from image-upload.tsx", () => {
      const sites = findCallSites(
        "ITEM_IMAGE_UPLOADED",
        AnalyticsEvents.ITEM_IMAGE_UPLOADED,
      );
      expect(
        sites.some((p) => p.endsWith("image-upload.tsx")),
        `expected image-upload.tsx in call sites, got: ${sites.join(", ")}`,
      ).toBe(true);
    });

    // --- v1.2 §5.33 — activation call-site follow-through ---
    // These pin the seams added by Phase-3.1. Each event MUST fire from
    // its designated client form (not the server action), because
    // `track()` is a server-side no-op and firing from the action would
    // silently drop the event in production.

    it("item_created fires from items/item-form.tsx", () => {
      const sites = findCallSites("ITEM_CREATED", AnalyticsEvents.ITEM_CREATED);
      expect(
        sites.some((p) => p.endsWith("items/item-form.tsx")),
        `expected items/item-form.tsx in call sites, got: ${sites.join(", ")}`,
      ).toBe(true);
    });

    it("first_item_created fires from items/item-form.tsx", () => {
      const sites = findCallSites(
        "FIRST_ITEM_CREATED",
        AnalyticsEvents.FIRST_ITEM_CREATED,
      );
      expect(
        sites.some((p) => p.endsWith("items/item-form.tsx")),
        `expected items/item-form.tsx in call sites, got: ${sites.join(", ")}`,
      ).toBe(true);
    });

    it("first_warehouse_created fires from warehouses/warehouse-form.tsx", () => {
      const sites = findCallSites(
        "FIRST_WAREHOUSE_CREATED",
        AnalyticsEvents.FIRST_WAREHOUSE_CREATED,
      );
      expect(
        sites.some((p) => p.endsWith("warehouses/warehouse-form.tsx")),
        `expected warehouses/warehouse-form.tsx in call sites, got: ${sites.join(", ")}`,
      ).toBe(true);
    });

    it("count_started fires from stock-counts/new-count-form.tsx", () => {
      const sites = findCallSites("COUNT_STARTED", AnalyticsEvents.COUNT_STARTED);
      expect(
        sites.some((p) => p.endsWith("stock-counts/new-count-form.tsx")),
        `expected stock-counts/new-count-form.tsx in call sites, got: ${sites.join(", ")}`,
      ).toBe(true);
    });

    it("first_count_completed fires from reconcile-form.tsx", () => {
      const sites = findCallSites(
        "FIRST_COUNT_COMPLETED",
        AnalyticsEvents.FIRST_COUNT_COMPLETED,
      );
      expect(
        sites.some((p) => p.endsWith("reconcile/reconcile-form.tsx")),
        `expected reconcile-form.tsx in call sites, got: ${sites.join(", ")}`,
      ).toBe(true);
    });

    it("barcode_scanned fires from scan/scanner.tsx", () => {
      const sites = findCallSites(
        "BARCODE_SCANNED",
        AnalyticsEvents.BARCODE_SCANNED,
      );
      expect(
        sites.some((p) => p.endsWith("scan/scanner.tsx")),
        `expected scan/scanner.tsx in call sites, got: ${sites.join(", ")}`,
      ).toBe(true);
    });

    it("first_scan fires from scan/scanner.tsx", () => {
      const sites = findCallSites("FIRST_SCAN", AnalyticsEvents.FIRST_SCAN);
      expect(
        sites.some((p) => p.endsWith("scan/scanner.tsx")),
        `expected scan/scanner.tsx in call sites, got: ${sites.join(", ")}`,
      ).toBe(true);
    });
  });
});
