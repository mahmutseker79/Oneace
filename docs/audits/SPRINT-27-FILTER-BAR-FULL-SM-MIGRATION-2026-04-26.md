# Sprint 27 — Filter-bar full sm migration + Select primitive size variant

**Tarih:** 2026-04-26 (Sprint 26 follow-up — height mismatch resolution)
**Bundle tag:** `v1.38.0-filter-bar-full-sm`
**Önceki HEAD:** _Sprint 26 closure (script `v1.37.0-input-size-sm-activation^{commit}` resolve eder)_
**Yeni HEAD:** _Mac apply script tarafından oluşturulacak (3 commit)_

NOT: Sprint 26 push edilmiş olmalı.

---

## Bağlam

Sprint 26'da 2 search Input'a `size="sm"` verdim ama date Input'lar + Select'leri içeren satırlar atlandı çünkü Select primitive hardcoded `h-[var(--control-h-md)]` kullanıyordu — sm migration height mismatch yaratırdı. Sprint 27 bu engeli kaldırır:

1. **Select primitive cva refactor**: `size: sm/default/lg` variant union eklenir, `--control-h-*` token'larıyla lock-step (Input + SelectTrigger + Button hep aynı row'da yan yana hizalı kalır).
2. **Filter-bar tam migration**: movements (4 surface) + purchase-orders (2 surface) filter-bar'larda kalan 4 SelectTrigger + 2 date Input → `size="sm"`.

Sonuç: 2 filter-bar tam compact, görsel hierarchy data tablosuna kayar.

---

## PR #1 — Select primitive + 6 surface migration

**Tag (planned):** `v1.37.1-select-primitive-size-variant`

### `select.tsx` cva refactor

Önceki SelectTrigger:
```tsx
<SelectPrimitive.Trigger
  className={cn("flex h-[var(--control-h-md)] w-full ...", className)}
  ...
/>
```

Sonrası:
```tsx
const selectTriggerVariants = cva(
  "flex w-full items-center justify-between ...",
  {
    variants: {
      size: {
        sm: "h-[var(--control-h-sm)] px-2.5 py-1.5 text-sm",
        default: "h-[var(--control-h-md)] px-3 py-2 text-sm",
        lg: "h-[var(--control-h-lg)] px-4 py-2.5 text-base",
      },
    },
    defaultVariants: { size: "default" },
  },
);

interface SelectTriggerProps extends ..., VariantProps<typeof selectTriggerVariants> {}

function SelectTrigger({ className, size, children, ...props }: SelectTriggerProps) {
  return (
    <SelectPrimitive.Trigger className={cn(selectTriggerVariants({ size }), className)} ...>
      ...
    </SelectPrimitive.Trigger>
  );
}
```

Backward compatible: default size preserved, mevcut tüm SelectTrigger kullanımları default'a düşer.

### 6 surface migration

| Dosya | Surface | size= |
|---|---|---|
| `movements/movements-filter-bar.tsx:163` | from date Input | `sm` |
| `movements/movements-filter-bar.tsx:176` | to date Input | `sm` |
| `movements/movements-filter-bar.tsx:191` | type SelectTrigger | `sm` |
| `movements/movements-filter-bar.tsx:210` | warehouse SelectTrigger | `sm` |
| `purchase-orders/purchase-orders-filter-bar.tsx:127` | status SelectTrigger | `sm` |
| `purchase-orders/purchase-orders-filter-bar.tsx:146` | supplier SelectTrigger | `sm` |

Görsel etki: 2 filter-bar'ın tüm row'ları kompakt — Input + Select + Button hep h-9 (`--control-h-sm`).

---

## PR #2 — Pinned test guard

**Tag (planned):** `v1.37.2-filter-bar-full-sm-test`

Yeni `sprint-27-filter-bar-full-sm.test.ts` (9 case):
- Select primitive cva size variant union check (sm/default/lg + --control-h-* tokens)
- 6 surface'in her biri için id + size="sm" kombinasyonu
- Cumulative threshold: `<SelectTrigger size="sm">` >= 4, `<Input size="sm">` >= 4

---

## PR #3 — Sprint 27 closure audit doc

**Tag (planned):** `v1.38.0-filter-bar-full-sm`

Bu doc'un kendisi PR #3'tür.

---

## Bundle özeti

```
<HASH-3>  docs(audit): Sprint 27 closure — filter-bar full sm           [v1.38.0]
<HASH-2>  test(filter-bar): full sm migration + select primitive guard  [v1.37.2]
<HASH-1>  ui(select+filter-bar): primitive size variant + 6 surface sm  [v1.37.1]
<SPRINT-26-PR3>  docs(audit): Sprint 26 closure (PR #3)                  [v1.37.0, prev HEAD]
```

**Closure tag:** `v1.38.0-filter-bar-full-sm`
**Stable branch:** HEAD

**Pinned test toplam (Sprint 27):** 1 yeni dosya, 9 case
- `sprint-27-filter-bar-full-sm.test.ts`

**Census etkisi (§D-1 Input state census tekrar koşulduğunda):**
```
total=145 invalid_prop=15
states: (default only)
sizes:  sm=4
```
Input.size.sm: **2 → 4** (Sprint 26: 2 search + Sprint 27: 2 date).

**Smoke (sandbox):** Sprint 27 + 22 census = 12 PASS.

**Mac apply script:** `OneAce/apply-sprint-27.command`

---

## Unused-variant audit progress

| Variant | Sprint 22 baseline | Şu an | Durum |
|---|---|---|---|
| Button.success | 0 | 2 | ✅ activated (S24) |
| Alert.success | 0 | 3 | ✅ activated (S25) |
| Alert.info | 0 | 1 | ✅ activated (S25) |
| Input.size.sm | 0 | **4** | ✅ activated (S26+S27 expanded) |
| Input.size.lg | 0 | 0 | pending |
| Input.state.success | 0 | 0 | pending |

**Bonus:** SelectTrigger size variant artık var (yeni primitive feature, audit kapsamı dışı ama tasarım sistemi tutarlılığı için önemli).

4/6 unused variant aktive + 1 yeni primitive feature.

---

## Sprint 28+ backlog

1. **Input.state.success activation** — username/SKU availability success feedback (form library entegrasyonu — domain bilgisi gerek)
2. **Input.size.lg activation** — hero search / primary search input'ları (ERP'de kullanım yeri yok büyük ihtimal — emekli kararı adayı)
3. **EmptyState completed pack 2** — tüm aday yerler tüketilmiş (icon ailesi araması, completion tematik EmptyState yok)
4. **Unused-variant audit closure doc** — son 2 variant kararından sonra (aktive veya emekli) audit closure
5. **Filter-bar daha fazla yer** — sales-orders/transfers/labels filter-bar'ları varsa onlar da sm'e migrate
