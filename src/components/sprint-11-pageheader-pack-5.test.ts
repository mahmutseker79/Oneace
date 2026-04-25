// Sprint 11 PR #2 — PageHeader migration paketi 5 (5 sayfa)
// (UX/UI audit Apr-25 §B-6 follow-up).
//
// PageHeader oranı 93/141 → 98/141. Migrate edilenler:
//   - suppliers/[id]/edit (form + custom back link)
//   - departments/[id] (detail page, dynamic title)
//   - stock-counts/pending-approvals
//   - stock-counts/compare
//   - stock-counts/templates/new

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");

function read(relative: string): string {
  return readFileSync(resolve(REPO_ROOT, relative), "utf8");
}

const PAGES: ReadonlyArray<{ name: string; path: string; expectedTitle: RegExp }> = [
  {
    name: "suppliers/[id]/edit",
    path: "src/app/(app)/suppliers/[id]/edit/page.tsx",
    expectedTitle: /title=\{t\.suppliers\.editSupplier\}/,
  },
  {
    name: "departments/[id]",
    path: "src/app/(app)/departments/[id]/page.tsx",
    expectedTitle: /title=\{department\.name\}/,
  },
  {
    name: "stock-counts/pending-approvals",
    path: "src/app/(app)/stock-counts/pending-approvals/page.tsx",
    expectedTitle: /title="Pending Approvals"/,
  },
  {
    name: "stock-counts/compare",
    path: "src/app/(app)/stock-counts/compare/page.tsx",
    expectedTitle: /title="Compare Counts"/,
  },
  {
    name: "stock-counts/templates/new",
    path: "src/app/(app)/stock-counts/templates/new/page.tsx",
    expectedTitle: /title="New Count Template"/,
  },
];

describe("Sprint 11 PR #2 §B-6 — PageHeader migration pack 5 (5 sayfa)", () => {
  for (const { name, path, expectedTitle } of PAGES) {
    describe(name, () => {
      const src = read(path);

      it("imports PageHeader from the design system", () => {
        expect(src).toMatch(
          /import\s*\{[^}]*\bPageHeader\b[^}]*\}\s*from\s*["']@\/components\/ui\/page-header["']/,
        );
      });

      it("renders <PageHeader title={...}>", () => {
        expect(src).toMatch(/<PageHeader\s/);
        expect(src).toMatch(expectedTitle);
      });

      it("does NOT keep an inline <h1 className=\"text-2xl|text-3xl\"> heading", () => {
        expect(src).not.toMatch(/<h1 className="text-(?:2xl|3xl) font-(?:semibold|bold)/);
      });
    });
  }
});
