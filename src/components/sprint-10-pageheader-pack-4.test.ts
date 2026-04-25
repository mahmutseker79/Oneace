// Sprint 10 PR #2 — PageHeader migration paketi 4 (5 sayfa)
// (UX/UI audit Apr-25 §B-6 follow-up).
//
// PageHeader oranı 88/141 → 93/141. Migrate edilenler:
//   - departments/new (Create form)
//   - items/reorder-config (form + back link, t.items.reorderConfig)
//   - inventory/status-change (form + backHref)
//   - organizations/new (Create org, badge prop için Building2 icon)
//   - labels/designer (form + backHref, dynamic title)

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");

function read(relative: string): string {
  return readFileSync(resolve(REPO_ROOT, relative), "utf8");
}

const PAGES: ReadonlyArray<{ name: string; path: string; expectedTitle: RegExp }> = [
  {
    name: "departments/new",
    path: "src/app/(app)/departments/new/page.tsx",
    expectedTitle: /title="New Department"/,
  },
  {
    name: "items/reorder-config",
    path: "src/app/(app)/items/reorder-config/page.tsx",
    expectedTitle: /title=\{t\.items\.reorderConfig\.heading\}/,
  },
  {
    name: "inventory/status-change",
    path: "src/app/(app)/inventory/status-change/page.tsx",
    expectedTitle: /title="Change Stock Status"/,
  },
  {
    name: "organizations/new",
    path: "src/app/(app)/organizations/new/page.tsx",
    expectedTitle: /title=\{t\.organizations\.create\.heading\}/,
  },
  {
    name: "labels/designer",
    path: "src/app/(app)/labels/designer/page.tsx",
    expectedTitle: /title=\{isEdit \? "Edit Label Template" : "New Label Template"\}/,
  },
];

describe("Sprint 10 PR #2 §B-6 — PageHeader migration pack 4 (5 sayfa)", () => {
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
