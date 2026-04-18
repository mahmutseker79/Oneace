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
// The CI wiring (`.github/workflows/perf-budget.yml`) + the
// `size-limit` / `@lhci/cli` devDeps have now landed. The bottom
// describe blocks pin their presence so the budget can't be
// silently de-enforced by dropping either half.

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

// ──────────────────────────────────────────────────────────────────
// 3. devDeps — size-limit + LHCI packages must be declared
// ──────────────────────────────────────────────────────────────────

type PackageJson = {
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const fullPkg = readJson<PackageJson>("package.json");

describe("§5.43 — size-limit and LHCI are wired as devDependencies", () => {
  // A config without a runner is a paperweight. Pin the tooling so
  // the workflow below has something to execute.

  it("size-limit is declared as a devDependency", () => {
    expect(fullPkg.devDependencies?.["size-limit"]).toBeDefined();
  });

  it("size-limit preset is declared as a devDependency", () => {
    // The preset-app plugin teaches size-limit how to read the
    // Next.js build output. Without it the CLI runs but reports 0 B
    // for every chunk.
    expect(fullPkg.devDependencies?.["@size-limit/preset-app"]).toBeDefined();
  });

  it("@lhci/cli is declared as a devDependency", () => {
    expect(fullPkg.devDependencies?.["@lhci/cli"]).toBeDefined();
  });

  it("package.json exposes a `size-limit` script", () => {
    expect(fullPkg.scripts?.["size-limit"]).toMatch(/size-limit/);
  });

  it("package.json exposes an `lhci` script", () => {
    expect(fullPkg.scripts?.lhci).toMatch(/lhci\s+autorun/);
  });
});

// ──────────────────────────────────────────────────────────────────
// 4. CI workflow — perf-budget.yml must exist and invoke both runners
// ──────────────────────────────────────────────────────────────────

const workflow = readFileSync(join(REPO_ROOT, ".github/workflows/perf-budget.yml"), "utf8");

describe("§5.43 — .github/workflows/perf-budget.yml enforces the budget in CI", () => {
  it("workflow has a size-limit job that runs the runner", () => {
    // A size-limit config with no CI hook is self-reporting only.
    // Pin the job + the step that actually invokes the CLI.
    expect(workflow).toMatch(/size-limit:/);
    expect(workflow).toMatch(/pnpm\s+size-limit/);
  });

  it("workflow has a lighthouse job that runs LHCI autorun", () => {
    expect(workflow).toMatch(/lighthouse:/);
    expect(workflow).toMatch(/lhci\s+autorun/);
  });

  it("size-limit job builds before measuring", () => {
    // `size-limit` reads .next/static/chunks — no build, no signal.
    expect(workflow).toMatch(/pnpm\s+build/);
  });

  it("workflow triggers on pull_request (PR-time enforcement)", () => {
    // If the budget only runs post-merge, the first time a regression
    // gets caught is after it's already on main. Pin PR triggering.
    expect(workflow).toMatch(/pull_request:/);
  });
});
