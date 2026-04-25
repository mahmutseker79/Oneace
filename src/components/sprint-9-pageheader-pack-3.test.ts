// Sprint 9 PR #2 — PageHeader migration paketi 3 (5 sayfa)
// (UX/UI audit Apr-25 §B-6 follow-up).
//
// Sprint 4 PR #1 search migrate, Sprint 8 PR #3 pack 2 (sales-orders/[id],
// picks/[id], kits/new). Bu paket 5 daha:
//   - sales-orders/new/page.tsx       (create form)
//   - items/import/page.tsx           (import wizard)
//   - vehicles/page.tsx               (list)
//   - stock-counts/templates/page.tsx (list)
//   - help/page.tsx                   (info page)
//
// PageHeader kullanım oranı: 83/141 → 88/141.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");

function read(relative: string): string {
  return readFileSync(resolve(REPO_ROOT, relative), "utf8");
}

const PAGES: ReadonlyArray<{ name: string; path: string; expectedTitle: RegExp }> = [
  {
    name: "sales-orders/new",
    path: "src/app/(app)/sales-orders/new/page.tsx",
    expectedTitle: /title="Create Sales Order"/,
  },
  {
    name: "items/import",
    path: "src/app/(app)/items/import/page.tsx",
    expectedTitle: /title=\{t\.itemsImport\.heading\}/,
  },
  {
    name: "vehicles",
    path: "src/app/(app)/vehicles/page.tsx",
    expectedTitle: /title=\{t\.vehicles\.heading\}/,
  },
  {
    name: "stock-counts/templates",
    path: "src/app/(app)/stock-counts/templates/page.tsx",
    expectedTitle: /title="Count Templates"/,
  },
  {
    name: "help",
    path: "src/app/(app)/help/page.tsx",
    expectedTitle: /title="Help"/,
  },
];

describe("Sprint 9 PR #2 §B-6 — PageHeader migration pack 3 (5 sayfa)", () => {
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
        // Eski pattern: <h1 className="text-2xl ..."> veya text-3xl
        expect(src).not.toMatch(/<h1 className="text-(?:2xl|3xl) font-(?:semibold|bold)/);
      });
    });
  }
});
