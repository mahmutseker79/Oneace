# Sprint 20 — §C-5 Button variant census + anti-pattern hard-fail

**Tarih:** 2026-04-26 (UX/UI audit Apr-25 §C-5 yeni track — atomic open & close)
**Bundle tag:** `v1.31.0-button-variant-census`
**Önceki HEAD:** _Sprint 19 PR #3 hash (script tarafından `v1.30.0-badge-variant-census` tag'inden çözülecek)_
**Yeni HEAD:** _Mac apply script tarafından oluşturulacak (2 commit)_

NOT: Sandbox FUSE pattern (Sprint 15-19 ile aynı). `OneAce/apply-sprint-20.command`
ile Mac'te commit + tag + push. **Sprint 19 push edilmiş olmalı** — script
`v1.30.0-badge-variant-census` tag'ini bekliyor.

---

## PR #1 — Button variant census + anti-pattern hard-fail (yeni track §C-5)

**Tag (planned):** `v1.30.1-button-variant-census`

Button primitive 7 named variant kullanır (`default, destructive, success,
outline, secondary, ghost, link`), `cva` tabanlı. Ek olarak 4 size variant'ı
(`default, sm, lg, icon`). Sprint 20 census'u kalıcılaştırır.

**Anti-pattern HARD FAIL = 0:**

```tsx
<Button className="border-red-500" ...>     ❌
<Button className="bg-yellow-100" ...>      ❌
<Button className="bg-destructive" ...>     ❌ (use variant="destructive")
<Button className="bg-success" ...>         ❌ (use variant="success")
<Button className="bg-secondary" ...>       ❌ (use variant="secondary")
<Button className="bg-primary" ...>         ❌ (use variant="default")
```

Negatif lookahead `(?!\/|-)`: opacity-modified (`bg-primary/10`) veya
compound (`bg-success-foreground`) legitimate kullanımları muaf tutar.

**Census snapshot (informational):**

| Variant | Kullanım sayısı |
|---|---|
| outline | 125 |
| ghost | 90 |
| destructive | 18 |
| default (explicit) | 5 |
| link | 3 |
| secondary | 3 |
| **success** | **0** ⚠️ |
| **default (implicit / no variant)** | **156** |
| **Total Button instance** | **400** |

⚠️ **Bulgu:** `success` variant'ı tasarlandı (button.tsx'te tanımlı:
`bg-success text-success-foreground hover:bg-success/90 shadow-card`)
ama hiçbir yerde kullanılmıyor. Sprint 21+ adayı: success state CTA için
2-3 kullanım yeri tespit et veya variant'ı kaldır. (Bu sprint'in scope'u
değil — informational kayıt.)

**Pinned test:** `button-variant-census.test.ts` (3 case)
- Anti-pattern hard fail = 0
- Variant census snapshot (informational, 7 named + default)
- Variant union güncel (7 named values, cva)

**Zero-offender note:** Sprint 18 Card gibi Sprint 20 Button da migration
gerektirmedi — Button kullanımı zaten temiz. Sprint 19 Badge'de 4 dosya/7
instance migration vardı (hibrit), Sprint 18 Card + Sprint 20 Button atomic
clean.

---

## PR #2 — Sprint 20 closure audit doc

**Tag (planned):** `v1.31.0-button-variant-census`

Bu doc'un kendisi PR #2'dir.

---

## Bundle özeti (Mac apply script çıktısı sonrası)

```
<HASH-2>  docs(audit): Sprint 20 closure — §C-5 button variant     [v1.31.0]
<HASH-1>  test(button): variant census + anti-pattern hard-fail    [v1.30.1]
<SPRINT-19-PR3>  docs(audit): Sprint 19 closure (PR #3)            [v1.30.0, prev HEAD]
```

**Closure tag:** `v1.31.0-button-variant-census` → `<HASH-2>`
**Stable branch:** `<HASH-2>`

**Pinned test toplam (Sprint 20):** 1 yeni dosya, 3 case
- `button-variant-census.test.ts` (3 case = §C-5 census + hard-fail + union)

**Smoke status (sandbox):** 126/126 ✓ (Sprint 14-20 cumulative — 10 test file)

**Mac apply script:** `OneAce/apply-sprint-20.command`

---

## UX/UI audit Apr-25 — Section status (cumulative)

| Section | Status | Sprint(s) |
|---|---|---|
| **§B-6 PageHeader** | ✅ FULLY CLOSED (115/115 coverage) | Sprint 8-14 + 18 |
| **§B-7 Inline empty pattern** | ✅ FULLY CLOSED (A=B=C=0 hard fail) | Sprint 11-17 |
| **§C-3 Card variant** | ✅ FULLY CLOSED (anti-pattern=0, census) | Sprint 10-12 + 18 |
| **§C-4 Badge variant** | ✅ FULLY CLOSED (anti-pattern=0 + census, atomic) | Sprint 19 |
| **§C-5 Button variant** | ✅ FULLY CLOSED (anti-pattern=0, census, atomic) | Sprint 20 |

---

## Sprint 21+ backlog (güncel)

§B-6, §B-7, §C-3, §C-4, §C-5 closed. Yeni track önerileri:

1. **TR native review pass** (Mahmut manuel — i18n string review, terminoloji tutarlılığı)
2. **Chromatic visual regression CI** (30+ story baseline — EmptyState 4 + Bare + Card 5 + Badge 8 + Button 7 + PageHeader)
3. **EmptyState `completed` variant'ı 2-3 daha surface'e yay**
4. **Button `success` variant kullanım tespiti** — variant tasarlandı ama 0 kullanım. 2-3 yer bul (örn. "Save successful" toast CTA, "Confirmed" actions) veya variant'ı emekliye ayır.
5. **Input/Textarea variant census** (varsa) — §C-6 adayı. Önce primitive'lere bak.
6. **§B-8+** — UX/UI audit Apr-25'in kalan B-section'ları (Mahmut audit doc'u açar)
