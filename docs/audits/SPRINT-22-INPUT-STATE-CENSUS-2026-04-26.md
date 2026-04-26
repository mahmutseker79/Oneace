# Sprint 22 — §D-1 Input state + size census + anti-pattern hard-fail

**Tarih:** 2026-04-26 (UX/UI audit Apr-25 §D-1 — yeni TRACK FAMILY: state-bazlı primitive)
**Bundle tag:** `v1.33.0-input-state-census`
**Önceki HEAD:** _Sprint 21 PR #3 hash (script tarafından `v1.32.0-alert-variant-census` tag'inden çözülecek)_
**Yeni HEAD:** _Mac apply script tarafından oluşturulacak (2 commit)_

NOT: Sandbox FUSE pattern (Sprint 15-21 ile aynı). `OneAce/apply-sprint-22.command`
ile Mac'te commit + tag + push. **Sprint 21 koşulmuş olmalı** — script
`v1.32.0-alert-variant-census` tag'ini bekliyor.

---

## Yeni track family — §D state-bazlı primitive

§C-3..§C-6 (Card / Badge / Button / Alert) **variant=** prop kullanır. Input
buna özdeş değil — **state=** + **size=** + **invalid** prop kullanır. §D-1
yeni track family'nin ilk üyesi (state-bazlı primitive census). Sonraki
state-bazlı primitive'ler (varsa: Select, Checkbox, Switch state'leri) §D-2+
olarak buraya eklenir.

---

## PR #1 — Input state + size census + anti-pattern hard-fail (yeni track §D-1)

**Tag (planned):** `v1.32.1-input-state-census`

Input primitive cva tabanlı:
- **size**: sm / default / lg (3 size token, `--control-h-*` bağlı)
- **state**: default / error / success (3 state, border + focus-ring)
- **invalid**: boolean prop, `state="error"` + `aria-invalid` alias

**Anti-pattern HARD FAIL = 0:**

```tsx
<Input className="border-red-500" ...>          ❌
<Input className="border-destructive" ...>      ❌ (use state="error" or invalid)
<Input className="border-success" ...>          ❌ (use state="success")
<Input className="bg-yellow-100" ...>           ❌
```

Negatif lookahead `(?!\/|-)`: `border-destructive/50`, `border-destructive-foreground`
gibi legitimate kullanımları muaf tutar.

**Census snapshot (informational):**

| Metrik | Değer |
|---|---|
| Total `<Input>` instance | **145** |
| `invalid` prop kullanımı | **15** |
| Explicit `state=` prop kullanımı | **0** (default only) |
| Explicit `size=` prop kullanımı | **0** (default only) |

⚠️ **Bulgular:**
- **`size=` prop HİÇ kullanılmıyor** — 3 size variant (sm/default/lg) tasarlandı,
  tüm 145 Input default-md boyutta. Form satırlarında veya filter-bar'larda `size="sm"`
  kullanılması düşünülmemiş. Sprint 23+ adayı: dense-form yerlerini tespit et.
- **`state="success"` HİÇ kullanılmıyor** — Button `success` (0) + Alert `success` (0)
  + Alert `info` (0) ile **paralel bulgu**. Form validation success-state hiç
  görselleştirilmemiş. Sprint 23+ unused-variant audit kapsamı genişledi
  (artık 5 unused variant: Button.success, Alert.success, Alert.info,
  Input.size.{sm,lg}, Input.state.success).
- **`invalid` prop = 15** — error state hep alias üzerinden gidiyor, `state="error"`
  doğrudan kullanılmamış. Convenience alias çalışıyor, OK.

**Pinned test:** `input-state-census.test.ts` (3 case)
- Anti-pattern hard fail = 0 (raw color/token border override yasak)
- State + size + invalid census snapshot (informational)
- cva union güncel (3 size + 3 state + invalid prop)

**Zero-offender note:** Sprint 18 Card + Sprint 20 Button gibi Sprint 22 Input
da migration gerektirmedi — Input kullanımı baştan temiz.

---

## PR #2 — Sprint 22 closure audit doc

**Tag (planned):** `v1.33.0-input-state-census`

Bu doc'un kendisi PR #2'dir.

---

## Bundle özeti (Mac apply script çıktısı sonrası)

```
<HASH-2>  docs(audit): Sprint 22 closure — §D-1 input state census  [v1.33.0]
<HASH-1>  test(input): state + size census + anti-pattern hard-fail [v1.32.1]
<SPRINT-21-PR3>  docs(audit): Sprint 21 closure (PR #3)              [v1.32.0, prev HEAD]
```

**Closure tag:** `v1.33.0-input-state-census` → `<HASH-2>`
**Stable branch:** `<HASH-2>`

**Pinned test toplam (Sprint 22):** 1 yeni dosya, 3 case
- `input-state-census.test.ts` (3 case = §D-1 state+size census + hard-fail + cva union)

**Smoke status (sandbox):** 132/132 ✓ (Sprint 14-22 cumulative — 12 test file)

**Mac apply script:** `OneAce/apply-sprint-22.command`

---

## UX/UI audit Apr-25 — Section status (cumulative)

| Section | Track family | Status | Sprint(s) |
|---|---|---|---|
| **§B-6 PageHeader** | shell | ✅ FULLY CLOSED (115/115 coverage) | Sprint 8-14 + 18 |
| **§B-7 Inline empty** | pattern | ✅ FULLY CLOSED (A=B=C=0 hard fail) | Sprint 11-17 |
| **§C-3 Card variant** | variant= primitive | ✅ FULLY CLOSED | Sprint 10-12 + 18 |
| **§C-4 Badge variant** | variant= primitive | ✅ FULLY CLOSED (+migration) | Sprint 19 |
| **§C-5 Button variant** | variant= primitive | ✅ FULLY CLOSED (zero-offender) | Sprint 20 |
| **§C-6 Alert variant** | variant= primitive | ✅ FULLY CLOSED (+migration) | Sprint 21 |
| **§D-1 Input state** | state= primitive (yeni track family) | ✅ FULLY CLOSED (zero-offender) | Sprint 22 |

**Cumulative: 7 audit section closed.**

---

## Sprint 23+ backlog (güncel)

§B-6, §B-7, §C-3..§C-6, §D-1 closed. Yeni track önerileri:

1. **Unused-variant audit pass (5 unused variant)** — artık genişledi:
   - Button `success` (0)
   - Alert `success` (0)
   - Alert `info` (0)
   - Input `size="sm"` ve `size="lg"` (0 / 0)
   - Input `state="success"` (0)
   Tek sprint'te karar: kullanım yeri tespit (2-3 surface her variant) **veya** emekli (cva'dan kaldır + dokümante). 5 variant × 2-3 surface = 10-15 surface migration potansiyeli.
2. **Select / Checkbox / Switch state census** (§D-2/3/4 — state-bazlı primitive devamı, varsa cva)
3. **TR native review pass** (Mahmut manuel — i18n string review, terminoloji tutarlılığı)
4. **Chromatic visual regression CI** (40+ story baseline)
5. **EmptyState `completed` variant'ı 2-3 daha surface'e yay**
6. **§B-8+** — UX/UI audit Apr-25'in kalan B-section'ları (Mahmut audit doc'u açar)
