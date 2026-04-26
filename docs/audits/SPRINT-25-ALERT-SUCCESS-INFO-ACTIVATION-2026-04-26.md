# Sprint 25 — Alert `success` + `info` variant çift aktivasyon (4 surface, 2 unused variant)

**Tarih:** 2026-04-26 (Sprint 22 unused-variant audit follow-up — Sprint 24 ile aynı pattern, çift variant)
**Bundle tag:** `v1.36.0-alert-success-info-activation`
**Önceki HEAD:** _Sprint 24 closure (script `v1.35.0-button-success-activation^{commit}` resolve eder)_
**Yeni HEAD:** _Mac apply script tarafından oluşturulacak (3 commit)_

NOT: Sprint 24 push edilmiş olmalı — script tag-resolve eder.

---

## Bağlam — pivot

Sprint 25'in orijinal scope'u "EmptyState completed pack 2" idi (transfers
fully received, sales-orders fully shipped, stock-counts reconciled).
Sandbox arama: tüm CheckCircle2 + EmptyState yerleri zaten Sprint 16/23'te
`completed` variant'a alınmış. Pack 2 için aday yok. **Pivot:** Alert.success
+ Alert.info çift aktivasyon (Sprint 24 Button.success replikası, 2 unused
variant aynı sprint'te).

Bonus bulgu: reconcile-form'da line 111'de `<Alert className="border-info/50
bg-info/10">` var — Alert primitive'i kullanıyor ama className override ile
info ton'unu manuel veriyor. variant="info" prop'a çevirince Alert.info kullanım
sayısı 0'dan 1'e çıkar — Sprint 25'in scope'una bedavadan dahil edildi.

---

## PR #1 — 3 dosya, 4 surface migration

**Tag (planned):** `v1.35.1-alert-success-info-activation-migration`

### Alert.success (3 surface)

| Dosya | Surface | Önceki | Sonraki |
|---|---|---|---|
| `settings/security/two-factor-card.tsx:297` | Recovery code rotation success message | `<output className="border-success/50 bg-success/10 ...">{regenerateSuccess}</output>` | `<Alert variant="success"><AlertDescription>{regenerateSuccess}</AlertDescription></Alert>` |
| `settings/security/two-factor-card.tsx:419` | Generic success state banner | `<div role="alert" className="border-success/50 bg-success/10 ...">{success}</div>` | `<Alert variant="success"><AlertDescription>{success}</AlertDescription></Alert>` |
| `stock-counts/[id]/reconcile/reconcile-form.tsx:88` | Stock count reconciliation success block | `<output ... bg-success/10>` + manual CheckCircle2 + h1/p + Button'lar | `<Alert variant="success">` + AlertTitle + AlertDescription, button'lar ayrı div'e taşındı |

### Alert.info (1 surface)

| Dosya | Surface | Önceki | Sonraki |
|---|---|---|---|
| `stock-counts/[id]/reconcile/reconcile-form.tsx:111` | Pre-completion trust messaging | `<Alert className="border-info/50 bg-info/10">` (className override) | `<Alert variant="info">` (clean prop) |

### Import değişiklikleri

- `two-factor-card.tsx`: `Alert, AlertDescription` import eklendi (`@/components/ui/alert`).
- `reconcile-form.tsx`: import zaten vardı.

### Yapı kararı (reconcile-form success block)

Önceki block tek bir `<output>` içinde icon + heading + body + 2 button bulunduruyordu. Alert primitive yapısı (Alert + AlertTitle + AlertDescription) success message'ı kapsasın, button'lar dış `<div>`'de kalsın diye refactor edildi:

```tsx
<div className="space-y-4">
  <Alert variant="success">
    <CheckCircle2 className="h-4 w-4" />
    <AlertTitle>{labels.successTitle}</AlertTitle>
    <AlertDescription>{body}</AlertDescription>
  </Alert>
  <div className="flex flex-wrap gap-2">
    <Button size="sm" asChild>...</Button>
    ...
  </div>
</div>
```

Daha temiz semantic: Alert sadece success message, action button'ları semantik olarak Alert dışında.

---

## PR #2 — Pinned test guard

**Tag (planned):** `v1.35.2-alert-success-info-activation-test`

Yeni `sprint-25-alert-success-info-activation.test.ts` (6 case):
- 4 surface'in her biri için `variant="success"` veya `variant="info"` + ilgili label fragment'leri yan yana
- Cumulative threshold: `<Alert variant="success">` >= 3, `<Alert variant="info">` >= 1
- Yeni kullanım eklenirse threshold kendiliğinden geçer; regression durumunda fail.

---

## PR #3 — Sprint 25 closure audit doc

**Tag (planned):** `v1.36.0-alert-success-info-activation`

Bu doc'un kendisi PR #3'tür.

---

## Bundle özeti

```
<HASH-3>  docs(audit): Sprint 25 closure — alert success+info activation [v1.36.0]
<HASH-2>  test(alert): success+info variant activation pack 1 guard      [v1.35.2]
<HASH-1>  ui(alert): success+info variant activation — 4 surface, 3 dosya [v1.35.1]
<SPRINT-24-PR3>  docs(audit): Sprint 24 closure (PR #3)                   [v1.35.0, prev HEAD]
```

**Closure tag:** `v1.36.0-alert-success-info-activation`
**Stable branch:** HEAD

**Pinned test toplam (Sprint 25):** 1 yeni dosya, 6 case
- `sprint-25-alert-success-info-activation.test.ts`

**Census etkisi (§C-6 Alert variant census tekrar koşulduğunda):**
```
total=20 default=4
destructive=9, success=3, warning=3, info=1
```
Alert.success: **0 → 3**, Alert.info: **0 → 1**.

**Smoke (sandbox):** Sprint 25 + 21 census = 9 PASS.

**Mac apply script:** `OneAce/apply-sprint-25.command`

---

## Unused-variant audit progress

| Variant | Sprint 22 baseline | Sprint 24 sonrası | Sprint 25 sonrası | Durum |
|---|---|---|---|---|
| Button.success | 0 | **2** | 2 | ✅ activated (S24) |
| Alert.success | 0 | 0 | **3** | ✅ activated (S25) |
| Alert.info | 0 | 0 | **1** | ✅ activated (S25) |
| Input.size.sm | 0 | 0 | 0 | pending |
| Input.size.lg | 0 | 0 | 0 | pending |
| Input.state.success | 0 | 0 | 0 | pending |

**3/6 unused variant aktive** (S24+S25 toplam).

---

## Sprint 26+ backlog

1. **§B-8+ veya §C-7+ audit doc taraması** — UX/UI audit Apr-25 kalan section'lar
2. **Input.size.sm activation** — filter-bar dense form'lar (movements, purchase-orders, sales-orders)
3. **Input.state.success activation** — username/SKU availability success feedback
4. **Input.size.lg activation** — hero search, primary search input'ları (varsa)
5. **EmptyState completed pack 2** — yeni icon ailesi (Check, ListChecks, BadgeCheck) kullanan completion-tematik EmptyState araması
