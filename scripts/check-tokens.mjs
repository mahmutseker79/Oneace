#!/usr/bin/env node
/**
 * scripts/check-tokens.mjs
 *
 * Verifies that tokens declared in docs/design-spec/tokens.json have matching
 * runtime CSS custom properties in src/app/globals.css.
 *
 * This is a "bridge" validator, not a strict 1:1 mapper — tokens.json uses a
 * semantic spec (e.g. shadow.sm, shadow.md) while globals.css uses semantic
 * aliases (--shadow-card, --shadow-popover). The BRIDGE table below declares
 * the intended mapping, and the script reports drift:
 *
 *   ✓ both sides present
 *   ✗ tokens.json declares it but globals.css is missing the CSS var
 *   ⚠ globals.css has it but tokens.json doesn't (orphan var — optional warning)
 *
 * Exit code: 0 if all REQUIRED bridges pass, 1 otherwise.
 * Run: `node scripts/check-tokens.mjs` or via `scripts/verify.sh` Phase 8.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const TOKENS_PATH = join(ROOT, "docs/design-spec/tokens.json");
const CSS_PATH = join(ROOT, "src/app/globals.css");

// ─── Bridge table ────────────────────────────────────────────
// Each entry links a tokens.json path (array of keys) to a CSS variable.
// `required: true` means missing CSS var is a failure; `false` means warning.
const BRIDGE = [
  // Radius — tokens.json uses px values, globals.css uses calc(var(--radius) ± n)
  { token: ["radius", "sm"], cssVar: "--radius-sm", required: true },
  { token: ["radius", "md"], cssVar: "--radius-md", required: true },
  { token: ["radius", "lg"], cssVar: "--radius-lg", required: true },
  { token: ["radius", "xl"], cssVar: "--radius-xl", required: true },

  // Motion durations — tokens.json: fast/default/slow, globals.css: fast/normal/slow
  { token: ["motion", "duration", "fast"], cssVar: "--transition-fast", required: true },
  { token: ["motion", "duration", "default"], cssVar: "--transition-normal", required: true },
  { token: ["motion", "duration", "slow"], cssVar: "--transition-slow", required: true },

  // Shadow — tokens.json: sm/md/lg/xl scale, globals.css: semantic aliases
  { token: ["shadow", "sm"], cssVar: "--shadow-card", required: true,
    note: "semantic alias (scale → role)" },
  { token: ["shadow", "md"], cssVar: "--shadow-elevated", required: true,
    note: "semantic alias (scale → role)" },
  { token: ["shadow", "lg"], cssVar: "--shadow-popover", required: true,
    note: "semantic alias (scale → role)" },

  // Form control heights — not in tokens.json yet, but should be
  { token: ["control", "height", "sm"], cssVar: "--control-h-sm", required: true },
  { token: ["control", "height", "md"], cssVar: "--control-h-md", required: true },
  { token: ["control", "height", "lg"], cssVar: "--control-h-lg", required: true },
];

// ─── Helpers ─────────────────────────────────────────────────
function getByPath(obj, path) {
  return path.reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function cssHasVar(css, varName) {
  // Match `--name:` at start of a declaration (allow whitespace indent).
  const pattern = new RegExp(`^\\s*${varName.replace(/-/g, "\\-")}\\s*:`, "m");
  return pattern.test(css);
}

// ─── Load inputs ─────────────────────────────────────────────
let tokens;
try {
  tokens = JSON.parse(readFileSync(TOKENS_PATH, "utf8"));
} catch (err) {
  console.error(`✗ Cannot read tokens.json at ${TOKENS_PATH}: ${err.message}`);
  process.exit(1);
}

let css;
try {
  css = readFileSync(CSS_PATH, "utf8");
} catch (err) {
  console.error(`✗ Cannot read globals.css at ${CSS_PATH}: ${err.message}`);
  process.exit(1);
}

// ─── Walk bridge ─────────────────────────────────────────────
const results = { pass: [], fail: [], warn: [] };

for (const entry of BRIDGE) {
  const { token, cssVar, required, note } = entry;
  const tokenValue = getByPath(tokens, token);
  const cssPresent = cssHasVar(css, cssVar);
  const tokenKey = token.join(".");

  if (tokenValue !== undefined && cssPresent) {
    results.pass.push({ tokenKey, cssVar, note });
  } else if (tokenValue === undefined && !cssPresent) {
    // Both missing — only warn if required, else silent
    if (required) {
      results.fail.push({
        tokenKey,
        cssVar,
        reason: "both tokens.json and globals.css are missing this entry",
      });
    }
  } else if (tokenValue !== undefined && !cssPresent) {
    // Declared in spec but no runtime var
    const bucket = required ? results.fail : results.warn;
    bucket.push({ tokenKey, cssVar, reason: `tokens.json has ${tokenKey} but globals.css lacks ${cssVar}`, note });
  } else {
    // CSS var exists but not in tokens.json (orphan)
    results.warn.push({
      tokenKey,
      cssVar,
      reason: `globals.css has ${cssVar} but tokens.json is missing ${tokenKey}`,
      note,
    });
  }
}

// ─── Report ──────────────────────────────────────────────────
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const GREY = "\x1b[90m";
const RESET = "\x1b[0m";

console.log(`\nDesign token sync check — ${BRIDGE.length} bridges\n`);

for (const r of results.pass) {
  const suffix = r.note ? `  ${GREY}(${r.note})${RESET}` : "";
  console.log(`  ${GREEN}✓${RESET} ${r.tokenKey} ↔ ${r.cssVar}${suffix}`);
}
for (const r of results.warn) {
  const suffix = r.note ? `  ${GREY}(${r.note})${RESET}` : "";
  console.log(`  ${YELLOW}⚠${RESET} ${r.reason}${suffix}`);
}
for (const r of results.fail) {
  console.log(`  ${RED}✗${RESET} ${r.reason}`);
}

console.log(
  `\n${results.pass.length} ok, ${results.warn.length} warn, ${results.fail.length} fail\n`,
);

process.exit(results.fail.length > 0 ? 1 : 0);
