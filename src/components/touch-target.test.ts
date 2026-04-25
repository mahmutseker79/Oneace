// Sprint 1 PR #2 — 44px touch-target floor on primary tap surfaces
// (UX/UI audit Apr-25 §B-3).
//
// WCAG 2.5.5 (Target Size, Level AAA) and the iOS Human Interface
// Guidelines both call for a minimum 44×44 CSS pixel hit-area on
// pointer targets. Pre-PR audit found the floor met in only one
// file (button.tsx icon size). This PR raises:
//
//   1. `--control-h-md` token to 2.75rem (44px) so default Button,
//      Input, Select, Textarea reach 44px in lock-step.
//   2. Sidebar nav items to `min-h-11` + `py-3` (≈ 48px tap height).
//   3. Mobile drawer items to `min-h-11` + `py-3`.
//   4. Header avatar trigger to `min-h-11 min-w-11`.
//
// Why a static test: Tailwind purges unused classes, so we cannot
// assert "computed style ≥ 44px" without a full DOM render. But the
// invariant we care about is the source-level pattern: the floor
// classes are present where they should be. A pure source-text
// assertion costs nothing to run and is trivial to update if a
// future refactor renames a token.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");

function read(relative: string): string {
  return readFileSync(resolve(REPO_ROOT, relative), "utf8");
}

const GLOBALS = read("src/app/globals.css");
const SIDEBAR = read("src/components/shell/sidebar.tsx");
const MOBILE_NAV = read("src/components/shell/mobile-nav.tsx");
const HEADER = read("src/components/shell/header.tsx");
const BUTTON = read("src/components/ui/button.tsx");

describe("PR #2 §B-3 — control height token raised to 44px floor", () => {
  it("--control-h-md is 2.75rem (44px) — default Button/Input/Select", () => {
    // The lock-step token. Pinning the literal so a future cleanup
    // doesn't quietly drop us back below the bar.
    expect(GLOBALS).toMatch(/--control-h-md:\s*2\.75rem/);
  });

  it("--control-h-lg is 3rem (48px) — Material Design recommended", () => {
    expect(GLOBALS).toMatch(/--control-h-lg:\s*3rem/);
  });

  it("--control-h-sm stays at 36px for non-touch dense surfaces", () => {
    // Keeping the small variant explicit so callers know the small
    // size is *opt-in* compactness, not the default.
    expect(GLOBALS).toMatch(/--control-h-sm:\s*2\.25rem/);
  });

  it("button.tsx icon size still pins min 44px (was already correct)", () => {
    // The icon variant was the only place that met the bar pre-PR;
    // verify we did not regress it during the token bump.
    expect(BUTTON).toMatch(/min-h-\[44px\]\s+min-w-\[44px\]/);
  });
});

describe("PR #2 §B-3 — sidebar nav items meet 44px floor", () => {
  it("renderItem applies min-h-11 + py-3 for tap-safe height", () => {
    // The renderItem helper is the canonical row shape. A regression
    // here would silently drop every desktop sidebar item below the
    // bar, so we pin the two classes together.
    expect(SIDEBAR).toMatch(/min-h-11[\s\S]*?py-3/);
  });
});

describe("PR #2 §B-3 — mobile-nav drawer items meet 44px floor", () => {
  it("renderItem applies min-h-11 + py-3 for tap-safe height", () => {
    expect(MOBILE_NAV).toMatch(/min-h-11[\s\S]*?py-3/);
  });

  it("does not regress to py-2.5 (would be ≈ 40px, below floor)", () => {
    // Catching the most likely regression direction explicitly.
    expect(MOBILE_NAV).not.toMatch(/py-2\.5\s+text-sm font-medium transition-colors/);
  });
});

describe("PR #2 §B-3 — header avatar trigger meets 44px floor", () => {
  it("avatar button enforces min-h-11 min-w-11 on the click area", () => {
    // The visible avatar stays h-8 (32px) for visual density; the
    // hit-area expansion is on the wrapping <button>.
    expect(HEADER).toMatch(/min-h-11\s+min-w-11/);
  });

  it("avatar button still has aria-label so screen readers can announce sign out", () => {
    // We added aria-label in this PR to give the button a name —
    // the title attribute alone is not announced reliably.
    expect(HEADER).toMatch(/aria-label=\{labels\.signOut\}/);
  });
});
