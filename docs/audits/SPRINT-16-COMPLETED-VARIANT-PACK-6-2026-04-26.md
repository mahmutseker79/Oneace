# Sprint 16 — EmptyState `completed` variant + ternary pack 6

**Tarih:** 2026-04-26 (UX/UI audit Apr-25 §B-7 follow-up)
**Bundle tag:** `v1.27.0-emptystate-completed-pack-6`
**Önceki HEAD:** `883f3aa` (Sprint 15 closure, `v1.26.0-emptystate-hardfail-pass-9`)
**Yeni HEAD:** _Mac apply script tarafından oluşturulacak (3 commit)_

NOT: Sandbox FUSE `.git/HEAD.lock` kaldırılamadığı için commit'ler **Mac-side
`OneAce/apply-sprint-16.command`** ile atılır. Dosya değişiklikleri zaten
working tree'de — script sadece stage + commit + tag + branch update yapar.

---

## PR #1 — EmptyState `completed` variant + putaway visual restore

**Tag (planned):** `v1.26.1-emptystate-completed-variant`

Sprint 15 PR #1 putaway noUnbinnedStock surface'ini `empty` variant ile
migrate etmişti — `text-success` → `text-primary` görsel kayıp vardı. Bu
PR EmptyState primitive'e 4. variant ekler ve putaway'i restore eder.

| Variant | İcon container | İcon | Anlam |
|---|---|---|---|
| `empty` (default) | `bg-primary/8 ring-primary/10` | `text-primary` | İlk-kullanım boşluğu |
| `filtered` | `bg-muted/60 ring-border/30` | `text-muted-foreground` | Filtre sonucu boş |
| `unavailable` | `bg-warning-light ring-warning/20` | `text-warning` | Plan-gated özellik |
| **`completed`** (Sprint 16) | **`bg-success/10 ring-success/20`** | **`text-success`** | **Pozitif tamamlanma / iş bitti** |

`completed` semantik: "boş" değil, "tamamlandı". Putaway'de `noUnbinnedStock`
durumu (tüm stok bin'lendi) için doğal eşleşme. Future: tüm sayım sonrası
"all variances reconciled", PO sonrası "fully received" vb. surface'lerde.

**Storybook:** `Completed` story export'u eklendi (CheckCircle2 + viewPO action).

**Pinned test:** `sprint-16-empty-state-completed-variant.test.ts` (9 case)
- Component: variant union + iconContainerClass + iconClass branch'leri
- Storybook: Completed story + variant arg
- putaway-form: noUnbinnedStock variant="completed" + CheckCircle2 + viewPo retain

---

## PR #2 — EmptyState migration pack 6 (5 ternary surface)

**Tag (planned):** `v1.26.2-emptystate-pack-6`

Sprint 15 PR #2 hard-fail guard Pattern C (ternary `X.length === 0 ?`)'i
informational soft-fail ≤20 olarak başlatmıştı. Pack 6 ilk 5 surface'i migrate
eder; threshold ≤13'e indirilir (current=12, headroom 1).

| Surface | Icon | Variant | Bare? |
|---|---|---|---|
| `vehicles/[id]/page.tsx` (history) | `History` | (default `empty`) | ✅ |
| `settings/reason-codes/reason-code-table-client.tsx` (kategori) | `MessageSquare` | (default `empty`) | ❌ (own card) |
| `stock-counts/[id]/reconcile/page.tsx` (variance rows) | `Sigma` | (default `empty`) | ✅ |
| `stock-counts/[id]/variance-detail/page.tsx` (rows) | `Sigma` | (default `empty`) | ✅ |
| `stock-counts/new-count-form.tsx` (filter sonuç) | `Search` | `filtered` | ✅ |

Hepsi 1x ternary'li, 100-388 satırlık dosyalar — multi-edit risk düşük.

**Pattern C count:** 17 → 12. Audit testindeki threshold ≤20 → ≤13'e güncellendi.

**Pinned test:** `sprint-16-empty-state-pack-6.test.ts` (~25 case)
- 5 surface × (import + 3-4 contains + 1 not-contains)

---

## PR #3 — Sprint 16 closure audit doc

**Tag (planned):** `v1.27.0-emptystate-completed-pack-6`

Bu doc'un kendisi PR #3'tür. Sprint 17+ backlog özetler.

---

## Bundle özeti (Mac apply script çıktısı sonrası)

```
<HASH-3>  docs(audit): Sprint 16 closure (PR #3)                          [v1.27.0]
<HASH-2>  ui(emptystate): migration pack 6 — 5 ternary surface (PR #2)   [v1.26.2]
<HASH-1>  ui(emptystate): completed variant + putaway restore (PR #1)    [v1.26.1]
883f3aa   docs(audit): Sprint 15 closure (PR #3)                          [v1.26.0, prev HEAD]
```

**Closure tag:** `v1.27.0-emptystate-completed-pack-6` → `<HASH-3>`
**Stable branch:** `<HASH-3>`

**Pinned test toplam:** 2 yeni dosya, ~34 case
- `sprint-16-empty-state-completed-variant.test.ts` (9 case)
- `sprint-16-empty-state-pack-6.test.ts` (25 case)

**Smoke status (sandbox):** 59/59 ✓ (Sprint 14+15+16 testleri toplam)

**Mac apply script:** `OneAce/apply-sprint-16.command` (POSIX, bash 3.x parallel array)

---

## Sprint 17+ backlog (güncel)

1. **EmptyState pack 7** — kalan 12 ternary surface; bunların migrate'i sonrası
2. **Pattern C → hard-fail promote** — pack 7 sonrası threshold 13→0
3. **PageHeader pack 9** — kalan ~34 sayfa
4. **TR native review pass** (Mahmut manuel)
5. **Chromatic visual regression CI** (27 story baseline — Completed dahil)
6. **Card variant census test** — variant kullanım metriği snapshot
7. **EmptyState `completed` variant'ı 2-3 daha surface'e yay** — fully reconciled, fully received gibi durumlar
