// v1.2 P2 §5.40 — axe-core + Playwright a11y sweep (LIVE).
//
// Skeleton landed in `v1.2.11-p2-wcag-contrast`; this follow-up
// wires @axe-core/playwright as a devDep, drops the skip gate, and
// replaces the local type stub with the real import.
//
// Baseline strategy: the first green run on a branch is the baseline.
// The sweep fails on ANY WCAG 2.1 AA violation, but we allow-list a
// small set of known issues via `ACCEPTABLE_VIOLATION_IDS` so the
// team can land the infra without blocking on the long-tail fixes.
// Any violation NOT in that allow-list is a hard fail — that way the
// sweep is a tripwire for NEW regressions, not a goalpost that moves
// silently.
//
// When a violation in the allow-list is actually fixed, drop its rule
// id from the set. The pin in `src/lib/a11y-token-contrast.test.ts`
// keeps CRITICAL_PATHS and the WCAG tag set honest.

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

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
  // Sprint 8 PR #2 — high-traffic paths added after Sprint 6 (TR ops)
  // genişlemesi. Bu sayfalar TR locale aktifken yüzlerce yeni string
  // render eder; axe sweep onların a11y regresyonunu da yakalar.
  "/movements",
  "/movements/new",
  "/suppliers",
  "/suppliers/new",
  "/scan",
  "/search?q=test",
  "/reports",
  "/reports/low-stock",
  "/users",
];

/**
 * axe rule ids we currently accept as allow-listed while the infra
 * lands. Each one should have a tracking note — remove entries as
 * fixes ship. Intentionally empty right now so the very first CI run
 * fails loudly on whatever is already broken; the team's first
 * triage pass decides which ids (if any) land here.
 *
 * DO NOT add ids here to silence a NEW regression. The whole point
 * of the sweep is to catch new violations. Only existing, triaged
 * issues with a tracking ticket belong here.
 */
const ACCEPTABLE_VIOLATION_IDS: ReadonlySet<string> = new Set<string>([
  // (populated after first triage — see §5.40 follow-ups)
]);

test.describe("§5.40 — axe-core sweep across CRITICAL_PATHS", () => {
  for (const path of CRITICAL_PATHS) {
    test(`${path} has no unexpected WCAG 2.1 AA axe violations`, async ({ page }) => {
      await page.goto(path);
      // Wait for the app shell to paint before running the sweep —
      // axe can race with React hydration otherwise.
      await page.waitForLoadState("networkidle");

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();

      const unexpected = results.violations.filter((v) => !ACCEPTABLE_VIOLATION_IDS.has(v.id));
      // Shape the failure message so the CI log shows the rule id +
      // impact + node count per violation — easier to triage than
      // dumping the whole payload.
      const summary = unexpected.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.length,
        help: v.help,
      }));

      expect(
        summary,
        `unexpected axe violations on ${path}: ${JSON.stringify(summary, null, 2)}`,
      ).toEqual([]);
    });
  }
});
