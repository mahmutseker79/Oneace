// Sprint 15 PR #1 — EmptyState migration pack 5 (3 surface, 2 dosya)
// (UX/UI audit Apr-25 §B-7 follow-up).
//
// Sprint 14 PR #3 informational audit kalan inline empty pattern'leri flag
// etmişti (strict regex 0, ama i18n {labels.no...} pattern'leri kaçıyordu).
// Pack 5 i18n inline empty + scheduled-reports ternary'sini kapatır.
//
// Migrate edilen pattern'ler:
//   - putaway-form noBins (PackageOpen, variant=unavailable)
//   - putaway-form noUnbinnedStock (CheckCircle2, default + actions=viewPo)
//   - reports/scheduled empty branch (CalendarClock, default + actions=newReport)
//
// Card+CardContent inline empty wrapper'ı bu surface'lerden tamamen kaldırıldı.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");
const APP_DIR = resolve(REPO_ROOT, "src/app");

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      yield* walk(full);
    } else if (entry.endsWith(".tsx")) {
      yield full;
    }
  }
}

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
    name: "putaway-form noBins",
    path: "src/app/(app)/purchase-orders/[id]/putaway/putaway-form.tsx",
    contains: [
      "icon={PackageOpen}",
      "title={labels.noBins}",
      'variant="unavailable"',
    ],
    notContains: [
      // Sprint 15 öncesi inline pattern artık olmamalı
      '<p className="text-sm text-muted-foreground">{labels.noBins}',
    ],
  },
  {
    name: "putaway-form noUnbinnedStock",
    path: "src/app/(app)/purchase-orders/[id]/putaway/putaway-form.tsx",
    contains: [
      "icon={CheckCircle2}",
      "title={labels.noUnbinnedStock}",
      "label: labels.viewPo",
      "href: backHref",
    ],
    notContains: [
      '<p className="text-sm text-muted-foreground">{labels.noUnbinnedStock}',
    ],
  },
  {
    name: "reports/scheduled empty branch",
    path: "src/app/(app)/reports/scheduled/page.tsx",
    contains: [
      "icon={CalendarClock}",
      'title="No scheduled reports yet"',
      // Action button only when hasAccess
      'label: "New scheduled report"',
      'href: "/reports/scheduled/new"',
    ],
    notContains: [
      // Eski ternary'deki inline paragraph
      "When you create a scheduled report it will show up here. Each run emails the rendered\n              report to the recipient list.",
    ],
  },
];

describe("Sprint 15 PR #1 §B-7 — EmptyState migration pack 5 (3 surface)", () => {
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
          it(`no longer contains old inline pattern (${needle.slice(0, 50)}…)`, () => {
            expect(src).not.toContain(needle);
          });
        }
      }
    });
  }

  it("putaway-form: Card+CardContent imports removed (no remaining card wrapper)", () => {
    const src = read("src/app/(app)/purchase-orders/[id]/putaway/putaway-form.tsx");
    expect(src).not.toMatch(/from\s+["']@\/components\/ui\/card["']/);
  });

  it("EmptyState file count >= 46 (Sprint 14 closure: ~44 + Sprint 15: +2 yeni dosya)", () => {
    let count = 0;
    for (const file of walk(APP_DIR)) {
      const content = readFileSync(file, "utf8");
      if (content.includes("EmptyState")) count++;
    }
    expect(count, `EmptyState importer file count = ${count}`).toBeGreaterThanOrEqual(46);
  });
});
