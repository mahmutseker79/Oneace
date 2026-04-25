# Sprint 12 — EmptyState bare + PageHeader pack 6 + Card info variant

**Tarih:** 2026-04-25 (UX/UI audit Apr-25 follow-up)
**Bundle tag:** `v1.23.0-emptystate-pageheader-card-info-pass-6`
**Önceki HEAD:** `1e1addd` (Sprint 11 closure — `v1.22.0`)
**Yeni HEAD:** `e543b76`

---

## PR #1 — EmptyState `bare` prop + integrations pack 2

**Tag:** `v1.22.1-emptystate-bare-pack-2`
**Commit:** `e54d1d4`

### Yeni primitive prop: `bare`

```typescript
// src/components/ui/empty-state.tsx
type EmptyStateProps = {
  // ... existing props
  bare?: boolean; // default false
};
```

- `bare=false` (default): outer `<Card border-dashed>` ile sarılır (önceki davranış)
- `bare=true`: sadece inner content render eder, panel-içi (existing CardContent içinde) kullanım için

### Migrate edilen 4 integrations panel

| Panel | Icon | Bare? |
|---|---|---|
| `sync-rules-panel.tsx:131` | `Filter` | ✅ |
| `webhook-events-panel.tsx:122` | `Webhook` | ✅ |
| `sync-schedules-panel.tsx:120` | `Clock` | ✅ |
| `field-mapping-table.tsx:118` | `ArrowRightLeft` | ✅ |

Önceki pattern (`<div className="py-8 text-center"><p text-sm text-muted-foreground>No ...</p></div>`) ortadan kalktı.

**+ Sprint 11 audit doc** (push'a yetişmemişti) bu commit'e dahil edildi.

**Pinned test:** `sprint-12-empty-state-pack-2.test.ts` (19 case = primitive 3 + 4 panel × 4)

---

## PR #2 — PageHeader migration pack 6

**Tag:** `v1.22.2-pageheader-pack-6`
**Commit:** `f0e76b7`

PageHeader oranı **98 → 103/141 sayfa**. Migrate edilenler:

| Sayfa | Pattern |
|---|---|
| `stock-counts/templates/[id]` | Detail, dynamic title (`{template.name}`) |
| `stock-counts/[id]/assignments/new` | Form + custom contextual back link (`Assignments for {count.name}`) |
| `stock-counts/[id]/assignments` | List + `Assign Counter` actions slot |
| `purchase-orders/[id]/putaway` | **BOTH branches** (empty case + main case) |
| `movements/transfers/new` | **BOTH branches** (locked/upgrade case + main wizard) |

**Pinned test:** `sprint-12-pageheader-pack-6.test.ts` (15 case = 5×3)

---

## PR #3 — Card `info` variant + Storybook

**Tag:** `v1.22.3-card-info-variant`
**Commit:** `e543b76` (HEAD)

5. variant: `info` (mavi tonlu notice/bilgi states).

```typescript
const CARD_VARIANTS = {
  default: "",
  interactive: "hover:bg-muted/50 cursor-pointer transition-colors",
  warning: "border-warning/50 bg-warning-light",
  destructive: "border-destructive/50 bg-destructive/5",
  info: "border-info/50 bg-info-light",  // NEW
};
```

Mevcut `--info` (#3b82f6 light, #60a5fa dark) ve `--info-light` token'larını kullanır → dark mode otomatik.

**Storybook:** `card.stories.tsx` 4 → 5 story (yeni: `Info`).

### Sprint 13+ migration backlog

OneAce'ta 14+ "info"-tipi pattern var (alert, banner, getting-started). Sprint 13'te ad-hoc kullanımları audit + migrate.

**Pinned test:** `sprint-12-card-info-variant.test.ts` (8 case = primitive 2 + story 1 + token 3 + 2 sanity)

---

## Bundle özeti

```
e543b76 ui(card): info variant (5th) + Storybook story (Sprint 12 PR #3)  [v1.22.3, v1.23.0 closure]
f0e76b7 ui(pageheader): migration pack 6 — 5 sayfa (Sprint 12 PR #2)  [v1.22.2]
e54d1d4 ui(emptystate): bare prop + integrations pack 2 (Sprint 12 PR #1)  [v1.22.1]
1e1addd ui(emptystate): migration pack 1 — 4 sayfa (Sprint 11 PR #3)  (önceki HEAD)
```

**Closure tag:** `v1.23.0-emptystate-pageheader-card-info-pass-6` → e543b76
**Tüm tag'ler doğru commit'lerde.**

**Pinned test sayısı:** 3 yeni dosya, ~42 case
- `sprint-12-empty-state-pack-2.test.ts` (19 case)
- `sprint-12-pageheader-pack-6.test.ts` (15 case)
- `sprint-12-card-info-variant.test.ts` (8 case)

**Mac apply script:** `OneAce/apply-sprint-12.command` (POSIX, parallel array)

---

## Sprint 13+ backlog (güncel)

1. **Card `info` variant migration** — 14+ ad-hoc "info"-tipi alert/banner/getting-started → variant
2. **EmptyState pack 3** — kits, integrations sync-history, scan-activity, settings/billing tableler (~33→38+)
3. **PageHeader pack 7** — kalan ~38 sayfa (~5 sayfa/pack)
4. **TR native review pass** (Mahmut manuel)
5. **Chromatic visual regression CI** (25 story snapshot baseline)
