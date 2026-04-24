// Phase-1 P0 §vercel-quota — Dependabot preview deploy gate.
//
// Pinned guard for `vercel.json` `git.deploymentEnabled`.
//
// Background: on 2026-04-18 the production hotfix rollout for v1.5.13
// (edge-logger) was blocked by Vercel's free-plan "api-deployments-
// free-per-day" quota (>100). Root cause was that Dependabot had
// opened 20+ PRs during initial repo ingestion; each one triggered a
// preview build, burning the daily quota before the actual hotfix
// promote could run. The fix was to add
//
//   "git": { "deploymentEnabled": { "dependabot/*": false } }
//
// to vercel.json so Dependabot branches never trigger builds. This
// test pins that policy so a well-meaning refactor of vercel.json
// cannot silently reopen the hole.
//
// Static read only. No network, no Vercel API.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");
const VERCEL_JSON_PATH = resolve(REPO_ROOT, "vercel.json");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const VERCEL_JSON: Record<string, any> = JSON.parse(readFileSync(VERCEL_JSON_PATH, "utf8"));

describe("Phase-1 P0 §vercel-quota — vercel.json has Dependabot build gate", () => {
  it("has a `git.deploymentEnabled` object", () => {
    expect(
      VERCEL_JSON.git,
      "vercel.json must carry a `git` section — otherwise deployment rules cannot pin",
    ).toBeTypeOf("object");
    expect(
      VERCEL_JSON.git?.deploymentEnabled,
      "vercel.json must carry `git.deploymentEnabled` — otherwise branch gating is dashboard-only (unversioned)",
    ).toBeTypeOf("object");
  });

  it("disables builds for `dependabot/*` branches", () => {
    const de = VERCEL_JSON.git?.deploymentEnabled;
    expect(
      "dependabot/*" in (de ?? {}),
      "vercel.json `git.deploymentEnabled` must include the `dependabot/*` minimatch key — otherwise Dependabot previews keep burning daily quota",
    ).toBe(true);
    expect(
      de?.["dependabot/*"],
      "`dependabot/*` must resolve to `false` — `true` or missing would reopen the free-plan quota hole",
    ).toBe(false);
  });

  it("does NOT explicitly disable `main`, `stable`, or the active working branch", () => {
    // Overlapping rules: if main/stable are set to false, we'd block
    // our own production deploys. Audit doc §Phase-1 P0 requires that
    // the gate only covers Dependabot — other branches stay open.
    const de = VERCEL_JSON.git?.deploymentEnabled ?? {};
    for (const branch of ["main", "stable", "phase-1-p0-remediations"]) {
      if (branch in de) {
        expect(
          de[branch],
          `\`${branch}\` must not be set to \`false\` in vercel.json — production rollout would break`,
        ).not.toBe(false);
      }
    }
  });
});

describe("Phase-1 P0 §vercel-quota — vercel.json keeps cron + install intact", () => {
  // Regression guard: the deploymentEnabled edit should not have
  // orphaned the existing cron schedule or installCommand. Pinning
  // both protects against a stray JSON mis-merge.
  it("preserves `installCommand`", () => {
    expect(VERCEL_JSON.installCommand).toBe("npm install --legacy-peer-deps");
  });

  it("preserves all 4 cron schedules", () => {
    expect(Array.isArray(VERCEL_JSON.crons), "crons[] must remain an array").toBe(true);
    const paths = VERCEL_JSON.crons.map((c: { path: string }) => c.path) as string[];
    expect(paths).toEqual([
      "/api/cron/stock-count-triggers",
      "/api/cron/cleanup-migration-files",
      "/api/cron/cleanup-notifications",
      "/api/cron/cleanup-cronruns",
    ]);
  });
});
