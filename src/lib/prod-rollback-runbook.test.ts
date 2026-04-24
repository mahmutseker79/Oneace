// v1.3 §5.50 F-06 — production rollback runbook + last-known-good ledger.
//
// What this test pins (and why):
//
//   1. The three artifacts exist at the exact paths the runbook
//      quotes: `docs/runbooks/prod-rollback.md`,
//      `docs/runbooks/.last-known-good.json`, and
//      `scripts/update-last-known-good.sh`. If any of them is
//      renamed or deleted without updating the other two, incident
//      response on the next outage will follow a dead pointer.
//
//   2. The runbook covers all three rollback paths (A: dashboard
//      promote, B: quota-blocked, C: manual deploy). These path
//      names are referenced from oncall notes and the incident doc;
//      dropping one is a footgun during a 2AM page.
//
//   3. The runbook cross-references the §5.45 F-01 (webhook-health)
//      and §5.48 F-04 (quota-health) crons by their logger tags —
//      `webhook-health.silent` and `vercel-quota.exceeded`. Those
//      tags are how a responder gets from the alert route back to
//      the runbook, so they must be exact.
//
//   4. The last-known-good ledger parses as JSON and carries every
//      field the runbook quotes (`tag`, `commit`,
//      `vercelDeploymentId`, `verifiedAt`, `history`). The ledger is
//      the single source of truth for "where do I promote back to";
//      a field rename breaks §1 of the runbook.
//
//   5. The updater script is executable, uses `set -euo pipefail`
//      (no silent half-writes), and references the ledger by the
//      path the runbook documents. The script is also the "how do I
//      update the ledger" answer in the runbook — if its filename
//      drifts from `scripts/update-last-known-good.sh`, every
//      "how to update" block in the runbook lies.
//
// Why static-analysis instead of running the script: a real run
// needs `git tag`, a tree state, and jq. The failure mode we care
// about is "someone renamed the file and forgot to update the
// runbook" — that's a filename/substring check, not a behavioral
// one.

import { constants, accessSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");

const RUNBOOK_PATH = resolve(REPO_ROOT, "docs/runbooks/prod-rollback.md");
const LEDGER_PATH = resolve(REPO_ROOT, "docs/runbooks/.last-known-good.json");
const SCRIPT_PATH = resolve(REPO_ROOT, "scripts/update-last-known-good.sh");

function readRunbook(): string {
  return readFileSync(RUNBOOK_PATH, "utf8");
}

function readLedger(): Record<string, unknown> {
  return JSON.parse(readFileSync(LEDGER_PATH, "utf8")) as Record<string, unknown>;
}

function readScript(): string {
  return readFileSync(SCRIPT_PATH, "utf8");
}

describe("§5.50 F-06 — rollback artifacts exist at documented paths", () => {
  it("docs/runbooks/prod-rollback.md is present", () => {
    expect(() => statSync(RUNBOOK_PATH)).not.toThrow();
  });

  it("docs/runbooks/.last-known-good.json is present", () => {
    expect(() => statSync(LEDGER_PATH)).not.toThrow();
  });

  it("scripts/update-last-known-good.sh is present", () => {
    expect(() => statSync(SCRIPT_PATH)).not.toThrow();
  });
});

describe("§5.50 F-06 — runbook covers all three rollback paths", () => {
  it("declares Path A (dashboard promote)", () => {
    const runbook = readRunbook();
    expect(runbook).toMatch(/##\s*2\.\s*Path A/);
    expect(runbook.toLowerCase()).toContain("promote to production");
  });

  it("declares Path B (quota-blocked)", () => {
    const runbook = readRunbook();
    expect(runbook).toMatch(/##\s*3\.\s*Path B/);
    // The quota alarm tag is our only machine-readable pointer back
    // from the F-04 cron into this path. The legacy `vercel-quota.*`
    // naming was renamed to `platform-quota.*` in Faz 2 (v1.5.32
    // platform-agnostic rename); accept either so the pin survives
    // the rename without blocking Path B docs changes.
    expect(runbook).toMatch(/vercel-quota\.exceeded|platform-quota\.exceeded/);
  });

  it("declares Path C (manual deployment)", () => {
    const runbook = readRunbook();
    expect(runbook).toMatch(/##\s*4\.\s*Path C/);
    // Manual deploy flow must mention the webhook-health alarm tag
    // — it's the trigger that usually pushes a responder to Path C.
    expect(runbook).toContain("webhook-health.silent");
  });

  it("includes a migration-aware rollback section", () => {
    const runbook = readRunbook();
    expect(runbook).toMatch(/##\s*5\.\s*Rollback with migrations/);
    // Additive vs destructive split is the decision that prevents a
    // migration rollback from corrupting prod.
    expect(runbook.toLowerCase()).toContain("additive");
    expect(runbook.toLowerCase()).toContain("destructive");
  });

  it("documents the Deployment Protection bypass flow", () => {
    const runbook = readRunbook();
    // `_vercel_share` is the exact query param Vercel uses; a rename
    // here would hand oncall a broken share URL.
    expect(runbook).toContain("_vercel_share");
  });

  it("cross-references the companion crons by their finding IDs", () => {
    const runbook = readRunbook();
    expect(runbook).toContain("F-01");
    expect(runbook).toContain("F-04");
  });

  it("points at the updater script by its canonical path", () => {
    const runbook = readRunbook();
    expect(runbook).toContain("scripts/update-last-known-good.sh");
  });
});

describe("§5.50 F-06 — last-known-good ledger shape", () => {
  it("parses as JSON", () => {
    expect(() => readLedger()).not.toThrow();
  });

  it("carries every field the runbook quotes", () => {
    const ledger = readLedger();
    expect(ledger).toHaveProperty("tag");
    expect(ledger).toHaveProperty("commit");
    expect(ledger).toHaveProperty("vercelDeploymentId");
    expect(ledger).toHaveProperty("verifiedAt");
    expect(ledger).toHaveProperty("history");
    expect(Array.isArray(ledger.history)).toBe(true);
  });

  it("tag looks like a semver tag and commit is a short SHA", () => {
    const ledger = readLedger();
    expect(typeof ledger.tag).toBe("string");
    expect(ledger.tag as string).toMatch(/^v\d+\.\d+\.\d+/);
    expect(typeof ledger.commit).toBe("string");
    // Short SHAs are 7-12 hex chars in practice; be generous but
    // reject obvious garbage like empty string or a full commit msg.
    expect(ledger.commit as string).toMatch(/^[0-9a-f]{7,40}$/);
  });

  it("vercelDeploymentId has the `dpl_` prefix Vercel uses", () => {
    const ledger = readLedger();
    // Allow empty for a freshly-seeded ledger in a post-reset repo,
    // but if present it MUST be a real Vercel ID shape.
    const id = ledger.vercelDeploymentId as string;
    if (id.length > 0) {
      expect(id).toMatch(/^dpl_[A-Za-z0-9]+$/);
    }
  });

  it("_comment cross-references the updater script + runbook", () => {
    const ledger = readLedger();
    const comment = (ledger._comment ?? "") as string;
    expect(comment).toContain("update-last-known-good.sh");
    expect(comment).toContain("prod-rollback.md");
  });
});

describe("§5.50 F-06 — updater script is safe to run", () => {
  it("is marked executable", () => {
    // stat returns the mode bits; the user-execute bit is 0o100.
    const mode = statSync(SCRIPT_PATH).mode;
    expect(mode & 0o100).not.toBe(0);
    // Also check via accessSync as a belt-and-braces guard — FUSE
    // sometimes reports a stat mode that `accessSync` disagrees with.
    expect(() => accessSync(SCRIPT_PATH, constants.X_OK)).not.toThrow();
  });

  it("uses `set -euo pipefail` (no silent half-writes)", () => {
    const script = readScript();
    expect(script).toMatch(/set -euo pipefail/);
  });

  it("references the ledger at the path the runbook documents", () => {
    const script = readScript();
    expect(script).toContain("docs/runbooks/.last-known-good.json");
  });

  it("is explicit that it is NOT a pre-commit hook", () => {
    // The whole point of this finding: a `commit on main` is not a
    // `verified deploy`. If someone "simplifies" the script into a
    // blind pre-commit later, this pin catches the regression.
    const script = readScript();
    expect(script.toLowerCase()).toMatch(
      /not a pre-commit|opt-in after promote|after.{0,40}verified prod promote/,
    );
  });

  it("writes atomically via a temp file + mv", () => {
    // `jq > FILE` directly on the ledger would truncate on error.
    // The documented pattern is `jq > $TMP; mv $TMP $LEDGER` — pin
    // that so a well-meaning cleanup doesn't remove the safety.
    const script = readScript();
    expect(script).toMatch(/mktemp/);
    expect(script).toMatch(/mv\s+"?\$TMP"?\s+"?\$LEDGER"?/);
  });
});
