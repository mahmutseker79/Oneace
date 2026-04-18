// God-Mode v2 §4 — Phase 4 — hardcoded-string regression guard.
//
// The audit flagged two i18n leaks in user-facing chrome that the
// product's "localization" claim quietly relied on a reader not
// checking:
//
//   1. `src/components/shell/header.tsx` typed `searchPlaceholder`
//      in its `HeaderLabels` contract, and `src/app/(app)/layout.tsx`
//      actually passed `t.header.searchPlaceholder` in — but the
//      component's `<Input>` ignored the prop and rendered the
//      literal `"Search items, locations..."`. That's worse than a
//      missing label: it makes the wiring look done while shipping
//      English-only to every locale.
//
//   2. `src/app/(app)/onboarding/page.tsx` rendered `"Welcome to
//      OneAce"` + three trust-signal literals as string literals and
//      instantiated `<OnboardingForm labels={{}} />`. The wizard is
//      the first screen most new accounts see, so a fallback-to-en
//      drift here contradicts the README's multilingual claim more
//      loudly than anywhere else in the app.
//
// This vitest is static-analysis on purpose: no React Testing Library,
// no JSDOM, no server boot. It reads the source files with `fs` and
// asserts on the presence / absence of specific strings. That keeps
// it cheap and robust across the Next.js 15 App Router shape changes.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");

function read(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), "utf8");
}

describe("header search placeholder is sourced from the i18n catalog", () => {
  const src = read("src/components/shell/header.tsx");

  it("reads the placeholder from `labels.searchPlaceholder`", () => {
    // Positive assertion: the component must consume the typed prop.
    expect(src).toMatch(/placeholder=\{labels\.searchPlaceholder\}/);
  });

  it("does not render the pre-remediation literal placeholder", () => {
    // Negative assertion: the exact literal the audit flagged must
    // not reappear (including any neighbouring variants).
    expect(src).not.toMatch(/placeholder="Search items, locations\.\.\."/);
    expect(src).not.toMatch(/placeholder='Search items, locations\.\.\.'/);
    // Also guard against a Unicode-ellipsis variant sneaking back.
    expect(src).not.toMatch(/placeholder="Search items, locations…"/);
  });

  it("still declares `searchPlaceholder` in HeaderLabels (prop contract)", () => {
    // This is the type slot the component now reads from. If someone
    // drops it from the union, layout.tsx still compiles (the extra
    // prop would silently become unused) so we pin the declaration.
    expect(src).toMatch(/searchPlaceholder:\s*string/);
  });
});

describe("onboarding wizard page sources chrome from the i18n catalog", () => {
  const src = read("src/app/(app)/onboarding/page.tsx");

  it("does not contain the pre-remediation brand-header literals", () => {
    // Audit-visible English-only drift: these were the exact strings
    // the onboarding page rendered before Phase 4.
    expect(src).not.toMatch(/>Welcome to OneAce</);
    expect(src).not.toMatch(/>256-bit encryption</);
    expect(src).not.toMatch(/>No credit card required</);
    expect(src).not.toMatch(/>Free forever plan</);
  });

  it("calls `getMessages()` and reads the wizard namespace", () => {
    // Positive assertion: the page must go through the catalog.
    expect(src).toMatch(/getMessages\(\)/);
    expect(src).toMatch(/auth\.onboarding\.wizard/);
  });

  it("renders the wizard strings via JSX expressions, not literals", () => {
    // Each of the four strings that used to be literals must now
    // render through a `{wizard.X}` expression. We assert on the
    // expressions rather than the original English so a new locale
    // file doesn't have to touch this test.
    expect(src).toMatch(/\{wizard\.welcomeTitle\}/);
    expect(src).toMatch(/\{wizard\.welcomeSubtitle\}/);
    expect(src).toMatch(/\{wizard\.trustEncryption\}/);
    expect(src).toMatch(/\{wizard\.trustNoCard\}/);
    expect(src).toMatch(/\{wizard\.trustFreePlan\}/);
  });
});

describe("en.ts exposes the onboarding wizard namespace", () => {
  // If the wizard namespace disappears from the catalog, the page
  // renders `undefined` strings silently (server components don't
  // throw on a missing property). This test anchors the slot so
  // removing it fails CI rather than prod.
  const src = read("src/lib/i18n/messages/en.ts");

  it("declares the wizard sub-object under auth.onboarding", () => {
    expect(src).toMatch(/wizard:\s*\{/);
  });

  it("declares every wizard string the page reads", () => {
    // These must be present as keys. We don't assert on the English
    // values — a locale swap is supposed to change those — only on
    // the key contract.
    expect(src).toMatch(/welcomeTitle:/);
    expect(src).toMatch(/welcomeSubtitle:/);
    expect(src).toMatch(/trustEncryption:/);
    expect(src).toMatch(/trustNoCard:/);
    expect(src).toMatch(/trustFreePlan:/);
  });
});
