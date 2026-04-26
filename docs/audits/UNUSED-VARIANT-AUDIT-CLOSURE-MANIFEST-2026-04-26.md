# Unused-Variant Audit — Closure Manifest

**Tarih:** 2026-04-26
**Audit segment:** UX/UI Audit Apr-25 — §D-1 (state-bazlı primitive census) + downstream unused-variant pack
**Closure tag:** `v1.42.0-unused-variant-closure-manifest`
**Stable branch:** HEAD
**Önceki tag:** `v1.41.0-input-state-success-passwords` (Sprint 30 closure)

---

## TL;DR

UX/UI audit Apr-25'in §D-1 (Input state census, **yeni track family**) ile başlayan unused-variant temizlik segmenti **Sprint 22 → Sprint 30** boyunca 9 sprint sürdü, **7 unused-variant track + 1 token audit**'i çözdü. Bu doc o segmentin kapanış mührüdür: tarihçe, kararlar, regresyon koruma haritası ve "hangi şartlarda yeniden açarız" rehberi.

| Toplam | Sayı |
|---|---|
| Sprint sayısı | 9 (S22..S30) |
| Track sayısı | 7 unused-variant + 1 token audit = **8 track resolved** |
| Aktivasyon | 5 (Button.success, Alert.success+info, Input.size.sm, Input.state.success) |
| Retire | 2 (Input.size.lg, SelectTrigger.size.lg) |
| Token audit | 1 (`--control-h-lg` sole-consumer) |
| Pinned test dosyası | 9+ (her sprint en az 1 yeni guard) |
| Cumulative smoke | 40 PASS / 6 file (S27+S28+S29+S30 + census + touch-target) |

---

## 1. Tarihçe — Sprint Çizelgesi

| Sprint | Tarih | Başlık | Track | Karar | Closure tag |
|---|---|---|---|---|---|
| **S22** | 2026-04-26 | Input state census (yeni track family §D-1) | Input.state + Input.size baseline | informational + cva union pin | (S22 closure) |
| **S24** | 2026-04-26 | Button.success activation | Button.success | ✅ activate (2 surface) | `v1.31.0-button-success-activation` |
| **S25** | 2026-04-26 | Alert.success+info activation | Alert.success, Alert.info | ✅ activate (3+1 surface) | `v1.32.0-alert-success-info-activation` |
| **S26** | 2026-04-26 | Input.size.sm activation pack 1 | Input.size.sm | ✅ activate (2 surface) | `v1.36.0-input-size-sm-activation` |
| **S27** | 2026-04-26 | Filter-bar full sm + Select primitive size | Input.size.sm expand + SelectTrigger.size primitive | ✅ activate (4 surface) + new primitive | `v1.38.0-filter-bar-full-sm` |
| **S28** | 2026-04-26 | Input + SelectTrigger lg retire | Input.size.lg, SelectTrigger.size.lg | ✅ retire (0 use-case) | `v1.39.0-input-select-lg-retire` |
| **S29** | 2026-04-26 | --control-h-lg token sole-consumer audit | `--control-h-lg` token | ✅ sole-consumer pinned (Button.lg) | `v1.40.0-control-h-lg-token-audit` |
| **S30** | 2026-04-26 | Input.state.success activation | Input.state.success | ✅ activate (3 surface — auth passwords) | `v1.41.0-input-state-success-passwords` |
| **S31** | 2026-04-26 | **Audit closure manifest** | (this doc) | 🏁 segment closed | `v1.42.0-unused-variant-closure-manifest` |

> Not: Sprint numarası asla atlanmadı; S23 EmptyState completed pack 1 gibi farklı track family ile birlikte yürüyen sprint'ler de oldu, ama bu manifest yalnız §D-1 + unused-variant pack track'ini dokümante eder.

---

## 2. Decision Matrix — Track-by-Track

### 2.1 Button.success → ✅ Activate

| | Detay |
|---|---|
| Sprint 22 baseline | 0 instance |
| Sprint 30 sonrası | 2 instance |
| Karar | activate |
| Use-case | Settings save confirmation, success toast trigger button |
| Sprint | S24 |
| Pinned test | `sprint-24-button-success-activation.test.ts` |

### 2.2 Alert.success + Alert.info → ✅ Activate

| | Detay |
|---|---|
| Sprint 22 baseline | success=0, info=0 |
| Sprint 30 sonrası | success=3, info=1 |
| Karar | activate (her ikisi) |
| Use-case | success: import/export tamamlandı, integration synced; info: GDPR notice |
| Sprint | S25 |
| Pinned test | `sprint-25-alert-success-info-activation.test.ts` |

### 2.3 Input.size.sm → ✅ Activate (incremental)

| | Detay |
|---|---|
| Sprint 22 baseline | 0 instance |
| Sprint 30 sonrası | 4 instance |
| Karar | activate |
| Use-case | Filter-bar compact rows (movements + purchase-orders search/date inputs) |
| Sprint | S26 (2 search) → S27 (2 date + 6 SelectTrigger.sm) |
| Pinned test | `sprint-26-input-size-sm-activation.test.ts`, `sprint-27-filter-bar-full-sm.test.ts` |
| Bonus | S27'de SelectTrigger primitive cva refactor (size variant eklendi — yeni primitive feature) |

### 2.4 Input.size.lg → ✅ Retire

| | Detay |
|---|---|
| Sprint 22 baseline | 0 instance |
| Sprint 30 sonrası | (retired from cva) |
| Karar | retire (YAGNI) |
| Mantık | ERP scope'unda hero/landing input ihtiyacı yok; Button.lg yeterli |
| Sprint | S28 |
| Pinned test | `sprint-28-input-select-lg-retire.test.ts` (HARD GUARD: `<Input size="lg">` = 0) |

### 2.5 SelectTrigger.size.lg → ✅ Retire

| | Detay |
|---|---|
| S27 baseline | 0 instance (yeni primitive feature) |
| Sprint 30 sonrası | (retired from cva) |
| Karar | retire — Input.lg ile lock-step |
| Sprint | S28 |
| Pinned test | `sprint-28-input-select-lg-retire.test.ts` (HARD GUARD: `<SelectTrigger size="lg">` = 0) |

### 2.6 `--control-h-lg` token → ✅ Sole-consumer pinned

| | Detay |
|---|---|
| Sprint 22 baseline | 3 primitive consumer (Input + Select + Button) |
| Sprint 30 sonrası | 1 primitive consumer (Button only) |
| Karar | token korundu, sole-consumer pinned |
| Mantık | S28 retire sonrası emniyet katmanı; yeni primitive yanlışlıkla tüketmesin |
| Sprint | S29 |
| Pinned test | `sprint-29-control-h-lg-token-audit.test.ts` (3. assertion: consumers === ["button.tsx"]) |

### 2.7 Input.state.success → ✅ Activate

| | Detay |
|---|---|
| Sprint 22 baseline | 0 instance |
| Sprint 30 sonrası | 3 instance (3 surface) |
| Karar | activate (auth password forms) |
| Use-case | register password (length≥8), reset-password new-password (length≥MIN), reset-password confirm (length≥MIN AND match) |
| Sprint | S30 |
| Pinned test | `sprint-30-input-state-success-passwords.test.ts` (6 case) |
| Census ext | `input-state-census.test.ts` ternary-aware (STATE_TERNARY_REGEX) |

### 2.8 Input.state.error / invalid → ✅ Already in use (no track)

| | Detay |
|---|---|
| Sprint 22 baseline | invalid prop = 15 (geçmişten beri aktif) |
| Karar | mevcut, track'e gerek yok |
| Pattern | `aria-invalid={!!error}` veya `<Input invalid />` (alias) |

---

## 3. Regression Protection Map

Hangi karar hangi test dosyası tarafından korunuyor:

```
src/components/
├─ input-state-census.test.ts                    [§D-1 master census]
│   ├─ Anti-pattern HARD FAIL: raw color/token override
│   ├─ State + size + invalid census snapshot (informational, ternary-aware)
│   └─ cva union güncel: 2 size + 3 state values (Sprint 28 sonrası)
│
├─ sprint-24-button-success-activation.test.ts   [Button.success activation]
├─ sprint-25-alert-success-info-activation.test.ts [Alert.success + Alert.info]
├─ sprint-26-input-size-sm-activation.test.ts    [Input.size.sm pack 1]
├─ sprint-27-filter-bar-full-sm.test.ts          [Input.size.sm expand + SelectTrigger primitive]
│   └─ (S28 sonrası lg assertion'ları kaldırıldı — comment-friendly regex)
│
├─ sprint-28-input-select-lg-retire.test.ts      [Input.lg + SelectTrigger.lg retire]
│   ├─ Input cva: lg yok
│   ├─ SelectTrigger cva: lg yok
│   ├─ Button.lg cva: KORUNUR (regression detect)
│   ├─ HARD GUARD: <Input size="lg"> = 0
│   └─ HARD GUARD: <SelectTrigger size="lg"> = 0
│
├─ sprint-29-control-h-lg-token-audit.test.ts    [--control-h-lg sole-consumer]
│   ├─ Token tanımı: 3rem
│   ├─ Lock-step: sm/md/lg = 2.25/2.75/3 rem
│   ├─ HARD GUARD: var(--control-h-lg) consumer = ["button.tsx"]
│   ├─ Button.lg = exactly 1 occurrence
│   ├─ --control-h-md ≥ 3 primitive consumer
│   ├─ --control-h-sm ≥ 3 primitive consumer
│   └─ Input + Select var(--control-h-lg) = 0
│
└─ sprint-30-input-state-success-passwords.test.ts [Input.state.success activation]
    ├─ register-form: ternary length >= 8 success
    ├─ reset new-password: ternary length >= MIN success
    ├─ reset confirm: ternary length >= MIN AND match success
    ├─ HARD GUARD: login-form state=success YOK
    ├─ Cumulative: surface count >= 3
    └─ Input cva: success: "border-success" tanımlı
```

**Toplam pinned case:** 50+ (tüm sprint'ler birleşik). Cumulative smoke: 40 PASS / 6 file (Sprint 27..30 + census + touch-target).

---

## 4. Pattern Rehberi — Lessons Learned

### 4.1 Activate vs Retire trade-off

Bir variant'ı çıkarmadan önce **doğal use-case** taraması yap:

```
Variant 0 kullanımda → soru: "ERP scope'unda anlamlı use-case var mı?"
   ├─ EVET → activate (1-3 surface'te tutarlı uygula)
   └─ HAYIR → retire (cva temizliği, type union daralır)
```

S28 (Input.lg) ve S30 (Input.state.success) bu kararın iki ucu. **S28 retire, S30 activate** — ikisi de 0 başlıyordu, ama S30'da auth password güçlü use-case'di, S28'de hero input use-case'i yoktu (Button.lg yeterli). Audit kapanışı **5 activate + 2 retire** dengesiyle bitti — sırf retire spree değil, ne aktive edebileceğine bakıldı.

### 4.2 Pinned test üç katmanlı

Her track için en az 3 katmanlı koruma:

1. **Cva union pin** — primitive source'da variant değerleri korunur (S22 cva union, S28 retire'da `not.toMatch`)
2. **Surface usage pin** — beklenen surface'lerin variant'ı kullandığı doğrulanır (S24..S30 hepsi surface listesi içeriyor)
3. **HARD GUARD (regresyon)** — yasak kullanımlar 0'da kilitli (S28 lg = 0, S30 login state=success = 0)

### 4.3 Lock-step token ailesi

`--control-h-sm/md/lg` üçü birden tasarlandı, primitive'ler arasında lock-step:
- Input + SelectTrigger + Button hep aynı row'da yan yana hizalı (S27 filter-bar bu sayede sm'e migrate edilebildi)
- Yeni primitive eklenince da bu zincire katılması beklenir
- S29 token audit bu lock-step'i pinned hale getirdi (`>=3 primitive consumer` for sm/md)

### 4.4 Comment-friendly regex

S28 PR #2'de öğrenilen trap: `not.toMatch(/--control-h-lg/)` regex'i comment'lerde token adı geçtiği için false-positive verdi. Çözüm: `var\(--control-h-lg\)` actual CSS expression match. **Memory'ye eklendi: feedback_replace_all_indent_trap'in komşusu.**

### 4.5 Ternary state expression (Sprint 30 öğretisi)

Conditional state activation pattern'i:

```tsx
state={password.length >= 8 ? "success" : "default"}
```

vs

```tsx
state="success" // sabit
```

İkisi de §D-1 census'te sayılmalı. Sprint 30'da `STATE_TERNARY_REGEX` eklendi — `<Input ... state={... "X" ...}>` shape'i tarar, multi-line tolerant.

---

## 5. Backlog (audit segmenti dışı)

Bu manifest **§D-1 + unused-variant pack** segmentini kapatır. Aşağıdakiler hâlâ açık ama **farklı segmentlere ait**:

1. **Storybook coverage 12→25** (Sprint 8-9 backlog'undan kaldı) — UI/UX audit §E (görsel doc + a11y story coverage). Sprint 31+ önceliklendir.
2. **EmptyState completed pack 2** (Sprint 23 sonrası) — UX/UI audit §B-7 follow-up. Aday yer kalmadı izlenimi, deep-scan gerek.
3. **Live-validation confirm-password** (Sprint 30 risk maddesi) — Sprint 32+ adayı. Confirm input'ta mismatch için `state="error"` ternary ekleme.
4. **TR coverage** (Sprint 6-7 i18n family) — başka audit segmenti, devam ediyor.
5. **Card variant census + anti-pattern** (Sprint 18+ §C-3) — başka audit segmenti, S22 manifestinde yok.

---

## 6. "Yeniden açma" rehberi

Bu segment kapatıldı ama bazı şartlarda **track açılabilir**:

| Şart | Track yeniden açılır mı? | Nasıl |
|---|---|---|
| Yeni primitive `--control-h-lg` tüketmeye başlar | ✅ S29 test hard-fail; sole-consumer listesini güncelle veya retire'ı geri çevir | `sprint-29-...test.ts` 3. assertion'ı genişlet |
| `<Input size="lg">` regresyon olarak geri gelir | ✅ S28 test hard-fail; tartış: cva'ya geri eklenmeli mi? | `sprint-28-...test.ts` 5. assertion log'u oku |
| Live-validation request gelir (confirm error) | ⏳ S32+ adayı; S30 risk maddesinde planlandı | `reset-password-form` confirm Input'a `state="error"` ternary ekle |
| Yeni state variant ihtiyacı (warning, processing) | ⚠️ Ayrı sprint — Input cva'ya yeni state eklenir, §D-1 census STATE_REGEX'i otomatik yakalar | Cva ekle + surface kullanımı + pinned test |
| `--control-h-lg` Button.lg'den de retire edilir | ✅ Token tamamen emekli; S29 test güncellenir veya silinir | `sprint-29-...test.ts` consumers === [] beklenmesi |

---

## 7. Audit closure mührü

```
🏁 §D-1 + unused-variant pack:    SEALED 2026-04-26
   Sprint sürekliliği:             S22..S30 (9 sprint)
   Track resolution:               7/7 + 1 token audit
   Pinned test cumulative:         50+ case across 9 dosya
   Audit dengesi:                  5 activate + 2 retire + 1 audit
   Sonraki segment:                Storybook coverage / §E
```

Bu doc, audit segmenti tarihselleştirmesi ve regresyon koruma haritasıdır. **Hiçbir source/test değişmez** — yalnızca pinned tests ve mevcut sprint closure doc'ları referans alır. Mevcut testler işlerini yapmaya devam ettiği sürece bu segment kapalı kalır.
