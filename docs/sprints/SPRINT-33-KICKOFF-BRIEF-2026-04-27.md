# Sprint 33 — TR coverage segment kickoff

**Tarih:** 2026-04-27
**Önceki tag:** `v1.43.0-confirm-password-live-val` (Sprint 32)
**Closure tag:** `v1.44.0-tr-coverage-foundation`
**Status:** ✅ Decisions taken (all ♥ — see §3) — segment OPEN
**Council:** launch-blocking (segment opens new track family)

> **Decision log (2026-04-27):** All §3 forks resolved with the
> recommended option (♥). Sprint 33 ships the foundation only —
> `INTENTIONAL_EN` marker, `tr-key-parity.test.ts` scaffold,
> Playwright TR smoke fixture + spec, `tr-smoke-fixture.static.test.ts`
> pin, and the CLAUDE.md i18n drift fix. Sprints 34-37 land per the
> §4 breakdown.

---

## 0. Reality check (CLAUDE.md güncellemesi)

`CLAUDE.md` "i18n is a scaffold with `en` only" diyor. Bu **artık doğru değil**. Mevcut state:

| Boyut | Durum |
|---|---|
| `SUPPORTED_LOCALES` | `["en", "tr"]` |
| `SUPPORTED_REGIONS` | 8 region (US/GB/EU/CA/AU/AE/SG/**TR**) |
| TR namespace coverage | **48/48** (Sprint 7 closure) |
| TR leaf string ratio | ~95% (2070 / 2179 user-copy literal) |
| Fallback chain | cookie → org default → Accept-Language → DEFAULT |
| Plural support | `plural.ts` (CLDR-rule scaffold) |
| RTL plumbing | hazır (ar/he/fa/ur listeli, locale eklenirse aktif) |
| Pinned guards | `locale-parity` + `tr-coverage` (>=48 hard) + `tr-locale.static` |
| Legal page | `(marketing)/legal/kvkk` mevcut, **DRAFT banner taşıyor** |

**Sonuç:** TR temeli atılmış, namespace parite tam. **Eksik olan: per-key parite + hardcoded survivor sweep + transactional surface'ler.** Kickoff brief bunu segment olarak nasıl kapatacağımıza karar vermek için.

> **AKSİYON (Sprint 33 Faz 0):** CLAUDE.md i18n satırı güncellenecek — "scaffold" iddiası artık drift, README §5.23 guard'ı bile bunu yakalamak için kuruldu.

---

## 1. "TR coverage" ne demek? — Taxonomy

Tek başına "%100 TR" muğlak. 4 katman var, her birini ayrı tartmamız lâzım:

| Katman | Tanım | Şu anki durum | Risk |
|---|---|---|---|
| **L1 Namespace** | `tr.ts` her top-level namespace'i `...en.X` ile spread'liyor mu? | ✅ 48/48 | namespace eklenirse pinned test fail eder (regresyon korumalı) |
| **L2 Per-key (catalog)** | Her leaf string TR override'a sahip mi? | ⚠️ ~95% (rough) | UI'da rastgele EN string sızıntısı; statik test yok |
| **L3 Hardcoded survivor** | UI/server'da catalog dışı literal EN string var mı? | ❌ 287 suspect (107 JSX + 43 placeholder + 95 metadata + 33 toast + 9 aria-label) | Catalog'a alınmadığı için locale switch'te EN kalır |
| **L4 Transactional/server** | Email template, Zod hata mesajı, server log copy | ❌ 4 email template (welcome/invite/reset/billing) — dictionary outside scope | Customer'a giden email her zaman EN |

**Council decision #1:** Sprint 33 segmentinin **launch-blocking** tanımı bu 4 katmandan hangileri? Önerim aşağıda (§4.1).

---

## 2. Gap inventory — sayılar

**L2 (per-key) — sample audit gerekli.** Şu an `...en.namespace` spread olduğu için per-key eksiklik runtime'a kadar gizleniyor. Gerçek sayı için bir static analyzer gerek (öneri: `tr-key-parity.test.ts` — namespace içinde `Object.keys(tr.X)` ⊂ `Object.keys(en.X)` ve **her key TR-translated** = "değer en'dekinden farklı").

**L3 (hardcoded) — 287 suspect.** Sandbox scan sonucu (745 dosya, i18n + ui/ klasörleri hariç):

```
JSX-text             107   ör. >Sign in to your account<, >Page not found<
placeholder=          43   ör. "Additional details about this reason code"
aria-label=            9   1 zaten TR ("Dosyayı kaldır"), 8 EN
metadata.title:       95   çoğu marketing landing (app/page.tsx)
toast.x()             33   ör. toast.success("Account deleted successfully")
```

Toplam ham sayı şişirilmiş — bazı match'ler false-positive (ör. `>OneAce<` brand name). Gerçek migrate hedefi tahmin: **~200 string**.

**L4 (transactional) — 4 template + auth flow:**
```
src/lib/mail/templates/billing-emails.ts
src/lib/mail/templates/invitation-email.ts
src/lib/mail/templates/welcome-email.ts
src/lib/mail/templates/reset-password-email.ts
```
+ Better Auth'un kendi default error mesajları (auth-rate-limit, "Invalid token" vs.) — bunlar paket içinden geliyor, ya wrap'leyeceğiz ya catch + custom mesaj.

---

## 3. Council-grade decisions

Aşağıdaki 5 fork sprint scope'unu, sürelerini ve verification şeklini doğrudan belirliyor. Her birinin **1 tercih** önerisi var (♥ ile işaretli) ama council formatında karar.

### 3.1 Coverage gold standard

| Seçenek | Kapsam | Süre tahmini | Avantaj | Dezavantaj |
|---|---|---|---|---|
| **A** L1 + L2 yeter | Per-key parite + namespace | 2 sprint | Hızlı; UI tamamen TR | Email/server EN kalır → customer-facing email EN |
| **B** L1+L2+L3 ♥ | + hardcoded sweep | 4 sprint | Müşteri ekran-front bütün EN'i bitirir | Email hâlâ EN |
| **C** L1+L2+L3+L4 | + email + server copy | 6 sprint | Tam coverage | Launch slip riski; council-launch-blocking criteria flexed |

**Önerim:** B (L1+L2+L3). Email'leri Sprint 35 sonrası "post-launch closure" olarak ayır — launch criteria için TR ekran %100, TR email ⏳ release-note caveat. Karşı argüman: TR ülkesinde KVKK reset email'i EN gelirse PR riski.

### 3.2 Verification approach

| Seçenek | Yöntem | Güç | Maliyet |
|---|---|---|---|
| **A** Sadece pinned static | Regex + key set diff | Compile-time | Düşük (zaten pattern oturmuş) |
| **B** Static + Playwright TR session ♥ | E2E `oneace-locale=tr` cookie ile core flow click-through, screenshot diff | Runtime + visual | Orta (mevcut e2e infra var) |
| **C** B + manuel native review | + native TR konuşur QA pass | Translation kalite garantisi | Yüksek; insan döngüsü |

**Önerim:** B + sample-based C. Static + Playwright TR session her sprint sonunda zorunlu; native review yalnızca high-traffic surface'lerde (auth, dashboard, items, billing).

### 3.3 Stub policy (passthrough vs. translated)

Şu an `tr.foo = { ...en.foo, bar: "Türkçe" }` shape'inde — hangi key'ler **kasıtlı EN passthrough** (ör. brand name "OneAce", teknik terim "SKU") hangi key'ler **TODO** belli değil.

| Seçenek | Marker | Verification |
|---|---|---|
| **A** Hiç marker yok | Mevcut hâl | Per-key test → TODO ile gerçek translate ayrılamaz |
| **B** `INTENTIONAL_EN` constant ♥ | `bar: INTENTIONAL_EN` (= en.foo.bar) | Per-key test "değer === en + INTENTIONAL_EN değil = TODO" |
| **C** `__notTranslated` flag | Object wrap | Daha invazif; refactor pahalı |

**Önerim:** B. `INTENTIONAL_EN` symbol'ü `messages/_markers.ts`'e koy, `tr.ts`'de explicit kullanım. Per-key test'i sayar.

### 3.4 Sprint cadence — sub-sprint breakdown

| Şıkk | Boyutlama | Trade-off |
|---|---|---|
| **A** Per-namespace sweep | Her sprint 5-8 namespace | Sprint sayısı çok (~10) |
| **B** Per-feature surface ♥ | Auth → Dashboard → Items → PO → Settings → ... | Doğal user-journey grupları, smoke-test kolay |
| **C** Per-content-type | Önce tüm placeholder'lar, sonra toast'lar... | Mantıklı görünür ama her sprint cross-cutting → review zor |

**Önerim:** B (per-feature). Aşağıda §4'te detaylandırdım.

### 3.5 Translation source

| Seçenek | Yöntem | Hız | Maliyet | Kalite |
|---|---|---|---|---|
| **A** In-house native (sen + ekip) | Manuel | Yavaş | Sıfır $ | Yüksek |
| **B** Agency | RFP + pass | Yavaş başlangıç | $$$ | Yüksek |
| **C** LLM-draft + native review ♥ | Sprint başı LLM toplu draft, sprint sonu native pass | Hızlı | $ | Orta-yüksek (review'a bağlı) |

**Önerim:** C. Bu repo zaten LLM-friendly catalog yapısına sahip; LLM tek pass'te tr.ts override'ları çıkarır, sprint sonu native review (sen) düzeltir.

---

## 4. Önerilen sprint breakdown (decisions §3'a koşullu)

§3'teki ♥ önerilere göre kalibre edilmiş. Her sprint kendi closure tag'ı ve pinned test'iyle.

### Sprint 33 — Foundation + L2 framework
- `INTENTIONAL_EN` marker primitive (`messages/_markers.ts`)
- `tr-key-parity.test.ts` yeni pinned test — namespace bazında EN ⊂ TR + "TODO=0" hard assertion (initial whitelist'e izin var)
- `tr-coverage.test.ts` istatistik genişletme: namespace+key matrix dump (informational)
- Playwright `oneace-locale=tr` smoke fixture (1 happy path: login → dashboard)
- CLAUDE.md i18n satırı update
- **Closure tag:** `v1.44.0-tr-coverage-foundation`
- **Boyut:** 1-2 gün

### Sprint 34 — L3 hardcoded sweep tier 1 (auth + chrome)
- `app/page.tsx`, `app/not-found.tsx`, `(auth)/*` literal'leri → catalog
- Header, sidebar, search placeholder
- 287 suspect listesinin ~80'i
- ESLint custom rule: `no-hardcoded-jsx-text` (whitelist: brand names + ui/ + i18n/)
- **Closure tag:** `v1.45.0-tr-l3-auth-chrome`
- **Boyut:** 2 gün

### Sprint 35 — L3 sweep tier 2 (operations: items + dashboard + scan)
- (app)/items, (app)/dashboard, (app)/scan literal'leri
- toast.x() çağrılarının ilk yarısı
- **Closure tag:** `v1.46.0-tr-l3-operations`
- **Boyut:** 2 gün

### Sprint 36 — L3 sweep tier 3 (procurement + fulfillment + settings)
- (app)/purchase-orders, (app)/sales-orders, (app)/kits, (app)/settings
- Geriye kalan toast'lar + aria-label'ler
- **Closure tag:** `v1.47.0-tr-l3-modules`
- **Boyut:** 2 gün

### Sprint 37 — L2 per-key fill + closure
- `INTENTIONAL_EN` whitelist'i hariç **TODO=0**
- LLM-draft → native review iterasyon
- Playwright TR smoke test 5 core flow'u kapsasın (login, dashboard, item-create, PO-create, settings-org-default-locale-switch)
- L4 (email + server copy) için backlog doc
- **Closure tag:** `v1.48.0-tr-l2-fill-closure`
- **Boyut:** 3-4 gün
- **Segment SEAL** — `v1.49.0-tr-coverage-segment-sealed` closure manifest

### (Backlog — Sprint 38+) L4 transactional
- 4 email template TR override
- Better Auth error wrapper
- Server log/audit message normalization

---

## 5. Risk register

| # | Risk | Olasılık | Etki | Mitigasyon |
|---|---|---|---|---|
| R1 | LLM-draft kalitesi düşük → "Google Translate gibi" | Orta | Yüksek (PR riski) | Native review zorunlu, sample-based UX QA |
| R2 | Hardcoded sweep'te yanlışlıkla brand-name'i de catalog'a alıp localize etmek (ör. "OneAce" → "TekAs") | Düşük | Orta | `INTENTIONAL_EN` + brand-name whitelist |
| R3 | Better Auth paket-içi mesajları override edilemez | Orta | Düşük | Catch + wrap pattern; "auth.errors.fallback" key |
| R4 | KVKK page hâlâ DRAFT — TR launch claim'i hukuki risk | Yüksek | Yüksek | Sprint 37 öncesi avukat review **mandatory gate** |
| R5 | tr-TR number formatting (comma decimal) bazı UI'larda EN format'la karışık görünür (Recharts axis vs. cell value) | Orta | Düşük | Sprint 33 Phase 0'da tek-spot Intl audit |
| R6 | Org-level `defaultLocale` set edilmiş test fixture'ları artık TR bekleyebilir → mevcut e2e regresyon | Düşük | Orta | Mevcut e2e'leri Sprint 33 Phase 0'da run, baseline'la |
| R7 | Sprint cadence çakışması: design system audit segment yeniden açılırsa lock-step gerekir | Düşük | Düşük | Closure manifest §6 "yeniden açma" rehberi var |

---

## 6. Verification methodology — pinned test taksonomisi

Sprint sonunda her zaman 4-katman testleri yeşil:

```
src/lib/i18n/
├─ locale-parity.test.ts            [§5.23 — config ↔ messages dosya symmetri]
├─ tr-locale.static.test.ts         [P1-07 — TR locale + KVKK + region foundation]
├─ tr-coverage.test.ts              [Sprint 2-7 — namespace coverage hard >=48]
├─ tr-key-parity.test.ts            [Sprint 33 YENİ — per-key parity + INTENTIONAL_EN sayım]
└─ no-hardcoded-jsx.test.ts         [Sprint 34 YENİ — L3 sweep regresyon kapanı]

e2e/
└─ tr-smoke.spec.ts                 [Sprint 33+ — oneace-locale=tr happy path]
```

Mevcut `tr-coverage.test.ts`'in `>=48` hard assertion'ı zaten launch-blocking gate. Sprint 37 closure'ında bunu `tr-key-parity.test.ts` ile zenginleştir: **TODO sayısı ≤ whitelist** hard assert.

---

## 7. Council'a sorular (decision karar tablosu için)

1. **§3.1 — coverage gold standard:** A / **B ♥** / C ?
2. **§3.2 — verification:** A / **B ♥** / C ?
3. **§3.3 — stub policy:** A / **B ♥** / C ?
4. **§3.4 — sprint cadence:** A / **B ♥** / C ?
5. **§3.5 — translation source:** A / B / **C ♥** ?
6. **R4 (KVKK draft):** Sprint 37 öncesi avukat review yapılabilir mi? Eğer hayır, launch criteria'dan TR çıkarılır mı, yoksa TR-beta ile feature-flag'lenir mi?

Bu 6 karar verilince Sprint 33 apply script'i hazırlanır (foundation + marker primitive + tr-key-parity.test.ts iskeletini yazıp tag atarız).

---

## 8. Sonraki adım

- Council toplantı modunda 6 soruya tek-tek karar (önerilerle gidecekse "all ♥" yeter)
- Decision'lar netleştikten sonra brief'in DRAFT etiketi düşer, `SPRINT-33-KICKOFF-BRIEF-2026-04-27.md` olarak commit edilir
- Sprint 33 apply script'i `scripts/sprints/2026-04-27-tr-coverage-segment-kickoff/` altına yazılır
