// P2-3 (audit v1.1 §5.25) — keyboard-accessible skip link guard.
//
// WCAG 2.1 AA SC 2.4.1 (Bypass Blocks) asks that any page with
// repeated blocks of content (sidebar nav, marketing nav) expose a
// way to jump past them to the main content. The (app) layout has
// carried this since 714e2d4, but (marketing) did not. This
// remediation extends the pattern to (marketing), and this test
// pins both layouts so a future refactor can't quietly regress.
//
// Why a static test: the layout files are async server components
// that pull i18n + session data to render, so a JSDOM render would
// be expensive for what is a pure-markup invariant. Reading the
// source and asserting the href + target pair gives us the same
// confidence for ~zero cost.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");

function read(relative: string): string {
  return readFileSync(resolve(REPO_ROOT, relative), "utf8");
}

// Escape parens because the path contains route-group segments.
const APP_LAYOUT = read("src/app/(app)/layout.tsx");
const MARKETING_LAYOUT = read("src/app/(marketing)/layout.tsx");
const EN_CATALOG = read("src/lib/i18n/messages/en.ts");
const TR_CATALOG = read("src/lib/i18n/messages/tr.ts");

describe("P2-3 §5.25 — a11y skip link in (app) layout", () => {
  it('has an anchor with href="#main-content"', () => {
    expect(APP_LAYOUT).toMatch(/href=["']#main-content["']/);
  });

  // Sprint 1 PR #5 §B-5: the visible label now flows from the i18n
  // catalog instead of being hardcoded English. We pin the catalog
  // call site so a future edit can't accidentally inline the string
  // again, and pin the catalog values so EN + TR both stay covered.
  it("renders the skip-link label via t.common.skipToMain (i18n)", () => {
    expect(APP_LAYOUT).toMatch(/\{t\.common\.skipToMain\}/);
  });

  it("hides the link visually until focused (sr-only + focus:not-sr-only)", () => {
    // Without these two classes together, either the link is
    // always visible (ugly) or always invisible (broken). The
    // pair is what makes it a proper skip link.
    expect(APP_LAYOUT).toMatch(/\bsr-only\b/);
    expect(APP_LAYOUT).toMatch(/focus:not-sr-only\b/);
  });

  it('has a <main id="main-content"> target', () => {
    // The jump target. If the id drifts off <main>, the skip link
    // points at nothing and screen readers announce nothing.
    expect(APP_LAYOUT).toMatch(/<main\s+[^>]*id=["']main-content["']/);
  });
});

describe("P2-3 §5.25 — a11y skip link in (marketing) layout", () => {
  it('has an anchor with href="#main-content"', () => {
    expect(MARKETING_LAYOUT).toMatch(/href=["']#main-content["']/);
  });

  it("renders the skip-link label via t.common.skipToMain (i18n)", () => {
    expect(MARKETING_LAYOUT).toMatch(/\{t\.common\.skipToMain\}/);
  });

  it("awaits getMessages() so the locale resolves at render time", () => {
    // Sprint 1 PR #5 §B-5: the marketing layout was a sync function
    // pre-PR. It is now async + awaits getMessages(); regressing
    // would leave `t` undefined and crash render.
    expect(MARKETING_LAYOUT).toMatch(/getMessages/);
    expect(MARKETING_LAYOUT).toMatch(/async function MarketingLayout/);
  });

  it("hides the link visually until focused (sr-only + focus:not-sr-only)", () => {
    expect(MARKETING_LAYOUT).toMatch(/\bsr-only\b/);
    expect(MARKETING_LAYOUT).toMatch(/focus:not-sr-only\b/);
  });

  it('has a <main id="main-content"> target', () => {
    expect(MARKETING_LAYOUT).toMatch(/<main\s+[^>]*id=["']main-content["']/);
  });
});

describe("PR #5 §B-5 — i18n catalog carries the skipToMain key in EN + TR", () => {
  it("en.ts defines skipToMain in the common namespace", () => {
    expect(EN_CATALOG).toMatch(/skipToMain:\s*"Skip to main content"/);
  });

  it("tr.ts defines skipToMain in the common namespace", () => {
    expect(TR_CATALOG).toMatch(/skipToMain:\s*"Ana içeriğe geç"/);
  });
});

describe("P2-3 §5.25 — skip link contract stays aligned across shells", () => {
  it("both layouts use the same target id so the same keyboard shortcut behaves identically", () => {
    // A subtle drift would be if (app) targets `#main-content`
    // but (marketing) targets `#content`. Both users tab, both
    // see the link, one works, one doesn't. Pin the shared id.
    const targetId = /id=["']main-content["']/;
    expect(APP_LAYOUT).toMatch(targetId);
    expect(MARKETING_LAYOUT).toMatch(targetId);
  });

  it("both layouts position the link in the top-left focus zone", () => {
    // `focus:left-*` + `focus:top-*` is what makes the link land
    // where sighted keyboard users expect. If a future refactor
    // swaps to right-aligned or bottom-aligned, screen-reader
    // parity breaks for low-vision users on zoom.
    expect(APP_LAYOUT).toMatch(/focus:left-4/);
    expect(APP_LAYOUT).toMatch(/focus:top-4/);
    expect(MARKETING_LAYOUT).toMatch(/focus:left-4/);
    expect(MARKETING_LAYOUT).toMatch(/focus:top-4/);
  });
});
