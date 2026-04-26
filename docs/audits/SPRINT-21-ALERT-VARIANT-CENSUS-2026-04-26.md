# Sprint 21 — §C-6 Alert variant census + anti-pattern hard-fail

**Tarih:** 2026-04-26 (UX/UI audit Apr-25 §C-6 yeni track — atomic open & close)
**Bundle tag:** `v1.32.0-alert-variant-census`
**Önceki HEAD:** _Sprint 20 PR #2 hash (script tarafından `v1.31.0-button-variant-census` tag'inden çözülecek)_
**Yeni HEAD:** _Mac apply script tarafından oluşturulacak (3 commit)_

NOT: Sandbox FUSE pattern (Sprint 15-20 ile aynı). `OneAce/apply-sprint-21.command`
ile Mac'te commit + tag + push. **Sprint 20 koşulmuş olmalı** — script
`v1.31.0-button-variant-census` tag'ini bekliyor.

---

## PR #1 — Alert anti-pattern migration (1 dosya, 1 instance)

**Tag (planned):** `v1.31.1-alert-anti-pattern-migration`

Sprint 21 census test'i ilk koşulduğunda 1 dosyada 1 Alert raw className
override yakaladı.

| Dosya | Önceki | Sonraki |
|---|---|---|
| `components/ui/upgrade-prompt.tsx` (line 90) | `<Alert className="border-warning/60 bg-warning-light">` | `<Alert variant="warning">` |

**Tasarım intent korundu:** Alert `warning` variant class'ı zaten
`border-warning/30 text-warning bg-warning-light`. Önceki manuel override
border opacity'sini /60 yapmış (variant /30); görsel fark minimal,
tasarım sisteminin tek-kaynaklı tutarlılığı tercih edildi. Sprint 22+ için
varyantın opacity tonunu güçlendirmek istenirse cva tarafında `/30` → `/60`
revize edilir (tüm Alert kullanımları için).

---

## PR #2 — Alert variant census + anti-pattern hard-fail (yeni track §C-6)

**Tag (planned):** `v1.31.2-alert-variant-census`

Alert primitive 5 named variant kullanır (`default, destructive, success,
warning, info`), `cva` tabanlı. Sprint 21 census'u kalıcılaştırır.

**Anti-pattern HARD FAIL = 0:**

```tsx
<Alert className="border-red-500" ...>          ❌
<Alert className="bg-yellow-100" ...>           ❌
<Alert className="bg-destructive-light" ...>    ❌ (use variant="destructive")
<Alert className="bg-warning-light" ...>        ❌ (use variant="warning")
<Alert className="bg-success-light" ...>        ❌ (use variant="success")
<Alert className="bg-info-light" ...>           ❌ (use variant="info")
<Alert className="border-warning" ...>          ❌ (use variant="warning")
```

Negatif lookahead `(?!\/|-)`: `border-warning/30`, `border-warning-foreground`
gibi legitimate kullanımları muaf tutar.

**Census snapshot (informational):**

| Variant | Kullanım sayısı |
|---|---|
| destructive | 9 |
| warning | 2 |
| **success** | **0** ⚠️ |
| **info** | **0** ⚠️ |
| **default (implicit / no variant)** | **6** |
| **Total Alert instance** | **17** |

⚠️ **Bulgular:**
- `success` ve `info` variant'ları tasarlandı ama HİÇ kullanılmıyor
  (Button'da `success` 0 idi — paralel bulgu).
- Sprint 22+ adayı: success state için "Successfully imported", "Account
  verified" gibi yerleri tespit et veya variant'ları emekliye ayır. Info
  için "Helpful tip" / "Did you know" surface'leri.

**Pinned test:** `alert-variant-census.test.ts` (3 case)
- Anti-pattern hard fail = 0
- Variant census snapshot (informational, 5 named + default)
- Variant union güncel (5 named values, cva)

---

## PR #3 — Sprint 21 closure audit doc

**Tag (planned):** `v1.32.0-alert-variant-census`

Bu doc'un kendisi PR #3'tür.

---

## Bundle özeti (Mac apply script çıktısı sonrası)

```
<HASH-3>  docs(audit): Sprint 21 closure — §C-6 alert variant       [v1.32.0]
<HASH-2>  test(alert): variant census + anti-pattern hard-fail      [v1.31.2]
<HASH-1>  ui(alert): anti-pattern migration (1 dosya, upgrade-prompt) [v1.31.1]
<SPRINT-20-PR2>  docs(audit): Sprint 20 closure (PR #2)              [v1.31.0, prev HEAD]
```

**Closure tag:** `v1.32.0-alert-variant-census` → `<HASH-3>`
**Stable branch:** `<HASH-3>`

**Pinned test toplam (Sprint 21):** 1 yeni dosya, 3 case
- `alert-variant-census.test.ts` (3 case = §C-6 census + hard-fail + union)

**Smoke status (sandbox):** 129/129 ✓ (Sprint 14-21 cumulative — 11 test file)

**Mac apply script:** `OneAce/apply-sprint-21.command`

---

## UX/UI audit Apr-25 — Section status (cumulative)

| Section | Status | Sprint(s) |
|---|---|---|
| **§B-6 PageHeader** | ✅ FULLY CLOSED (115/115 coverage) | Sprint 8-14 + 18 |
| **§B-7 Inline empty pattern** | ✅ FULLY CLOSED (A=B=C=0 hard fail) | Sprint 11-17 |
| **§C-3 Card variant** | ✅ FULLY CLOSED (anti-pattern=0, census) | Sprint 10-12 + 18 |
| **§C-4 Badge variant** | ✅ FULLY CLOSED (anti-pattern=0 + 7 instance migration) | Sprint 19 |
| **§C-5 Button variant** | ✅ FULLY CLOSED (anti-pattern=0, atomic clean) | Sprint 20 |
| **§C-6 Alert variant** | ✅ FULLY CLOSED (anti-pattern=0 + 1 instance migration) | Sprint 21 |

---

## Sprint 22+ backlog (güncel)

§B-6, §B-7, §C-3, §C-4, §C-5, §C-6 closed. Yeni track önerileri:

1. **TR native review pass** (Mahmut manuel — i18n string review, terminoloji tutarlılığı)
2. **Chromatic visual regression CI** (35+ story baseline — EmptyState 4 + Card 5 + Badge 8 + Button 7 + Alert 5 + PageHeader)
3. **EmptyState `completed` variant'ı 2-3 daha surface'e yay**
4. **Unused-variant audit pass** — Button `success` (0) + Alert `success` (0) + Alert `info` (0) için: 2-3 kullanım tespit et **veya** variant'ları emekliye ayır. Tek sprint'te 3 variant kararı verilir.
5. **Input state census** (§D-1 — pattern farklı: `state="error|success"` + `invalid` prop)
6. **§B-8+** — UX/UI audit Apr-25'in kalan B-section'ları (Mahmut audit doc'u açar)
