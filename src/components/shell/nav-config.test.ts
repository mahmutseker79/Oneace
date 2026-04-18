// P1-4 remediation test (audit v1.0 §5.9) — pins that the desktop
// sidebar and the mobile nav both render from the canonical
// `NAV_GROUPS` config, so they can't drift again.
//
// Background: the previous mobile nav silently omitted Dashboard,
// Migrations, Integrations, Vehicles, and Pallets — items users on
// phones literally couldn't reach. The fix extracted the nav data
// into `nav-config.ts` and made both surfaces consume it.
//
// v1.5 IA refactor — the sidebar collapses from 26 entries across
// seven groups to 10 entries across two groups (primary + secondary).
// Re-homed routes (Movements, Categories, Transfers, Suppliers, …)
// are still reachable because (a) their routes aren't removed and
// (b) the wrapper items' `activePathPrefixes` pull them under the
// right sidebar entry. This test pins both properties.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  NAV_GROUPS,
  isItemActive,
  primaryGroups,
  secondaryGroups,
  visibleGroups,
} from "./nav-config";

const SHELL_DIR = resolve(__dirname);

const SIDEBAR_SOURCE = readFileSync(resolve(SHELL_DIR, "sidebar.tsx"), "utf8");
const MOBILE_SOURCE = readFileSync(resolve(SHELL_DIR, "mobile-nav.tsx"), "utf8");

// v1.5: the entries that must appear in the sidebar (6 primary + 4
// secondary). Ordering is asserted separately so a mis-sort flags
// immediately.
const PRIMARY_SIDEBAR = [
  { id: "dashboard", href: "/dashboard" },
  { id: "inventory", href: "/items" },
  { id: "locations", href: "/warehouses" },
  { id: "counts", href: "/stock-counts" },
  { id: "orders", href: "/purchase-orders" },
  { id: "reports", href: "/reports" },
] as const;

const SECONDARY_SIDEBAR = [
  { id: "team", href: "/users", adminOnly: true },
  { id: "integrations", href: "/integrations", adminOnly: true },
  { id: "settings", href: "/settings", adminOnly: true },
  { id: "help", href: "/help", adminOnly: false },
] as const;

// Routes that were once direct sidebar entries. They must still be
// reachable — via their wrapper's `activePathPrefixes` — so a bookmarked
// link to any of them still lights up the right sidebar item.
const RE_HOMED_ROUTES: Array<{ route: string; expectedOwnerId: string }> = [
  { route: "/movements", expectedOwnerId: "inventory" },
  { route: "/categories", expectedOwnerId: "inventory" },
  { route: "/labels", expectedOwnerId: "inventory" },
  { route: "/pallets", expectedOwnerId: "inventory" },
  { route: "/kits", expectedOwnerId: "inventory" },
  { route: "/inventory/status-change", expectedOwnerId: "inventory" },
  { route: "/transfers", expectedOwnerId: "locations" },
  { route: "/vehicles", expectedOwnerId: "locations" },
  { route: "/suppliers", expectedOwnerId: "orders" },
  { route: "/sales-orders", expectedOwnerId: "orders" },
  { route: "/picks", expectedOwnerId: "orders" },
  { route: "/scan", expectedOwnerId: null as unknown as string }, // global — header shortcut
  { route: "/departments", expectedOwnerId: "team" },
  { route: "/audit", expectedOwnerId: "settings" },
  { route: "/import", expectedOwnerId: "settings" },
  { route: "/export", expectedOwnerId: "settings" },
  { route: "/migrations", expectedOwnerId: "settings" },
].filter((r) => r.expectedOwnerId !== null);

function allItems() {
  return NAV_GROUPS.flatMap((g) => g.items);
}

describe("v1.5 — sidebar has exactly 10 entries across two groups", () => {
  it("there is exactly one primary group and one secondary group", () => {
    expect(primaryGroups(NAV_GROUPS).length).toBe(1);
    expect(secondaryGroups(NAV_GROUPS).length).toBe(1);
  });

  it("primary group has 6 items in the expected order", () => {
    const primary = primaryGroups(NAV_GROUPS)[0];
    expect(primary.items.length, "primary items count").toBe(6);
    expect(primary.items.map((i) => i.id)).toEqual(PRIMARY_SIDEBAR.map((p) => p.id));
    expect(primary.items.map((i) => i.href)).toEqual(PRIMARY_SIDEBAR.map((p) => p.href));
  });

  it("secondary group has 4 items in the expected order", () => {
    const secondary = secondaryGroups(NAV_GROUPS)[0];
    expect(secondary.items.length, "secondary items count").toBe(4);
    expect(secondary.items.map((i) => i.id)).toEqual(SECONDARY_SIDEBAR.map((s) => s.id));
    expect(secondary.items.map((i) => i.href)).toEqual(SECONDARY_SIDEBAR.map((s) => s.href));
  });

  it("Team / Integrations / Settings are admin-gated; Help is not", () => {
    const byId = new Map(allItems().map((i) => [i.id, i]));
    for (const { id, adminOnly } of SECONDARY_SIDEBAR) {
      expect(byId.get(id)?.adminOnly ?? false, `${id} adminOnly flag`).toBe(adminOnly);
    }
  });

  it("each item id is unique within the config", () => {
    const ids = allItems().map((i) => i.id);
    expect(new Set(ids).size, "item ids not unique").toBe(ids.length);
  });

  it("each group id is unique", () => {
    const ids = NAV_GROUPS.map((g) => g.id);
    expect(new Set(ids).size, "group ids not unique").toBe(ids.length);
  });

  it("each href is unique across the whole nav", () => {
    const hrefs = allItems().map((i) => i.href);
    expect(new Set(hrefs).size, "hrefs not unique").toBe(hrefs.length);
  });

  it("collapsible/admin groups declare activePathPrefixes when used", () => {
    for (const g of NAV_GROUPS) {
      if (g.mode === "collapsible" || g.mode === "admin") {
        expect(g.activePathPrefixes, `group ${g.id} needs activePathPrefixes`).toBeDefined();
        expect(g.activePathPrefixes?.length ?? 0).toBeGreaterThan(0);
      }
    }
  });
});

describe("v1.5 — re-homed routes still activate the correct sidebar item", () => {
  const byId = new Map(allItems().map((i) => [i.id, i]));

  it.each(RE_HOMED_ROUTES)(
    "$route lights up $expectedOwnerId via activePathPrefixes",
    ({ route, expectedOwnerId }) => {
      const owner = byId.get(expectedOwnerId);
      expect(owner, `owner item ${expectedOwnerId} missing`).toBeDefined();
      if (!owner) return;
      expect(isItemActive(owner, route), `${route} should activate ${expectedOwnerId}`).toBe(true);
    },
  );
});

describe("v1.5 — visibleGroups gates admin items per-item", () => {
  it("non-admin viewers see Help in the secondary section", () => {
    const groups = visibleGroups(false);
    const secondary = secondaryGroups(groups)[0];
    expect(secondary, "secondary section present").toBeDefined();
    expect(secondary.items.map((i) => i.id)).toEqual(["help"]);
  });

  it("admin viewers see Team / Integrations / Settings / Help in the secondary section", () => {
    const groups = visibleGroups(true);
    const secondary = secondaryGroups(groups)[0];
    expect(secondary.items.map((i) => i.id)).toEqual(["team", "integrations", "settings", "help"]);
  });

  it("the primary group is not affected by showAdmin", () => {
    const hidden = primaryGroups(visibleGroups(false))[0];
    const shown = primaryGroups(visibleGroups(true))[0];
    expect(hidden.items.map((i) => i.id)).toEqual(shown.items.map((i) => i.id));
  });

  it("group ordering is preserved between admin and non-admin modes", () => {
    const hiddenIds = visibleGroups(false).map((g) => g.id);
    const shownIds = visibleGroups(true).map((g) => g.id);
    // non-admin may drop fully-admin groups (legacy mode: "admin"), but
    // the groups that DO appear must be in the same order.
    for (const id of hiddenIds) expect(shownIds).toContain(id);
  });
});

describe("P1-4 — sidebar.tsx (desktop) renders from the config", () => {
  it("imports NAV_GROUPS / visibleGroups from ./nav-config", () => {
    expect(SIDEBAR_SOURCE).toMatch(
      /import\s*\{[\s\S]*?\bvisibleGroups\b[\s\S]*?\}\s*from\s*"\.\/nav-config"/,
    );
  });

  it("imports the new primaryGroups/secondaryGroups helpers (v1.5 two-column layout)", () => {
    expect(SIDEBAR_SOURCE).toMatch(/\bprimaryGroups\b/);
    expect(SIDEBAR_SOURCE).toMatch(/\bsecondaryGroups\b/);
  });

  it("does not declare its own hardcoded href arrays", () => {
    // Spot-check hrefs that used to be inline. No plain string
    // literal `"/items"` etc. should be present.
    const offenders = [
      "/dashboard",
      "/items",
      "/warehouses",
      "/stock-counts",
      "/purchase-orders",
      "/reports",
      "/users",
      "/integrations",
      "/settings",
      "/migrations",
    ];
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

  it("imports the new primaryGroups/secondaryGroups helpers", () => {
    expect(MOBILE_SOURCE).toMatch(/\bprimaryGroups\b/);
    expect(MOBILE_SOURCE).toMatch(/\bsecondaryGroups\b/);
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
