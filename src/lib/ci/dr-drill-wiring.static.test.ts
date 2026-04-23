// src/lib/ci/dr-drill-wiring.static.test.ts
//
// Pinned static-analysis test for P1-06 (GOD MODE roadmap 2026-04-23).
//
// Invariants
// ----------
//   1. .github/workflows/dr-drill.yml calls the real Neon API
//      (`/projects/{id}/branches` + `/projects/{id}/connection_uri`
//      + DELETE branch). No TODO stubs remain.
//   2. The workflow records elapsed time and appends a row to
//      docs/DR-drill-log.md on every live drill.
//   3. docs/DR-drill-log.md exists with the header + table shape
//      the workflow appends to.
//   4. The workflow has a weekly schedule (was monthly — P1-06
//      tightened the cadence so logs stay fresh).
//
// Rationale
// ---------
// Pre-P1-06 the workflow was a skeleton with TODO curl calls; a
// claim of "RTO ≈ 2-3h" was in docs/backup-strategy.md without any
// measured evidence. This test fails the PR if the wiring regresses
// to a stub OR the log file is dropped.

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

describe("DR drill workflow — P1-06 wiring", () => {
  const root = findRepoRoot();
  const yml = fs.readFileSync(
    path.join(root, ".github", "workflows", "dr-drill.yml"),
    "utf8",
  );

  it("runs on a weekly schedule (Monday 06:00 UTC)", () => {
    // `0 6 * * 1` = weekly Monday 06:00 UTC. The skeleton used
    // `0 6 1 * *` (1st of month). If a future edit regresses the
    // cadence, this test catches it.
    expect(/-\s*cron:\s*["']0\s+6\s+\*\s+\*\s+1["']/.test(yml)).toBe(true);
  });

  it("calls Neon's real POST /branches endpoint", () => {
    expect(/projects\/\$NEON_PROJECT_ID\/branches/.test(yml)).toBe(true);
    expect(/-X\s+POST/.test(yml)).toBe(true);
  });

  it("fetches a connection URI from /connection_uri", () => {
    expect(/\/connection_uri\?branch_id=/.test(yml)).toBe(true);
  });

  it("fetches both pooled and unpooled connection URIs", () => {
    expect(/pooled=true/.test(yml)).toBe(true);
    expect(/pooled=false/.test(yml)).toBe(true);
  });

  it("destroys the branch via DELETE on cleanup", () => {
    expect(/-X\s+DELETE/.test(yml)).toBe(true);
    expect(/branches\/\$BRANCH_ID/.test(yml)).toBe(true);
  });

  it("cleanup runs on always() (survives failures)", () => {
    // The delete-branch step's `if:` must include `always()` so a
    // failed drill doesn't leak a branch.
    expect(
      /name:\s*Destroy ephemeral Neon branch[\s\S]*?if:\s*always\(\)/.test(yml),
    ).toBe(true);
  });

  it("appends to docs/DR-drill-log.md on every live drill", () => {
    expect(/docs\/DR-drill-log\.md/.test(yml)).toBe(true);
    expect(/git commit -m[\s\S]*?dr-drill/.test(yml)).toBe(true);
  });

  it("appends a level-2 heading matching the existing log format", () => {
    // The existing DR-drill-log.md uses `## YYYY-MM-DD — title`.
    // The workflow must honour that, not introduce a table.
    expect(/echo\s+["']## \$\{DATE_ONLY\}/.test(yml)).toBe(true);
  });

  it("has no TODO stubs left in the Neon branch-create step", () => {
    // Any remaining `TODO: call Neon API` comment means rc is
    // incomplete and the drill is still a stub.
    expect(/TODO:\s*call Neon API/.test(yml)).toBe(false);
  });

  it("short-circuit gate still respects secrets_missing for fork PRs", () => {
    expect(/secrets_missing=true/.test(yml)).toBe(true);
    expect(/NEON_API_KEY/.test(yml)).toBe(true);
  });
});

describe("DR drill log — P1-06 append-target shape", () => {
  const root = findRepoRoot();
  const logPath = path.join(root, "docs", "DR-drill-log.md");

  it("docs/DR-drill-log.md exists", () => {
    expect(fs.existsSync(logPath)).toBe(true);
  });

  it("log uses the level-2-heading-per-drill format the workflow appends to", () => {
    // The existing file documents the format contract at the top:
    //   - Every real drill starts with `## YYYY-MM-DD — <title>`.
    // The workflow emits headings that match. The test pins the
    // contract so a docs refactor that flips to a table silently
    // breaks the append step.
    const md = fs.readFileSync(logPath, "utf8");
    expect(/## YYYY-MM-DD/.test(md) || /## \d{4}-\d{2}-\d{2}/.test(md)).toBe(true);
  });

  it("log references the backup-strategy RTO target", () => {
    const md = fs.readFileSync(logPath, "utf8");
    expect(/backup-strategy\.md/.test(md)).toBe(true);
  });
});
