/**
 * P2-2 (audit v1.0 §5.18) — pin the service worker precache list
 * against the actual filesystem so it can't drift again.
 *
 * History: early drafts of `public/sw.js` precached `/items` and
 * `/po/new`. Those routes have since been moved under
 * `/inventory/*` and `/purchasing/*`, and the old entries were
 * quietly dropped in PWA Sprints 3 / 6 / 7. The audit caught a
 * lingering mismatch, and this test is the guard against the next
 * one: every URL in `PRECACHE_URLS` must resolve to either
 *
 *   (a) a real file under `public/`, or
 *   (b) a page route under `src/app/…/page.tsx`
 *
 * If someone later adds `/offline/purchasing` to the precache list
 * without creating the corresponding route, this test fails before
 * the PR merges — which is preferable to learning about the stale
 * entry after the first install fetches a 404 into the cache.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const SW_PATH = join(process.cwd(), "public/sw.js");
const sw = readFileSync(SW_PATH, "utf8");

/** Pull the `PRECACHE_URLS` array literal out of the worker source. */
function extractPrecacheUrls(source: string): string[] {
  const match = source.match(/const\s+PRECACHE_URLS\s*=\s*\[([\s\S]*?)\]/);
  if (!match) throw new Error("PRECACHE_URLS array not found in sw.js");
  const body = match[1] ?? "";
  return Array.from(body.matchAll(/"([^"]+)"/g), (m) => m[1] as string);
}

function resolvesToAsset(url: string): boolean {
  if (url.startsWith("/offline")) {
    // App-router route — expect a page.tsx at src/app/<url>/page.tsx.
    const routePath = join(process.cwd(), "src/app", url, "page.tsx");
    return existsSync(routePath);
  }
  // Static asset — expect a file directly under public/.
  const assetPath = join(process.cwd(), "public", url);
  return existsSync(assetPath);
}

describe("service worker precache list (§5.18)", () => {
  const urls = extractPrecacheUrls(sw);

  it("parses a non-empty list", () => {
    expect(urls.length).toBeGreaterThan(0);
  });

  it.each(urls)("precache entry %s resolves to a real asset or route", (url) => {
    expect(resolvesToAsset(url)).toBe(true);
  });

  it("does not reference the pre-audit stale routes", () => {
    // Defensive: the two routes the audit flagged must never be
    // re-introduced — they no longer exist as public-facing pages
    // and would cache 404s on install.
    expect(urls).not.toContain("/items");
    expect(urls).not.toContain("/po/new");
  });

  it("does not reference other known-renamed ancestors", () => {
    // /po/* moved under /purchasing/*, /items/* moved under
    // /inventory/*. A precache entry that starts with /po/ or
    // bare /items/ (not /offline/items) is therefore stale by
    // construction.
    for (const url of urls) {
      expect(url.startsWith("/po/")).toBe(false);
      if (url.startsWith("/items/")) {
        // Only `/offline/items*` is allowed — flat /items/* is legacy.
        expect(url.startsWith("/offline/")).toBe(true);
      }
    }
  });
});
