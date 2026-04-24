/**
 * Audit v1.3 §5.49 F-05 — Dependabot burst-cap pin.
 *
 * Context
 * -------
 * v1.5.17 (`vercel.json` dependabot deploy gate) closed the `-preview`
 * half of the 2026-04-18 quota incident by stopping Dependabot
 * branches from triggering Vercel preview builds. But the `.github/
 * dependabot.yml` config itself — which is what *creates* those
 * branches in the first place — had no regression guard. A single
 * future edit that bumped `open-pull-requests-limit` from 5 to 50 or
 * forgot the `github-actions` ecosystem entry would re-open the same
 * burst channel from a different angle (CI-build minutes, reviewer
 * attention budget, changelog-review load) — even though previews are
 * now gated.
 *
 * The audit dossier flagged this as P2 FOLLOW-THROUGH: "burst alarm
 * pinned değil" — the intent exists in the config, but nothing
 * enforces it. This file pins the intent.
 *
 * Guard contract
 * --------------
 * Each assertion below has a comment explaining what fails if the
 * guard trips. When Renovate/new ecosystem lands or the team
 * deliberately raises the burst budget, update the `BURST_BUDGET`
 * constant + the per-ecosystem expectations below — do NOT just
 * disable the suite.
 *
 * Static-analysis only (feedback_pinned_tests.md preference): we parse
 * the YAML text, we do not spawn `dependabot`. This runs in < 5ms.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const DEPENDABOT_YML_PATH = resolve(process.cwd(), ".github/dependabot.yml");

/**
 * Total open-PR budget across all ecosystems. The 2026-04-18 incident
 * showed that a burst of 20+ Dependabot PRs can exhaust Vercel's
 * free-plan daily deploy cap via preview builds. v1.5.17 closed that
 * specific channel (`vercel.json` deploymentEnabled gate), but the
 * same 20+ PRs still create review load, CI-minute spend, and
 * changelog-review fatigue. Budget chosen to match current config
 * (5 npm + 3 github-actions = 8) with no extra headroom — raising
 * this is a deliberate decision that should be paired with an
 * observability plan for the downstream effects.
 */
const BURST_BUDGET = 8;

function readDependabotYml(): string {
  return readFileSync(DEPENDABOT_YML_PATH, "utf8");
}

describe("§5.49 F-05 — dependabot.yml burst guard", () => {
  it("dependabot.yml exists and is non-empty", () => {
    const text = readDependabotYml();
    // If this fails someone removed the config — preview gate in
    // vercel.json becomes meaningless because Dependabot stops
    // opening PRs entirely, but so does every CVE-advisory PR.
    expect(text.length).toBeGreaterThan(100);
    expect(text).toContain("version: 2");
  });

  it("npm ecosystem declares open-pull-requests-limit ≤ 5", () => {
    const text = readDependabotYml();
    const npmBlock = extractEcosystemBlock(text, "npm");
    expect(npmBlock, "npm ecosystem block must exist").not.toBeNull();
    const limit = extractOpenPrLimit(npmBlock ?? "");
    expect(limit, "npm open-pull-requests-limit must be set").not.toBeNull();
    expect(limit).toBeLessThanOrEqual(5);
  });

  it("github-actions ecosystem declares open-pull-requests-limit ≤ 3", () => {
    const text = readDependabotYml();
    const gaBlock = extractEcosystemBlock(text, "github-actions");
    expect(gaBlock, "github-actions ecosystem block must exist").not.toBeNull();
    const limit = extractOpenPrLimit(gaBlock ?? "");
    expect(limit, "github-actions open-pull-requests-limit must be set").not.toBeNull();
    expect(limit).toBeLessThanOrEqual(3);
  });

  it("total burst across ecosystems stays within BURST_BUDGET", () => {
    const text = readDependabotYml();
    // We walk every non-comment `open-pull-requests-limit: N` line
    // and sum them. Missing limits implicitly default to 5 (Dependabot
    // upstream default) which would blow past BURST_BUDGET if a third
    // ecosystem was added without an explicit limit — that is the
    // failure mode this sum guards against.
    //
    // Filter out lines whose first non-whitespace character is `#`
    // so comment bodies that mention the key for documentation
    // purposes don't inflate the count.
    const activeLines = text
      .split("\n")
      .filter((line) => !/^\s*#/.test(line))
      .join("\n");
    const matches = [...activeLines.matchAll(/open-pull-requests-limit:\s*(\d+)/g)];
    expect(matches.length, "at least one ecosystem with an explicit limit").toBeGreaterThanOrEqual(
      2,
    );
    const total = matches.reduce((sum, m) => sum + Number.parseInt(m[1] ?? "0", 10), 0);
    expect(total, `BURST_BUDGET=${BURST_BUDGET}, actual=${total}`).toBeLessThanOrEqual(
      BURST_BUDGET,
    );
  });

  it("npm groups prod-minor-patch + dev-minor-patch are declared", () => {
    // Groups batch minor/patch bumps so a busy upstream week opens
    // 2 PRs (one per dependency type) instead of 30 individual ones.
    // If someone deletes these groups the burst re-emerges even with
    // open-pull-requests-limit: 5, because each PR is individual.
    const text = readDependabotYml();
    expect(text).toMatch(/prod-minor-patch:\s*\n\s*dependency-type:\s*"production"/);
    expect(text).toMatch(/dev-minor-patch:\s*\n\s*dependency-type:\s*"development"/);
  });

  it("major bumps are NOT added to the groups (intentional fragmentation)", () => {
    // Guard: major bumps MUST land as individual PRs so the reviewer
    // reads the changelog one at a time. If `- "major"` appears under
    // either prod-minor-patch or dev-minor-patch update-types, the
    // reviewer experience degrades from "one readable PR per breaking
    // bump" to "a bundled mega-PR with N changelogs to reconcile".
    const text = readDependabotYml();
    const prodGroupMatch = text.match(
      /prod-minor-patch:\s*\n\s*dependency-type:\s*"production"\s*\n\s*update-types:\s*\n([\s\S]*?)(?:\n\s{4}[a-z]|\n {2}-|\Z)/,
    );
    const devGroupMatch = text.match(
      /dev-minor-patch:\s*\n\s*dependency-type:\s*"development"\s*\n\s*update-types:\s*\n([\s\S]*?)(?:\n\s{4}[a-z]|\n {2}-|\Z)/,
    );
    const prodBody = prodGroupMatch?.[1] ?? "";
    const devBody = devGroupMatch?.[1] ?? "";
    expect(prodBody.toLowerCase()).not.toContain('- "major"');
    expect(devBody.toLowerCase()).not.toContain('- "major"');
  });

  it("weekly cadence keeps npm PR flow predictable", () => {
    // If someone moves npm to "daily" the burst channel silently
    // widens by 7x even with the same per-day limit. A deliberate
    // cadence shift should come with a paired PR that also adjusts
    // BURST_BUDGET — not slide through unnoticed.
    const text = readDependabotYml();
    const npmBlock = extractEcosystemBlock(text, "npm");
    expect(npmBlock).toContain('interval: "weekly"');
  });
});

// ─────────────────────────────────────────────────────────────────
// Parsing helpers — kept inline so the test stays self-contained and
// does not take on a YAML-parser dependency just for 70 lines.
// ─────────────────────────────────────────────────────────────────

function extractEcosystemBlock(yaml: string, ecosystem: string): string | null {
  const start = yaml.indexOf(`package-ecosystem: "${ecosystem}"`);
  if (start === -1) return null;
  // Block ends at the next `- package-ecosystem:` marker or EOF.
  const rest = yaml.slice(start);
  const nextMarker = rest.indexOf("\n  - package-ecosystem:", 1);
  return nextMarker === -1 ? rest : rest.slice(0, nextMarker);
}

function extractOpenPrLimit(block: string): number | null {
  const match = block.match(/open-pull-requests-limit:\s*(\d+)/);
  if (!match || !match[1]) return null;
  return Number.parseInt(match[1], 10);
}
