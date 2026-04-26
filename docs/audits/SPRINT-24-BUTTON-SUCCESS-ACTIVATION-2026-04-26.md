# Sprint 24 — Button `success` variant activation pack 1 (2 surface)

**Tarih:** 2026-04-26 (Sprint 22 unused-variant audit follow-up)
**Bundle tag:** `v1.35.0-button-success-activation`
**Önceki HEAD:** _Sprint 23 PR #3 hash (script `v1.34.0-emptystate-completed-pack-1^{commit}` resolve eder)_
**Yeni HEAD:** _Mac apply script tarafından oluşturulacak (3 commit)_

NOT: Sprint 22 census 5 unused variant gösterdi. Sprint 24 ilk variant'ı (Button.success) aktif kullanıma alır.

---

## Bağlam

Sprint 20 §C-5 Button variant census çıktısı `success=0` gösterdi — `success`
variant tasarlandı (`bg-success text-success-foreground hover:bg-success/90 shadow-card`) ama hiç kullanılmamıştı. Sprint 24 bu variant'ı 2 completion-tematik
CTA'ya yayar.

---

## PR #1 — 2 surface migration

**Tag (planned):** `v1.34.1-button-success-activation-migration`

| Dosya | Surface | Önceki | Sonraki |
|---|---|---|---|
| `settings/security/two-factor-card.tsx:310` | Recovery code rotation completion ("Done — I've saved these codes") | implicit `default` (primary) | `variant="success"` |
| `onboarding/onboarding-form.tsx:365-368` | Final step "Finish setup" (emails boşken render edilir) | implicit `default` (conditional metin "Send invites" / "Finish setup" tek button'da) | conditional render: emails varsa `default` (Send invites), boşsa `variant="success"` (Finish setup) |

**Conditional render değişikliği (onboarding-form):** Census regex `variant="..."`
JSX expression `variant={cond ? "..." : "..."}` formunu yakalamaz. Bu yüzden
tek button + conditional metin yerine iki ayrı Button render edildi:
- `emails.trim()` true → `<Button>Send invites</Button>` (default primary CTA)
- `emails.trim()` false → `<Button variant="success">Finish setup</Button>` (completion success CTA)

Görsel etki: 2 surface'te `bg-primary` (mavi) → `bg-success` (yeşil) ton, completion
sinyali doğru iletildi. Onboarding'de "Send invites" hâlâ neutral CTA — sadece
final adım yeşil.

---

## PR #2 — Pinned test guard

**Tag (planned):** `v1.34.2-button-success-activation-test`

Yeni `sprint-24-button-success-activation.test.ts` (3 case):
- 2 surface'in her biri için `variant="success"` + label fragment'leri yan yana
- Cumulative threshold: `<Button variant="success">` total kullanım `>= 2`. Yeni kullanım eklenirse threshold kendiliğinden geçer; regression durumunda fail.

---

## PR #3 — Sprint 24 closure audit doc

**Tag (planned):** `v1.35.0-button-success-activation`

Bu doc'un kendisi PR #3'tür.

---

## Bundle özeti

```
<HASH-3>  docs(audit): Sprint 24 closure — button success activation   [v1.35.0]
<HASH-2>  test(button): success variant activation pack 1 guard        [v1.34.2]
<HASH-1>  ui(button): success variant activation pack 1 — 2 surface    [v1.34.1]
c88a7f6   docs(audit): Sprint 23 closure (PR #3)                       [v1.34.0, prev HEAD]
```

**Closure tag:** `v1.35.0-button-success-activation`
**Stable branch:** HEAD

**Pinned test toplam (Sprint 24):** 1 yeni dosya, 3 case
- `sprint-24-button-success-activation.test.ts`

**Census etkisi (Sprint 20 census tekrar koşulduğunda):**
```
total=401 default=155
outline=125, ghost=90, destructive=18, default=5, link=3, secondary=3, success=2
```
Button.success: **0 → 2**.

**Smoke (sandbox):** Sprint 24 + 20 census = 6 PASS.

**Mac apply script:** `OneAce/apply-sprint-24.command`

---

## Unused-variant audit progress

| Variant | Sprint 22 baseline | Sprint 24 sonrası | Durum |
|---|---|---|---|
| Button.success | 0 | **2** | ✅ activated |
| Alert.success | 0 | 0 | pending |
| Alert.info | 0 | 0 | pending |
| Input.size.sm | 0 | 0 | pending |
| Input.size.lg | 0 | 0 | pending |
| Input.state.success | 0 | 0 | pending |

---

## Sprint 25+ backlog

1. **EmptyState completed pack 2** — transfers fully received, sales-orders fully shipped, stock-counts reconciled (Sprint 23 pattern replikası, 2-3 surface)
2. **Alert.success activation** — "Successfully imported", "2FA setup complete", "Backup restored" gibi yerler
3. **Alert.info activation** — onboarding tip'leri, dashboard "Welcome" hint'leri
4. **Input.size.sm activation** — filter-bar dense form'lar (movements/purchase-orders)
5. **Input.state.success activation** — username/SKU availability success feedback
6. **§B-8+** — UX/UI audit Apr-25 kalan section'ları (Mahmut audit doc'u açar)
