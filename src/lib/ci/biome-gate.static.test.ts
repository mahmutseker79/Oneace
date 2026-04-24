// src/lib/ci/biome-gate.static.test.ts
//
// Pinned static-analysis test for Sprint 2 (2026-04-24 ci-lint-audit).
//
// Contract:
//   - .github/workflows/ci.yml runs Biome via `pnpm lint`
//   - The same job runs a second invocation with
//     `--diagnostic-level=error` so warnings don't break CI but
//     errors do (required-check trade-off).
//   - package.json "lint" script == "biome check ."
//   - package.json "lint:fix" script invokes biome with --write.
//   - biome.json exists and enables the linter.
//
// This guards against silent workflow drift: if someone removes the
// errors-only step or changes the command shape, CI will flip from
// "errors fail" back to "warnings fail" (noisy) or "never fails"
// (dangerous).
//
// Lightweight file-scan only. No runtime booted.

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

describe("Sprint 2 — Biome CI gate (drift guard)", () => {
  const root = findRepoRoot();

  describe(".github/workflows/ci.yml", () => {
    const wf = fs.readFileSync(path.join(root, ".github", "workflows", "ci.yml"), "utf8");

    it("has a Biome lint step (pnpm lint)", () => {
      expect(/pnpm lint/.test(wf)).toBe(true);
    });

    it("re-runs Biome with --diagnostic-level=error for the errors-only gate", () => {
      expect(/biome\s+check\s+--diagnostic-level=error/.test(wf)).toBe(true);
    });

    it("exits on the errors-only exit code (not the warnings one)", () => {
      // The job should `exit $ERRORS_EXIT` so that warnings alone
      // don't fail CI but errors always do.
      expect(/exit\s+\$?ERRORS_EXIT/.test(wf)).toBe(true);
    });
  });

  describe("package.json", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    const scripts = pkg.scripts ?? {};

    it("defines a `lint` script that runs biome check", () => {
      expect(scripts.lint).toBeDefined();
      expect(/biome\s+check/.test(scripts.lint ?? "")).toBe(true);
    });

    it("defines a `lint:fix` script that uses biome --write", () => {
      expect(scripts["lint:fix"]).toBeDefined();
      expect(/biome\s+check\s+--write/.test(scripts["lint:fix"] ?? "")).toBe(true);
    });
  });

  describe("biome.json", () => {
    const cfgPath = path.join(root, "biome.json");

    it("exists at repo root", () => {
      expect(fs.existsSync(cfgPath)).toBe(true);
    });

    it("enables the linter explicitly", () => {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8")) as {
        linter?: { enabled?: boolean };
      };
      expect(cfg.linter?.enabled).toBe(true);
    });
  });
});
