// v1.5 Navigation IA — Phase 3 pinned static-analysis tests.
//
// These complement the existing `nav-config.test.ts` (which pins the
// sidebar SHAPE) by pinning the SURROUNDING invariants that the v1.5
// refactor relies on:
//
//   1. wrapper-tab-coverage — every re-homed sub-page renders a
//      <WrapperTabs> row with the correct SPECS constant, so a user
//      landing on /categories or /transfers always sees the wrapper
//      context and can sibling-navigate without back-button trips.
//
//   2. metaTitle-alignment — the four landing pages whose titles were
//      renamed for v1.5 (Items→Inventory, Stock Counts→Counts,
//      Purchase Orders→Orders, Users→Team) have matching `metaTitle`
//      entries in the i18n dictionary. Stops the browser tab from
//      drifting back to the old label silently.
//
//   3. orphan-routes — every top-level route under `src/app/(app)`
//      is either a direct sidebar entry, covered by a wrapper's
//      `activePathPrefixes`, or explicitly allow-listed as a global
//      (scan, search, onboarding, …). A new route added without nav
//      thought will fail this test.
//
//   4. empty-state-links — EmptyState CTAs on the landings reference
//      canonical v1.5 routes. No /items-management, /order-center
//      etc. sneak in via copy-paste.
//
// All tests are static-analysis style (fs + regex), matching the
// project preference for vitest over JSDOM/integration for this kind
// of shape check.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { NAV_GROUPS } from "./nav-config";
import {
  INVENTORY_TAB_SPECS,
  LOCATIONS_TAB_SPECS,
  ORDERS_TAB_SPECS,
  SETTINGS_TAB_SPECS,
  TEAM_TAB_SPECS,
} from "./wrapper-tabs-config";

// ─── Paths ───────────────────────────────────────────────────────────

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const APP_DIR = resolve(REPO_ROOT, "src", "app", "(app)");
const I18N_EN = resolve(REPO_ROOT, "src", "lib", "i18n", "messages", "en.ts");

// ─── Wrapper → sub-pages ─────────────────────────────────────────────
// Derived from wrapper-tabs-config.ts so adding a tab there automatically
// extends the coverage assertion.

type WrapperCheck = {
  wrapper: string;
  specsName: string;
  pages: string[]; // absolute file paths
};

function pageFor(href: string): string {
  // "/items" -> "src/app/(app)/items/page.tsx"
  const segment = href.replace(/^\//, "");
  return resolve(APP_DIR, segment, "page.tsx");
}

const WRAPPER_CHECKS: WrapperCheck[] = [
  {
    wrapper: "Inventory",
    specsName: "INVENTORY_TAB_SPECS",
    pages: INVENTORY_TAB_SPECS.map((s) => pageFor(s.href)),
  },
  {
    wrapper: "Locations",
    specsName: "LOCATIONS_TAB_SPECS",
    pages: LOCATIONS_TAB_SPECS.map((s) => pageFor(s.href)),
  },
  {
    wrapper: "Orders",
    specsName: "ORDERS_TAB_SPECS",
    pages: ORDERS_TAB_SPECS.map((s) => pageFor(s.href)),
  },
  {
    wrapper: "Team",
    specsName: "TEAM_TAB_SPECS",
    pages: TEAM_TAB_SPECS.map((s) => pageFor(s.href)),
  },
  {
    wrapper: "Settings",
    specsName: "SETTINGS_TAB_SPECS",
    pages: SETTINGS_TAB_SPECS.map((s) => pageFor(s.href)),
  },
];

describe("v1.5 — every wrapper sub-page renders <WrapperTabs>", () => {
  const cases: Array<[string, string, string]> = [];
  for (const { wrapper, specsName, pages } of WRAPPER_CHECKS) {
    for (const p of pages) cases.push([wrapper, specsName, p]);
  }

  it.each(cases)(
    "%s landing at %s imports %s and renders <WrapperTabs>",
    (_wrapper, specsName, pagePath) => {
      const src = readFileSync(pagePath, "utf8");
      expect(src, `${pagePath} should import ${specsName}`).toMatch(
        new RegExp(`\\b${specsName}\\b`),
      );
      expect(src, `${pagePath} should render <WrapperTabs>`).toMatch(/<WrapperTabs\b/);
      expect(src, `${pagePath} should call resolveWrapperTabs(${specsName}`).toMatch(
        new RegExp(`resolveWrapperTabs\\(\\s*${specsName}\\b`),
      );
    },
  );
});

// ─── metaTitle alignment ─────────────────────────────────────────────

describe("v1.5 — landing metaTitles match sidebar wrapper labels", () => {
  const en = readFileSync(I18N_EN, "utf8");

  // Helper: scan a slice for its metaTitle value.
  function metaTitleOf(slice: string): string | undefined {
    // Match the first `metaTitle: "..."` inside the object started by
    // `<slice>: {` — the slices we care about all have metaTitle as
    // their first (or near-first) field, so a non-greedy scan is safe.
    const re = new RegExp(`\\b${slice}:\\s*\\{[^\\}]*?metaTitle:\\s*"([^"]+)"`, "s");
    const m = en.match(re);
    return m?.[1];
  }

  const cases: Array<{ slice: string; expectedTitle: string; sidebarLabel: string }> = [
    { slice: "items", expectedTitle: "Inventory", sidebarLabel: "Inventory" },
    { slice: "stockCounts", expectedTitle: "Counts", sidebarLabel: "Counts" },
    { slice: "purchaseOrders", expectedTitle: "Orders", sidebarLabel: "Orders" },
    { slice: "users", expectedTitle: "Team", sidebarLabel: "Team" },
  ];

  it.each(cases)(
    "$slice.metaTitle = '$expectedTitle' (matches sidebar label '$sidebarLabel')",
    ({ slice, expectedTitle, sidebarLabel }) => {
      const actual = metaTitleOf(slice);
      expect(actual, `${slice}.metaTitle not found in en.ts`).toBeDefined();
      expect(actual, `${slice}.metaTitle must match sidebar label`).toBe(expectedTitle);
      expect(actual, "must also equal sidebarLabel token").toBe(sidebarLabel);
    },
  );

  it("the 4 sidebar wrapper labels themselves are exactly the renamed terms", () => {
    // Guard against a future edit that quietly re-renames "Inventory"
    // back to "Items" in nav.ts — the metaTitle tests would still
    // pass against the new name, but the IA would drift.
    const primary = NAV_GROUPS.find((g) => g.id === "primary");
    const secondary = NAV_GROUPS.find((g) => g.id === "secondary");
    expect(primary).toBeDefined();
    expect(secondary).toBeDefined();

    const byId = new Map(
      [...(primary?.items ?? []), ...(secondary?.items ?? [])].map((i) => [i.id, i]),
    );
    expect(byId.get("inventory")?.fallbackLabel).toBe("Inventory");
    expect(byId.get("counts")?.fallbackLabel).toBe("Counts");
    expect(byId.get("orders")?.fallbackLabel).toBe("Orders");
    expect(byId.get("team")?.fallbackLabel).toBe("Team");
  });
});

// ─── Orphan routes ───────────────────────────────────────────────────

describe("v1.5 — every top-level (app) route is reachable from the sidebar", () => {
  // Global/standalone routes that intentionally don't belong to a
  // wrapper — they're reachable from the header, empty states, or the
  // onboarding flow, not the sidebar. If you add a new orphan route,
  // justify it in this list rather than hiding it.
  const ALLOW_LISTED: readonly string[] = [
    "scan", // header shortcut
    "search", // header search result page
    "onboarding", // first-run flow
    "organizations", // org picker
    "inventory", // reserved landing / status-change parent (no page.tsx today)
  ];

  function topLevelDirs(): string[] {
    return (
      readdirSync(APP_DIR)
        .filter((name) => {
          const full = resolve(APP_DIR, name);
          try {
            return statSync(full).isDirectory();
          } catch {
            return false;
          }
        })
        // Strip Next.js route groups like "(tabs)" — their children are
        // mounted at the parent; they aren't routes themselves.
        .filter((name) => !name.startsWith("(") && !name.startsWith("_"))
        // Only count directories that actually render a top-level page.
        // Directories containing only `actions.ts`, `layout.tsx`, or
        // deeper sub-pages aren't navigable top-level routes and don't
        // need sidebar coverage.
        .filter((name) => {
          const pageTsx = resolve(APP_DIR, name, "page.tsx");
          try {
            return statSync(pageTsx).isFile();
          } catch {
            return false;
          }
        })
    );
  }

  function itemHrefs(): string[] {
    return NAV_GROUPS.flatMap((g) => g.items).map((i) => i.href);
  }

  function itemPrefixes(): string[] {
    const prefixes: string[] = [];
    for (const g of NAV_GROUPS) {
      for (const item of g.items) {
        if (item.activePathPrefixes) prefixes.push(...item.activePathPrefixes);
      }
    }
    return prefixes;
  }

  const dirs = topLevelDirs();
  const hrefs = new Set(itemHrefs());
  const prefixes = new Set(itemPrefixes());

  it("there is at least one top-level directory scanned", () => {
    expect(dirs.length).toBeGreaterThan(10);
  });

  it.each(dirs)("'/%s' is either a sidebar item, a wrapper prefix, or allow-listed", (dir) => {
    const route = `/${dir}`;
    const reachable =
      hrefs.has(route) ||
      prefixes.has(route) ||
      [...prefixes].some((p) => p === route) ||
      ALLOW_LISTED.includes(dir);
    expect(
      reachable,
      `route ${route} isn't reachable from the sidebar — wire it into nav-config.ts or add to the v1.5 test allow-list`,
    ).toBe(true);
  });
});

// ─── Empty-state CTA hrefs ───────────────────────────────────────────

describe("v1.5 — EmptyState CTAs on landings point at canonical routes", () => {
  // Canonical route whitelist. If a landing empty state links somewhere
  // that isn't on this list, it's either a new page (add it) or a
  // stale/ghost route (fix it). We only check LANDINGS (page.tsx files
  // at the top of a wrapper family), since they're the ones most
  // likely to drift after an IA rename.
  const CANONICAL_PREFIXES: readonly string[] = [
    "/dashboard",
    "/items",
    "/warehouses",
    "/stock-counts",
    "/purchase-orders",
    "/reports",
    "/movements",
    "/categories",
    "/labels",
    "/pallets",
    "/kits",
    "/transfers",
    "/vehicles",
    "/suppliers",
    "/sales-orders",
    "/picks",
    "/users",
    "/departments",
    "/settings",
    "/audit",
    "/import",
    "/export",
    "/migrations",
    "/integrations",
    "/help",
    "/scan",
    "/search",
    "/inventory", // status-change subtree
    "/onboarding",
    "/organizations",
  ];

  // Collect unique wrapper-landing paths from the SPECS constants.
  const LANDINGS = Array.from(
    new Set(
      [
        ...INVENTORY_TAB_SPECS,
        ...LOCATIONS_TAB_SPECS,
        ...ORDERS_TAB_SPECS,
        ...TEAM_TAB_SPECS,
        ...SETTINGS_TAB_SPECS,
      ].map((s) => pageFor(s.href)),
    ),
  );

  function isCanonical(href: string): boolean {
    if (!href.startsWith("/")) return true; // external / anchor — ignore here
    return CANONICAL_PREFIXES.some(
      (p) => href === p || href.startsWith(`${p}/`) || href.startsWith(`${p}?`),
    );
  }

  it.each(LANDINGS)("%s EmptyState hrefs are canonical", (pagePath) => {
    const src = readFileSync(pagePath, "utf8");
    // Only scan blocks inside an <EmptyState …> JSX element. We grab
    // from `<EmptyState` up to the matching closing `/>` or
    // `</EmptyState>` and inspect href:"/..." occurrences inside.
    const blocks: string[] = [];
    const open = /<EmptyState\b/g;
    for (const match of src.matchAll(open)) {
      const start = match.index ?? 0;
      // Find the nearest terminator after `start`. Either self-close
      // `/>` or explicit close `</EmptyState>`.
      const selfCloseAt = src.indexOf("/>", start);
      const closeAt = src.indexOf("</EmptyState>", start);
      const candidates = [selfCloseAt, closeAt].filter((i) => i !== -1);
      if (candidates.length === 0) continue;
      const end = Math.min(...candidates);
      blocks.push(src.slice(start, end));
    }
    if (blocks.length === 0) return; // page doesn't use EmptyState — fine

    const offenders: string[] = [];
    for (const block of blocks) {
      const hrefs = [...block.matchAll(/href:\s*"([^"]+)"/g)].map((m) => m[1]);
      for (const h of hrefs) {
        if (!isCanonical(h)) offenders.push(h);
      }
    }
    expect(
      offenders,
      `${pagePath} EmptyState uses non-canonical route(s): ${offenders.join(", ")}`,
    ).toEqual([]);
  });
});

// ─── Back-link sanity for the /inventory wrapper ─────────────────────

describe("v1.5 — /inventory/status-change back-link goes to the primary landing", () => {
  it("back-link targets /items (not the empty /inventory shell)", () => {
    const p = resolve(APP_DIR, "inventory", "status-change", "page.tsx");
    const src = readFileSync(p, "utf8");
    // The page should link back to /items since /inventory has no
    // page.tsx (the Inventory wrapper is served by /items).
    expect(src).toMatch(/href="\/items"/);
    expect(src).not.toMatch(/href="\/inventory"(?!\/)/);
  });
});
