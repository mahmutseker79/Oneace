// P1-§5.22 (audit v1.1) — CI workflow policy pins.
//
// The original audit v1.0 only checked fast gates (lint/typecheck/vitest)
// in CI. Playwright lived in e2e.yml but was gated behind workflow_dispatch,
// so nobody ran it before merge. This test locks the policy: e2e.yml must
// trigger on PRs against the protected branches (main, next-port) so a
// Playwright break blocks merges the same way a vitest break does.
//
// Static-analysis over YAML parsing on purpose — we're guarding the file
// shape, not the workflow's execution semantics. If someone accidentally
// reverts `on:` back to `workflow_dispatch` only, this test fails before
// the change reaches CI.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");

function readWorkflow(name: string): string {
  return readFileSync(resolve(REPO_ROOT, ".github", "workflows", name), "utf8");
}

describe("CI workflow policy (audit v1.1 §5.22)", () => {
  it("e2e.yml triggers on pull_request to main/next-port", () => {
    const yml = readWorkflow("e2e.yml");

    // pull_request block must exist
    expect(yml, "e2e.yml missing pull_request trigger").toMatch(
      /pull_request:\s*\n\s+branches:\s*\[\s*main\s*,\s*next-port\s*\]/,
    );
  });

  it("e2e.yml triggers on push to main/next-port", () => {
    const yml = readWorkflow("e2e.yml");
    expect(yml, "e2e.yml missing push trigger for protected branches").toMatch(
      /\bpush:\s*\n\s+branches:\s*\[\s*main\s*,\s*next-port\s*\]/,
    );
  });

  it("e2e.yml still supports manual dispatch for maintainer re-runs", () => {
    const yml = readWorkflow("e2e.yml");
    expect(yml, "workflow_dispatch removed — maintainers lose re-run").toMatch(
      /\bworkflow_dispatch\b/,
    );
  });

  it("e2e.yml skips fork PRs (no secrets access)", () => {
    const yml = readWorkflow("e2e.yml");
    expect(yml, "fork-skip guard missing — forks will fail on secrets").toMatch(
      /pull_request\.head\.repo\.full_name\s*==\s*github\.repository/,
    );
  });

  it("e2e.yml runs the full Playwright suite (npx playwright install + pnpm test:e2e)", () => {
    const yml = readWorkflow("e2e.yml");
    expect(yml).toMatch(/npx playwright install/);
    expect(yml).toMatch(/\bpnpm test:e2e\b/);
  });

  it("e2e.yml cancels superseded runs on the same ref", () => {
    const yml = readWorkflow("e2e.yml");
    expect(yml, "concurrency group missing — stale PR runs pile up and waste minutes").toMatch(
      /concurrency:[\s\S]*cancel-in-progress:\s*true/,
    );
  });

  it("ci.yml and e2e.yml share protected-branch triggers", () => {
    // Pin the invariant that both workflows run on the same events —
    // prevents drift where one gate moves to a different branch set.
    const ciYml = readWorkflow("ci.yml");
    const e2eYml = readWorkflow("e2e.yml");
    for (const branch of ["main", "next-port"]) {
      expect(ciYml, `ci.yml dropped ${branch}`).toContain(branch);
      expect(e2eYml, `e2e.yml dropped ${branch}`).toContain(branch);
    }
  });
});
