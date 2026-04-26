// Sprint 17 PR #1 — EmptyState migration pack 7 closure (12 surface, 21 ternary)
// (UX/UI audit Apr-25 §B-7 follow-up).
//
// Sprint 16 PR #2 (pack 6) 17 ternary surface'in ilk 5'ini migrate etmişti.
// Pack 7 KALAN 12 dosyayı (21 ternary occurrence) tamamen kapatır →
// Pattern C count 12 → 0 → Sprint 17 PR #2 hard-fail promote.
//
// Migrate edilen dosyalar (24 total ternary, 21 audit-matching):
//   - dashboard (2x: lowStock CheckCircle2, recent Activity)
//   - items/[id] (2x: stockLevels Boxes, movements ArrowLeftRight)
//   - migrations/new (2x: detections FileSearch, mappings Link2)
//   - movements/movement-form (1x: filtered Search variant=filtered)
//   - purchase-orders/[id] (1x: scopedAudit ClipboardList)
//   - purchase-orders/purchase-order-form (1x: lines ListPlus)
//   - scan/scanner (2x: levels Boxes, history History)
//   - search (3x: items Package, suppliers Building2, warehouses Warehouse — variant=filtered)
//   - stock-counts/[id] (2x: snapshots Camera, entries ClipboardList)
//   - suppliers/[id] (1x: topItems TrendingUp)
//   - users (2x: invitations MailX, mobile sorted Users)
//   - warehouses/[id] (2x: stockLevels Boxes, movements ArrowLeftRight)

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
}> = [
  {
    name: "dashboard lowStock + recentMovements",
    path: "src/app/(app)/dashboard/page.tsx",
    contains: [
      "icon={CheckCircle2}",
      "title={t.dashboard.lowStockCard.empty}",
      "icon={Activity}",
      "title={t.dashboard.recentActivityCard.empty}",
    ],
  },
  {
    name: "items/[id] stock + movements",
    path: "src/app/(app)/items/[id]/page.tsx",
    contains: [
      "icon={Boxes}",
      "title={t.itemDetail.stockEmpty}",
      "icon={ArrowLeftRight}",
      "title={t.movements.recentEmpty}",
    ],
  },
  {
    name: "migrations/new detections + mappings",
    path: "src/app/(app)/migrations/new/page.tsx",
    contains: [
      "icon={FileSearch}",
      'title="Hiçbir dosya tanınamadı."',
      "icon={Link2}",
      'title="Otomatik mapping bulunamadı."',
    ],
  },
  {
    name: "movements/movement-form combobox empty",
    path: "src/app/(app)/movements/movement-form.tsx",
    contains: [
      "icon={Search}",
      'title="No items found."',
      'variant="filtered"',
    ],
  },
  {
    name: "purchase-orders/[id] audit empty",
    path: "src/app/(app)/purchase-orders/[id]/page.tsx",
    contains: [
      "icon={ClipboardList}",
      "title={t.purchaseOrders.detail.auditEmpty}",
    ],
  },
  {
    name: "purchase-orders/purchase-order-form lines empty",
    path: "src/app/(app)/purchase-orders/purchase-order-form.tsx",
    contains: [
      "icon={ListPlus}",
      "title={labels.fields.linesEmpty}",
    ],
  },
  {
    name: "scan/scanner levels + history",
    path: "src/app/(app)/scan/scanner.tsx",
    contains: [
      "icon={Boxes}",
      "title={labels.resultNoLevels}",
      "icon={History}",
      "title={labels.noHistory}",
    ],
  },
  {
    name: "search items + suppliers + warehouses",
    path: "src/app/(app)/search/page.tsx",
    contains: [
      "icon={Package}",
      "icon={Building2}",
      "icon={Warehouse}",
      "title={t.search.sectionEmpty}",
    ],
  },
  {
    name: "stock-counts/[id] snapshots + entries",
    path: "src/app/(app)/stock-counts/[id]/page.tsx",
    contains: [
      "icon={Camera}",
      "title={t.stockCounts.detail.itemsTableEmpty}",
      "icon={ClipboardList}",
      "title={t.stockCounts.detail.entriesEmpty}",
    ],
  },
  {
    name: "suppliers/[id] topItems empty",
    path: "src/app/(app)/suppliers/[id]/page.tsx",
    contains: [
      "icon={TrendingUp}",
      "title={t.suppliers.detail.topItemsEmpty}",
    ],
  },
  {
    name: "users invitations + mobile table",
    path: "src/app/(app)/users/page.tsx",
    contains: [
      "icon={MailX}",
      "title={t.users.invitations.empty}",
      "icon={Users}",
      "title={t.users.table.empty}",
    ],
  },
  {
    name: "warehouses/[id] stock + movements",
    path: "src/app/(app)/warehouses/[id]/page.tsx",
    contains: [
      "icon={Boxes}",
      "title={t.warehouses.detail.stockEmpty}",
      "icon={ArrowLeftRight}",
      "title={t.warehouses.detail.movementsEmpty}",
    ],
  },
];

describe("Sprint 17 PR #1 §B-7 — EmptyState migration pack 7 closure (12 surface)", () => {
  for (const { name, path, contains } of SURFACES) {
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
    });
  }

  it("Pattern C ternary count is 0 — Sprint 17 PR #2 hard-fail tetikleyebilir", () => {
    // Bu test empty-state-no-inline-pattern.test.ts'in Pattern C hard-fail'ı
    // ile çakışmamak için sadece spot check yapar; gerçek hard-fail orada.
    let total = 0;
    for (const { path } of SURFACES) {
      const src = read(path);
      const matches = src.match(/\w+\.length\s*===?\s*0\s*\?[\s\S]{0,150}<p[^>]*text-muted-foreground/g);
      total += matches?.length ?? 0;
    }
    expect(total, "Sprint 17 PR #1 sonrası 12 dosyada Pattern C kalmamalı").toBe(0);
  });
});
