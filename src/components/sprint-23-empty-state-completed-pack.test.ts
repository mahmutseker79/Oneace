// Permanent guard — Sprint 23 (UX/UI audit Apr-25 §B-7 follow-up).
//
// EmptyState `completed` variant pack 1: 4 surface migration.
//
// Sprint 16 PR #1'de `completed` variant eklendi (purchase-orders putaway
// noUnbinnedStock için). Sprint 23 bu variant'ı 4 daha completion-tematik
// surface'e yayar:
//
//   1) items/import/import-form (ready tab — tüm satırlar import-ready)
//   2) dashboard lowStockCard (no low stock items — pozitif sinyal)
//   3) reports/low-stock (no critical stock — all stocked good news)
//   4) stock-counts/pending-approvals (all approvals processed)
//
// Pinned guard:
//   - Her surface "icon={CheckCircle2}" + "variant=\"completed\"" kombinasyonu
//   - Toplam `variant="completed"` kullanım >= 5 (Sprint 16 baseline 1 + Sprint 23 +4)

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");
const SRC_DIR = resolve(REPO_ROOT, "src");

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      if (entry === "node_modules" || entry === ".next" || entry === "generated") continue;
      yield* walk(full);
    } else if (entry.endsWith(".tsx") && !entry.endsWith(".test.tsx") && !entry.endsWith(".stories.tsx")) {
      yield full;
    }
  }
}

const COMPLETED_VARIANT_REGEX = /variant=["']completed["']/g;

type Surface = {
  name: string;
  path: string;
  // Bir EmptyState bloğunda hep birlikte görünmeli.
  contains: string[];
};

const SURFACES: Surface[] = [
  {
    name: "items/import/import-form (ready tab — all rows ready to import)",
    path: "src/app/(app)/items/import/import-form.tsx",
    contains: [
      "icon={CheckCircle2}",
      "title={labels.empty}",
      'variant="completed"',
    ],
  },
  {
    name: "dashboard lowStockCard (no low stock — positive completion)",
    path: "src/app/(app)/dashboard/page.tsx",
    contains: [
      "icon={CheckCircle2}",
      "title={t.dashboard.lowStockCard.empty}",
      'variant="completed"',
      "bare",
    ],
  },
  {
    name: "reports/low-stock (no critical stock — all stocked good news)",
    path: "src/app/(app)/reports/low-stock/page.tsx",
    contains: [
      "icon={CheckCircle2}",
      "title={t.reports.lowStock.emptyTitle}",
      'variant="completed"',
    ],
  },
  {
    name: "stock-counts/pending-approvals (all approvals processed)",
    path: "src/app/(app)/stock-counts/pending-approvals/page.tsx",
    contains: [
      "icon={CheckCircle2}",
      'title="No pending approvals"',
      'variant="completed"',
    ],
  },
];

describe("Sprint 23 — EmptyState `completed` variant pack 1 (4 surface)", () => {
  for (const surface of SURFACES) {
    it(`${surface.name} uses CheckCircle2 + variant="completed"`, () => {
      const filePath = resolve(REPO_ROOT, surface.path);
      const src = readFileSync(filePath, "utf8");
      for (const fragment of surface.contains) {
        expect(
          src,
          `${surface.path} missing fragment: ${fragment}`,
        ).toContain(fragment);
      }
    });
  }

  it("Cumulative: total `variant=\"completed\"` usage >= 5 across src/", () => {
    let total = 0;
    for (const file of walk(SRC_DIR)) {
      const content = readFileSync(file, "utf8");
      total += (content.match(COMPLETED_VARIANT_REGEX) || []).length;
    }
    // Baseline: Sprint 16 = 1 (putaway noUnbinnedStock)
    // Sprint 23: +4 (items/import, dashboard lowStockCard, reports/low-stock, stock-counts/pending-approvals)
    // Total beklenen: >= 5. Yeni kullanım eklenirse threshold kendiliğinden geçer.
    expect(total).toBeGreaterThanOrEqual(5);
  });
});
