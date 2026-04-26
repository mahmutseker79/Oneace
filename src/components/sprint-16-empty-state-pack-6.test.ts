// Sprint 16 PR #2 — EmptyState migration pack 6 (5 surface, ternary length===0)
// (UX/UI audit Apr-25 §B-7 follow-up).
//
// Sprint 15 PR #2 hard-fail guard'ı Pattern C (ternary `X.length === 0 ?` +
// muted-foreground p) için soft-fail informational threshold ≤20 koymuştu.
// Pack 6 ilk 5 surface'i migrate eder (1x ternary, küçük-orta dosya).
// Yeni Pattern C count: 17 → 12.
//
// Pack 7 hedefi: kalan 12 → 0, sonra Pattern C hard-fail promote.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");

function read(rel: string): string {
  return readFileSync(resolve(REPO_ROOT, rel), "utf8");
}

const SURFACES: ReadonlyArray<{
  name: string;
  path: string;
  contains: ReadonlyArray<string>;
  notContains?: ReadonlyArray<string>;
}> = [
  {
    name: "vehicles/[id] history empty",
    path: "src/app/(app)/vehicles/[id]/page.tsx",
    contains: [
      "icon={History}",
      "title={t.vehicles.historyEmpty}",
      "bare",
    ],
    notContains: [
      '<p className="text-muted-foreground mt-2 text-sm">{t.vehicles.historyEmpty}',
    ],
  },
  {
    name: "settings/reason-codes empty category",
    path: "src/app/(app)/settings/reason-codes/reason-code-table-client.tsx",
    contains: [
      "icon={MessageSquare}",
      'title="No reason codes in this category"',
    ],
    notContains: [
      "<p className=\"text-sm text-muted-foreground text-center py-8\">\n                      No reason codes in this category",
    ],
  },
  {
    name: "stock-counts/[id]/reconcile variance empty",
    path: "src/app/(app)/stock-counts/[id]/reconcile/page.tsx",
    contains: [
      "icon={Sigma}",
      "title={t.stockCounts.detail.itemsTableEmpty}",
      "bare",
    ],
    notContains: [
      '<p className="px-6 pb-6 text-sm text-muted-foreground">',
    ],
  },
  {
    name: "stock-counts/[id]/variance-detail rows empty",
    path: "src/app/(app)/stock-counts/[id]/variance-detail/page.tsx",
    contains: [
      "icon={Sigma}",
      "title={emptyLabel}",
      "bare",
    ],
    notContains: [
      '<p className="text-sm text-muted-foreground">{emptyLabel}',
    ],
  },
  {
    name: "stock-counts/new-count-form filtered empty",
    path: "src/app/(app)/stock-counts/new-count-form.tsx",
    contains: [
      "icon={Search}",
      "title={labels.itemsEmpty}",
      'variant="filtered"',
      "bare",
    ],
    notContains: [
      '<p className="p-6 text-center text-sm text-muted-foreground">{labels.itemsEmpty}',
    ],
  },
];

describe("Sprint 16 PR #2 §B-7 — EmptyState migration pack 6 (5 ternary surface)", () => {
  for (const { name, path, contains, notContains } of SURFACES) {
    describe(name, () => {
      const src = read(path);

      it("imports EmptyState", () => {
        expect(src).toMatch(
          /import\s*\{[^}]*\bEmptyState\b[^}]*\}\s*from\s*["']@\/components\/ui\/empty-state["']/,
        );
      });

      for (const needle of contains) {
        it(`contains \`${needle.length > 60 ? needle.slice(0, 60) + "…" : needle}\``, () => {
          expect(src).toContain(needle);
        });
      }

      if (notContains) {
        for (const needle of notContains) {
          it(`no longer contains old inline ternary (${needle.slice(0, 50)}…)`, () => {
            expect(src).not.toContain(needle);
          });
        }
      }
    });
  }
});
