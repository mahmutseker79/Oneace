// P1-4 remediation test (audit v1.0 §5.9) — pins that the desktop
// sidebar and the mobile nav both render from the canonical
// `NAV_GROUPS` config, so they can't drift again.
//
// Background: the previous mobile nav silently omitted Dashboard,
// Migrations, Integrations, Vehicles, and Pallets — items users on
// phones literally couldn't reach. The fix extracted the nav data
// into `nav-config.ts` and made both surfaces consume it.
//
// This test:
//   1. Imports the config directly (no Next.js runtime dependency)
//      and confirms every page that should be in the nav is.
//   2. Reads `sidebar.tsx` and `mobile-nav.tsx` source and pins
//      that each imports `NAV_GROUPS`/`visibleGroups` and no longer
//      hardcodes its own NavItem arrays.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { NAV_GROUPS, visibleGroups } from "./nav-config";

const SHELL_DIR = resolve(__dirname);

const SIDEBAR_SOURCE = readFileSync(resolve(SHELL_DIR, "sidebar.tsx"), "utf8");
const MOBILE_SOURCE = readFileSync(resolve(SHELL_DIR, "mobile-nav.tsx"), "utf8");

// Pages that MUST appear in the canonical nav. These are the items
// the audit identified as "missing on mobile" plus the always-on
// core pages — together they form the parity contract.
const REQUIRED_HREFS = [
  "/dashboard",
  "/items",
  "/warehouses",
  "/stock-counts",
  "/categories",
  "/suppliers",
  "/purchase-orders",
  "/labels",
  "/pallets",
  "/scan",
  "/movements",
  "/transfers",
  "/departments",
  "/inventory/status-change",
  "/vehicles",
  "/sales-orders",
  "/kits",
  "/picks",
  "/reports",
  "/import",
  "/export",
  "/migrations",
  "/users",
  "/audit",
  "/integrations",
  "/settings",
] as const;

function allHrefs(): string[] {
  return NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
}

describe("P1-4 — canonical NAV_GROUPS is the source of truth", () => {
  it.each(REQUIRED_HREFS)("includes %s", (href) => {
    expect(allHrefs()).toContain(href);
  });

  it("each item id is unique within the config", () => {
    const ids = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.id));
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("each group id is unique", () => {
    const ids = NAV_GROUPS.map((g) => g.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("each href is unique across the whole nav", () => {
    const hrefs = allHrefs();
    const unique = new Set(hrefs);
    expect(unique.size).toBe(hrefs.length);
  });

  it("collapsible/admin groups declare activePathPrefixes", () => {
    for (const g of NAV_GROUPS) {
      if (g.mode === "collapsible" || g.mode === "admin") {
        expect(g.activePathPrefixes, `group ${g.id} needs activePathPrefixes`).toBeDefined();
        expect(g.activePathPrefixes?.length ?? 0).toBeGreaterThan(0);
      }
    }
  });
});

describe("P1-4 — visibleGroups gates the admin section", () => {
  it("hides the admin group when showAdmin is false", () => {
    const hidden = visibleGroups(false);
    expect(hidden.find((g) => g.id === "admin")).toBeUndefined();
  });

  it("includes the admin group when showAdmin is true", () => {
    const shown = visibleGroups(true);
    expect(shown.find((g) => g.id === "admin")).toBeDefined();
  });

  it("returns the same non-admin groups in both modes (order preserved)", () => {
    const hiddenIds = visibleGroups(false).map((g) => g.id);
    const shownIds = visibleGroups(true)
      .filter((g) => g.mode !== "admin")
      .map((g) => g.id);
    expect(hiddenIds).toEqual(shownIds);
  });
});

describe("P1-4 — sidebar.tsx (desktop) renders from the config", () => {
  it("imports NAV_GROUPS / visibleGroups from ./nav-config", () => {
    expect(SIDEBAR_SOURCE).toMatch(
      /import\s*\{[\s\S]*?\bvisibleGroups\b[\s\S]*?\}\s*from\s*"\.\/nav-config"/,
    );
  });

  it("does not declare its own hardcoded href arrays", () => {
    // Spot-check a few hrefs that used to be inline. They may still
    // appear in the rendered output via labels, but no plain
    // string literal `"/items"` etc. should be present.
    const offenders = ["/dashboard", "/items", "/warehouses", "/migrations", "/integrations"];
    for (const href of offenders) {
      expect(
        SIDEBAR_SOURCE.includes(`"${href}"`),
        `sidebar.tsx should not hardcode ${href} — pull it from nav-config`,
      ).toBe(false);
    }
  });
});

describe("P1-4 — mobile-nav.tsx renders from the config", () => {
  it("imports NAV_GROUPS / visibleGroups from ./nav-config", () => {
    expect(MOBILE_SOURCE).toMatch(
      /import\s*\{[\s\S]*?\bvisibleGroups\b[\s\S]*?\}\s*from\s*"\.\/nav-config"/,
    );
  });

  it("no longer hardcodes the missing pages (regression guard)", () => {
    // The audit's exact symptom: these hrefs were missing from
    // the mobile nav. They MUST come from the shared config now,
    // so no hardcoded literals should exist.
    const offenders = ["/dashboard", "/migrations", "/integrations", "/vehicles", "/pallets"];
    for (const href of offenders) {
      expect(
        MOBILE_SOURCE.includes(`"${href}"`),
        `mobile-nav.tsx should not hardcode ${href} — pull it from nav-config`,
      ).toBe(false);
    }
  });

  it("imports the SidebarLabels type from the shared module", () => {
    expect(MOBILE_SOURCE).toMatch(
      /import\s+type\s*\{\s*SidebarLabels\s*\}\s*from\s*"\.\/sidebar-labels"/,
    );
  });
});
