# Sprint 14 — EmptyState pack 4 + PageHeader pack 8 + Bare story

**Tarih:** 2026-04-25 (UX/UI audit Apr-25 follow-up)
**Bundle tag:** `v1.25.0-emptystate-pageheader-bare-story-pass-8`
**Önceki HEAD:** `f2ea283` (Sprint 13 closure — `v1.24.0`)
**Yeni HEAD:** `527494d`

NOT: Sprint 14 PR #3 başlangıçta "Card interactive pack 2" olarak planlanmıştı; ancak audit sonrası Card interactive için tek temiz migration kalmıştı (kalanlar visual differing özel pattern). Scope shift edilip "EmptyState Bare story + inline audit"'e çevrildi.

---

## PR #1 — EmptyState migration pack 4 (5 surface)

**Tag:** `v1.24.1-emptystate-pack-4`
**Commit:** `4f214a7`

EmptyState file count **40 → 44** (5 inline pattern, 1 dosya 2 tab içeriyor).

| Surface | Icon | Variant | Bare? |
|---|---|---|---|
| `stock-counts/compare/page.tsx` | `Search` | `filtered` | ✅ |
| `transfers/[id]/page.tsx` | `Boxes` | (default) | ✅ |
| `stock-counts/[id]/rollback/page.tsx` | `Lock` | `unavailable` | ❌ |
| `stock-counts/page.tsx` (renderTable helper) | `ClipboardList` | (default) | ✅ |
| `items/import/import-form.tsx` (ready + rejected tabs) | `CheckCircle2` + `AlertTriangle` | `filtered` | ❌ |

**Pinned test:** `sprint-14-empty-state-pack-4.test.ts` (~21 case)

---

## PR #2 — PageHeader migration pack 8 (5 surface)

**Tag:** `v1.24.2-pageheader-pack-8`
**Commit:** `a2d348d`

PageHeader page-level oranı **106 → 107/141** (yalnızca 1 yeni page; pack 8 daha çok mevcut sayfalardaki **fallback branch'leri** ve form component'leri kapsar).

| Surface | Pattern |
|---|---|
| `settings/general/page.tsx` | Error fallback branch + Card variant=destructive |
| `audit/page.tsx` | Main heading |
| `purchase-orders/page.tsx` | 2 fallback h1 (`!canUsePurchaseOrders` + `suppliers.length === 0`) — `replace_all` ile |
| `stock-counts/[id]/zones/zone-form.tsx` | Component (new + edit ikisini etkiler) |
| `stock-counts/[id]/zones/[zoneId]/page.tsx` | notFound fallback branch |

**Pinned test:** `sprint-14-pageheader-pack-8.test.ts` (15 case = 5×3)

---

## PR #3 — EmptyState `Bare` story + inline audit (informational)

**Tag:** `v1.24.3-emptystate-bare-story`
**Commit:** `527494d` (HEAD)

Sprint 12 PR #1 EmptyState'e `bare` prop eklemişti ama Storybook story'si yoktu. Bu PR onu ekler:

```typescript
// src/components/ui/empty-state.stories.tsx
export const Bare: Story = {
  args: { icon: Package, title: "...", description: "...", bare: true },
  parameters: { docs: { description: { story: "Panel-içi ..." } } },
};
```

EmptyState story sayısı 5 → **6**.

### Informational inline audit (gelecek pack backlog)

Yeni soft-fail test `sprint-14-empty-state-bare-story.test.ts`:
- Yasaklı pattern (informational): `<CardContent py-N><p text-...muted-foreground>No ...`
- Threshold: ≤ 10 (kalan inline empty pattern sayısı)
- Sprint 15+ pack 5 hedefi: bu sayıyı 0'a indirmek (hard fail moda alınacak)

**+ Sprint 13 audit doc** bu commit'te include edildi.

**Pinned test:** `sprint-14-empty-state-bare-story.test.ts` (4 case = 3 story + 1 inline audit)

---

## Bundle özeti

```
527494d build(storybook): EmptyState Bare story + inline empty audit (Sprint 14 PR #3)  [v1.24.3, v1.25.0 closure]
a2d348d ui(pageheader): migration pack 8 — 5 surface (Sprint 14 PR #2)  [v1.24.2]
4f214a7 ui(emptystate): migration pack 4 — 5 surface (Sprint 14 PR #1)  [v1.24.1]
f2ea283 ui(pageheader): migration pack 7 — 4 surface + Sprint 12 hotfix (Sprint 13 PR #3)  (önceki HEAD)
```

**Closure tag:** `v1.25.0-emptystate-pageheader-bare-story-pass-8` → 527494d
**Tüm tag'ler doğru commit'lerde.**

**Pinned test sayısı:** 3 yeni dosya, ~40 case
- `sprint-14-empty-state-pack-4.test.ts` (~21 case)
- `sprint-14-pageheader-pack-8.test.ts` (15 case)
- `sprint-14-empty-state-bare-story.test.ts` (4 case)

**Mac apply script:** `OneAce/apply-sprint-14.command` (POSIX, parallel array)

---

## Sprint 15+ backlog (güncel)

1. **EmptyState pack 5** — kalan inline pattern (≤10) → variant=bare/filtered/unavailable, sonra hard-fail guard
2. **PageHeader pack 9** — kalan ~34 sayfa (107/141 + form component'lerle ~115 effective)
3. **TR native review pass** (Mahmut manuel)
4. **Chromatic visual regression CI** (26 story baseline — EmptyState Bare dahil)
5. **Card variant census test** — variant kullanım metriği snapshot
