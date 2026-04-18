// v1.2 P2 §5.37 — Marketing-page SEO metadata pin.
//
// The audit flagged "OG/Twitter metadata sparse — 3 pages only".
// Before remediation, 10 marketing pages exported a bare
// `{ title, description }` Metadata literal. Social unfurls fell
// through to the root layout's generic `summary` card — a LinkedIn
// share of `/docs/warehouses` and `/docs/reports` showed the same
// preview as the landing page.
//
// The remediation introduces `buildMarketingMetadata({ title,
// description, path })` which emits the full OG (type, siteName, url,
// title, description) + Twitter (card: summary_large_image, title,
// description) + canonical-url block. This test pins two things:
//
//  1. Helper contract (unit) — dedup suffix, resolve canonical URL,
//     emit both og+twitter blocks, summary_large_image card.
//  2. Usage contract (static analysis) — every marketing `page.tsx`
//     under `src/app/(marketing)/`, plus the root landing page at
//     `src/app/page.tsx`, routes through the helper. A regression —
//     someone re-adding a bare `{ title, description }` literal —
//     would fail here loudly before shipping to production.
//
// We intentionally avoid JSDOM or a Next.js test harness. This is a
// static-analysis pin — we read the helper via direct import and we
// read page.tsx source with `fs.readFileSync`. No Prisma, no DB, no
// network. Fast and deterministic.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { buildMarketingMetadata } from "./seo/marketing-metadata";

// ---------------------------------------------------------------------------
// 1. Helper contract
// ---------------------------------------------------------------------------

describe("buildMarketingMetadata — title handling", () => {
  it("appends ' — OneAce' when the brand is absent", () => {
    const meta = buildMarketingMetadata({
      title: "Getting started",
      description: "x",
      path: "/docs/getting-started",
    });
    expect(meta.title).toBe("Getting started — OneAce");
    // Twitter + OG must reflect the same full title so unfurls match
    // the HTML <title> the search result shows.
    expect((meta.openGraph as { title?: string }).title).toBe("Getting started — OneAce");
    expect((meta.twitter as { title?: string }).title).toBe("Getting started — OneAce");
  });

  it("does not double-append when the title already ends with ' — OneAce'", () => {
    const meta = buildMarketingMetadata({
      title: "Pricing — OneAce",
      description: "x",
      path: "/pricing",
    });
    expect(meta.title).toBe("Pricing — OneAce");
    expect((meta.openGraph as { title?: string }).title).toBe("Pricing — OneAce");
  });

  it("does not append when the title already starts with 'OneAce ' (leading brand)", () => {
    // Landing page shape: `OneAce — Inventory Management…`. Appending
    // the suffix would produce `OneAce — Inventory Management — OneAce`
    // which shows up badly in unfurls.
    const meta = buildMarketingMetadata({
      title: "OneAce — Inventory Management for Growing Businesses",
      description: "x",
      path: "/",
    });
    expect(meta.title).toBe("OneAce — Inventory Management for Growing Businesses");
  });

  it("still appends when the title contains the brand only as a substring (e.g. OneAce2)", () => {
    // Guard against over-eager matching. A title like "OneAce2"
    // should not suppress the suffix, because it's not the brand.
    const meta = buildMarketingMetadata({
      title: "OneAce2 integrations",
      description: "x",
      path: "/x",
    });
    expect(meta.title).toBe("OneAce2 integrations — OneAce");
  });
});

describe("buildMarketingMetadata — canonical URL resolution", () => {
  // `vi.stubEnv` / `vi.unstubAllEnvs` keeps env mutation scoped to the
  // test (biome's `noDelete` rule disallows `delete process.env.X`,
  // and plain assignment to `undefined` stores the string "undefined"
  // in Node's env map — both approaches are wrong here). The stub
  // helper is the right primitive for "temporarily set env, then
  // restore" in vitest.
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("emits the raw path when NEXT_PUBLIC_APP_URL is unset (dev-safe)", () => {
    // `stubEnv(..., "")` is how vitest models an unset variable —
    // the helper reads `process.env.NEXT_PUBLIC_APP_URL?.trim()` so
    // an empty string behaves the same as absent.
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    const meta = buildMarketingMetadata({
      title: "Pricing — OneAce",
      description: "x",
      path: "/pricing",
    });
    expect(meta.alternates?.canonical).toBe("/pricing");
    expect((meta.openGraph as { url?: string }).url).toBe("/pricing");
  });

  it("emits an absolute URL when NEXT_PUBLIC_APP_URL is set", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://oneace.app");
    const meta = buildMarketingMetadata({
      title: "Pricing — OneAce",
      description: "x",
      path: "/pricing",
    });
    expect(meta.alternates?.canonical).toBe("https://oneace.app/pricing");
    expect((meta.openGraph as { url?: string }).url).toBe("https://oneace.app/pricing");
  });

  it("trims a trailing slash on origin so we never emit '//'", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://oneace.app/");
    const meta = buildMarketingMetadata({
      title: "Docs — OneAce",
      description: "x",
      path: "/docs",
    });
    expect(meta.alternates?.canonical).toBe("https://oneace.app/docs");
  });

  it("normalises a path without a leading slash", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://oneace.app");
    // Callers _should_ pass a leading slash, but we guard against
    // a future typo collapsing the origin into a bare hostname.
    const meta = buildMarketingMetadata({
      title: "Docs — OneAce",
      description: "x",
      path: "docs",
    });
    expect(meta.alternates?.canonical).toBe("https://oneace.app/docs");
  });
});

describe("buildMarketingMetadata — shape contract", () => {
  it("emits a summary_large_image twitter card (not the root-layout default 'summary')", () => {
    // The root layout exports `twitter.card = 'summary'`. Marketing
    // pages intentionally upgrade to the larger card so doc/legal
    // unfurls use the full preview slot once per-page images ship.
    const meta = buildMarketingMetadata({
      title: "Docs — OneAce",
      description: "x",
      path: "/docs",
    });
    expect((meta.twitter as { card?: string }).card).toBe("summary_large_image");
  });

  it("emits a website-typed openGraph block with siteName 'OneAce'", () => {
    const meta = buildMarketingMetadata({
      title: "Docs — OneAce",
      description: "x",
      path: "/docs",
    });
    const og = meta.openGraph as { type?: string; siteName?: string };
    expect(og.type).toBe("website");
    expect(og.siteName).toBe("OneAce");
  });

  it("preserves the caller-supplied description verbatim on all three surfaces", () => {
    const description = "Run stock counts offline with multiple operators.";
    const meta = buildMarketingMetadata({
      title: "Stock counts — OneAce Docs",
      description,
      path: "/docs/stock-counts",
    });
    expect(meta.description).toBe(description);
    expect((meta.openGraph as { description?: string }).description).toBe(description);
    expect((meta.twitter as { description?: string }).description).toBe(description);
  });
});

// ---------------------------------------------------------------------------
// 2. Usage contract — every public marketing page must route through the helper
// ---------------------------------------------------------------------------
//
// The list below is the _complete_ set of public marketing entry points
// at the time of §5.37 closure. If a new page is added under
// `src/app/(marketing)/` without being registered here, a developer is
// free to add the path — but forgetting the helper wiring will surface
// on the file content check below.
//
// We do NOT use `fs.readdirSync` to auto-discover files, because that
// would let a new page land without the author being forced to think
// about metadata. Explicit registry forces the author to touch this
// test, which prompts the helper call.

const REPO_ROOT = join(__dirname, "..", "..");

const MARKETING_PAGES = [
  // Root landing page — lives outside the (marketing) route group but
  // is conceptually a marketing page and ships the same metadata shape.
  "src/app/page.tsx",
  "src/app/(marketing)/pricing/page.tsx",
  "src/app/(marketing)/docs/page.tsx",
  "src/app/(marketing)/docs/getting-started/page.tsx",
  "src/app/(marketing)/docs/warehouses/page.tsx",
  "src/app/(marketing)/docs/permissions/page.tsx",
  "src/app/(marketing)/docs/scanning/page.tsx",
  "src/app/(marketing)/docs/stock-counts/page.tsx",
  "src/app/(marketing)/docs/purchase-orders/page.tsx",
  "src/app/(marketing)/docs/reports/page.tsx",
  "src/app/(marketing)/legal/privacy/page.tsx",
  "src/app/(marketing)/legal/terms/page.tsx",
] as const;

function readPageSource(relPath: string): string {
  return readFileSync(join(REPO_ROOT, relPath), "utf8");
}

describe("marketing pages — all route metadata through buildMarketingMetadata", () => {
  for (const relPath of MARKETING_PAGES) {
    describe(relPath, () => {
      const src = readPageSource(relPath);

      it("imports buildMarketingMetadata from the shared helper", () => {
        expect(
          src,
          `${relPath} must import buildMarketingMetadata — bare { title, description } Metadata literals were the audit §5.37 regression`,
        ).toMatch(
          /import\s*\{\s*buildMarketingMetadata\s*\}\s*from\s*["']@\/lib\/seo\/marketing-metadata["']/,
        );
      });

      it("calls buildMarketingMetadata(...) when declaring metadata", () => {
        // Accept either `export const metadata: Metadata = buildMarketingMetadata(`
        // or a (future) generateMetadata wrapper that returns the
        // helper output.
        expect(
          src,
          `${relPath} imports the helper but doesn't call it — metadata must use buildMarketingMetadata`,
        ).toMatch(/buildMarketingMetadata\s*\(/);
      });

      it("does not declare a bare `{ title, description }` Metadata literal", () => {
        // Catches a regression where someone re-introduces the sparse
        // pattern alongside the helper call. We look for a Metadata
        // literal that declares `title:` without any openGraph/twitter.
        // The helper call itself contains `title:` as an object key too,
        // so we anchor on `: Metadata = {` which is the old pattern.
        const hasBareLiteral = /:\s*Metadata\s*=\s*\{\s*\n\s*title:/.test(src);
        expect(
          hasBareLiteral,
          `${relPath} still declares a bare Metadata literal — replace with buildMarketingMetadata(...)`,
        ).toBe(false);
      });
    });
  }
});

describe("marketing pages registry — completeness guard", () => {
  it("covers at least 12 pages (1 landing + 1 pricing + 7 docs + 2 legal + docs index = 12)", () => {
    // Hard floor: if someone deletes an entry, the count drops and
    // this trips. If someone adds a marketing page without
    // registering it here, the new file won't be covered — the
    // CLAUDE.md protocol + code review catches that.
    expect(MARKETING_PAGES.length).toBeGreaterThanOrEqual(12);
  });

  it("lists each page exactly once", () => {
    const seen = new Set<string>();
    for (const p of MARKETING_PAGES) {
      expect(seen.has(p), `duplicate entry: ${p}`).toBe(false);
      seen.add(p);
    }
  });
});
