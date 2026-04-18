// P1-5 remediation test (audit v1.0 §5.10) — pins that the app shell
// queries are tag-cached and that the most critical mutation paths
// bust the cache.
//
// Background: the (app) layout used to run three DB queries on every
// server-rendered navigation (low-stock badge + 20 most recent
// notifications + unread count). Each is cheap on a warm DB but the
// layout re-renders dozens of times per session — wasted work that
// also stretches cold-render time on a freshly woken Vercel
// function.
//
// We wrap them in `unstable_cache` with per-org / per-user tags, and
// every mutation path that affects the cached values must call the
// matching `revalidate*` helper. This test pins:
//
//   1. The cache module exports the expected helpers and uses
//      `unstable_cache` + `revalidateTag`.
//   2. The (app) layout no longer queries the DB directly for these
//      values — it goes through the cache helpers.
//   3. The notification action file calls `revalidateNotifications`
//      after every mutation.
//   4. The item create / update / delete / import actions call
//      `revalidateLowStock` after each mutation.
//   5. The reorder-config action calls `revalidateLowStock` after
//      writing new thresholds.
//
// Source-level pinning (no module imports) so the test works without
// the Next.js server runtime / Prisma client.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../../..");

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

const CACHE_SOURCE = read("src/lib/cache/app-shell-cache.ts");
const LAYOUT_SOURCE = read("src/app/(app)/layout.tsx");
const NOTIFICATIONS_ACTIONS = read("src/app/(app)/notifications/actions.ts");
const ITEMS_ACTIONS = read("src/app/(app)/items/actions.ts");
const REORDER_ACTIONS = read("src/app/(app)/items/reorder-config/actions.ts");

describe("P1-5 — app-shell-cache module", () => {
  it("uses unstable_cache and revalidateTag from next/cache", () => {
    expect(CACHE_SOURCE).toMatch(
      /import\s*\{[^}]*\brevalidateTag\b[^}]*\bunstable_cache\b[^}]*\}\s*from\s*"next\/cache"/,
    );
  });

  it("exports getLowStockBadge / getNotificationData / revalidateLowStock / revalidateNotifications", () => {
    for (const name of [
      "getLowStockBadge",
      "getNotificationData",
      "revalidateLowStock",
      "revalidateNotifications",
    ]) {
      expect(CACHE_SOURCE).toMatch(new RegExp(`export\\s+(?:async\\s+)?function\\s+${name}\\b`));
    }
  });

  it("scopes cache tags by organization (low-stock) and by org+user (notifications)", () => {
    // Specific tag prefixes are part of the public contract — the
    // mutation paths assume them.
    expect(CACHE_SOURCE).toMatch(/`app-shell:low-stock:\$\{orgId\}`/);
    expect(CACHE_SOURCE).toMatch(/`app-shell:notifications:\$\{orgId\}:\$\{userId\}`/);
  });

  it("sets a finite TTL on each cache entry as a safety net", () => {
    // The TTL is the belt-and-suspenders — tags are the primary
    // invalidation. We only assert that *some* numeric revalidate
    // option is set on each unstable_cache call.
    const matches = CACHE_SOURCE.match(/revalidate:\s*\w+/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});

describe("P1-5 — (app)/layout.tsx is wired to the cache", () => {
  it("imports both cache helpers from app-shell-cache", () => {
    expect(LAYOUT_SOURCE).toMatch(
      /import\s*\{[^}]*\bgetLowStockBadge\b[^}]*\bgetNotificationData\b[^}]*\}\s*from\s*"@\/lib\/cache\/app-shell-cache"/,
    );
  });

  it("no longer queries db.item / db.notification directly", () => {
    // The previous inline queries are gone. We allow the symbol `db`
    // to appear in comments, but no live `db.item.findMany` or
    // `db.notification.findMany|count` may remain.
    expect(LAYOUT_SOURCE).not.toMatch(/db\.item\.findMany/);
    expect(LAYOUT_SOURCE).not.toMatch(/db\.notification\.findMany/);
    expect(LAYOUT_SOURCE).not.toMatch(/db\.notification\.count/);
  });

  it("runs the two cache reads in parallel", () => {
    // The new code awaits Promise.all([...getLowStockBadge..., ...getNotificationData...])
    expect(LAYOUT_SOURCE).toMatch(
      /Promise\.all\(\s*\[[\s\S]*getLowStockBadge[\s\S]*getNotificationData[\s\S]*\]\s*\)/,
    );
  });
});

describe("P1-5 — notification mutation paths bust the cache", () => {
  it("imports revalidateNotifications", () => {
    expect(NOTIFICATIONS_ACTIONS).toMatch(
      /import\s*\{[^}]*\brevalidateNotifications\b[^}]*\}\s*from\s*"@\/lib\/cache\/app-shell-cache"/,
    );
  });

  it("each of the three actions calls revalidateNotifications", () => {
    // markNotificationReadAction, markAllNotificationsReadAction,
    // dismissAlertAction — count should be at least 3.
    const calls = NOTIFICATIONS_ACTIONS.match(/revalidateNotifications\s*\(/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(3);
  });
});

describe("P1-5 — item mutation paths bust the low-stock cache", () => {
  it("items/actions.ts imports revalidateLowStock", () => {
    expect(ITEMS_ACTIONS).toMatch(
      /import\s*\{[^}]*\brevalidateLowStock\b[^}]*\}\s*from\s*"@\/lib\/cache\/app-shell-cache"/,
    );
  });

  it("create / update / delete / import all call revalidateLowStock", () => {
    // 4 mutation entry points → at least 4 revalidate calls.
    const calls = ITEMS_ACTIONS.match(/revalidateLowStock\s*\(/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(4);
  });

  it("reorder-config/actions.ts also busts the low-stock cache", () => {
    expect(REORDER_ACTIONS).toMatch(
      /import\s*\{[^}]*\brevalidateLowStock\b[^}]*\}\s*from\s*"@\/lib\/cache\/app-shell-cache"/,
    );
    expect(REORDER_ACTIONS).toMatch(/revalidateLowStock\s*\(\s*membership\.organizationId\s*\)/);
  });
});
