// v1.2 P2 §5.40 — axe-core + Playwright a11y sweep SKELETON.
//
// This file is deliberately PARKED. The real sweep needs:
//
//   1. `npm i -D @axe-core/playwright` (adds ~1.5MB to devDeps).
//   2. An initial triage pass — the audit estimates 5-15 genuine
//      violations on the first run (colour-contrast that the token
//      test didn't catch, `aria-describedby` gaps on form errors,
//      missing `aria-live` on toasts, combobox tab cycling). Those
//      fixes are §5.40.2 — their own remediation batch.
//   3. A baseline / allow-list mechanism so the sweep blocks NEW
//      violations without requiring all existing ones to be fixed
//      in a single commit.
//
// Until that lands, `describe.skip(...)` keeps Playwright happy
// (the file compiles and the shape is obvious to a reviewer) while
// not breaking CI on an import of a dependency that isn't installed.
//
// When the dep lands, the follow-up PR should:
//   - drop this header,
//   - change `describe.skip` to `describe`,
//   - swap the local AxeBuilder type for the real import, and
//   - wire a baseline file (e.g. `e2e/a11y-baseline.json`) that the
//     expectation reads before asserting.
//
// The static-analysis pin in `src/lib/a11y-token-contrast.test.ts`
// keeps this file honest — CRITICAL_PATHS must stay declared, the
// WCAG tags must remain, and the skip gate must not be lifted
// prematurely.

import { test } from "@playwright/test";

/**
 * The paths we care about for the first sweep. These are the routes
 * the audit called out as "high leverage, high-traffic": a
 * signed-out marketing entry, the core signed-in surfaces, and the
 * forms most likely to carry aria-describedby regressions.
 *
 * Not exhaustive — the goal is a trip-wire, not a full crawl.
 */
const CRITICAL_PATHS: readonly string[] = [
  "/", // marketing landing
  "/login",
  "/signup",
  "/dashboard",
  "/items",
  "/items/new",
  "/purchase-orders",
  "/purchase-orders/new",
  "/stock-counts",
  "/stock-counts/new",
  "/settings/security",
  "/settings/security/sessions",
];

// Placeholder type — swap for `import AxeBuilder from "@axe-core/playwright"`
// once the dep is installed. Keeping the shape here so the sweep body
// below typechecks even in the parked state.
type AxeBuilderShape = {
  withTags(tags: string[]): AxeBuilderShape;
  analyze(): Promise<{ violations: unknown[] }>;
};
declare const AxeBuilder: new (_: { page: unknown }) => AxeBuilderShape;

test.describe.skip(
  "§5.40 — axe-core sweep across CRITICAL_PATHS (parked until @axe-core/playwright is installed)",
  () => {
    for (const path of CRITICAL_PATHS) {
      test(`${path} has no WCAG 2.1 AA axe violations`, async ({ page }) => {
        await page.goto(path);
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        // When the sweep goes live, this should compare against a
        // baseline file and fail only on NEW violations.
        if (results.violations.length > 0) {
          throw new Error(`axe found ${results.violations.length} violation(s) on ${path}`);
        }
      });
    }
  },
);
