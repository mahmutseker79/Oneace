// P2-4 (audit v1.1 §5.26) — supply chain hygiene guard.
//
// Two operational invariants pinned here so a future refactor can't
// quietly regress the automation we just wired:
//
//   1. `.github/dependabot.yml` exists and is a valid Dependabot v2
//      config covering npm + github-actions ecosystems. Without this
//      file, a CVE on `next` or `@prisma/client` waits on someone
//      manually running `pnpm outdated`.
//   2. `package.json` pins `engines.node`, `engines.pnpm`, and the
//      `packageManager` field. Without these, a new dev with Node 18
//      or pnpm 8 can `install` the repo without any warning and ship
//      subtle lockfile drift to CI.
//
// Static reads only — parse YAML and JSON, no runtime needed.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");

const PACKAGE_JSON = JSON.parse(
  readFileSync(resolve(REPO_ROOT, "package.json"), "utf8"),
) as {
  engines?: Record<string, string>;
  packageManager?: string;
};

const DEPENDABOT_YAML = readFileSync(
  resolve(REPO_ROOT, ".github", "dependabot.yml"),
  "utf8",
);

describe("P2-4 §5.26 — package.json pins Node + pnpm versions", () => {
  it("has an `engines` block", () => {
    // Without engines, `npm install` on a mismatched Node major will
    // succeed silently even when the deps require a newer runtime.
    expect(PACKAGE_JSON.engines).toBeDefined();
    expect(typeof PACKAGE_JSON.engines).toBe("object");
  });

  it("pins `engines.node` at >= 20 (CI uses node 20)", () => {
    // The CI workflow installs `node-version: "20"`, so local setups
    // below that are a recipe for "works-on-my-machine" surprises.
    const node = PACKAGE_JSON.engines?.node;
    expect(node, "engines.node must be set").toBeDefined();
    // Accept either a range (">=20.0.0") or a caret shorthand. We
    // only care that 20 is the floor.
    expect(node).toMatch(/^(>=|\^)?20(\.\d+)*(\.\d+)*/);
  });

  it("pins `engines.pnpm` at >= 9 (CI uses pnpm 9.12)", () => {
    const pnpm = PACKAGE_JSON.engines?.pnpm;
    expect(pnpm, "engines.pnpm must be set").toBeDefined();
    // Same reasoning as node — we only pin the major floor, not a
    // fully-specified version (that's what `packageManager` does).
    expect(pnpm).toMatch(/^(>=|\^)?9(\.\d+)*(\.\d+)*/);
  });

  it("sets `packageManager` to a specific pnpm version (Corepack)", () => {
    // `packageManager` is the Corepack-enforced version — if this is
    // missing, a dev with a different pnpm major can regenerate the
    // lockfile in ways CI (which pins 9.12.0) will reject.
    expect(PACKAGE_JSON.packageManager).toBeDefined();
    expect(PACKAGE_JSON.packageManager).toMatch(/^pnpm@\d+\.\d+\.\d+/);
  });
});

describe("P2-4 §5.26 — .github/dependabot.yml covers both ecosystems", () => {
  it("is a v2 Dependabot config", () => {
    // Dependabot only recognizes `version: 2`. A file without this
    // header is ignored silently — no errors, no PRs, nothing.
    expect(DEPENDABOT_YAML).toMatch(/^version:\s*2\b/m);
  });

  it("has an `updates:` section", () => {
    expect(DEPENDABOT_YAML).toMatch(/^updates:\s*$/m);
  });

  it("covers the `npm` ecosystem (production deps)", () => {
    // This is the CVE watch-dog for `next`, `@prisma/client`, etc.
    // If this entry goes missing, the security PR channel closes.
    expect(DEPENDABOT_YAML).toMatch(/package-ecosystem:\s*["']?npm["']?/);
  });

  it("covers the `github-actions` ecosystem", () => {
    // Action versions matter too — e.g. `actions/checkout@v3` vs @v4
    // have different Node versions. A drift here is a slow-burn
    // reliability issue, not a security one, but still worth pinning.
    expect(DEPENDABOT_YAML).toMatch(
      /package-ecosystem:\s*["']?github-actions["']?/,
    );
  });

  it("schedules npm updates at least weekly", () => {
    // A stricter cadence (daily) generates too much review noise; a
    // looser one (monthly) lets CVEs pile up. Weekly is the floor.
    expect(DEPENDABOT_YAML).toMatch(
      /interval:\s*["']?(daily|weekly)["']?/,
    );
  });

  it("has an `open-pull-requests-limit` so the queue can't explode", () => {
    // The default is 5 — we pin it explicitly so a future refactor
    // can't silently raise it (which would drown the reviewer).
    expect(DEPENDABOT_YAML).toMatch(/open-pull-requests-limit:\s*\d+/);
  });
});
