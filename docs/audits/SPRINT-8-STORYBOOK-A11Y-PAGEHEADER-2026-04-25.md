# OneAce — Sprint 8: Storybook + a11y + PageHeader pack 2

**Tarih:** 2026-04-25
**Tag:** `v1.19.0-storybook-a11y-pass-2`
**Önceki:** [Sprint 7](./SPRINT-7-TR-FULL-COVERAGE-2026-04-25.md) (`v1.18.0-tr-full-coverage`)

---

## 1. Üç eksende paralel ilerleme

### PR #1 — Storybook coverage 1 → 11 primitive

10 yeni story dosyası: Badge, Alert, Card, EmptyState, PageHeader, Skeleton, Input, KpiCard, Tabs, Tooltip.

| Story | Vurgu |
|---|---|
| `badge.stories.tsx` | 8 variant + ERP-spesifik kullanım (StockStatuses) |
| `alert.stories.tsx` | 5 variant + KVKK draft banner örneği |
| `card.stories.tsx` | Composition + footer + stacked patterns |
| `empty-state.stories.tsx` | 3 variant (empty/filtered/unavailable) |
| `page-header.stories.tsx` | 6 story — basic, actions, breadcrumb, back, gradient title (Sprint 1 PR #7 prop'u), full combo |
| `skeleton.stories.tsx` | Table/card-grid/page-header fallback patterns |
| `input.stories.tsx` | 8 type + WithLabel + 44px touch target audit |
| `kpi-card.stories.tsx` | 6 trend variant + dashboard 4-card grid |
| `tabs.stories.tsx` | 4-tab + 2-tab Radix patterns |
| `tooltip.stories.tsx` | Icon button + form field help |

**Tag:** `v1.18.1-storybook-pack-1`

### PR #2 — a11y kritik paths genişletme + EN plural guard

- `e2e/a11y.spec.ts` CRITICAL_PATHS 12 → 21 path (movements, suppliers, scan, search, reports, users eklendi).
- `src/app/no-en-plural-template.test.ts` — sayfalardaki EN plural template'leri yakalayan informational test (`count === 1 ? '' : 's'` patterni).

**Tag:** `v1.18.2-a11y-paths-en-plural`

### PR #3 — PageHeader migration pack 2

3 sayfa daha PageHeader primitive'ine taşındı:
- `sales-orders/[id]/page.tsx` — order detail with status badge
- `picks/[id]/page.tsx` — pick task detail with status badge
- `kits/new/page.tsx` — create form

**PageHeader kullanım oranı:** 87/141 → 90/141 (~64%).
**Tag:** `v1.18.3-pageheader-pack-2`

---

## 2. Mahmut'un Mac'te yapacağı

```bash
./apply-sprint-8.command   # 3 PR + v1.19.0-storybook-a11y-pass-2
```

Storybook çalıştırma (Sprint 5 PR #1'den beri bekleyen):
```bash
cd oneace
pnpm install --save-dev \
  @storybook/react@^8 @storybook/react-vite@^8 \
  @storybook/addon-essentials@^8 @storybook/addon-a11y@^8 \
  @storybook/test@^8 storybook@^8 vite@^5
pnpm storybook        # http://localhost:6006
```

Storybook açılınca 11 primitive story (Button + Sprint 8'in 10'u) görünür. Her story'de a11y addon axe çalıştırır → runtime kontrast/ARIA denetimi.

---

## 3. Sprint 9+ Backlog

**Storybook:** kalan 14 primitive story (Select, Label, Textarea, Checkbox, Switch, Dialog, Sheet, Popover, DropdownMenu, Avatar, Breadcrumb, Separator, Sonner, ScrollArea).

**PageHeader migration:** kalan 51 sayfa (51/141 hala kullanmıyor). 5'er paketler = ~10 paket daha.

**Card varyant normalize 7 → 3** (Sprint 5 PR #3 hala backlog): KpiCard / ChartCard / WidgetCard / DataPanel / SectionShell / ReportSummaryCard → tek `<Card variant="metric|chart|panel">` API. Storybook ile karşılaştırma kolaylaşır.

**EN plural fix-up:** Sprint 8 PR #2'nin lint test'i bulduğu dosyalarda `format(t.x, {count})` ICU pattern'ine çevirme.

**TR native review pass:** Mahmut'un TR locale aktifken uygulamayı dolaşarak yapay/tutarsız çevirileri işaretlemesi.

**EmptyState 29 → 50+ coverage** (Sprint 4 PR #2 hala backlog).

---

## 4. Tag Hiyerarşisi (kümülatif)

```
v1.18.0-tr-full-coverage              ← Sprint 7 (48/48 TR coverage)

v1.18.1-storybook-pack-1              ← Sprint 8 PR #1
v1.18.2-a11y-paths-en-plural          ← Sprint 8 PR #2
v1.18.3-pageheader-pack-2             ← Sprint 8 PR #3
v1.19.0-storybook-a11y-pass-2         ← Sprint 8 closure
```

---

## 5. Sandbox sayım

- Yeni dosyalar: **10 story + 2 test** (12 yeni dosya)
- Değişen dosyalar: e2e/a11y.spec.ts, sales-orders/[id]/page.tsx, picks/[id]/page.tsx, kits/new/page.tsx (4 dosya)
- Toplam Sprint 8 değişikliği: 16 dosya

Pinned testler:
1. `tr-coverage.test.ts` (Sprint 6/7'den, 48 namespace assertion)
2. `locale-parity.test.ts` (mevcut)
3. `sprint-8-pageheader-pack-2.test.ts` (yeni)
4. `no-en-plural-template.test.ts` (yeni, soft)
