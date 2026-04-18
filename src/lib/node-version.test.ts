// v1.2.17 — Node 22 upgrade pin.
//
// Node 20 LTS entered maintenance in April 2026. This repo upgraded to
// Node 22 (Active LTS through October 2027). The pin lives in three
// places that must stay consistent:
//
//   1. package.json engines.node — floor for npm/pnpm install
//   2. .github/workflows/*.yml    — every `node-version:` in CI
//   3. .nvmrc                     — local dev pin for `nvm use`
//
// Vercel reads `engines.node` from package.json automatically, so
// there's no Vercel-specific pin to track.
//
// If you legitimately need to move Node again, bump ALL three at once.
// Mixed Node versions across local / CI / prod has cost us debugging
// time before ("works on my machine" → CI green → Vercel breaks).

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..");
const PKG = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
  engines?: { node?: string };
};
const NVMRC = readFileSync(join(REPO_ROOT, ".nvmrc"), "utf8").trim();
const WORKFLOWS_DIR = join(REPO_ROOT, ".github", "workflows");

describe("Node version pins are consistent (v1.2.17)", () => {
  it("package.json engines.node demands >=22.0.0", () => {
    expect(PKG.engines?.node).toBe(">=22.0.0");
  });

  it(".nvmrc pins the local dev version to 22", () => {
    // Accept plain "22" or explicit minor/patch pins like "22.22.0".
    expect(NVMRC).toMatch(/^22(\.\d+(\.\d+)?)?$/);
  });

  it("every GitHub workflow pins node-version to 22", () => {
    const files = readdirSync(WORKFLOWS_DIR).filter((f) => f.endsWith(".yml"));
    // Sanity pin — if someone deletes the workflows, this test must
    // still fail loudly instead of silently passing with 0 files.
    expect(files.length).toBeGreaterThan(0);

    const violations: Array<{ file: string; line: number; text: string }> = [];
    for (const file of files) {
      const source = readFileSync(join(WORKFLOWS_DIR, file), "utf8");
      const lines = source.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const raw = lines[i] ?? "";
        // Match `node-version: <value>` with optional quotes.
        const m = raw.match(/^\s*node-version:\s*["']?([^"'\s#]+)["']?\s*(#.*)?$/);
        if (!m) continue;
        const value = m[1];
        // Accept "22", "22.x", "22.22", "22.22.0" — reject 20/18/anything else.
        if (!/^22(\.(\d+|x))?(\.\d+)?$/.test(value ?? "")) {
          violations.push({ file, line: i + 1, text: raw });
        }
      }
    }
    const summary = violations.map((v) => `${v.file}:${v.line}  ${v.text.trim()}`);
    expect(summary, `Non-22 node-version pins found:\n${summary.join("\n")}`).toEqual([]);
  });

  it("no workflow still pins Node 20 (regression guard)", () => {
    const files = readdirSync(WORKFLOWS_DIR).filter((f) => f.endsWith(".yml"));
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(join(WORKFLOWS_DIR, file), "utf8");
      // Search for the specific strings we migrated away from.
      if (/^\s*node-version:\s*["']?20/m.test(source)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
