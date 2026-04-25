// Sprint 4 PR #1 — search page adopts canonical PageHeader
// (UX/UI audit Apr-25 §B-6 follow-up).
//
// PageHeader-yoksun 56 sayfanın bu paketteki ilki: search/page.tsx.
// Önceki halinde inline `<div><SearchIcon /><h1>...` vardı.
// Şimdi `<PageHeader title=... description=... />`.
//
// Bu test ile coverage 86/141 → 87/141 pin'lenir.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..", "..", "..");
const SEARCH = readFileSync(resolve(REPO_ROOT, "src/app/(app)/search/page.tsx"), "utf8");

describe("PR #1 §B-6 — search uses canonical PageHeader", () => {
  it("imports PageHeader from the design system", () => {
    expect(SEARCH).toMatch(
      /import\s*\{\s*PageHeader\s*\}\s*from\s*["']@\/components\/ui\/page-header["']/,
    );
  });

  it("renders <PageHeader title={...} description={...}>", () => {
    expect(SEARCH).toMatch(/<PageHeader[^>]*title=\{t\.search\.heading\}/);
    expect(SEARCH).toMatch(/description=\{t\.search\.subtitle\}/);
  });

  it("does NOT keep the old inline <h1>", () => {
    expect(SEARCH).not.toMatch(
      /<h1 className="text-xl font-semibold tracking-tight sm:text-2xl">\{t\.search\.heading\}/,
    );
  });
});
