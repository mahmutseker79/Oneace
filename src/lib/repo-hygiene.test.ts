// P3-2 (audit v1.1 §5.31) — repo hygiene guard.
//
// Three drift-prone artifacts that the audit called out:
//
//   1. `test-artifacts/`, `TEST_REPORT.md`, `test-results/`,
//      `playwright-report/` sneak into commits because they live at
//      the repo root and look like source. Must be in `.gitignore`.
//   2. `src/app/_unused_onboarding_copy/` was a dead copy of an older
//      onboarding shell (pre-P7). Keeping it makes grep and import
//      graphs dishonest — removed and pinned here so nobody restores
//      it "just in case".
//   3. `CLAUDE.md` must carry an "## OneAce Architecture" section so
//      future Claude sessions don't re-derive the soft-delete,
//      capability, cron, analytics invariants every time.
//
// Static read only. No network, no Prisma, no JSDOM.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");
const GITIGNORE = readFileSync(resolve(REPO_ROOT, ".gitignore"), "utf8");
const CLAUDE_MD = readFileSync(resolve(REPO_ROOT, "CLAUDE.md"), "utf8");

describe("P3-2 §5.31 — .gitignore covers scratch / report outputs", () => {
  const patterns = ["/test-artifacts/", "/TEST_REPORT.md", "/test-results/", "/playwright-report/"];
  for (const pattern of patterns) {
    it(`ignores '${pattern}'`, () => {
      expect(
        GITIGNORE.includes(pattern),
        `.gitignore must list '${pattern}' — otherwise per-session rollups end up tracked`,
      ).toBe(true);
    });
  }
});

describe("P3-2 §5.31 — dead onboarding copy was removed", () => {
  it("src/app/_unused_onboarding_copy/ does not exist", () => {
    const dead = resolve(REPO_ROOT, "src", "app", "_unused_onboarding_copy");
    expect(
      existsSync(dead),
      "src/app/_unused_onboarding_copy/ must stay removed — grep / import graph dishonesty",
    ).toBe(false);
  });
});

describe("P3-2 §5.31 — CLAUDE.md has an OneAce Architecture section", () => {
  it("has a top-level '## OneAce Architecture' heading", () => {
    expect(
      /^## OneAce Architecture\b/m.test(CLAUDE_MD),
      "CLAUDE.md must carry a '## OneAce Architecture' section — keeps session bootstraps honest",
    ).toBe(true);
  });

  it("covers soft-delete, capabilities, cron ledger, analytics, i18n", () => {
    const needles = [
      /isArchived/,
      /requireCapability|Capabilities/i,
      /CronRun|withCronIdempotency/,
      /track\(event|analytics facade|track\(/i,
      /SUPPORTED_LOCALES/,
    ];
    for (const needle of needles) {
      expect(
        needle.test(CLAUDE_MD),
        `OneAce Architecture section must reference ${needle.source} — invariants cannot be invisible`,
      ).toBe(true);
    }
  });

  it("the section is non-trivial (>=40 lines of prose)", () => {
    const match = CLAUDE_MD.match(/## OneAce Architecture([\s\S]*?)\n## [A-Z]/);
    expect(match, "OneAce Architecture section must be bounded by a following H2").not.toBeNull();
    const body = match?.[1];
    const lines = body.split("\n").filter((l) => l.trim().length > 0);
    expect(
      lines.length,
      "OneAce Architecture section must carry real content (>=40 non-empty lines)",
    ).toBeGreaterThanOrEqual(40);
  });
});
