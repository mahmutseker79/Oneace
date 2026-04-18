// P3-1 (audit v1.1 §5.29) — vitest coverage threshold guard.
//
// The audit flags that without coverage thresholds, a silent regression
// can erase whole slices of tested code without any signal. This guard
// pins the SHAPE of the coverage block in `vitest.config.ts`:
//
//   - provider: "v8"          (aligned with @vitest/coverage-v8)
//   - reporter array includes "text", "html", and "json-summary"
//     ("json-summary" is what CI parses for ramp-up)
//   - excludes the Prisma generated client and test files so we do not
//     get flattered by 100% coverage of generated code
//   - thresholds exist for lines, branches, functions, statements
//
// Initial floors are 0 — this is a scaffold, not a lint fence. The
// follow-up commit after first coverage run raises each floor to
// (measured - buffer). Dropping the thresholds entirely would defeat
// the point of this guard, so we assert they EXIST rather than that
// they have a specific value.
//
// Static read only — no vitest/config import at runtime; we parse the
// source file textually so the assertion fires before the config is
// even loaded.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");
const VITEST_CONFIG = readFileSync(
  resolve(REPO_ROOT, "vitest.config.ts"),
  "utf8",
);
const PACKAGE_JSON = JSON.parse(
  readFileSync(resolve(REPO_ROOT, "package.json"), "utf8"),
) as {
  devDependencies?: Record<string, string>;
};

describe("P3-1 §5.29 — vitest coverage scaffold is present", () => {
  it("vitest.config.ts has a coverage block", () => {
    expect(
      /coverage\s*:\s*\{/.test(VITEST_CONFIG),
      "vitest.config.ts must declare a coverage block inside test {}",
    ).toBe(true);
  });

  it("coverage provider is v8", () => {
    expect(
      /provider\s*:\s*["']v8["']/.test(VITEST_CONFIG),
      "coverage.provider must be 'v8' — aligned with @vitest/coverage-v8",
    ).toBe(true);
  });

  it("coverage reporter array includes text, html, json-summary", () => {
    const reporterMatch = VITEST_CONFIG.match(
      /reporter\s*:\s*\[([^\]]+)\]/,
    );
    expect(
      reporterMatch,
      "coverage.reporter must be an array literal so ramp-up parsing is deterministic",
    ).not.toBeNull();
    const reporters = reporterMatch![1];
    for (const r of ["text", "html", "json-summary"]) {
      expect(
        reporters.includes(`"${r}"`) || reporters.includes(`'${r}'`),
        `coverage.reporter must include '${r}' — CI parses json-summary for ramp-up`,
      ).toBe(true);
    }
  });

  it("coverage excludes generated client, test files, e2e, node_modules", () => {
    const excludeMatch = VITEST_CONFIG.match(
      /exclude\s*:\s*\[([\s\S]*?)\]/,
    );
    expect(
      excludeMatch,
      "coverage.exclude must be an array literal",
    ).not.toBeNull();
    const excludes = excludeMatch![1];
    for (const needle of [
      "src/generated/",
      "src/**/*.test.ts",
      "e2e/",
      "node_modules/",
    ]) {
      expect(
        excludes.includes(needle),
        `coverage.exclude must list '${needle}' — generated / test files inflate numbers`,
      ).toBe(true);
    }
  });

  it("coverage thresholds exist for lines/branches/functions/statements", () => {
    const thresholdsMatch = VITEST_CONFIG.match(
      /thresholds\s*:\s*\{([\s\S]*?)\}/,
    );
    expect(
      thresholdsMatch,
      "coverage.thresholds must be an object — drops silent regressions",
    ).not.toBeNull();
    const body = thresholdsMatch![1];
    for (const metric of ["lines", "branches", "functions", "statements"]) {
      expect(
        new RegExp(`\\b${metric}\\s*:\\s*\\d+`).test(body),
        `coverage.thresholds must define a numeric '${metric}' floor`,
      ).toBe(true);
    }
  });
});

describe("P3-1 §5.29 — @vitest/coverage-v8 is pinned in devDependencies", () => {
  it("package.json devDependencies pins @vitest/coverage-v8", () => {
    const dep = PACKAGE_JSON.devDependencies?.["@vitest/coverage-v8"];
    expect(
      dep,
      "@vitest/coverage-v8 must be in devDependencies so `npx vitest run --coverage` works",
    ).toBeDefined();
    expect(
      /^[\^~]?\d/.test(dep ?? ""),
      "@vitest/coverage-v8 version must be a semver range (e.g. ^2.1.9)",
    ).toBe(true);
  });
});
