// v1.2 P3 §5.43 — Performance budget pin.
//
// The audit flagged that a bundle or perf regression could ship
// silently: `@next/bundle-analyzer` was present, but no CI budget
// was declared and no Lighthouse thresholds lived in the repo. This
// batch lands the two configuration artefacts:
//
//   1. `size-limit` array in package.json — gzipped JS budgets for
//      the Next.js static chunks. Once `size-limit` is installed as
//      a devDep and wired into CI, the first run sets a baseline
//      and subsequent PRs show deltas.
//   2. `.lighthouserc.json` — core-web-vitals thresholds (FCP, LCP,
//      CLS, TBT, TTI) plus Lighthouse category floors. Designed to
//      be picked up by `npx @lhci/cli autorun` in a scheduled CI
//      workflow.
//
// This test doesn't actually run size-limit or Lighthouse — it
// pins the config shape so a drive-by "cleanup" can't delete the
// budget and a tightening of thresholds remains a deliberate edit.
//
// When the CI wiring lands (a follow-up PR installs the devDeps
// and adds the workflow job), the real enforcement happens there.
// This test is the "the budget exists and is sane" tripwire.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..");

function readJson<T = unknown>(rel: string): T {
  return JSON.parse(readFileSync(join(REPO_ROOT, rel), "utf8")) as T;
}

// ──────────────────────────────────────────────────────────────────
// 1. package.json — size-limit array
// ──────────────────────────────────────────────────────────────────

type SizeLimitEntry = {
  name?: string;
  path: string | string[];
  limit: string;
  gzip?: boolean;
  ignore?: string[];
};

const pkg = readJson<{ "size-limit"?: SizeLimitEntry[] }>("package.json");

describe("§5.43 — package.json declares a size-limit budget", () => {
  it("size-limit field is a non-empty array", () => {
    expect(Array.isArray(pkg["size-limit"])).toBe(true);
    expect(pkg["size-limit"]?.length ?? 0).toBeGreaterThan(0);
  });

  it("every entry declares a path and a limit", () => {
    for (const entry of pkg["size-limit"] ?? []) {
      expect(entry.path, `entry missing path: ${JSON.stringify(entry)}`).toBeTruthy();
      expect(entry.limit, `entry missing limit: ${JSON.stringify(entry)}`).toMatch(
        /^\s*\d+(?:\.\d+)?\s*(?:B|KB|MB)\s*$/i,
      );
    }
  });

  it("at least one entry targets the Next.js framework bundle", () => {
    // Pin the shape that matters — if someone drops this entry the
    // main thing the budget is meant to catch (React/Next upgrades
    // that add weight) goes uncovered.
    const entries = pkg["size-limit"] ?? [];
    const hasFramework = entries.some((e) => {
      const paths = Array.isArray(e.path) ? e.path : [e.path];
      return paths.some((p) => p.includes("framework"));
    });
    expect(hasFramework, "size-limit must cover framework-*.js chunk").toBe(true);
  });

  it("at least one entry targets the main app chunk", () => {
    const entries = pkg["size-limit"] ?? [];
    const hasMain = entries.some((e) => {
      const paths = Array.isArray(e.path) ? e.path : [e.path];
      return paths.some((p) => p.includes("main"));
    });
    expect(hasMain, "size-limit must cover main-*.js chunk").toBe(true);
  });

  it("budgets are measured gzipped (network reality, not disk)", () => {
    // Uncompressed sizes are misleading for perf. Force the gzip
    // flag on every chunk so the numbers match what users download.
    for (const entry of pkg["size-limit"] ?? []) {
      expect(entry.gzip, `entry ${entry.name ?? entry.path} must set gzip: true`).toBe(true);
    }
  });
});

// ──────────────────────────────────────────────────────────────────
// 2. .lighthouserc.json — core-web-vitals assertions
// ──────────────────────────────────────────────────────────────────

type LhAssertion = [string, { maxNumericValue?: number; minScore?: number }] | "off" | "warn";
type LhConfig = {
  ci?: {
    collect?: { url?: string[]; numberOfRuns?: number };
    assert?: { assertions?: Record<string, LhAssertion> };
  };
};

const lhci = readJson<LhConfig>(".lighthouserc.json");

describe("§5.43 — .lighthouserc.json declares perf thresholds", () => {
  const assertions = lhci.ci?.assert?.assertions ?? {};

  it("collects at least one URL", () => {
    const urls = lhci.ci?.collect?.url ?? [];
    expect(urls.length).toBeGreaterThan(0);
  });

  it("declares maxNumericValue for first-contentful-paint", () => {
    const a = assertions["first-contentful-paint"];
    expect(Array.isArray(a)).toBe(true);
    if (Array.isArray(a)) {
      expect(a[1]?.maxNumericValue).toBeGreaterThan(0);
    }
  });

  it("declares maxNumericValue for largest-contentful-paint", () => {
    const a = assertions["largest-contentful-paint"];
    expect(Array.isArray(a)).toBe(true);
    if (Array.isArray(a)) {
      expect(a[1]?.maxNumericValue).toBeGreaterThan(0);
    }
  });

  it("declares maxNumericValue for cumulative-layout-shift", () => {
    const a = assertions["cumulative-layout-shift"];
    expect(Array.isArray(a)).toBe(true);
    if (Array.isArray(a)) {
      // CLS is a ratio, not ms — expect a small number, not zero.
      expect(a[1]?.maxNumericValue).toBeGreaterThan(0);
      expect(a[1]?.maxNumericValue).toBeLessThanOrEqual(0.25);
    }
  });

  it("declares a minScore for the accessibility category", () => {
    // §5.40 pinned contrast; the Lighthouse a11y category catches
    // the other cheap wins (alt text, label-for, heading order).
    const a = assertions["categories:accessibility"];
    expect(Array.isArray(a)).toBe(true);
    if (Array.isArray(a)) {
      expect(a[1]?.minScore).toBeGreaterThanOrEqual(0.9);
    }
  });
});
