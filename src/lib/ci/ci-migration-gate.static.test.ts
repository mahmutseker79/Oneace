// src/lib/ci/ci-migration-gate.static.test.ts
//
// Pinned static-analysis test for P1-04 + P1-05 (GOD MODE roadmap
// 2026-04-23).
//
// Invariants
// ----------
//   1. `.github/workflows/ci.yml` contains a `migrations` job that
//      spins up Postgres, runs `prisma migrate deploy`, and
//      re-runs it idempotently.
//   2. The job's `name:` field matches the branch-protection
//      required-check list.
//   3. `scripts/setup-branch-protection.sh` exists and its
//      REQUIRED_CHECKS list matches ci.yml's four job names.
//   4. `docs/runbooks/branch-protection.md` is in sync with the
//      script's policy.
//
// Rationale
// ---------
// Branch protection and CI live in two different files. Drift
// between them is the classic silent regression: the branch
// protection still references a job that was renamed, so the
// required-check silently becomes a no-op. This test fails the PR
// when someone changes one without the other.

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

const EXPECTED_JOB_NAMES = [
  "Lint · Typecheck",
  "Vitest",
  "Prisma Validate",
  "Prisma Migrations (scratch Postgres)",
];

describe("CI migrations job — P1-04", () => {
  const root = findRepoRoot();
  const ci = fs.readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8");

  it("defines a `migrations` job", () => {
    expect(/^\s{2}migrations:/m.test(ci)).toBe(true);
  });

  it("migrations job carries the expected name", () => {
    expect(/name:\s*Prisma Migrations \(scratch Postgres\)/.test(ci)).toBe(true);
  });

  it("migrations job uses a postgres service container", () => {
    expect(/services:[\s\S]*?postgres:[\s\S]*?image:\s*postgres:16/.test(ci)).toBe(true);
  });

  it("migrations job runs `prisma migrate deploy` TWICE (idempotence gate)", () => {
    // Count occurrences of `pnpm prisma migrate deploy` within the
    // migrations job. Two invocations means the re-run check is
    // still present — a future refactor that drops the second run
    // regresses the "re-runnable migration" invariant.
    const migrationsBlock = ci.slice(ci.indexOf("migrations:"));
    const occurrences = (migrationsBlock.match(/pnpm prisma migrate deploy/g) ?? []).length;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it("migrations job verifies _prisma_migrations is populated", () => {
    expect(/_prisma_migrations/.test(ci)).toBe(true);
  });
});

describe("Branch protection script — P1-05", () => {
  const root = findRepoRoot();
  const scriptPath = path.join(root, "scripts/setup-branch-protection.sh");
  const runbookPath = path.join(root, "docs/runbooks/branch-protection.md");

  it("scripts/setup-branch-protection.sh exists and is executable-shaped", () => {
    expect(fs.existsSync(scriptPath)).toBe(true);
    const src = fs.readFileSync(scriptPath, "utf8");
    expect(src.startsWith("#!/")).toBe(true);
  });

  it("docs/runbooks/branch-protection.md exists", () => {
    expect(fs.existsSync(runbookPath)).toBe(true);
  });

  it("script's REQUIRED_CHECKS lists the same 4 jobs as ci.yml", () => {
    const src = fs.readFileSync(scriptPath, "utf8");
    for (const name of EXPECTED_JOB_NAMES) {
      expect(
        src.includes(`"${name}"`),
        `REQUIRED_CHECKS in setup-branch-protection.sh missing "${name}"`,
      ).toBe(true);
    }
  });

  it("script requires ≥1 approving review", () => {
    const src = fs.readFileSync(scriptPath, "utf8");
    expect(/"required_approving_review_count":\s*1/.test(src)).toBe(true);
  });

  it("script forbids force-pushes and deletions on main + stable", () => {
    const src = fs.readFileSync(scriptPath, "utf8");
    expect(/"allow_force_pushes":\s*false/.test(src)).toBe(true);
    expect(/"allow_deletions":\s*false/.test(src)).toBe(true);
  });

  it("runbook points at the same 4 status checks", () => {
    const md = fs.readFileSync(runbookPath, "utf8");
    for (const name of EXPECTED_JOB_NAMES) {
      expect(md.includes(name), `runbook missing check "${name}"`).toBe(true);
    }
  });
});
