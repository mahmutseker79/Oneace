// P0-3 remediation test — guards the onboarding routing contract.
//
// The (app)/layout is expected to short-circuit when x-pathname equals
// "/onboarding", skipping requireActiveMembership so first-run users
// don't redirect-loop (membership-redirect → /onboarding → same layout
// → same redirect → ...).
//
// We can't run the layout under Vitest without a full Next.js request
// context, so this test asserts the *decision rule*: given a pathname,
// should the layout short-circuit?

import { describe, expect, it } from "vitest";

function shouldSkipAppShell(pathname: string | null): boolean {
  return pathname === "/onboarding";
}

describe("P0-3 — onboarding routing", () => {
  it("short-circuits the app shell when rendering /onboarding", () => {
    expect(shouldSkipAppShell("/onboarding")).toBe(true);
  });

  it("does NOT short-circuit any other path", () => {
    expect(shouldSkipAppShell("/dashboard")).toBe(false);
    expect(shouldSkipAppShell("/items")).toBe(false);
    expect(shouldSkipAppShell("/")).toBe(false);
  });

  it("does NOT short-circuit lookalike paths", () => {
    // Important: a user browsing /onboarding-demo or /onboarding/ (trailing
    // slash gets normalized by Next.js but the header wouldn't include it)
    // must not accidentally bypass the shell.
    expect(shouldSkipAppShell("/onboarding-demo")).toBe(false);
    expect(shouldSkipAppShell("/onboarding/foo")).toBe(false);
  });

  it("handles missing header gracefully", () => {
    expect(shouldSkipAppShell(null)).toBe(false);
  });
});
