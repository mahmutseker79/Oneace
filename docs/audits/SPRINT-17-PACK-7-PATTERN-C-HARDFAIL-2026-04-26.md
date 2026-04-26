# Sprint 17 — EmptyState pack 7 closure + Pattern C hard-fail promote

**Tarih:** 2026-04-26 (UX/UI audit Apr-25 §B-7 follow-up)
**Bundle tag:** `v1.28.0-emptystate-pack-7-hardfail-closure`
**Önceki HEAD:** `ddddef3` (Sprint 16 closure, `v1.27.0`)
**Yeni HEAD:** _Mac apply script tarafından oluşturulacak (3 commit)_

NOT: Sandbox FUSE `.git/HEAD.lock` kaldırılamadığı için commit'ler **Mac-side
`OneAce/apply-sprint-17.command`** ile atılır. Dosya değişiklikleri zaten
working tree'de — script sadece stage + commit + tag + branch update yapar.

---

## PR #1 — EmptyState migration pack 7 closure (12 surface, 21 ternary)

**Tag (planned):** `v1.27.1-emptystate-pack-7`

Sprint 16 PR #2 (pack 6) kalan 17 ternary surface'in ilk 5'ini migrate
etmişti (Pattern C: 17→12). Pack 7 KALAN 12 dosyayı (21 ternary
occurrence) tamamen kapatır.

| Surface | Ternary sayısı | Icon(lar) |
|---|---|---|
| `dashboard/page.tsx` | 2 | `CheckCircle2` (lowStock empty), `Activity` (recent empty) |
| `items/[id]/page.tsx` | 2 | `Boxes` (stock), `ArrowLeftRight` (movements) |
| `migrations/new/page.tsx` | 2 | `FileSearch` (detections), `Link2` (mappings) |
| `movements/movement-form.tsx` | 1 | `Search` variant=filtered (combobox) |
| `purchase-orders/[id]/page.tsx` | 1 | `ClipboardList` (audit) |
| `purchase-orders/purchase-order-form.tsx` | 1 | `ListPlus` (lines) |
| `scan/scanner.tsx` | 2 | `Boxes` (levels), `History` (history) |
| `search/page.tsx` | 3 | `Package`/`Building2`/`Warehouse` variant=filtered |
| `stock-counts/[id]/page.tsx` | 2 | `Camera` (snapshots), `ClipboardList` (entries) |
| `suppliers/[id]/page.tsx` | 1 | `TrendingUp` (top items) |
| `users/page.tsx` | 2 | `MailX` (invitations), `Users` (mobile table) |
| `warehouses/[id]/page.tsx` | 2 | `Boxes` (stock), `ArrowLeftRight` (movements) |

Hepsi **bare** EmptyState kullanır (mevcut Card+CardHeader korunur, sadece
inner `<p>` empty branch yerine geçer). search/page.tsx, movements/movement-form.tsx
ve `users/page.tsx` mobile table `variant="filtered"` kullanır.

**Pattern C count:** 12 → 0.

**Pinned test:** `sprint-17-empty-state-pack-7.test.ts` (~54 case)
- 12 surface × (import EmptyState + 2-4 contains assertion)
- Global Pattern C count = 0 spot check

---

## PR #2 — Pattern C hard-fail promote

**Tag (planned):** `v1.27.2-emptystate-pattern-c-hardfail`

`empty-state-no-inline-pattern.test.ts` Pattern C testi soft-fail (≤13)'ten
**hard-fail (=0)** moduna alındı. Sprint 14 PR #3'ten beri evrim:

| Sprint | Pattern A | Pattern B | Pattern C |
|---|---|---|---|
| Sprint 14 PR #3 | informational ≤10 (0) | yok | yok |
| Sprint 15 PR #2 | **HARD = 0** | **HARD = 0** | informational ≤20 (17) |
| Sprint 16 PR #2 | **HARD = 0** | **HARD = 0** | informational ≤13 (12) |
| **Sprint 17 PR #2** | **HARD = 0** | **HARD = 0** | **HARD = 0** ✅ |

§B-7 inline empty pattern audit fully closed. Yeni inline empty pattern
merge edildiğinde A, B, veya C'den hangisi tetiklenirse CI bloklar; doğru
çözüm `<EmptyState />` (gerekirse `bare` prop) kullanmak.

**Pinned test:** mevcut `empty-state-no-inline-pattern.test.ts` güncellendi (3 case = A/B/C, hepsi hard-fail).

---

## PR #3 — Sprint 17 closure audit doc

**Tag (planned):** `v1.28.0-emptystate-pack-7-hardfail-closure`

Bu doc'un kendisi PR #3'tür. §B-7 fully closed; Sprint 18+ backlog yeni
track'lere kayıyor.

---

## Bundle özeti (Mac apply script çıktısı sonrası)

```
<HASH-3>  docs(audit): Sprint 17 closure (PR #3)                     [v1.28.0]
<HASH-2>  test(emptystate): Pattern C hard-fail promote (PR #2)      [v1.27.2]
<HASH-1>  ui(emptystate): pack 7 closure — 12 surface, 21 ternary    [v1.27.1]
ddddef3   docs(audit): Sprint 16 closure (PR #3)                     [v1.27.0, prev HEAD]
```

**Closure tag:** `v1.28.0-emptystate-pack-7-hardfail-closure` → `<HASH-3>`
**Stable branch:** `<HASH-3>`

**Pinned test toplam:** 1 yeni dosya, ~55 case + mevcut hard-fail guard güncellendi
- `sprint-17-empty-state-pack-7.test.ts` (~54 case)
- `empty-state-no-inline-pattern.test.ts` (3 case, Pattern C hard-fail)

**Smoke status (sandbox):** 110/110 ✓ (Sprint 14+15+16+17 testleri toplam)

**Mac apply script:** `OneAce/apply-sprint-17.command` (POSIX, bash 3.x parallel array)

---

## §B-7 ÜLTİMATE STATUS

```
Inline empty pattern audit (UX/UI Apr-25 §B-7) — KAPATILDI
─────────────────────────────────────────────────────────
  Pattern A (literal "No ")    : HARD FAIL = 0  ✅
  Pattern B (i18n {labels.no}) : HARD FAIL = 0  ✅
  Pattern C (ternary length=0) : HARD FAIL = 0  ✅

  Total surface'ler migrate edildi:
    Sprint 11-14: 40+ surface (cumulative öncesi)
    Sprint 15:    3 surface  (i18n closure)
    Sprint 16:    5 surface  (ternary first batch)
    Sprint 17:   12 surface  (ternary closure) ← BU SPRINT
    ─────────────────────────
    TOPLAM:    60+ migration in 17 sprint
```

---

## Sprint 18+ backlog (güncel)

§B-7 kapandığı için yeni track'lere geçiş:

1. **PageHeader pack 9** — kalan ~34 sayfa (107/141 → hedef 141/141)
2. **TR native review pass** (Mahmut manuel)
3. **Chromatic visual regression CI** (27 story baseline — Completed dahil)
4. **Card variant census test** — variant kullanım metriği snapshot
5. **EmptyState `completed` variant'ı 2-3 daha surface'e yay** (fully reconciled, fully received)
6. **§B-8+** — UX/UI audit Apr-25'in B-7 dışındaki sections'larına geç
