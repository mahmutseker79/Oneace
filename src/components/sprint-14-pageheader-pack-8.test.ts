// Sprint 14 PR #2 — PageHeader migration paketi 8 (5 surface)
// (UX/UI audit Apr-25 §B-6 follow-up).
//
// PageHeader page-level oranı 106/141 → 107/141 (+1 page level; pack 8 daha
// çok mevcut sayfalarda fallback branch'lerini ve form component'leri PageHeader'a
// çekiyor).
//
// Migrate edilen surface'ler:
//   - settings/general (error fallback branch)
//   - audit (heading)
//   - purchase-orders (2 fallback h1 — !canUsePurchaseOrders + suppliers.length === 0)
//   - stock-counts/[id]/zones/zone-form (component, new + edit ikisini etkiler)
//   - stock-counts/[id]/zones/[zoneId] (notFound branch)

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");

function read(relative: string): string {
  return readFileSync(resolve(REPO_ROOT, relative), "utf8");
}

const SURFACES: ReadonlyArray<{
  name: string;
  path: string;
  expectedTitle: RegExp;
}> = [
  {
    name: "settings/general (error fallback)",
    path: "src/app/(app)/settings/general/page.tsx",
    // Already had a PageHeader for happy path; new one is for the error branch.
    expectedTitle: /title="General Settings"/,
  },
  {
    name: "audit (main heading)",
    path: "src/app/(app)/audit/page.tsx",
    expectedTitle: /title=\{t\.audit\.heading\}/,
  },
  {
    name: "purchase-orders (fallback branches)",
    path: "src/app/(app)/purchase-orders/page.tsx",
    expectedTitle: /title=\{t\.purchaseOrders\.heading\}/,
  },
  {
    name: "stock-counts/[id]/zones/zone-form",
    path: "src/app/(app)/stock-counts/[id]/zones/zone-form.tsx",
    expectedTitle: /title=\{labels\.heading\}/,
  },
  {
    name: "stock-counts/[id]/zones/[zoneId] (notFound)",
    path: "src/app/(app)/stock-counts/[id]/zones/[zoneId]/page.tsx",
    expectedTitle: /title=\{t\.common\.notFound\}/,
  },
];

describe("Sprint 14 PR #2 §B-6 — PageHeader migration pack 8 (5 surface)", () => {
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
        // Sprint 14: also forbids `text-xl ... sm:text-2xl` (purchase-orders fallback)
        expect(src).not.toMatch(/<h1 className="text-(?:2xl|3xl) font-(?:semibold|bold)/);
        expect(src).not.toMatch(
          /<h1 className="text-xl font-semibold tracking-tight sm:text-2xl"/,
        );
      });
    });
  }
});
