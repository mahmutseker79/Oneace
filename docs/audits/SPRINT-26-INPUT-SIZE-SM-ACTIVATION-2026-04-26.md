# Sprint 26 — Input `size="sm"` aktivasyonu (2 surface, filter-bar dense forms)

**Tarih:** 2026-04-26 (Sprint 22 unused-variant audit follow-up #3)
**Bundle tag:** `v1.37.0-input-size-sm-activation`
**Önceki HEAD:** _Sprint 25 closure (script `v1.36.0-alert-success-info-activation^{commit}` resolve eder)_
**Yeni HEAD:** _Mac apply script tarafından oluşturulacak (3 commit)_

NOT: Sprint 25 push edilmiş olmalı.

---

## Bağlam — pivot #2

Sprint 26'nın orijinal scope'u "UX/UI audit doc taraması (§B-8+ veya §C-7+)" idi.
Audit doc (`docs/audits/UX-UI-AUDIT-AND-SPRINT-1-2026-04-25.md`) açıldığında:
- `§B-X` / `§C-X` etiketleri benim convention'umdan, audit doc'unda yok
- Audit doc PR-tabanlı yapıda (PR #1..PR #7), tümü Sprint 1 zamanı uygulanmış
- "1.2 Kalan gerçek bulgular" listesi çoğunlukla Sprint 19-25 batch'inde kapatıldı
- `Sonraki Sprintler` bölümü eski plan (i18n & a11y, Storybook, Tablet UX) — Sprint 19-25'e dahil değil

**Pivot:** Sprint 26'yı unused-variant audit'in 4. variant'ı olarak götür — Input.size.sm aktivasyonu (filter-bar dense form'lar).

---

## PR #1 — 2 surface migration

**Tag (planned):** `v1.36.1-input-size-sm-activation-migration`

| Dosya | Surface | Önceki | Sonraki |
|---|---|---|---|
| `movements/movements-filter-bar.tsx:146` | Search Input (tek satır, Select yok yan yanada) | implicit `size="default"` (md height) | `size="sm"` |
| `purchase-orders/purchase-orders-filter-bar.tsx:110` | Search Input (tek satır, Select yok yan yanada) | implicit `size="default"` | `size="sm"` |

### Scope sınırlaması — date Input'lar + Select'ler atlandı

Filter-bar'larda date Input'lar (movements `from`/`to` line 163/176) ve Select'ler (status, type, source-warehouse) yan yana satırlardalar. Bunları size="sm" yapmak height mismatch yaratır:
- Select primitive (`select.tsx:30`) hardcoded `h-[var(--control-h-md)]` kullanır
- Input.sm `h-[var(--control-h-sm)]` olur — yan yana hizalama bozulur

**Sprint 27+ adayı:** Select primitive'ini de size variant'lı hale getir, sonra date Input + Select'leri tek sprint'te sm'e migrate et.

### Görsel etki

2 search Input filter-bar'da 1 row daha kompakt görünür:
- Default (h-10, 40px) → sm (h-9, 36px) — 4px height reduction
- Filter row visual hierarchy data tablosunun altında biraz daha ezilir, primary focus data'ya kayar

---

## PR #2 — Pinned test guard

**Tag (planned):** `v1.36.2-input-size-sm-activation-test`

Yeni `sprint-26-input-size-sm-activation.test.ts` (3 case):
- 2 surface'in her biri için id + size="sm" fragment'leri yan yana
- Cumulative threshold: `<Input size="sm">` >= 2
- Yeni kullanım eklenirse threshold kendiliğinden geçer; regression durumunda fail.

---

## PR #3 — Sprint 26 closure audit doc

**Tag (planned):** `v1.37.0-input-size-sm-activation`

Bu doc'un kendisi PR #3'tür.

---

## Bundle özeti

```
<HASH-3>  docs(audit): Sprint 26 closure — input size sm activation     [v1.37.0]
<HASH-2>  test(input): size sm activation pack 1 guard                  [v1.36.2]
<HASH-1>  ui(input): size sm activation — 2 surface (filter-bar)        [v1.36.1]
<SPRINT-25-PR3>  docs(audit): Sprint 25 closure (PR #3)                 [v1.36.0, prev HEAD]
```

**Closure tag:** `v1.37.0-input-size-sm-activation`
**Stable branch:** HEAD

**Pinned test toplam (Sprint 26):** 1 yeni dosya, 3 case
- `sprint-26-input-size-sm-activation.test.ts`

**Census etkisi (§D-1 Input state census tekrar koşulduğunda):**
```
total=145 invalid_prop=15
states: (default only)
sizes:  sm=2
```
Input.size.sm: **0 → 2**.

**Smoke (sandbox):** Sprint 26 + 22 census = 6 PASS.

**Mac apply script:** `OneAce/apply-sprint-26.command`

---

## Unused-variant audit progress

| Variant | Sprint 22 baseline | Şu an | Durum |
|---|---|---|---|
| Button.success | 0 | **2** | ✅ activated (S24) |
| Alert.success | 0 | **3** | ✅ activated (S25) |
| Alert.info | 0 | **1** | ✅ activated (S25) |
| **Input.size.sm** | 0 | **2** | ✅ activated (S26) |
| Input.size.lg | 0 | 0 | pending |
| Input.state.success | 0 | 0 | pending |

**4/6 unused variant aktive** (S24+S25+S26 toplam).

---

## Sprint 27+ backlog

1. **Select primitive size variant** — Sprint 26 scope dışı bırakılan filter-bar date Input'ları + Select'leri sm'e taşımak için Select primitive'inin size variant'lı hale getirilmesi gerekir
2. **Input.state.success activation** — username/SKU availability success feedback
3. **Input.size.lg activation** — hero search / primary search input'ları (varsa)
4. **EmptyState completed pack 2** — yeni icon ailesi araması (Check, ListChecks, BadgeCheck, ShieldCheck)
5. **Unused-variant audit closure** — son 2 unused variant kapanınca (Input.size.lg + Input.state.success) audit'in tüm 6 variant'ı aktive edilmiş olur, closure doc'u
