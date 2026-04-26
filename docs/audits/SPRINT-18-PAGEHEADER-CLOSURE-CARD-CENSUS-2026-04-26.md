# Sprint 18 — §B-6 PageHeader closure + §C-3 Card variant census

**Tarih:** 2026-04-26 (UX/UI audit Apr-25 §B-6 + §C-3)
**Bundle tag:** `v1.29.0-pageheader-closure-card-census`
**Önceki HEAD:** `13a836f` (Sprint 17 closure, `v1.28.0`)
**Yeni HEAD:** _Mac apply script tarafından oluşturulacak (3 commit)_

NOT: Sandbox FUSE pattern (Sprint 15-17 ile aynı). `OneAce/apply-sprint-18.command`
ile Mac'te commit + tag + push.

---

## PR #1 — PageHeader audit refinement + §B-6 closure

**Tag (planned):** `v1.28.1-pageheader-coverage-refinement`

Sprint 8-14 boyunca PageHeader migration paketleri 1-8 ile 107 surface
migrate edildi. "107/141" sayımı yanıltıcıydı:

- **141 = TÜM page.tsx** (auth + marketing + onboarding + special dahil)
- PageHeader sadece (app)/ shell için tasarlandı
- 5 reports/* sayfası: server shell'de PageHeader yok ama CLIENT
  component'inde var (audit kaçırıyordu)
- 3 sayfa (zones/new, vehicles/[id], vehicles/new): PARENT DIR
  component'inde var (`vehicle-form`, `zone-form`)

Yeni `pageheader-coverage-audit.test.ts` doğru sayar:
- (app)/ içindeki TÜM page.tsx
- Aynı klasör + 2 parent klasördeki .tsx component'lerde PageHeader ara
- Exempt: özel layout (onboarding wizard, redirect-only, print)
- (auth)/, (marketing)/, special: skip (farklı layout)

**Coverage:** **(app)/: 115/115** (toplam 118, exempt 3) ✅

Hard-fail: yeni (app)/ page.tsx PageHeader olmadan merge edilemez.

**§B-6 STATUS:** **FULLY CLOSED** — coverage 100% (refined audit).

**Pinned test:** `pageheader-coverage-audit.test.ts` (4 case)
- (app)/ coverage = 100% (hard fail)
- EXEMPT list documents 3 special-layout pages
- Snapshot (informational) `[pageheader-coverage] (app)/: 115/115`
- (auth)/ + (marketing)/ skip (farklı layout)

---

## PR #2 — Card variant census + anti-pattern hard-fail (yeni track §C-3)

**Tag (planned):** `v1.28.2-card-variant-census`

Sprint 10 PR #3 Card primitive'i 7+ ad-hoc className kombinasyonundan 5
named variant'a normalize etmişti (default, interactive, warning,
destructive, info). Sprint 18 census'u kalıcılaştırır:

| Variant | Kullanım sayısı | Açıklama |
|---|---|---|
| default | 361 | Vanilla Card |
| destructive | 6 | settings/privacy, danger-zone, general, vb. |
| warning | 5 | transfer-ownership, plan-change-warning |
| interactive | 3 | Hover-clickable cards |
| info | 1 | Notice/banner |
| **Total** | **376** | (15 named + 361 default) |

**Anti-pattern HARD FAIL = 0:**
```
<Card className="border-red-500" ...>     ❌
<Card className="bg-yellow-100" ...>      ❌
<Card className="border-destructive" ...> ❌ (use variant="destructive")
<Card className="bg-warning-light" ...>   ❌ (use variant="warning")
```
Doğru çözüm: `variant=` prop kullan.

**Pinned test:** `card-variant-census.test.ts` (3 case)
- Anti-pattern hard fail = 0
- Variant census snapshot (informational, 5 variant + default)
- Variant union güncel (5 named values)

---

## PR #3 — Sprint 18 closure audit doc

**Tag (planned):** `v1.29.0-pageheader-closure-card-census`

Bu doc'un kendisi PR #3'tür.

---

## Bundle özeti (Mac apply script çıktısı sonrası)

```
<HASH-3>  docs(audit): Sprint 18 closure (PR #3)                   [v1.29.0]
<HASH-2>  test(card): variant census + anti-pattern hard-fail       [v1.28.2]
<HASH-1>  test(pageheader): coverage audit refinement + §B-6 closure [v1.28.1]
13a836f   docs(audit): Sprint 17 closure (PR #3)                   [v1.28.0, prev HEAD]
```

**Closure tag:** `v1.29.0-pageheader-closure-card-census` → `<HASH-3>`
**Stable branch:** `<HASH-3>`

**Pinned test toplam:** 2 yeni dosya, 7 case (4 + 3)
- `pageheader-coverage-audit.test.ts` (4 case = §B-6 closure)
- `card-variant-census.test.ts` (3 case = §C-3 census + hard-fail)

**Smoke status (sandbox):** 64/64 ✓

**Mac apply script:** `OneAce/apply-sprint-18.command`

---

## UX/UI audit Apr-25 — Section status (cumulative)

| Section | Status | Sprint(s) |
|---|---|---|
| **§B-6 PageHeader** | ✅ FULLY CLOSED (115/115 coverage) | Sprint 8-14 + 18 |
| **§B-7 Inline empty pattern** | ✅ FULLY CLOSED (A=B=C=0 hard fail) | Sprint 11-17 |
| **§C-3 Card variant** | ✅ FULLY CLOSED (anti-pattern=0, census snapshot) | Sprint 10-12 + 18 |

---

## Sprint 19+ backlog (güncel)

§B-6, §B-7, §C-3 closed. Yeni track önerileri:

1. **TR native review pass** (Mahmut manuel — i18n string review, terminoloji tutarlılığı)
2. **Chromatic visual regression CI** (27 story baseline — EmptyState 4 variant + Bare + Card 5 variant + PageHeader vb.)
3. **EmptyState `completed` variant'ı 2-3 daha surface'e yay** (fully reconciled, fully received)
4. **§B-8+** — UX/UI audit Apr-25'in B-6/B-7/C-3 dışındaki sections'larına geç (Mahmut audit doc'u açar, hangisi)
5. **Badge variant census** (Card census ile aynı pattern — Sprint 18 baseline'dan replicate)
6. **Button variant census** (aynı pattern — primary/secondary/destructive/outline kullanımı snapshot)
