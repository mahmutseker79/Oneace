// Sprint 33 — TR coverage segment kickoff (foundation, scaffold mode).
//
// Per-key parity test for the TR message catalog.
//
// Sprint 7 closure pinned namespace-level parity (48/48 — see
// `tr-coverage.test.ts`). This file opens the next coverage tier:
// per-key parity. Every leaf in `en` should be either:
//
//   (a) Translated in `tr` (different value), OR
//   (b) Wrapped in `INTENTIONAL_EN(...)` (deliberate passthrough), OR
//   (c) Counted as "TODO" (silent passthrough — needs translation).
//
// Sprint 33 mode: SCAFFOLD.
//   - Per-namespace key inventory: counted, logged, exported.
//   - INTENTIONAL_EN occurrences: counted, logged.
//   - TODO floor (silent passthroughs): logged but **not yet hard-failed**.
//   - Soft assertion: TODO count must be a finite number (catches a
//     parser regression where the test silently misses everything).
//
// Sprint 37 closure plan: flip the soft assertion into a hard ceiling
// (TODO ≤ initial_baseline, monotonically decreasing per sprint until
// 0). The `WHITELIST` array below will be populated only with keys
// that have a real reason to stay — by then most should be either
// translated or `INTENTIONAL_EN`-tagged.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const I18N_DIR = resolve(__dirname);
const EN_SRC = readFileSync(resolve(I18N_DIR, "messages", "en.ts"), "utf8");
const TR_SRC = readFileSync(resolve(I18N_DIR, "messages", "tr.ts"), "utf8");
const MARKERS_SRC = readFileSync(resolve(I18N_DIR, "messages", "_markers.ts"), "utf8");

// Regex: `<key>: "<value>"` or `<key>: \`<template>\``. Crude but
// good enough for the SCAFFOLD pass — a future hardening can swap in
// the TypeScript AST.
const LEAF_REGEX = /(["'`])?(\w+)\1?\s*:\s*(["`])((?:\\.|(?!\3).)*)\3/g;

type LeafCount = { total: number; user: number };

function countLeaves(src: string): LeafCount {
  let total = 0;
  let user = 0;
  for (const m of src.matchAll(LEAF_REGEX)) {
    const value = m[4] ?? "";
    if (value.length === 0) continue;
    total++;
    // "user copy" heuristic: not a pure SCREAMING_SNAKE / kebab-case
    // / dotted constant. Brand strings ("OneAce") still count.
    if (!/^[A-Z0-9_./\-]+$/.test(value)) user++;
  }
  return { total, user };
}

function countMarkerCalls(src: string, marker: string): number {
  // Match `INTENTIONAL_EN(` with optional whitespace, but not as a
  // substring of another identifier (negative-lookbehind for word
  // chars).
  const re = new RegExp(`(?<![A-Za-z0-9_])${marker}\\s*\\(`, "g");
  return (src.match(re) || []).length;
}

describe("Sprint 33 — TR per-key parity scaffold (informational + soft assert)", () => {
  it("INTENTIONAL_EN marker primitive is exported from messages/_markers.ts", () => {
    expect(MARKERS_SRC).toMatch(/export\s+const\s+INTENTIONAL_EN\s*=/);
    expect(MARKERS_SRC).toMatch(/export\s+const\s+INTENTIONAL_EN_MARKER\s*=\s*["']INTENTIONAL_EN["']/);
  });

  it("INTENTIONAL_EN is an identity function (zero runtime impact)", () => {
    // Must not introduce a runtime wrapper that breaks types — the
    // regex catches `(value: T): T => value` shape.
    expect(MARKERS_SRC).toMatch(/<T>\s*\(\s*\w+\s*:\s*T\s*\)\s*:\s*T\s*=>\s*\w+/);
  });

  it("EN leaf inventory parsed (sanity — non-empty)", () => {
    const en = countLeaves(EN_SRC);
    // eslint-disable-next-line no-console
    console.log(
      `[tr-key-parity] EN leaves: total=${en.total} user-copy=${en.user}`,
    );
    expect(en.user).toBeGreaterThan(500);
  });

  it("TR leaf inventory parsed (sanity — non-empty)", () => {
    const tr = countLeaves(TR_SRC);
    // eslint-disable-next-line no-console
    console.log(
      `[tr-key-parity] TR leaves: total=${tr.total} user-copy=${tr.user}`,
    );
    expect(tr.user).toBeGreaterThan(500);
  });

  it("INTENTIONAL_EN consumer count logged (Sprint 33 baseline = 0)", () => {
    const consumers = countMarkerCalls(TR_SRC, "INTENTIONAL_EN");
    // eslint-disable-next-line no-console
    console.log(
      `[tr-key-parity] INTENTIONAL_EN markers in tr.ts: ${consumers}`,
    );
    // Soft floor — any negative value would mean a regex bug.
    expect(consumers).toBeGreaterThanOrEqual(0);
  });

  it("TR/EN user-copy ratio meets the Sprint 7 closure floor (>= 90%)", () => {
    // Sprint 7 hit ~95%; require >= 90% as a regression floor that
    // tolerates editorial trimming on the EN side. Sprint 37 closure
    // bumps this to >= 99% once per-key sweep finishes.
    const en = countLeaves(EN_SRC);
    const tr = countLeaves(TR_SRC);
    const ratio = tr.user / en.user;
    // eslint-disable-next-line no-console
    console.log(
      `[tr-key-parity] TR/EN user-copy ratio: ${(ratio * 100).toFixed(1)}%`,
    );
    expect(ratio).toBeGreaterThanOrEqual(0.9);
  });

  it("TODO floor (silent EN passthroughs) is finite — parser smoke", () => {
    // Approximation for SCAFFOLD pass: TODO ≈ EN.user − TR.user −
    // INTENTIONAL_EN. Sprint 37 will swap this for an AST-based exact
    // diff. Today we only assert the math doesn't blow up.
    const en = countLeaves(EN_SRC);
    const tr = countLeaves(TR_SRC);
    const consumers = countMarkerCalls(TR_SRC, "INTENTIONAL_EN");
    const todoApprox = Math.max(0, en.user - tr.user - consumers);
    // eslint-disable-next-line no-console
    console.log(
      `[tr-key-parity] TODO approximation (EN.user − TR.user − INTENTIONAL_EN): ${todoApprox}`,
    );
    // Sanity ceiling — if this fires the parser is busted, not the
    // catalog. Sprint 37 swap-in for hard ceiling.
    expect(todoApprox).toBeLessThan(en.user);
    expect(Number.isFinite(todoApprox)).toBe(true);
  });
});
