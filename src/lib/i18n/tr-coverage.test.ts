// Sprint 2 PR #4 — TR locale coverage regression guard.
// (UX/UI audit Apr-25 follow-up.)
//
// Pre-Sprint-2 state: `tr.ts` overrode only 4 of 47 top-level
// namespaces (app, common, permissions, notifications) — every
// other surface silently fell through to English via the
// `...en` spread. This was correct TypeScript but wrong UX:
// a TR user landed on the dashboard and saw English labels.
//
// Sprint 2 PR #1-3 widened TR override coverage to 21 namespaces:
// chrome (nav, header, mail, metadata, pwa, offline, emptyStates,
// copyLabels, billing, organizations, search, advancedFeature),
// onboarding (auth, setup), and operations (dashboard, items, scan)
// + the original 4 (app, common, permissions, notifications).
//
// This test pins that coverage so a future "let's spread less and
// rely on en" refactor doesn't quietly drop locale support.
//
// What this test does NOT enforce:
//   - Per-key parity (does every leaf string have a TR override?).
//     That would be valuable but the existing `Messages` type plus
//     `...en.X` fallback already prevents missing keys at compile
//     time. Fully translating every leaf is Sprint 3+ work.
//   - Translation quality (this is a linter, not a copy editor).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const TR_SRC = readFileSync(
  resolve(__dirname, "messages", "tr.ts"),
  "utf8",
);

// Top-level namespaces tr.ts MUST override. Adding a namespace to
// this list = "we now claim TR coverage for it; don't regress."
// Removing a namespace from this list requires a deliberate decision
// (probably: en.ts removed the namespace too).
const REQUIRED_TR_NAMESPACES = [
  // Chrome — every page renders these
  "app",
  "common",
  "permissions",
  "notifications",
  "nav",
  "advancedFeature",
  "header",
  "mail",
  "metadata",
  "pwa",
  "offline",
  "emptyStates",
  "copyLabels",
  "billing",
  "organizations",
  "search",
  // Onboarding + entry
  "auth",
  "setup",
  // Operations (Sprint 2 PR #2 + PR #3)
  "dashboard",
  "items",
  "scan",
] as const;

function extractTopLevelNamespaces(source: string): Set<string> {
  // Match `<key>: {` only at the start of a 2-space indent (top-level
  // properties of the `tr: Messages = { ... }` literal). Sub-namespaces
  // are indented 4 spaces, so the regex naturally skips them.
  const matches = source.matchAll(/^ {2}([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*\{/gm);
  const names = new Set<string>();
  for (const m of matches) {
    if (m[1]) names.add(m[1]);
  }
  return names;
}

describe("Sprint 2 PR #4 — tr.ts override coverage regression guard", () => {
  const overridden = extractTopLevelNamespaces(TR_SRC);

  it.each(REQUIRED_TR_NAMESPACES)(
    "tr.ts overrides the '%s' namespace",
    (namespace) => {
      expect(
        overridden.has(namespace),
        `tr.ts must override the '${namespace}' namespace. ` +
          `Currently overrides: ${Array.from(overridden).sort().join(", ")}`,
      ).toBe(true);
    },
  );

  it("tr.ts uses the canonical `...en.<namespace>` fallback pattern inside each override", () => {
    // The shape we want is:
    //   nav: { ...en.nav, dashboard: "Pano", ... }
    // not:
    //   nav: { dashboard: "Pano" }              ← drops every key not overridden
    //   nav: { ...en, dashboard: "Pano" }        ← spreads the wrong thing
    //
    // Catch the second mistake by checking that every namespace block
    // contains a matching `...en.<namespace>` somewhere inside.
    const offenders: string[] = [];
    for (const ns of REQUIRED_TR_NAMESPACES) {
      // Skip `app` — its override pattern is fine but the body is
      // small enough that the exact `...en.app` line is human
      // judgement; the test below catches the broader case.
      const blockMatch = TR_SRC.match(
        new RegExp(`  ${ns}:\\s*\\{([\\s\\S]*?)^  \\},`, "m"),
      );
      if (!blockMatch) continue;
      const body = blockMatch[1] ?? "";
      if (!body.includes(`...en.${ns}`)) {
        offenders.push(ns);
      }
    }
    expect(
      offenders,
      `Namespaces missing the \`...en.<namespace>\` fallback: ${offenders.join(", ")}. ` +
        "Without this spread, leaf keys not overridden in TR will be undefined at runtime.",
    ).toEqual([]);
  });

  it("imports en + Messages type from ./en", () => {
    expect(TR_SRC).toMatch(
      /import\s*\{[^}]*type Messages[^}]*\}\s*from\s*["']\.\/en["']/,
    );
    expect(TR_SRC).toMatch(/import\s*\{[^}]*\ben\b[^}]*\}\s*from\s*["']\.\/en["']/);
  });

  it("declares the typed export `tr: Messages = { ...en, ... }`", () => {
    // The shallow `...en` at the top is what makes the fallback work
    // for namespaces tr.ts hasn't overridden yet (Sprint 3 backlog
    // covers ~26 remaining namespaces). Removing this spread breaks
    // every untranslated surface.
    expect(TR_SRC).toMatch(/export const tr:\s*Messages\s*=\s*\{\s*\.\.\.en,/);
  });
});

describe("Sprint 2 — TR coverage progress signal (informational)", () => {
  it("logs the current TR override count vs target", () => {
    const overridden = extractTopLevelNamespaces(TR_SRC);
    const total = 47; // current en.ts top-level namespace count (≈)
    const ratio = (overridden.size / total) * 100;
    // eslint-disable-next-line no-console
    console.log(
      `[tr-coverage] ${overridden.size}/${total} namespaces overridden ` +
        `(${ratio.toFixed(0)}%). Sprint 3 backlog covers the remainder.`,
    );
    // Soft assertion: at least the 21-namespace baseline established
    // in Sprint 2 must be present.
    expect(overridden.size).toBeGreaterThanOrEqual(21);
  });
});
