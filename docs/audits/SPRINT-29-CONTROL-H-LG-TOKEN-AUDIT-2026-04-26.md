# Sprint 29 — `--control-h-lg` token sole-consumer audit

**Tarih:** 2026-04-26
**Önceki tag:** `v1.39.0-input-select-lg-retire` (Sprint 28 closure)
**Closure tag:** `v1.40.0-control-h-lg-token-audit`
**Stable branch:** HEAD

---

## TL;DR

Sprint 28'de Input + SelectTrigger primitive'lerinden `lg` size variant retire edildi. CSS token `--control-h-lg` Button.lg için korundu. Sprint 29 bu durumu **token-level pinned guard** ile kilitler: yeni bir primitive yanlışlıkla `var(--control-h-lg)` tüketmeye başlarsa testler hard-fail olur.

| Token | Tanım | Primitive consumer | Kullanım sayısı |
|---|---|---|---|
| `--control-h-sm` | 2.25rem (36px) | Input + SelectTrigger + Button | 3+ |
| `--control-h-md` | 2.75rem (44px) | Input + SelectTrigger + Button | 3+ |
| `--control-h-lg` | 3rem (48px) | **Button (sole consumer)** | **1** |

**Pinned test toplam (Sprint 29):** 1 yeni dosya, 7 case (`sprint-29-control-h-lg-token-audit.test.ts`).

---

## Gerekçe

Sprint 28 closure'da risk + rollback bölümü şöyleydi:

> **Risk:** sıfır. Hem `<Input size="lg">` hem `<SelectTrigger size="lg">` repo'da 0 kullanım — primitive cva'dan çıkarmak hiçbir surface'i etkilemez.

Bu doğru, ama `--control-h-lg` token'ı sistemde duruyor ve **gelecekteki bir primitive** (yeni bir `Textarea` size variant'ı, veya yeni bir `Combobox`) yanlışlıkla bu token'ı tüketmeye başlarsa Sprint 28 retire kararı sessizce gevşer. Sprint 29 bunu **hard-fail** ile yakalar:

```ts
// Eğer biri input.tsx'e var(--control-h-lg) eklerse:
expect(consumers).toEqual(["src/components/ui/button.tsx"]);
//   → AssertionError: Expected ["button.tsx"], got ["button.tsx", "input.tsx"]
```

Ek olarak **lock-step gerçeği** (sm + md tokens) doğrulanır: en az 3 primitive consumer (Input, SelectTrigger, Button) sm + md token'larını paylaşır. Bu, sm/md retire risklerini de kapatır.

---

## PR #1 — Pinned token audit guard

**Tag (planned):** `v1.39.1-control-h-lg-token-audit`

Yeni `sprint-29-control-h-lg-token-audit.test.ts` (7 case):

| # | Assertion | Mantık |
|---|---|---|
| 1 | `--control-h-lg: 3rem` globals.css'te | Token tanımı korunur |
| 2 | sm=2.25rem, md=2.75rem, lg=3rem (3 size) | Lock-step tanım gerçeği |
| 3 | **HARD GUARD:** `var(--control-h-lg)` consumer = sadece button.tsx | Sole-consumer kilidi |
| 4 | Button.lg cva = exactly 1 occurrence | Regression koruması (yanlışlıkla 0'a düşmesi) |
| 5 | `--control-h-md` ≥ 3 primitive consumer | Lock-step (default size) |
| 6 | `--control-h-sm` ≥ 3 primitive consumer | Lock-step (sm size) |
| 7 | Input + SelectTrigger `var(--control-h-lg)` = 0 | Sprint 28 retire kararı kalıcı |

**Comment-friendly regex:** `var\\(--control-h-lg\\)` — primitive source comment'inde token adı geçebilir, sadece gerçek CSS expression match eder.

---

## PR #2 — Sprint 29 closure audit doc

**Tag (planned):** `v1.40.0-control-h-lg-token-audit`

Bu doc'un kendisi PR #2'dir.

---

## Bundle özeti

```
<HASH-2>  docs(audit): Sprint 29 closure — control-h-lg token audit     [v1.40.0]
<HASH-1>  test(token-audit): control-h-lg sole-consumer pinned guard    [v1.39.1]
<SPRINT-28-PR3>  docs(audit): Sprint 28 closure (PR #3)                  [v1.39.0, prev HEAD]
```

**Closure tag:** `v1.40.0-control-h-lg-token-audit`
**Stable branch:** HEAD

**Smoke (sandbox) Sprint 29 yeni test + cumulative tabaka:**
```
✓ src/components/sprint-29-control-h-lg-token-audit.test.ts (7 tests) 58ms
✓ src/components/sprint-28-input-select-lg-retire.test.ts (6 tests)
✓ src/components/sprint-27-filter-bar-full-sm.test.ts (9 tests)
✓ src/components/input-state-census.test.ts (3 tests)
✓ src/components/touch-target.test.ts (9 tests)
Test Files  5 passed (5)  |  Tests 34 passed (34)
```

**Mac apply script:** `OneAce/apply-sprint-29.command`. **Sprint 28 önce shipped olmalı** (guard: `git describe --tags` = `v1.39.0-input-select-lg-retire`).

---

## Token consumer matrix (gözlemsel snapshot)

```
src/components/ui/button.tsx       → sm + md + lg     (3 size variant aktif)
src/components/ui/input.tsx        → sm + md          (Sprint 28 sonrası)
src/components/ui/select.tsx       → sm + md          (Sprint 28 sonrası)
src/components/ui/textarea.tsx     → md (default lock-step, varsa)
[diğer primitive'ler]              → genelde md
```

`--control-h-lg` yalnız Button surface'inde anlamlı: hero CTA, landing page, settings save, pricing buttons (10 instance toplam). Diğer primitive'ler default = `--control-h-md` (44px touch target floor).

---

## Audit cumulative status (Sprint 29 sonrası)

### Unused-variant audit (Sprint 22 §D-1 + downstream)

| Variant | Durum | Sprint |
|---|---|---|
| Button.success | ✅ activated | S24 |
| Alert.success | ✅ activated | S25 |
| Alert.info | ✅ activated | S25 |
| Input.size.sm | ✅ activated | S26+S27 |
| Input.size.lg | ✅ retired | S28 |
| SelectTrigger.size.lg | ✅ retired | S28 |
| **--control-h-lg token** | ✅ **sole-consumer audit** | **S29 (yeni)** |
| Input.state.success | ⏳ pending | S30 adayı |

**6/7 + token audit kapalı.** Geri kalan tek track: `Input.state.success` activation veya retire kararı.

---

## Sprint 30+ backlog

1. **Input.state.success** — username/SKU availability success feedback. İki yön mümkün:
   - **Activation:** signup email check, items/edit SKU uniqueness, integrations API key validation gibi async confirm flow'larda success state göster.
   - **Retire:** Eğer 1-2 sprint domain taraması sonra anlamlı use-case bulunmazsa Sprint 28 pattern'iyle retire.
   Bu sprint'te bir **scoping doc** hazırlanır, surface taraması yapılır, karar verilir.
2. **Unused-variant audit closure manifest** — Input.state.success çözümünden sonra §D-1 + unused-variant pack resmen kapanır. Tek bir KAPANIŞ doc'u (audit closure manifest) yazılır, audit'in bu segmenti tarihselleştirilir.
3. **EmptyState completed pack 2** — Sprint 23 ile pack 1 yapıldı; pack 2 için aday yer kalmadı izlenimi, deep-scan bir kez daha gerek.
4. **Storybook coverage 12→25** — Sprint 8-9 storybook backlog (PageHeader vb.). Hâlâ açık.

---

## Risk + rollback

- **Risk:** sıfır. Sprint 29 sadece test ekler, hiçbir source değişmez. Existing davranışı pinler.
- **Rollback:** test dosyasını silmek tek commit. Token + tüm primitive davranışları aynen kalır.
- **False positive senaryosu:** Yeni bir primitive (örn. Textarea size variant'ı) `--control-h-lg` tüketirse, test hard-fail olur. Bu bir bug değil — kasıtlı kararsa test'in 3. assertion'ı genişletilir (`button.tsx` listesine yeni primitive eklenir). Yani Sprint 29 testi büyüme rehberi gibi davranır.
