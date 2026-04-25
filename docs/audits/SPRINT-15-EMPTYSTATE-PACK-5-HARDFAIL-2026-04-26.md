# Sprint 15 — EmptyState pack 5 + inline empty hard-fail guard

**Tarih:** 2026-04-26 (UX/UI audit Apr-25 §B-7 follow-up)
**Bundle tag:** `v1.26.0-emptystate-hardfail-pass-9`
**Önceki HEAD:** `d6b5c9a` (Sprint 14 closure audit doc, `v1.25.1`)
**Yeni HEAD:** _Mac apply script tarafından oluşturulacak (3 commit)_

NOT: Sandbox FUSE `.git/HEAD.lock` kaldırılamadığı için commit'ler **Mac-side
`OneAce/apply-sprint-15.command`** ile atılır. Dosya değişiklikleri zaten working
tree'de — script sadece stage + commit + tag + branch update yapar.

---

## PR #1 — EmptyState migration pack 5 (3 surface)

**Tag (planned):** `v1.25.2-emptystate-pack-5`

Sprint 14 PR #3 informational audit (strict regex, threshold ≤10) literal "No "
pattern'lerini 0'a indirmişti — ama i18n `{labels.noBins}` expression
pattern'lerini kaçırıyordu. Pack 5 onu kapatır.

| Surface | Icon | Variant | Action |
|---|---|---|---|
| `purchase-orders/[id]/putaway/putaway-form.tsx` (noBins) | `PackageOpen` | `unavailable` | — |
| `purchase-orders/[id]/putaway/putaway-form.tsx` (noUnbinnedStock) | `CheckCircle2` | (default `empty`) | `viewPo` (secondary) |
| `reports/scheduled/page.tsx` (empty branch) | `CalendarClock` | (default `empty`) | `New scheduled report` (hasAccess only) |

**putaway-form** — `Card` + `CardContent` import'ları artık kullanılmıyor; kaldırıldı.
**reports/scheduled** — outer `<Card>` + `<CardHeader>` + `<CardContent>` empty
branch'te tamamen kaldırıldı; populated branch'te aynen korundu (ternary restructure).

### Semantic note: `noUnbinnedStock` post-completion mismatch
Bu surface aslında "empty" değil "all-done / completion" durumu. Mevcut EmptyState
varyantları (`empty`/`filtered`/`unavailable`) success styling vermiyor — `CheckCircle2`
icon `text-primary` rengiyle render ediliyor (önceden `text-success` idi).

Görsel kayıp düşük; doğru çözüm gelecekte EmptyState'e `completed` variant eklemek
(success ring + green icon). Sprint 16+ backlog'a alındı.

**Pinned test:** `sprint-15-empty-state-pack-5.test.ts` (~22 case)
- 3 surface × (import EmptyState + 3-4 contains + 1 not-contains)
- putaway-form: Card import removed assertion
- Global EmptyState file count `>= 46`

---

## PR #2 — Inline empty hard-fail guard (audit consolidation)

**Tag (planned):** `v1.25.3-emptystate-hardfail-guard`

Sprint 14 PR #3'teki informational audit `sprint-14-empty-state-bare-story.test.ts`
içindeydi (threshold ≤10, sadece literal "No " pattern). Pack 5 sonrası bu test
kapsamı dar kalıyor — i18n + ternary pattern'leri kaçırıyor.

Yeni permanent guard: `src/components/empty-state-no-inline-pattern.test.ts`

| Pattern | Trigger | Threshold |
|---|---|---|
| **A — Literal** | `<CardContent...py-N...><p text-muted-foreground>No ` | **0 (hard fail)** |
| **B — i18n** | `<CardContent...py-N text-center...><p text-muted-foreground>{labels.no\|empty\|nothing` | **0 (hard fail)** |
| **C — Ternary** | `X.length === 0 ? ...<p text-muted-foreground` | **≤20 (soft fail informational)** |

Pattern A ve B artık hard fail. Yeni inline empty pattern PR'larında CI bloklar.
Pattern C şu an 17 sayfa kapsıyor — Sprint 16+ pack 6/7 backlog hedefi: bunu 0'a
indirip hard-fail moduna almak.

**Sprint 14 bare-story test** (`sprint-14-empty-state-bare-story.test.ts`)
informational audit kısmından arındırıldı; sadece Bare story checks kaldı.

**Pinned test:** `empty-state-no-inline-pattern.test.ts` (3 case = 3 pattern)

---

## PR #3 — Sprint 15 closure audit doc (informational)

**Tag (planned):** `v1.26.0-emptystate-hardfail-pass-9`

Bu doc'un kendisi PR #3'tür. Sprint 16+ backlog özetler.

---

## Bundle özeti (Mac apply script çıktısı sonrası)

```
<HASH-3>  docs(audit): Sprint 15 closure (PR #3)            [v1.26.0]
<HASH-2>  test(emptystate): inline pattern hard-fail guard  [v1.25.3]
<HASH-1>  ui(emptystate): migration pack 5 — 3 surface      [v1.25.2]
d6b5c9a   docs(audit): Sprint 14 closure audit doc          [v1.25.1, prev HEAD]
```

**Closure tag:** `v1.26.0-emptystate-hardfail-pass-9` → `<HASH-3>`
**Stable branch:** `<HASH-3>`

**Pinned test toplam:** 2 yeni dosya, ~25 case
- `sprint-15-empty-state-pack-5.test.ts` (~22 case)
- `empty-state-no-inline-pattern.test.ts` (3 case = A/B/C pattern)

**Mac apply script:** `OneAce/apply-sprint-15.command` (POSIX, bash 3.x parallel array)

---

## Sprint 16+ backlog (güncel)

1. **EmptyState pack 6 (ternary length===0)** — kalan 17 sayfa → ilk 5-7'sini migrate et
2. **EmptyState pack 7 (ternary length===0 closure)** — kalan ~10-12 sayfa
3. **Pattern C → hard-fail promote** — pack 7 sonrası threshold 20→0
4. **EmptyState `completed` variant** — success ring + green icon (putaway noUnbinnedStock visual restore)
5. **PageHeader pack 9** — kalan ~34 sayfa
6. **TR native review pass** (Mahmut manuel)
7. **Chromatic visual regression CI** (26 story baseline — EmptyState Bare dahil)
8. **Card variant census test** — variant kullanım metriği snapshot
