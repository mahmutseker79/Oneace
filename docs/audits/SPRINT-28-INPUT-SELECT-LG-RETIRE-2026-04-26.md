# Sprint 28 — Input + SelectTrigger `lg` size retire

**Tarih:** 2026-04-26
**Önceki tag:** `v1.38.0-filter-bar-full-sm` (Sprint 27, HEAD=`7b0a525`)
**Closure tag:** `v1.39.0-input-select-lg-retire`
**Stable branch:** HEAD

---

## TL;DR

Input + SelectTrigger primitive'lerinin `size="lg"` variant'ı **kullanılmıyordu** (her ikisi de 0 instance). Sprint 28 bu yüzden cva surface'inden çıkardı. Button.lg aktif kullanımda olduğu için `--control-h-lg` CSS token'ı `globals.css`'te korundu — yalnızca Input + Select'in cva tanımları temizlendi.

| Primitive | Önce | Sonra | Kullanım | Karar |
|---|---|---|---|---|
| Input.size | sm / default / lg | sm / default | lg = 0 | ✅ retire |
| SelectTrigger.size | sm / default / lg | sm / default | lg = 0 | ✅ retire |
| Button.size | sm / default / lg / icon | (değişmedi) | lg = 10 | ✅ kalır |

**Pinned test toplam (Sprint 28):** 1 yeni dosya, 6 case (`sprint-28-input-select-lg-retire.test.ts`).

---

## Gerekçe

1. **§D-1 census baseline (Sprint 22):** Input.size.lg = 0 instance — primitive cva'da var ama kimse kullanmıyor.
2. **Sprint 27 sonrası SelectTrigger.size.lg = 0 instance** — yeni primitive feature ama lg değeri için use-case yok.
3. **Hero/landing surface'leri Button.lg kullanıyor** (10 instance: `app/page.tsx` 5, `pricing` 2, `migrations/new` 1, `settings/general` 1, `button.stories` 1). Yani `--control-h-lg` (3rem/48px) CSS token'ı sistemde gerekli — sadece Input + Select için gerekli değil.
4. **YAGNI + cva surface area:** kullanılmayan variant'lar test surface'i + tip karmaşıklığı + Storybook coverage borcu yaratır. Aktif kullanım yokken yaşatmanın bedeli var, getirisi yok.

---

## PR #1 — Primitive cva temizliği

**Tag (planned):** `v1.38.1-input-select-lg-retire`

### Diff özet

**`src/components/ui/input.tsx`** — `lg:` satırı kaldırıldı (1 satır):

```diff
       size: {
         sm: "h-[var(--control-h-sm)] px-2.5 py-1.5 text-sm",
         default: "h-[var(--control-h-md)] px-3 py-2 text-sm",
-        lg: "h-[var(--control-h-lg)] px-4 py-2.5 text-base",
       },
```

**`src/components/ui/select.tsx`** — `lg:` satırı kaldırıldı + Sprint 28 retire annotation eklendi:

```diff
+// Sprint 28 — `lg` retired (0 kullanım, primitive cva temizliği). Union: sm /
+// default. Hero/landing surface'leri Button.lg kullanıyor; Input + Select
+// scope'unda lg ihtiyacı yok. ...
       size: {
         sm: "h-[var(--control-h-sm)] px-2.5 py-1.5 text-sm",
         default: "h-[var(--control-h-md)] px-3 py-2 text-sm",
-        lg: "h-[var(--control-h-lg)] px-4 py-2.5 text-base",
       },
```

### Existing test alignment

- `src/components/input-state-census.test.ts` — comment `3 size` → `2 size`, cva union assertion `lg:\s*"/` → `not.toMatch(/lg:\s*"h-\[var\(--control-h-lg\)\]/)`.
- `src/components/sprint-27-filter-bar-full-sm.test.ts` — Select cva size variant assertion'ı `sm + default + lg` → `sm + default`, `--control-h-lg` reference assertion `not.toMatch` ile çevrildi.

### Hâlâ duruyor (kasıtlı)

- `src/app/globals.css:507` → `--control-h-lg: 3rem` token. Button.lg kullanıyor.
- `src/components/ui/button.tsx:26` → `lg: "h-[var(--control-h-lg)] rounded-md px-8"`. Button primitive değişmedi.
- `src/components/touch-target.test.ts:45-46` → CSS token assertion. Token korunduğu için test geçmeye devam ediyor.

---

## PR #2 — Pinned test guard

**Tag (planned):** `v1.38.2-input-select-lg-retire-test`

Yeni `sprint-28-input-select-lg-retire.test.ts` (6 case):

| # | Assertion | Mantık |
|---|---|---|
| 1 | Input cva: `sm + default` mevcut, `lg:` cva-style yok, `var(--control-h-lg)` reference yok | Primitive temizliği |
| 2 | SelectTrigger cva: `sm + default` mevcut, `lg:` cva-style yok, `var(--control-h-lg)` reference yok | Primitive temizliği |
| 3 | `globals.css` → `--control-h-lg: 3rem` korunur | Token survives |
| 4 | `button.tsx` → `lg: "h-[var(--control-h-lg)]` korunur | Button.lg yaşar |
| 5 | **HARD FAIL:** repo'da `<Input size="lg">` = 0 | Regresyon koruması |
| 6 | **HARD FAIL:** repo'da `<SelectTrigger size="lg">` = 0 | Regresyon koruması |

Comment-friendly regex: `var\(--control-h-lg\)` — primitive source comment'inde token adı geçebilir, sadece gerçek CSS expression yasak.

---

## PR #3 — Sprint 28 closure audit doc

**Tag (planned):** `v1.39.0-input-select-lg-retire`

Bu doc'un kendisi PR #3'tür.

---

## Bundle özeti

```
<HASH-3>  docs(audit): Sprint 28 closure — input+select lg retire        [v1.39.0]
<HASH-2>  test(input+select): lg retire pinned guard (6 case)            [v1.38.2]
<HASH-1>  ui(input+select): retire size=lg variant from cva (0 usage)    [v1.38.1]
<SPRINT-27-PR3 7b0a525>  docs(audit): Sprint 27 closure (PR #3)           [v1.38.0, prev HEAD]
```

**Closure tag:** `v1.39.0-input-select-lg-retire`
**Stable branch:** HEAD

**Smoke (sandbox) Sprint 28 + Sprint 27 + §D-1 census + touch-target:**
```
✓ src/components/sprint-27-filter-bar-full-sm.test.ts (9 tests)
✓ src/components/sprint-28-input-select-lg-retire.test.ts (6 tests)
✓ src/components/input-state-census.test.ts (3 tests)
✓ src/components/touch-target.test.ts (9 tests)
Test Files  4 passed (4)  |  Tests 27 passed (27)
```

Broader src/components/ smoke: 527/528 PASS. Tek fail (`nav-ia-v1.5.test.ts > /inventory/status-change back-link`) Sprint 28 ile alakasız, **pre-existing**.

**Mac apply script:** `OneAce/apply-sprint-28.command`

---

## Unused-variant audit progress

| Variant | Sprint 22 baseline | Şu an | Durum |
|---|---|---|---|
| Button.success | 0 | 2 | ✅ activated (S24) |
| Alert.success | 0 | 3 | ✅ activated (S25) |
| Alert.info | 0 | 1 | ✅ activated (S25) |
| Input.size.sm | 0 | 4 | ✅ activated (S26+S27) |
| **Input.size.lg** | **0** | **(retired)** | ✅ **retired (S28)** |
| **SelectTrigger.size.lg** | (Sprint 27 added, 0) | **(retired)** | ✅ **retired (S28)** |
| Input.state.success | 0 | 0 | ⏳ pending — domain decision |

**5/6 unused variant resolved (4 activate + 2 retire) + 1 yeni primitive feature (SelectTrigger.size).**

Geri kalan: Input.state.success — username/SKU availability success feedback için form library entegrasyonu gerekli (domain bilgisi). Sprint 29+ adayı.

---

## §D-1 Input state census — güncel snapshot

```
[input-state-census] total=145 invalid_prop=15
  states: (default only)        ← state="success" hâlâ 0
  sizes:  sm=4                  ← Sprint 26: 2 search + Sprint 27: 2 date
```

cva union: `{ size: { sm, default }, state: { default, error, success }, invalid?: boolean }`.

---

## Sprint 29+ backlog

1. **Input.state.success activation** — username/SKU availability success feedback (form library entegrasyonu gerek; e.g. async availability check).
2. **Unused-variant audit closure doc** — Input.state.success da çözüldükten sonra audit'in §D-1 + unused-variant pack'i resmen kapanır. Tek bir KAPANIŞ doc'u (closure manifest) yazılır.
3. **EmptyState completed pack 2** — Sprint 23 ile pack 1 yapıldı, pack 2 için aday yer kalmadı izlenimi var; deep-scan bir kez daha gerek.
4. **Storybook coverage 12→25** — Sprint 8-9 storybook backlog (PageHeader vb.); bu sprint chain bittikten sonra ergonomi yeniden ele alınabilir.
5. **Input.size.lg retire emniyet süresi** — 1-2 sprint sonra `--control-h-lg` token'ının yalnız Button kullandığını doğrulayan census doc'u (token-level audit).

---

## Risk + rollback

- **Risk:** sıfır. Hem `<Input size="lg">` hem `<SelectTrigger size="lg">` repo'da 0 kullanım — primitive cva'dan çıkarmak hiçbir surface'i etkilemez.
- **Rollback:** primitive cva'ya `lg:` satırını geri eklemek tek commit. Token zaten globals.css'te. PR #1 revert yeterli.
- **Type safety:** `VariantProps<typeof inputVariants>` artık `size: "sm" | "default" | undefined` döndürür; eskiden `lg` da vardı ama hiç kimse type-level olarak da yazmıyordu (grep doğruladı: 0 kullanım).
