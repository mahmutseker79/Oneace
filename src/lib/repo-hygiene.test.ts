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

import { execFileSync } from "node:child_process";
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

// ---------------------------------------------------------------------------
// God-Mode v2 §5 — Phase 5 — extended hygiene.
//
// Pre-Phase-5 the sandbox had accumulated ~124MB of stale Prisma
// client dumps (`src/generated/prisma.old`, `prisma.stale.<pid>`), a
// `.playwright-cli/` cache, a rogue `package-lock.json`, session
// `push-*.command` / `.log` pairs, and `*-KICKOFF-PROMPT.md` scratch
// files. None of them were tracked, but the surface-area was big
// enough that `git add -A` or a misconfigured IDE could easily
// commit one. These assertions go straight to `git ls-files` (not
// `fs.readdir`) so they match the committed tree, not whatever
// happens to be on disk in the current working copy.
// ---------------------------------------------------------------------------

describe("Phase 5 §5 — committed tree is free of sandbox/session scratch", () => {
  // Read the tracked file list once per describe block. Null-byte
  // delimiter so filenames with spaces/newlines don't split.
  const trackedZ = execFileSync("git", ["-C", REPO_ROOT, "ls-files", "-z", "--full-name"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const tracked = trackedZ.split("\0").filter(Boolean);

  it("no tracked Prisma-client stale dumps (src/generated/prisma.old|stale.N)", () => {
    // `src/generated/` is already gitignored; this fires if someone
    // force-adds a 50MB Prisma dump.
    const stale = tracked.filter((f) =>
      /^src\/generated\/(prisma\.old|prisma\.stale\.\d+)(\/|$)/.test(f),
    );
    expect(stale, `stale Prisma dumps tracked: ${stale.join(", ")}`).toEqual([]);
  });

  it("no tracked FUSE-rename '.gone' artifacts", () => {
    // When the sandbox can't unlink, it falls back to `mv foo
    // foo.gone`. Those renamed shells must not ship.
    const gone = tracked.filter((f) => f.endsWith(".gone") || f.includes(".gone/"));
    expect(gone, `.gone artifacts tracked: ${gone.join(", ")}`).toEqual([]);
  });

  it("no tracked '.trash.<pid>' directories", () => {
    const trash = tracked.filter((f) => /(^|\/)\.[\w-]+\.trash\.\d+(\/|$)/.test(f));
    expect(trash, `.trash artifacts tracked: ${trash.join(", ")}`).toEqual([]);
  });

  it("no tracked package-lock.json (project is pnpm-only)", () => {
    // `packageManager: pnpm@9.12.0` in package.json. An npm lockfile
    // alongside pnpm-lock.yaml makes Vercel resolve twice.
    const npmLock = tracked.filter(
      (f) => f === "package-lock.json" || f.endsWith("/package-lock.json"),
    );
    expect(npmLock, `npm lockfile tracked: ${npmLock.join(", ")}`).toEqual([]);
  });

  it("no tracked '.playwright-cli/' browser snapshots", () => {
    const cache = tracked.filter(
      (f) => f === ".playwright-cli" || f.startsWith(".playwright-cli/"),
    );
    expect(cache, `.playwright-cli tracked: ${cache.join(", ")}`).toEqual([]);
  });

  // NOTE: `push-*.command` / `push-*.log` are intentionally tracked
  // as sprint release-process artefacts (per-release push helpers and
  // their output logs). They are NOT flagged by this suite. Only
  // truly-scratch patterns live below.

  it("no tracked '*-KICKOFF-PROMPT.md' session files", () => {
    const kickoff = tracked.filter((f) => /^[^/]+-KICKOFF-PROMPT\.md$/.test(f));
    expect(kickoff, `kickoff prompts tracked: ${kickoff.join(", ")}`).toEqual([]);
  });
});

describe("Phase 5 §5 — .gitignore covers the new scratch patterns", () => {
  // Paired assertion: if one of the tracked-tree tests above fires,
  // it usually means the pattern is missing from .gitignore too. We
  // pin the patterns here so "the gitignore covers this" stays a
  // readable single test failure message instead of only surfacing
  // when someone accidentally commits a file.
  const patterns = ["*.gone", "/.playwright-cli/", "/package-lock.json", "/*-KICKOFF-PROMPT.md"];
  for (const pattern of patterns) {
    it(`ignores '${pattern}'`, () => {
      expect(
        GITIGNORE.includes(pattern),
        `.gitignore must list '${pattern}' — Phase 5 hygiene`,
      ).toBe(true);
    });
  }
});
