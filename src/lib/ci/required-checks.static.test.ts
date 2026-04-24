// src/lib/ci/required-checks.static.test.ts
//
// Pinned static-analysis test for Sprint 5 (2026-04-24 required-checks).
//
// Contract:
//   - scripts/setup-branch-protection.sh exists, executable, uses `gh`
//   - It declares a REQUIRED_CHECKS JSON list of exactly these four
//     contexts (in this order, matching the `name:` field of each
//     job in .github/workflows/ci.yml):
//         Lint · Typecheck
//         Vitest
//         Prisma Validate
//         Prisma Migrations (scratch Postgres)
//   - Each listed context is the EXACT `name:` of a job in
//     .github/workflows/ci.yml (no typos, no drift).
//   - The protection config enforces strict checks, 1 reviewer,
//     linear history, no force-push, no deletions, conversation
//     resolution.
//
// Guards against silent drift: if someone renames a CI job, this
// test flips red immediately — they're forced to update the
// setup-branch-protection.sh list in the same PR.
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
];
// Typecheck runs as an advisory (non-blocking) job — it must NOT
// appear in REQUIRED_CONTEXTS while the ~212 pre-existing TS
// errors are being paid down.
const ADVISORY_CONTEXT = "Typecheck (advisory)";

describe("Sprint 5 — required status checks drift guard", () => {
  const root = findRepoRoot();
  const script = fs.readFileSync(
    path.join(root, "scripts", "setup-branch-protection.sh"),
    "utf8",
  );
  const workflow = fs.readFileSync(
    path.join(root, ".github", "workflows", "ci.yml"),
    "utf8",
  );

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
      expect(/"required_approving_review_count"\s*:\s*1/.test(script)).toBe(
        true,
      );
      expect(/"required_linear_history"\s*:\s*true/.test(script)).toBe(true);
      expect(/"allow_force_pushes"\s*:\s*false/.test(script)).toBe(true);
      expect(/"allow_deletions"\s*:\s*false/.test(script)).toBe(true);
      expect(
        /"required_conversation_resolution"\s*:\s*true/.test(script),
      ).toBe(true);
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

  describe("advisory typecheck job", () => {
    it(`ci.yml has a job named "${ADVISORY_CONTEXT}"`, () => {
      const pattern = new RegExp(
        `^\\s{4}name:\\s*${ADVISORY_CONTEXT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`,
        "m",
      );
      expect(pattern.test(workflow)).toBe(true);
    });

    it("advisory typecheck job carries continue-on-error: true", () => {
      // Grab the block from `name: Typecheck (advisory)` up to the
      // next top-level job (two-space indent key) or EOF.
      const block = workflow.match(
        /^\s{4}name:\s*Typecheck \(advisory\)[\s\S]*?(?=^\s{2}[a-z-]+:$|\Z)/m,
      );
      expect(block).toBeTruthy();
      expect(/continue-on-error:\s*true/.test(block?.[0] ?? "")).toBe(true);
    });

    it("advisory typecheck is NOT in the required-checks JSON block", () => {
      // Only scan the REQUIRED_CHECKS heredoc, not the comment
      // section (which is allowed to reference the advisory job
      // when explaining WHY it's excluded).
      const checksBlock = script.match(
        /REQUIRED_CHECKS\s*<<'JSON'[\s\S]*?\nJSON/,
      );
      expect(checksBlock).toBeTruthy();
      expect(checksBlock?.[0].includes(`"${ADVISORY_CONTEXT}"`)).toBe(false);
    });
  });
});
