// src/lib/ops/sprint-4b-sanity.static.test.ts
//
// Pinned static-analysis test for v1.10.1.1-sanity-gate-fix.
//
// Background
// ----------
// scripts/sprints/2026-04-24-ops-prod/sprint-4b-prod-migrate.command
// has a Phase 2 sanity scan that aborts when the resolved PROD
// DATABASE_URL contains substrings that suggest a non-prod target
// (staging, stage, _test, -test, _dev, -dev, sandbox, localhost).
//
// The original implementation used `grep -qF "$term"`. That works
// for terms that don't begin with '-', but BAD_TERMS contains
// '-test' and '-dev', so grep parsed those as flags ('grep -qF
// -test' → '-t' is unknown) and threw. The loop then continued
// WITHOUT any match — which is silent failure, not loud failure.
//
// The fix replaced grep with the bash built-in pattern operator
// ([[ "$URL_LOWER" == *"$term"* ]]) which has no argument
// parsing.
//
// Invariants enforced here
// ------------------------
//   1. The fixed-form expression IS present.
//   2. The legacy buggy form `grep -qF "$term"` is NOT present
//      (regression guard — prevents someone from "simplifying"
//      back to grep without realizing the arg-parse trap).
//   3. The BAD_TERMS array still covers the canonical danger
//      substrings (staging / -test / -dev / localhost) so
//      defensive coverage doesn't shrink unnoticed.
//   4. URL_LOWER is computed via tr to '[:lower:]' so the
//      compare is case-insensitive (a TYPE-2 production URL with
//      "STAGING" should still match).

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function findRepoRoot(): string {
  let dir = path.resolve(__dirname);
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error("repo root not found");
}

const REPO_ROOT = findRepoRoot();
const SCRIPT_PATH = path.join(
  REPO_ROOT,
  "scripts",
  "sprints",
  "2026-04-24-ops-prod",
  "sprint-4b-prod-migrate.command",
);

describe("sprint-4b PROD migrate — Phase 2 sanity gate", () => {
  it("script file exists and is non-empty", () => {
    expect(fs.existsSync(SCRIPT_PATH)).toBe(true);
    const stat = fs.statSync(SCRIPT_PATH);
    expect(stat.size).toBeGreaterThan(0);
  });

  it("uses the bash built-in substring match (no grep arg-parse trap)", () => {
    const src = fs.readFileSync(SCRIPT_PATH, "utf8");
    // Look for the fixed pattern: [[ "$URL_LOWER" == *"$term"* ]]
    // (whitespace tolerant, but quote-style strict).
    expect(src).toMatch(
      /\[\[\s*"\$URL_LOWER"\s*==\s*\*"\$term"\*\s*\]\]/,
    );
  });

  it("does NOT regress to the legacy buggy `grep -qF \"$term\"` form", () => {
    const src = fs.readFileSync(SCRIPT_PATH, "utf8");
    // Specifically the un-`--`-guarded form. If someone reintroduces
    // grep here, they MUST use `grep -qF -- "$term"` (argument
    // separator) — that variant is fine and the assertion below
    // tolerates it.
    const buggyForm = /grep\s+-qF\s+"\$term"/;
    expect(src).not.toMatch(buggyForm);
  });

  it("BAD_TERMS array still covers canonical danger substrings", () => {
    const src = fs.readFileSync(SCRIPT_PATH, "utf8");
    // Pull the BAD_TERMS=( ... ) literal — it MUST be a single-
    // line declaration so this regex is enough.
    const badMatch = src.match(/BAD_TERMS=\(([^)]+)\)/);
    expect(badMatch, "BAD_TERMS array literal missing").not.toBeNull();
    const literal = badMatch![1];
    for (const term of [
      "staging",
      "stage",
      "_test",
      "-test",
      "_dev",
      "-dev",
      "sandbox",
      "localhost",
    ]) {
      expect(literal, `BAD_TERMS missing '${term}'`).toContain(`"${term}"`);
    }
  });

  it("URL_LOWER lowercases the URL before matching (case-insensitive gate)", () => {
    const src = fs.readFileSync(SCRIPT_PATH, "utf8");
    // Accept any whitespace; the canonical line is:
    //   URL_LOWER="$(echo "$PROD_URL" | tr '[:upper:]' '[:lower:]')"
    expect(src).toMatch(
      /URL_LOWER="\$\(echo\s+"\$PROD_URL"\s*\|\s*tr\s+'\[:upper:\]'\s+'\[:lower:\]'\)"/,
    );
  });

  it("references the second confirmation literal 'APPLY PRODUCTION'", () => {
    // Defensive: make sure a future refactor doesn't accidentally
    // reduce the script to a single confirmation. The Phase 6
    // gate is what stops a typoed staging URL from going live.
    const src = fs.readFileSync(SCRIPT_PATH, "utf8");
    expect(src).toContain("APPLY PRODUCTION");
  });
});
