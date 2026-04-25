// Sprint 8 PR #3 — PageHeader migration paketi 2 (3 sayfa)
// (UX/UI audit Apr-25 §B-6 follow-up).
//
// Sprint 4 PR #1 search/page.tsx migrate edilmişti. Bu paket 3 daha:
//   - sales-orders/[id]/page.tsx (CRUD detail)
//   - picks/[id]/page.tsx (CRUD detail)
//   - kits/new/page.tsx (create form)
//
// PageHeader kullanım oranı: 87/141 → 90/141.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");

function read(relative: string): string {
  return readFileSync(resolve(REPO_ROOT, relative), "utf8");
}

const PAGES: ReadonlyArray<{ name: string; path: string; expectedTitle: RegExp }> = [
  {
    name: "sales-orders/[id]",
    path: "src/app/(app)/sales-orders/[id]/page.tsx",
    expectedTitle: /title=\{order\.orderNumber\}/,
  },
  {
    name: "picks/[id]",
    path: "src/app/(app)/picks/[id]/page.tsx",
    expectedTitle: /title=\{`Pick #\$\{task\.id\.slice\(0, 8\)\}`\}/,
  },
  {
    name: "kits/new",
    path: "src/app/(app)/kits/new/page.tsx",
    expectedTitle: /title="Create Kit"/,
  },
];

describe("PR #3 §B-6 — PageHeader migration pack 2 (3 sayfa)", () => {
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

      it("does NOT keep the old inline <h1>", () => {
        // Eski pattern: <h1 className="text-2xl|text-3xl font-(semibold|bold)">
        expect(src).not.toMatch(
          /<h1 className="text-2xl font-semibold">\{(?:order|task)\./,
        );
        expect(src).not.toMatch(/<h1 className="text-3xl font-bold">Create Kit<\/h1>/);
      });
    });
  }
});
