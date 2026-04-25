// Sprint 1 PR #7 — Dashboard adopts the canonical PageHeader primitive
// (UX/UI audit Apr-25 §B-6).
//
// Pre-PR: dashboard rendered an inline `<div>...<h1>{greeting}</h1>...</div>`
// header with bespoke gap/wrapping that drifted from the rest of the
// app. Pre-PR audit recorded 56 of 141 (app) pages skipping
// PageHeader; dashboard was the most-trafficked of those.
//
// PR contract:
//   - Dashboard imports PageHeader from the design system.
//   - Dashboard uses <PageHeader title={...} actions={...} /> JSX.
//   - The gradient title accent (`text-gradient-primary`) survives
//     the migration via the new `titleClassName` prop the same PR
//     adds to PageHeader.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..", "..", "..");

function read(relative: string): string {
  return readFileSync(resolve(REPO_ROOT, relative), "utf8");
}

const DASHBOARD = read("src/app/(app)/dashboard/page.tsx");
const PAGE_HEADER = read("src/components/ui/page-header.tsx");

describe("PR #7 §B-6 — dashboard uses the canonical PageHeader primitive", () => {
  it("imports PageHeader from the design system", () => {
    expect(DASHBOARD).toMatch(
      /import\s*\{[^}]*\bPageHeader\b[^}]*\}\s*from\s*["']@\/components\/ui\/page-header["']/,
    );
  });

  it("renders <PageHeader> in JSX (not the inline header)", () => {
    expect(DASHBOARD).toMatch(/<PageHeader\s/);
  });

  it("preserves the gradient title accent via titleClassName", () => {
    // The gradient was a deliberate brand cue. Pinning the prop name
    // and the value catches a future "we don't need that anymore"
    // edit before it ships.
    expect(DASHBOARD).toMatch(/titleClassName="text-gradient-primary"/);
  });

  it("does NOT keep the old inline `<h1 className=...text-gradient-primary>`", () => {
    // Catch the most likely incomplete migration: leaving the h1
    // tag behind alongside PageHeader.
    expect(DASHBOARD).not.toMatch(
      /<h1 className="text-xl font-semibold tracking-tight sm:text-2xl text-gradient-primary">/,
    );
  });
});

describe("PR #7 §B-6 — PageHeader primitive carries the new titleClassName prop", () => {
  it("declares titleClassName in the props interface", () => {
    expect(PAGE_HEADER).toMatch(/titleClassName\?:\s*string/);
  });

  it("applies titleClassName to the h1 via cn(...)", () => {
    // Without cn() the new prop wouldn't merge with the base size
    // utilities and would either replace them or be ignored.
    expect(PAGE_HEADER).toMatch(/cn\(\s*["']text-xl[^"']*["'],\s*titleClassName/);
  });
});
