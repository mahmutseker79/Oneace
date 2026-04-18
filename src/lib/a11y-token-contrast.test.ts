// v1.2 P2 §5.40 — WCAG 2.1 AA token contrast pin.
//
// The audit flagged the absence of any systemic accessibility sweep.
// This first batch lands the cheapest, highest-signal guard:
//
//   1. Parse `src/app/globals.css` to lift the `:root` and `.dark`
//      design tokens.
//   2. For each foreground/background pair the UI actually paints
//      (`--foreground` on `--background`, `--primary-foreground` on
//      `--primary`, etc.) compute the WCAG relative-luminance
//      contrast ratio and assert it clears AA (≥ 4.5 : 1 for normal
//      text).
//
// The math follows WCAG 2.1 SC 1.4.3 exactly — see
// https://www.w3.org/TR/WCAG21/#contrast-minimum. The relative
// luminance piece is the standard sRGB formula (gamma-expanded
// channels weighted by the ITU-R BT.709 coefficients).
//
// Scope — why only these pairs:
// The design token set has ~60 colors (stock levels, sheet status,
// discrepancy states, etc.). Those carry semantic meaning but the
// UI usually paints them as *background swatches* next to neutral
// text, not as their own fg/bg pair. Pinning every pair would be
// meaningless. Pinning the nine fg/bg pairs that the shadcn/Tailwind
// theme uses for body text, buttons, popovers and cards is the
// WCAG-relevant surface.
//
// This test is the static half of §5.40. The other half — axe-core +
// Playwright covering CRITICAL_PATHS — lives as a skeleton under
// `e2e/a11y.spec.ts`; see the "axe skeleton" describe block at the
// bottom of this file for the pin that the skeleton exists.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..");
const GLOBALS = readFileSync(join(REPO_ROOT, "src/app/globals.css"), "utf8");

// ──────────────────────────────────────────────────────────────────
// WCAG 2.1 contrast math
// ──────────────────────────────────────────────────────────────────

/** sRGB gamma expansion for a single normalized channel (0..1). */
function channelLuminance(c: number): number {
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance per WCAG 2.1 — L = 0.2126R + 0.7152G + 0.0722B. */
function relativeLuminance(hex: string): number {
  const m = hex.replace("#", "");
  const r = Number.parseInt(m.slice(0, 2), 16) / 255;
  const g = Number.parseInt(m.slice(2, 4), 16) / 255;
  const b = Number.parseInt(m.slice(4, 6), 16) / 255;
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

/** Contrast ratio per WCAG 2.1 — (L_light + 0.05) / (L_dark + 0.05). */
function contrastRatio(fg: string, bg: string): number {
  const L1 = relativeLuminance(fg);
  const L2 = relativeLuminance(bg);
  const [light, dark] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (light + 0.05) / (dark + 0.05);
}

// ──────────────────────────────────────────────────────────────────
// Token parser
// ──────────────────────────────────────────────────────────────────

/**
 * Lift `--token: value;` declarations from a block of CSS. Only
 * `#rrggbb` values are kept — `transparent` / `rgba()` / etc. are
 * dropped because we can't compute a contrast ratio against a
 * translucent background without knowing the composite.
 */
function extractTokens(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /--([a-z][a-z0-9-]*)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g;
  for (;;) {
    const m = re.exec(block);
    if (!m) break;
    out[m[1]] = m[2].toLowerCase();
  }
  return out;
}

/** Slice a selector's block out of the globals.css source. */
function sliceBlock(selector: string, source: string): string {
  // Anchor to line start so `.dark` doesn't match `&:is(.dark *)` etc.
  const re = new RegExp(`(^|\\n)${selector.replace(".", "\\.")}\\s*\\{`, "m");
  const m = re.exec(source);
  if (!m) throw new Error(`selector ${selector} not found in globals.css`);
  // Walk forward from the opening brace counting depth so nested
  // blocks (unlikely here, but cheap insurance) don't confuse us.
  const start = m.index + m[0].length;
  let depth = 1;
  for (let i = start; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(start, i);
    }
  }
  throw new Error(`unterminated block for ${selector}`);
}

const LIGHT = extractTokens(sliceBlock(":root", GLOBALS));
const DARK = extractTokens(sliceBlock(".dark", GLOBALS));

// ──────────────────────────────────────────────────────────────────
// Fg/bg pairs the UI actually paints
// ──────────────────────────────────────────────────────────────────

// Each entry names a foreground token and the background it lands on
// in the rendered UI. `inherit-from` is a fallback — in dark mode the
// `.dark` block doesn't redefine every token, so if a pair's fg or
// bg only exists in `:root`, we fall back to light.
const PAIRS: Array<{ fg: string; bg: string; label: string }> = [
  { fg: "foreground", bg: "background", label: "body text" },
  { fg: "card-foreground", bg: "card", label: "card text" },
  { fg: "popover-foreground", bg: "popover", label: "popover text" },
  { fg: "primary-foreground", bg: "primary", label: "primary button label" },
  { fg: "secondary-foreground", bg: "secondary", label: "secondary button label" },
  { fg: "muted-foreground", bg: "muted", label: "muted text on muted bg" },
  { fg: "muted-foreground", bg: "background", label: "muted caption on body bg" },
  { fg: "accent-foreground", bg: "accent", label: "accent label" },
  { fg: "destructive-foreground", bg: "destructive", label: "destructive button label" },
];

const WCAG_AA_NORMAL = 4.5;

function resolveToken(
  scope: Record<string, string>,
  fallback: Record<string, string>,
  key: string,
): string {
  return scope[key] ?? fallback[key];
}

// ──────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────

describe("§5.40 — WCAG 2.1 AA contrast for design token fg/bg pairs", () => {
  it("globals.css exposes a :root and a .dark block", () => {
    // Sanity pin — if a refactor drops either selector the rest of
    // the tests would false-pass on an empty map.
    expect(Object.keys(LIGHT).length).toBeGreaterThan(10);
    expect(Object.keys(DARK).length).toBeGreaterThan(10);
  });

  describe("light mode", () => {
    for (const { fg, bg, label } of PAIRS) {
      it(`${label} — --${fg} on --${bg} meets AA (4.5:1)`, () => {
        const fgHex = resolveToken(LIGHT, LIGHT, fg);
        const bgHex = resolveToken(LIGHT, LIGHT, bg);
        expect(fgHex, `--${fg} missing from :root`).toBeDefined();
        expect(bgHex, `--${bg} missing from :root`).toBeDefined();
        const ratio = contrastRatio(fgHex, bgHex);
        // Round to 2 dp for the assertion message so a failure
        // points at a meaningful number rather than 4.499999…
        expect(
          Math.round(ratio * 100) / 100,
          `--${fg} (${fgHex}) on --${bg} (${bgHex}) = ${ratio.toFixed(2)}:1 — WCAG AA requires ${WCAG_AA_NORMAL}:1`,
        ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
      });
    }
  });

  describe("dark mode", () => {
    for (const { fg, bg, label } of PAIRS) {
      it(`${label} — --${fg} on --${bg} meets AA (4.5:1)`, () => {
        const fgHex = resolveToken(DARK, LIGHT, fg);
        const bgHex = resolveToken(DARK, LIGHT, bg);
        expect(fgHex, `--${fg} unresolved in .dark or :root`).toBeDefined();
        expect(bgHex, `--${bg} unresolved in .dark or :root`).toBeDefined();
        const ratio = contrastRatio(fgHex, bgHex);
        expect(
          Math.round(ratio * 100) / 100,
          `--${fg} (${fgHex}) on --${bg} (${bgHex}) = ${ratio.toFixed(2)}:1 — WCAG AA requires ${WCAG_AA_NORMAL}:1`,
        ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
      });
    }
  });
});

// ──────────────────────────────────────────────────────────────────
// Axe skeleton presence pin
// ──────────────────────────────────────────────────────────────────

describe("§5.40 — axe skeleton is parked under e2e/", () => {
  // Purpose: the real axe sweep can't land in this batch because
  // @axe-core/playwright isn't a dependency yet and turning it on
  // will surface a remediation backlog of its own (5-15 violations
  // per the audit). But we DO want the shape parked now, so the
  // follow-up PR is "add the dep and flip `.skip` to `.describe`"
  // rather than "design the test from scratch". Pin the skeleton's
  // existence + required shape so a drive-by cleanup can't delete it.
  const skeleton = readFileSync(join(REPO_ROOT, "e2e/a11y.spec.ts"), "utf8");

  it("skeleton declares the CRITICAL_PATHS array", () => {
    expect(skeleton).toMatch(/CRITICAL_PATHS\s*(:\s*readonly\s+string\[\])?\s*=/);
  });

  it("skeleton references WCAG 2.1 AA axe tags", () => {
    expect(skeleton).toContain("wcag2aa");
    expect(skeleton).toContain("wcag21aa");
  });

  it("skeleton is gated (test.skip or describe.skip) until the dep is added", () => {
    // Without this gate the file imports @axe-core/playwright at
    // parse time and every e2e run explodes.
    expect(skeleton).toMatch(/test\.skip|describe\.skip/);
  });
});
