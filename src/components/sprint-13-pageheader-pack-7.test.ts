// Sprint 13 PR #3 — PageHeader migration paketi 7 (4 surface)
// (UX/UI audit Apr-25 §B-6 follow-up).
//
// PageHeader page-level oranı 103/141 → 106/141. Migrate edilenler:
//   - transfers/new/page.tsx (Card+CardTitle → PageHeader + form Card)
//   - transfers/[id]/add-line/page.tsx (Card+CardTitle → PageHeader)
//   - sales-orders/[id]/ship/page.tsx (h1 client → PageHeader)
//   - vehicles/vehicle-form.tsx (component, vehicles/new + /[id] iki sayfaya etki eder)
//
// vehicles/vehicle-form.tsx hem yeni hem edit varyantı için PageHeader render eder
// (isEdit ? labels.editVehicle : labels.newVehicleHeading).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");

function read(relative: string): string {
  return readFileSync(resolve(REPO_ROOT, relative), "utf8");
}

const SURFACES: ReadonlyArray<{ name: string; path: string; expectedTitle: RegExp }> = [
  {
    name: "transfers/new",
    path: "src/app/(app)/transfers/new/page.tsx",
    expectedTitle: /title="New Transfer"/,
  },
  {
    name: "transfers/[id]/add-line",
    path: "src/app/(app)/transfers/[id]/add-line/page.tsx",
    expectedTitle: /title=\{`Add Item to \$\{transfer\.transferNumber\}`\}/,
  },
  {
    name: "sales-orders/[id]/ship",
    path: "src/app/(app)/sales-orders/[id]/ship/page.tsx",
    expectedTitle: /title=\{`Ship: \$\{order\.orderNumber\}`\}/,
  },
  {
    name: "vehicles/vehicle-form (covers new + [id])",
    path: "src/app/(app)/vehicles/vehicle-form.tsx",
    expectedTitle:
      /title=\{isEdit \? labels\.editVehicle : labels\.newVehicleHeading\}/,
  },
];

describe("Sprint 13 PR #3 §B-6 — PageHeader migration pack 7 (4 surface)", () => {
  for (const { name, path, expectedTitle } of SURFACES) {
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
