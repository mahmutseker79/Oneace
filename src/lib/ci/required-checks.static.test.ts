// src/lib/ci/required-checks.static.test.ts
//
// Pinned static-analysis test for Sprint 5 (2026-04-24 required-checks)
// + Sprint 6 (2026-04-25 typecheck promotion to required, v1.12.0).
//
// Contract:
//   - scripts/setup-branch-protection.sh exists, executable, uses `gh`
//   - It declares a REQUIRED_CHECKS JSON list of exactly these five
//     contexts, matching the `name:` field of each job in
//     .github/workflows/ci.yml:
//         Lint (Biome)
//         Vitest
//         Prisma Validate
//         Prisma Migrations (scratch Postgres)
//         Typecheck
//   - Each listed context is the EXACT `name:` of a job in
//     .github/workflows/ci.yml (no typos, no drift).
//   - The Typecheck job is NOT carrying continue-on-error: true
//     anymore (was advisory until v1.11.x; promoted in v1.12.0
//     after the 0-TS-error baseline was verified).
//   - The protection config enforces strict checks, 1 reviewer,
//     linear history, no force-push, no deletions, conversation
//     resolution.
//
// Guards against silent drift: if someone renames a CI job, drops
// Typecheck back to advisory, or removes a context from the
// protection script, this test flips red immediately.
//
// Lightweight file-scan only. No runtime booted, no API hit.

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

const REQUIRED_CONTEXTS = [
  "Lint (Biome)",
  "Vitest",
  "Prisma Validate",
  "Prisma Migrations (scratch Postgres)",
  "Typecheck",
];

describe("Sprint 5/6 — required status checks drift guard", () => {
  const root = findRepoRoot();
  const script = fs.readFileSync(path.join(root, "scripts", "setup-branch-protection.sh"), "utf8");
  const workflow = fs.readFileSync(path.join(root, ".github", "workflows", "ci.yml"), "utf8");

  describe("scripts/setup-branch-protection.sh", () => {
    it("declares required_status_checks with strict=true", () => {
      expect(/"required_status_checks"\s*:/.test(script)).toBe(true);
      expect(/"strict"\s*:\s*true/.test(script)).toBe(true);
    });

    it("lists every required context in the REQUIRED_CHECKS block", () => {
      // The heredoc block literally carries each context name —
      // drop into it, assert.
      for (const ctx of REQUIRED_CONTEXTS) {
        expect(script.includes(`"${ctx}"`)).toBe(true);
      }
    });

    it("enforces the full protection shape (reviewer + linear + no force + resolution)", () => {
      expect(/"required_approving_review_count"\s*:\s*1/.test(script)).toBe(true);
      expect(/"required_linear_history"\s*:\s*true/.test(script)).toBe(true);
      expect(/"allow_force_pushes"\s*:\s*false/.test(script)).toBe(true);
      expect(/"allow_deletions"\s*:\s*false/.test(script)).toBe(true);
      expect(/"required_conversation_resolution"\s*:\s*true/.test(script)).toBe(true);
    });

    it("applies to both main and stable by default", () => {
      // The default BRANCHES expansion string — exact substring
      // scan is more robust than a regex across shell-quoting.
      expect(script.includes("BRANCHES:-main stable")).toBe(true);
    });
  });

  describe("each required context matches a ci.yml job name exactly", () => {
    for (const ctx of REQUIRED_CONTEXTS) {
      it(`ci.yml has a job named "${ctx}"`, () => {
        // Match `    name: <ctx>` at 4-space indent (YAML job field)
        const pattern = new RegExp(
          `^\\s{4}name:\\s*${ctx.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`,
          "m",
        );
        expect(pattern.test(workflow)).toBe(true);
      });
    }
  });

  describe("Typecheck promotion (v1.12.0) — was advisory, now required", () => {
    it("ci.yml Typecheck job does NOT carry continue-on-error: true", () => {
      // Grab the block from `    name: Typecheck` up to the next
      // top-level job (two-space indent key) or EOF, then assert
      // the block does NOT contain `continue-on-error: true`.
      const re = /^\s{4}name:\s*Typecheck\s*$[\s\S]*?(?=^\s{2}[a-z-]+:$|\Z)/m;
      const block = workflow.match(re);
      expect(block, "Typecheck job block missing").toBeTruthy();
      expect(/continue-on-error:\s*true/.test(block?.[0] ?? "")).toBe(false);
    });

    it("ci.yml does NOT carry the legacy '(advisory)' label on Typecheck", () => {
      // Defensive: catches a partial revert where someone renames
      // the job back to "Typecheck (advisory)" without restoring
      // continue-on-error (or vice versa).
      expect(workflow).not.toMatch(/^\s{4}name:\s*Typecheck \(advisory\)\s*$/m);
    });
  });
});
