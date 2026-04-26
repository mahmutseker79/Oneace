# Sprint 23 — EmptyState `completed` variant pack 1 (4 surface)

**Tarih:** 2026-04-26 (UX/UI audit Apr-25 §B-7 follow-up — completed variant yayma)
**Bundle tag:** `v1.34.0-emptystate-completed-pack-1`
**Önceki HEAD:** _Sprint 22 PR #2 hash (script tarafından `v1.33.0-input-state-census` tag'inden çözülecek)_
**Yeni HEAD:** _Mac apply script tarafından oluşturulacak (3 commit)_

NOT: Sandbox FUSE pattern. `OneAce/apply-sprint-23.command` ile Mac'te commit + tag + push. **Sprint 22 koşulmuş olmalı** — script `v1.33.0-input-state-census` tag'ini bekliyor.

---

## Bağlam

Sprint 16 PR #1'de `EmptyState` 4. variant'ı `completed` eklendi (Sprint 15'te
text-success kaybı için restore). Tek kullanım: `purchase-orders/[id]/putaway`
`noUnbinnedStock` durumunda.

Sprint 22 census çıktısı 5 unused variant gösterdi — bunlardan biri
EmptyState `completed`'in kullanım dengesizliği değildi (zaten 1 kullanım
vardı), ama yayılma potansiyeli vardı: completion-tematik `<EmptyState
icon={CheckCircle2}>` kullanan ama `completed` variant olmayan yerler.

Sprint 23 bu yayılmayı yapar.

---

## PR #1 — 4 surface migration

**Tag (planned):** `v1.33.1-emptystate-completed-pack-1-migration`

| Dosya | Önceki variant | Yeni variant | Mantık |
|---|---|---|---|
| `items/import/import-form.tsx:653` | `filtered` (semantik yanlış — filtre değil, tüm satırlar import-ready) | `completed` | "Tüm satırlar hazır" pozitif sinyal |
| `dashboard/page.tsx:629` | implicit `empty` + `bare` | `completed` + `bare` | "No low stock items" iyi haber |
| `reports/low-stock/page.tsx:160-164` | implicit `empty` | `completed` | "All stocked" iyi haber |
| `stock-counts/pending-approvals/page.tsx:50-54` | implicit `empty` | `completed` | "All approvals processed" tamamlanma |

**Görsel etki:** 4 surface'te background-primary/8 + ring-primary/10 + text-primary
yerine **bg-success/10 + ring-success/20 + text-success** (yeşil ton). Tasarım
sistemi yeşil = positive completion semantiğini doğru iletir.

`bare` mode + `completed` variant kombinasyonu (dashboard surface'inde):
component implementation `iconContainerClass` + `iconClass` switch'leri zaten
variant'a göre branch eder, `bare` flag'i ortogonal — kombine kullanım çalışır.

---

## PR #2 — Pinned test guard

**Tag (planned):** `v1.33.2-emptystate-completed-pack-1-test`

Yeni `sprint-23-empty-state-completed-pack.test.ts` (5 case):
- 4 surface'in her biri için `icon={CheckCircle2}` + `variant="completed"` fragment'leri yan yana doğrulanır
- Cumulative threshold: `variant="completed"` toplam kullanım `>= 5` (Sprint 16 baseline 1 + Sprint 23 +4 = 5). Yeni kullanım eklenirse threshold kendiliğinden geçer (regression durumunda fail).

---

## PR #3 — Sprint 23 closure audit doc

**Tag (planned):** `v1.34.0-emptystate-completed-pack-1`

Bu doc'un kendisi PR #3'tür.

---

## Bundle özeti

```
<HASH-3>  docs(audit): Sprint 23 closure — completed variant pack 1   [v1.34.0]
<HASH-2>  test(empty-state): completed variant pack 1 guard           [v1.33.2]
<HASH-1>  ui(empty-state): completed variant pack 1 — 4 surface       [v1.33.1]
<SPRINT-22-PR2>  docs(audit): Sprint 22 closure (PR #2)               [v1.33.0, prev HEAD]
```

**Closure tag:** `v1.34.0-emptystate-completed-pack-1`
**Stable branch:** HEAD

**Pinned test toplam (Sprint 23):** 1 yeni dosya, 5 case
- `sprint-23-empty-state-completed-pack.test.ts`

**Smoke status (sandbox):** 137/137 ✓ (Sprint 14-23 cumulative — 13 test file)

**Mac apply script:** `OneAce/apply-sprint-23.command`

---

## UX/UI audit Apr-25 — Section status

| Section | Status | Sprint(s) |
|---|---|---|
| §B-6 PageHeader | ✅ FULLY CLOSED | Sprint 8-14 + 18 |
| §B-7 Inline empty | ✅ FULLY CLOSED + completed variant pack 1 yayıldı | Sprint 11-17 + 23 |
| §C-3 Card variant | ✅ FULLY CLOSED | Sprint 10-12 + 18 |
| §C-4 Badge variant | ✅ FULLY CLOSED | Sprint 19 |
| §C-5 Button variant | ✅ FULLY CLOSED | Sprint 20 |
| §C-6 Alert variant | ✅ FULLY CLOSED | Sprint 21 |
| §D-1 Input state | ✅ FULLY CLOSED | Sprint 22 |

Cumulative: **7 audit section closed + 1 follow-up pack (Sprint 23)**.

EmptyState completed variant kullanım: **1 → 5** (Sprint 16 → Sprint 23).
Unused-variant audit'in 5 unused'ından biri Sprint 23'le aktif kullanıma
girdi (informational kayıt: completed Sprint 16'dan beri zaten kullanımdaydı,
Sprint 23 yayılma).

---

## Sprint 24+ backlog

1. **Unused-variant audit pass (4 unused kaldı)** — Button.success, Alert.success, Alert.info, Input.size.{sm,lg}, Input.state.success: kullanım yeri tespit veya emekli kararı
2. **TR native review pass** (Mahmut manuel)
3. **Chromatic visual regression CI** (40+ story baseline)
4. **EmptyState completed pack 2** — 2-3 daha surface (transfers/[id]/receive fully received, sales-orders/[id]/ship fully shipped, stock-counts reconciled)
5. **§B-8+** — UX/UI audit Apr-25'in kalan B-section'ları (Mahmut audit doc'u açar)
