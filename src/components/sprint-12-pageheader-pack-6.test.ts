// Sprint 12 PR #2 — PageHeader migration paketi 6 (5 sayfa)
// (UX/UI audit Apr-25 §B-6 follow-up).
//
// PageHeader oranı 98/141 → 103/141. Migrate edilenler:
//   - stock-counts/templates/[id] (detail, dynamic title)
//   - stock-counts/[id]/assignments/new (form + custom back link)
//   - stock-counts/[id]/assignments (list + actions slot)
//   - purchase-orders/[id]/putaway (BOTH branches: empty + main)
//   - movements/transfers/new (BOTH branches: locked + main)

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");

function read(relative: string): string {
  return readFileSync(resolve(REPO_ROOT, relative), "utf8");
}

const PAGES: ReadonlyArray<{ name: string; path: string; expectedTitle: RegExp }> = [
  {
    name: "stock-counts/templates/[id]",
    path: "src/app/(app)/stock-counts/templates/[id]/page.tsx",
    expectedTitle: /title=\{template\.name\}/,
  },
  {
    name: "stock-counts/[id]/assignments/new",
    path: "src/app/(app)/stock-counts/[id]/assignments/new/page.tsx",
    expectedTitle: /title="Assign Counter"/,
  },
  {
    name: "stock-counts/[id]/assignments",
    path: "src/app/(app)/stock-counts/[id]/assignments/page.tsx",
    expectedTitle: /title="Assignments"/,
  },
  {
    name: "purchase-orders/[id]/putaway",
    path: "src/app/(app)/purchase-orders/[id]/putaway/page.tsx",
    expectedTitle: /title=\{t\.purchaseOrders\.putaway\.heading\}/,
  },
  {
    name: "movements/transfers/new",
    path: "src/app/(app)/movements/transfers/new/page.tsx",
    expectedTitle: /title=\{t\.movements\.transfers\.heading\}/,
  },
];

describe("Sprint 12 PR #2 §B-6 — PageHeader migration pack 6 (5 sayfa)", () => {
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
