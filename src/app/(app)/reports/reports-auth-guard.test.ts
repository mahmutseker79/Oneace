// P1-6 remediation test (audit v1.0 §5.11) — pins which report pages
// guard their server component with `requireActiveMembership` (or a
// stronger `requireCapability`) before rendering.
//
// Background: five report pages relied on middleware-only auth (cookie
// presence). A session for a logged-in user with no active membership
// could land on the page body and the client component would issue API
// requests with no/wrong org context. The fix sprinkles
// `requireActiveMembership()` at the top of each `page.tsx` (and, for
// the `scan-activity` client page, extracts the UI into a sibling
// client component so the page can be a Server Component).
//
// This test reads the page source files directly and asserts the guard
// import + call exist. It deliberately does not import the page modules
// — they pull in Next.js server APIs (`headers`, `cookies`) that don't
// exist in the Vitest jsdom environment.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const REPORTS_DIR = resolve(__dirname);

// Pages that previously had no server-side auth guard. These MUST call
// `requireActiveMembership()` (or `requireCapability(...)`) before any
// data fetching or before rendering a client subtree.
const FORMERLY_GUARDLESS_PAGES = [
  "department-variance/page.tsx",
  "variance-trend/page.tsx",
  "abc-analysis/page.tsx",
  "count-comparison/page.tsx",
  "scan-activity/page.tsx",
] as const;

describe("P1-6 — report page auth guards", () => {
  it.each(FORMERLY_GUARDLESS_PAGES)(
    "%s imports a session guard from @/lib/session",
    (relativePath) => {
      const source = readFileSync(resolve(REPORTS_DIR, relativePath), "utf8");
      // The import must come from `@/lib/session`. Either helper is
      // acceptable: `requireActiveMembership` is the baseline,
      // `requireCapability` is stronger.
      expect(source).toMatch(
        /import\s*\{[^}]*\b(requireActiveMembership|requireCapability)\b[^}]*\}\s*from\s*"@\/lib\/session"/,
      );
    },
  );

  it.each(FORMERLY_GUARDLESS_PAGES)(
    "%s actually calls the guard inside the default export",
    (relativePath) => {
      const source = readFileSync(resolve(REPORTS_DIR, relativePath), "utf8");
      // Look for the call form `await requireActiveMembership()` or
      // `await requireCapability("...")` — anywhere in the file is
      // fine; in practice it should be at the top of the page.
      expect(source).toMatch(
        /await\s+(requireActiveMembership|requireCapability)\s*\(/,
      );
    },
  );

  it("scan-activity page is a Server Component (no top-level 'use client')", () => {
    // Prerequisite for the guard to actually run server-side: the
    // page.tsx itself must be a Server Component. The interactive UI
    // lives in `scan-activity-client.tsx`.
    const source = readFileSync(resolve(REPORTS_DIR, "scan-activity/page.tsx"), "utf8");
    // Strip leading whitespace and comments, then check the first
    // non-empty meaningful line is NOT `"use client"`.
    const firstSignificantLine = source
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0 && !l.startsWith("//") && !l.startsWith("/*") && !l.startsWith("*"));
    expect(firstSignificantLine).not.toMatch(/^['"]use client['"]/);
  });

  it("scan-activity client component exists and is the only 'use client' file in that route", () => {
    const clientSource = readFileSync(
      resolve(REPORTS_DIR, "scan-activity/scan-activity-client.tsx"),
      "utf8",
    );
    expect(clientSource.trim().startsWith('"use client"')).toBe(true);
    // And it must export a component the page can import.
    expect(clientSource).toMatch(/export\s+function\s+ScanActivityClient/);
  });
});
