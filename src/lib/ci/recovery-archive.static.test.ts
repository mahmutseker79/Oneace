// src/lib/ci/recovery-archive.static.test.ts
//
// Pinned static-analysis test for Sprint 1 (2026-04-24 hijyen).
//
// Contract:
//   - scripts/recovery/2026-04-23-god-mode/ exists and carries the
//     16 helper scripts that drove the GOD MODE recovery sprint.
//   - That directory has a README.md describing run order + what
//     each script landed.
//   - The README is linked from the memory dossier
//     (`oneace_god_mode_roadmap.md` → `scripts/recovery/...`).
//
// Guard against silent deletion / re-arrangement of the archive —
// anyone moving or pruning it has to update this test, which forces
// them to acknowledge the historical record is in flight.
//
// Lightweight file-scan only. No runtime booted.

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

describe("Sprint 1 — GOD MODE recovery archive integrity", () => {
  const root = findRepoRoot();
  const archiveDir = path.join(
    root,
    "scripts",
    "recovery",
    "2026-04-23-god-mode",
  );

  it("archive directory exists", () => {
    expect(fs.existsSync(archiveDir)).toBe(true);
    expect(fs.statSync(archiveDir).isDirectory()).toBe(true);
  });

  it("README.md documents the run order", () => {
    const readme = path.join(archiveDir, "README.md");
    expect(fs.existsSync(readme)).toBe(true);
    const body = fs.readFileSync(readme, "utf8");
    expect(/Run order \(historical\)/.test(body)).toBe(true);
    expect(/apply-recovery\.command/.test(body)).toBe(true);
    expect(/finish-recovery\.command/.test(body)).toBe(true);
  });

  it("carries all 16 archived .command scripts", () => {
    const entries = fs
      .readdirSync(archiveDir)
      .filter((f) => f.endsWith(".command"));
    // 14 hotfix + apply-recovery + finish-recovery +
    // merge-god-mode-recovery-to-main + merge-v1.7.6-auth-hardening-to-main
    // = 16 unique .command files at archive-time.
    expect(entries.length).toBe(16);
  });

  it("memory dossier reference is stable (path shape)", () => {
    // We don't load the memory file from the repo (it lives outside
    // working tree), but we pin the path shape so a rename here
    // breaks the dossier link loudly.
    const relative = path
      .relative(root, archiveDir)
      .split(path.sep)
      .join("/");
    expect(relative).toBe("scripts/recovery/2026-04-23-god-mode");
  });
});
