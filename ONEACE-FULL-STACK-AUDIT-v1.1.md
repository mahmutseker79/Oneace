# OneAce — Full-Stack Audit Dossier v1.1

**Proje:** OneAce (Next.js 15 Inventory / WMS SaaS)
**Repo:** `github.com/mahmutseker79/Oneace`
**Çalışma ağacı:** `~/Documents/Claude/Projects/OneAce/oneace`
**Deployed:** https://oneace-next-local.vercel.app
**Denetim anındaki sürüm:** `v1.0.0-rc14-p3-remediations` (HEAD = `f6b3dc2`, `stable` = HEAD)
**Denetim tarihi:** 2026-04-18
**Denetim kapsamı:** v1.0'da **örtülmeyen** yüzeyler (trust & ops dışı: test yüzeyi, telemetri pratiği, i18n, error topology, supply chain, cron hijyeni, email pipeline, erişilebilirlik derinliği)
**Yazar:** Claude (God-Mode audit protocol — v1.1 delta pass)

> **Okuma kontratı.** v1.0'da bulgu altına alınan ve artık kapanmış 24 kalem bu dokümanda yeniden açılmıyor. Aşağıdaki her bulgu (a) v1.0 kapsamı dışındadır, (b) file:line evidence ile bağlıdır, (c) v1.0'dakiyle aynı pinlenmiş-test workflow'u için hazır. "Critical Path" ve "Faz-2 Execution Prompt" (§15) bağlayıcı bölümler — aralarındaki her şey teşhis.

---

## 0. Bu dokümanı nasıl okumalı

- **Severity:** `P0` = ship-blocker / veri kaybı; `P1` = sessiz güven erozyonu veya kör nokta; `P2` = kullanıcı-görünür pürüz, ops riski; `P3` = polish; `P4` = nice-to-have.
- **Status etiketleri:** `DARK` (telemetri var ama ölçüm yok), `ASPIRATIONAL` (kod spec ediyor, uygulama tetiklemiyor), `DRIFT` (doc vs kod), `UNTESTED` (hot path, test neighbor'ı yok), `MISSING` (kategori tamamen yok).
- **Evidence formatı:** `src/<path>:<line>` — `oneace/` root'a göreli.
- **v1.0'a referans:** `(v1.0 §N.M kapsamında değildi)` notu, o alanın neden v1.1'de yeniden açıldığını kanıtlar.

---

## 1. Yönetici Özeti

v1.0 (rc14) "sessiz yalanları" ve perimeter-auth zayıflığını kapattı: billing capability check, dashboard sentetik trend, stock count rollback, middleware session validation, sales-order allocate, Shopify idempotency, rate-limit, PII headers, soft-delete kanonizasyonu, dialog a11y — hepsi pinlenmiş testlerle. Platform artık **"yaptığını iddia ettiği şeyi yapıyor"** kalitesinde.

v1.1'in odak noktası bambaşka üç eksen:

1. **Ölçüm teatrosı.** `src/lib/analytics/events.ts` 22 event ismi bildiriyor (`SIGNUP_COMPLETED`, `FIRST_ITEM_CREATED`, `FIRST_SCAN`, `FIRST_COUNT_COMPLETED`, `UPGRADE_CLICKED` …). Kod tabanında bunları çağıran yalnızca **3 dosya** var — 19 event hiç tetiklenmiyor. PostHog provider yüklüyor, `$pageview` otomatik gidiyor, ama **activation hunisi ölçülmüyor**. (§5.20, §7)
2. **Test asimetrisi.** 54 `"use server"` action dosyası var; neighbor `.test.ts` sayısı **sıfır**. v1.0'da eklenen 80 test, çoğunlukla static-analysis guard (CSP, a11y adoption, soft-delete lint) — hot-path davranış testi **server action'larda hiç yok**. Transfers, purchase-orders, kits, picks, migrations — üretimin göbeği regresyon koruması olmadan çalışıyor. (§5.19, §6)
3. **Topraksız hata yakalama.** `src/app/` altında sadece **2** error boundary var (`global-error.tsx`, `(app)/error.tsx`). Reports, purchase-orders, stock-counts, migrations, transfers — hepsi segment-level `error.tsx` olmadan çalışıyor. Bir raporda fırlatılan hata şu anda tüm app-shell'i devre dışı bırakıyor. (§5.21, §8)

Bunların yanında iki "proje olgunluğu" uyarısı: **i18n 8 locale deklare ediyor ama 7'sinin mesaj dosyası yok** (§5.23) ve **CI pipeline'ı Playwright suite'ini çalıştırmıyor** — E2E fiilen opsiyonel (§5.22).

### 1.1 Olgunluk skor kartı (v1.0 → v1.1 delta)

| Boyut | v1.0 | v1.1 | Gerekçe |
|---|---:|---:|---|
| Product / IA | 5.5 | 7.5 | Nav schism kapatıldı, onboarding reachable |
| Onboarding / Activation | 3 | 5 | Wizard açıldı; ama aktivasyon **ölçülmüyor** (§5.20) |
| Frontend / UI polish | 7.5 | 8 | Empty state adoption, dialog a11y, CSP, reduced-motion — hepsi yerinde |
| UX / Workflow correctness | 6 | 8 | Rollback, allocate, migration artık gerçek |
| Backend / Domain | 7 | 7.5 | Compound indexes eklendi; DLQ cap pinlendi |
| Analytics / Data trust | 4 | **4.5** | Sentetik grafikler gitti ama gerçek ölçüm de yok (§5.20) |
| RBAC / Security / Tenancy | 5.5 | 8 | Capabilities, headers, file scoping, session revalidation OK |
| Offline / PWA | 7 | 7.5 | SW precache pinlendi, DLQ cap var |
| Performance / Scale | 5.5 | 7 | Shell cache'lendi, hot-path indexes pinlendi |
| **Test / CI / Release confidence** | 4 | **4** | Static guard'lar arttı **ama** server-action behavior coverage hâlâ sıfır (§5.19, §5.22) |
| Observability / Product metrics | — | **3.5** | Yeni eksen: Sentry + logger iyi, product-analytics tak'sız (§5.20) |
| Internationalization | — | **4** | Yeni eksen: Scaffold var, tercüme yok (§5.23) |
| Supply chain hygiene | — | **5** | Yeni eksen: Dep'ler temiz, otomasyon yok (§5.26) |
| **Genel** | 5.8 | **6.5** | Trust koruması sağlam; ölçüm ve test kaslanmaya muhtaç |

### 1.2 En çok önemli üç şey

Tek sprint varsa: **(a)** Analytics event tetikleyicilerini 19 boş event için dağıt — activation hunisi bir haftada ölçülebilir hâle gelir (§5.20). **(b)** `(app)/` altındaki 6 ana route group'a `error.tsx` ekle — bir rapor hatası tüm uygulamayı devirmesin (§5.21). **(c)** En az üç "ağır" server action için behavior test yaz (transfer receive, purchase-order receive, migration import) — regresyon radarı açılır (§5.19).

Bu üç hamle birlikte: orta impact, düşük regresyon riski, 1-2 günlük iş. v1.1 Phase-1'in çekirdeği.

---

## 2. Sistem Şekli Özeti (v1.0'dan delta)

### 2.1 Teknoloji (değişmeyenler)

Next.js 15 + App Router, TypeScript strict (artık `ignoreBuildErrors: true` **kaldırıldı**, `tsc --noEmit` temiz — v1.0 §5.17 remediation), Prisma 6, better-auth, Tailwind 4 token sistemi, Sentry (client/server/edge), PostHog provider yüklü, Resend mailer, Dexie offline queue.

### 2.2 Yeni eklenen veya kapasitesi değişenler (v1.0 → rc14)

- **`src/lib/instrumentation.ts`** — ince bir `track()` facade (v1.0 P3-5). Gerçek fan-out yapıyor, ama çağrı yüzeyi (3 dosya) taxonomy'ye kıyasla çok küçük.
- **`src/lib/analytics/events.ts`** — 22 event sabiti + `trackEvent` wrapper. `src/components/ui/image-upload.tsx` dışında uygulama kodu bu API'yi kullanmıyor.
- **`src/lib/db/soft-delete.ts`** — 5 kanonik active-row predicate. Önceki drift kapatıldı.
- **`src/lib/offline/queue.ts`** — `MAX_OP_ATTEMPTS = 8` DLQ cap.
- **`docs/backup-strategy.md`, `docs/MONITORING.md`, `docs/SECURITY_AUDIT.md`** — ops dokümanları yazılmış; launch öncesi iyi bir temel.

### 2.3 Route topolojisi (sayılar)

- `src/app/api/**/route.ts` → **42** route dosyası (v1.0 "23" demişti; o tarih itibarıyla daha azmış ya da sayım metoduyla sapma var — şu anki gerçek sayı 42)
- `"use server"` içeren dosya → **54**
- `loading.tsx` → **~46** (v1.0 ile tutarlı)
- `error.tsx` + `global-error.tsx` → **2** (§5.21 — çok düşük)
- E2E spec → `e2e/*.spec.ts` altında **14 dosya** (auth, dashboard, exports, items, movements, notifications, permissions, purchase-orders, reports, scanner, settings, stock-counts, warehouses)
- Unit/integration test → **63 test dosyası / 972 test** (v1.0 rc14'te greenlit)

### 2.4 Dark/unused yüzey

Aşağıdaki yerlerde kod **var** ama kullanılmıyor — v1.0'dan kalan "dark surface" mirası:

| Yüzey | Durum | Not |
|---|---|---|
| `src/app/_unused_onboarding_copy/` | git untracked | Eski wizard kopyası, temizlenmeli (§5.31) |
| `AnalyticsEvents` enum | 22 event, 3 call-site | Taxonomy aspirational (§5.20) |
| `src/lib/i18n/messages/` | 8 locale tanımlı, 1 dosya | 7 locale için translation missing (§5.23) |
| `test-artifacts/` | git untracked | Playwright output; `.gitignore`'a girmemiş (§5.31) |

---

## 3. Dosya-dosya Audit Matrisi (yalnızca v1.1 için anlamlı olanlar)

| Dosya | Rol | Bulgular |
|---|---|---|
| `src/lib/analytics/events.ts` | PostHog event taxonomy | **P1** (§5.20): 22 event tanımlı, 3 call-site — 19 event ASPIRATIONAL |
| `src/components/posthog-provider.tsx` | PostHog init | OK — provider wire doğru |
| `src/components/posthog-pageview.tsx` | `$pageview` auto-capture | OK — ama manual event'ler üretilmiyor |
| `src/app/global-error.tsx` | Root error boundary | OK (v1.0 §5.21 — koruma çerçevesi) |
| `src/app/(app)/error.tsx` | App-level boundary | OK — ama tek "in-app" boundary (§5.21) |
| `src/app/(app)/reports/error.tsx` | YOK | **P2** (§5.21): rapor segment'inde error boundary yok |
| `src/app/(app)/purchase-orders/error.tsx` | YOK | **P2** (§5.21) |
| `src/app/(app)/stock-counts/error.tsx` | YOK | **P2** (§5.21) |
| `src/app/(app)/migrations/error.tsx` | YOK | **P2** (§5.21) |
| `src/app/(app)/transfers/error.tsx` | YOK | **P2** (§5.21) |
| `src/app/(app)/**/actions.ts` (54 dosya) | Server actions | **P1** (§5.19): UNTESTED — 54 dosyada 0 neighbor test |
| `src/app/(app)/layout.tsx:146` | `<main id="main-content">` | OK id var; **ama** skip-link yok (§5.25) |
| `src/lib/i18n/config.ts:17-26` | `SUPPORTED_LOCALES` = 8 | **P2** (§5.23): DRIFT — 8 locale, 1 mesaj dosyası |
| `src/lib/i18n/messages/en.ts` | Tek dil dosyası | OK en için |
| `src/lib/i18n/messages/` | Diğer 7 locale yok | **P2** (§5.23): MISSING |
| `prisma/schema.prisma` (Notification model) | Notification | **P2** (§5.24): `expiresAt` yok, retention/dedup yok |
| `.github/workflows/ci.yml:1-119` | CI pipeline | **P1** (§5.22): `playwright test` adımı yok |
| `.github/workflows/e2e.yml` | E2E pipeline | — (ayrı, muhtemelen manuel tetik) |
| `.github/dependabot.yml` veya `renovate.json` | YOK | **P2** (§5.26): bağımlılık upgrade otomasyonu yok |
| `package.json` | Manifest | **P2** (§5.26): `engines`, `packageManager` alanı yok |
| `vercel.json:5-13` | Cron tanımları | **P2** (§5.27): cron idempotency guard yok |
| `src/app/api/cron/stock-count-triggers/route.ts` | Günlük cron | CRON_SECRET ✓, idempotency ✗ |
| `src/app/api/cron/cleanup-migration-files/route.ts` | Günlük cron | CRON_SECRET ✓, idempotency ✗ |
| `src/app/api/cron/process-imports/route.ts` | Ad-hoc cron | vercel.json'da yok; dış trigger üzerinden |
| `src/lib/mail/resend-mailer.ts` | Resend mailer | OK send; **P2** (§5.28): bounce/complaint webhook yok |
| `src/app/api/webhooks/resend/route.ts` | YOK | **P2** (§5.28): MISSING |
| `src/app/api/billing/checkout/route.ts:69-88` | Checkout | **P3** (§5.30): body zod'suz (inline check var) |
| `src/app/api/account/delete/route.ts:42+` | GDPR delete | **P3** (§5.30): body zod'suz (inline check var) |
| `vitest.config.ts` | Vitest config | **P3** (§5.29): `coverage:` bloğu yok |
| `docs/openapi.yaml` | OpenAPI spec | **P3** (§5.32): DRIFT riski — otomatik diff yok |

---

## 4. 10 Yeni Çerçeve Sorusu

> v1.0 "yalanlar" için 10 soru sordu. v1.1 "ölçüm ve hazırlık" için 10 soru soruyor.

**S1. Ürün şu an hangi metriği görmüyor?**
Activation hunisi. `AnalyticsEvents` 22 event için isim yerleştirmiş ama `trackEvent` yalnızca `image-upload.tsx` ve `instrumentation.ts`'den çağrılıyor. Signup → ilk warehouse → ilk item → ilk count — hiçbirinin zamanı ölçülmüyor. (§5.20)

**S2. Prodüksiyonda bir server action patlarsa ne olur?**
`next.js` otomatik olarak app-level `error.tsx`'e düşer. Bu, tüm uygulama shell'ini (sidebar + topbar + content) hata ekranına çevirir. Kullanıcı dashboard'a dönmek için **tam sayfa reload** yapmak zorundadır. (§5.21, §8)

**S3. E2E ne zaman çalışıyor?**
`ci.yml` içinde hiçbir zaman. `.github/workflows/e2e.yml` ayrı dosya, `ci.yml`'den `needs:` ile bağlı değil. Her push'ta E2E zorunlu değil → E2E fiilen opsiyonel. (§5.22)

**S4. Server action regresyonlarını hangi test yakalar?**
Şu an hiçbiri. 54 action dosyası için neighbor `.test.ts` sayısı 0. `e2e/*.spec.ts` happy-path'i çalıştırıyor; edge-case, error-handling, concurrent mutation → koruma yok. (§5.19, §6)

**S5. 8 locale production'a çıkarsa ne olur?**
İngilizce dışındaki 7 dil için `messages/*.ts` dosyası yok. `useTranslations('tr')` gibi bir çağrı runtime'da undefined döndürür veya en'e fallback eder (implementation'a göre). Pazarlama "8 languages" promise'i **ürün gerçeği değil**. (§5.23)

**S6. Vercel Cron 500 dönerse?**
Vercel retry eder. `stock-count-triggers` ve `cleanup-migration-files` idempotency key kullanmadığı için aynı işin iki kez koşma ihtimali var — özellikle `cleanup-migration-files` için bu, fazladan dosya silinmesi riski. (§5.27)

**S7. Bir kullanıcı email'i bounce ederse?**
Resend webhook handler yok (`src/app/api/webhooks/resend/route.ts` MISSING). `User.emailIsInvalid` bayrağı yok. Hard-bounce eden adreslere sonsuza dek davetiye, parola reset maili, billing notification gönderilmeye devam edilir → Resend reputation erozyonu. (§5.28)

**S8. Bir bağımlılıkta CVE çıkarsa nasıl öğreniriz?**
Dependabot yok, Renovate yok. `.github/workflows/` içinde `npm audit` veya `pnpm audit` adımı yok. Manuel `pnpm outdated` gerekli. (§5.26)

**S9. Notification tablosu bir yıl sonra ne kadar büyür?**
Unbounded. `Notification` modelinde `expiresAt` yok, retention cron'u yok, dedup key yok. 1000 kullanıcı × 50 notification/gün × 365 → 18.2M satır. Hot index `(userId, readAt)` korur ama toplam boy ve seq scan riski artar. (§5.24)

**S10. Yeni bir geliştirici repo'ya baktığında hangi ekran onu kaybeder?**
İki yer: (a) `src/app/**/*actions.ts` — test yok, contract yok, ne beklendiği belirsiz; (b) `docs/openapi.yaml` ve koddaki route'lar — senkron olduğu otomatik doğrulanmıyor. README güncel, ama "iç" dokümantasyon yok. (§5.31, §5.32)

---

## 5. Kritik Bulgular (sıralı)

> Her bulgu: severity, başlık, evidence, impact, remediation direction, önerilen pinlenmiş test, fix-risk.

### 5.19 P1 — Server actions have zero behavior test coverage

**UNTESTED**

- **Evidence:**
  - `grep -rln '"use server"' src` → 54 sonuç
  - Neighbor `.test.ts` taraması → **0/54** (`src/app/(app)/organizations/actions.ts`, `migrations/actions.ts`, `purchase-orders/actions.ts`, `warehouses/actions.ts`, `transfers/actions.ts`, `kits/actions.ts`, `picks/actions.ts`, `suppliers/actions.ts`, `departments/actions.ts`, `labels/actions.ts`, `settings/*/actions.ts` — hiçbiri için `*.test.ts` dosyası yok)
  - `src/app/(app)/purchase-orders/actions.ts` — receive/close/cancel state makinesi, audit log, idempotency → 0 test
  - `src/app/(app)/migrations/actions.ts` — import/start/rollback pipeline → 0 test
- **Impact:** v1.0 84 olan static-guard testleri ekledi (CSP, empty state adoption, soft-delete lint). Ama server action **davranış** testleri yok. Bir PR, `finalizePurchaseOrder()` içindeki movement yazımını yanlışlıkla silerse, hiçbir CI gate yakalamaz; yalnızca manual QA veya prodüksiyonda ledger drift ile görünür.
- **Fix direction:** İlk iterasyonda "en pahalı 3 action" için behavior test ekle (PO receive, transfer commit, migration import). Pattern: Prisma test client + bir fixture organization → action'ı çağır → DB state + audit log assert.
- **Pinlenmiş test önerisi:** `src/app/(app)/purchase-orders/actions.test.ts` — 3 senaryo: (a) happy-path receive hem `StockMovement` hem `AuditLog` yazar, (b) double-receive idempotency key nedeniyle ikinci kez movement yazmaz, (c) canceled PO receive çağrılırsa `IllegalStateError` fırlatır.
- **Fix risk:** Düşük (sadece ekleme). CI süresi ~+30s.

### 5.20 P1 — Analytics event taxonomy is aspirational, not measured

**ASPIRATIONAL · DARK**

- **Evidence:**
  - `src/lib/analytics/events.ts:1-104` — 22 event sabiti: `SIGNUP_COMPLETED`, `FIRST_ITEM_CREATED`, `FIRST_WAREHOUSE_CREATED`, `FIRST_SCAN`, `FIRST_COUNT_COMPLETED`, `ONBOARDING_COMPLETED`, `UPGRADE_CLICKED`, `CHECKOUT_STARTED`, `SUBSCRIPTION_CREATED`, `ITEM_CREATED`, `MOVEMENT_LOGGED`, `COUNT_STARTED`, `REPORT_VIEWED`, `REPORT_EXPORTED`, `PO_CREATED`, `TWO_FACTOR_ENABLED`, `BIN_CREATED`, `BARCODE_SCANNED`, `ITEM_IMAGE_UPLOADED` …
  - `grep -rln "AnalyticsEvents\|trackEvent" src` → **3 dosya**: `events.ts` kendisi, `instrumentation.ts` (facade), `src/components/ui/image-upload.tsx` (yalnız `ITEM_IMAGE_UPLOADED`)
  - `src/components/posthog-pageview.tsx:61` — yalnız `$pageview` otomatik
- **Impact:** v1.0 §7.4 "activation metrikleri ölçülemiyor" bulgusunu kapatmadı — yalnız nihai tüketici API'sini (AnalyticsEvents sabitleri) oluşturdu. Bir user funnel raporu şu an 19 event için boş çıkar. Product team "Free→Paid conversion" veya "Time to first scan" gibi soruların cevabını **alamaz**. Activation/retention dashboard'ları demo-ready değil.
- **Fix direction:** Her event'in gerçek tetik noktasını haritala ve `trackEvent(AnalyticsEvents.X, {…})` çağrısı yerleştir:
  - `SIGNUP_COMPLETED` → `src/app/api/auth/sign-up/...` response başarılıysa
  - `FIRST_ITEM_CREATED` → `(app)/items/actions.ts` içindeki create action'ında, org'un ilk item'ı ise
  - `FIRST_SCAN` → Barcode scanner component'i, user'ın ilk scan'ı ise
  - `UPGRADE_CLICKED` → billing CTA button'ında
  - `CHECKOUT_STARTED` → `/api/billing/checkout` 200'de
  - `SUBSCRIPTION_CREATED` → Stripe webhook `customer.subscription.created`
  - `REPORT_VIEWED` → Report page component'i mount event'i
  - `PO_CREATED` → PO create action başarılıysa
- **Pinlenmiş test önerisi:** `src/lib/analytics/events.test.ts` — static analysis: `AnalyticsEvents` içindeki her key için en az 1 call-site bulunmalı (`readdirSync` + grep). Şu an 3/22 → test başlangıçta kırılır; her event doldurulunca yeşile döner.
- **Fix risk:** Düşük-orta. Her call-site 1-2 satır. "First ever" tetikleri (`FIRST_*`) ek state kontrolü gerektirir (org.createdAt + count === 0 kontrolü).

### 5.21 P1 — Error boundary topology is flat (2 total)

**MISSING**

- **Evidence:**
  - `find src/app -name "error.tsx" -o -name "global-error.tsx"` → 2 sonuç: `src/app/global-error.tsx`, `src/app/(app)/error.tsx`
  - Segment-level `error.tsx` **yok** şu route group'larda: `(app)/reports`, `(app)/purchase-orders`, `(app)/stock-counts`, `(app)/migrations`, `(app)/transfers`, `(app)/items`, `(app)/warehouses`, `(auth)`
  - `(app)/error.tsx:1-108` — app shell seviyesinde yakalar; ama bir rapor sayfasındaki Prisma hatası bu boundary'ye kadar yükselir → sidebar + topbar + content **hepsi** error UI'a çevrilir
- **Impact:** v1.0 §9 UI polish iyileştirdi ama error recovery UX'i polish edilmedi. Bir rapor sayfasında `/api/reports/*` 500 dönerse, kullanıcı bir hata banner'ı + "geri dön" linki görür, **sidebar'ı kullanamaz**. Reload gerek. Bu, düşük ciddiyetli bir hatayı (bir rapor çalışmadı) yüksek-algı bir bug'a (uygulama bozuldu) dönüştürür.
- **Fix direction:** Şu 6 grup için `error.tsx` ekle:
  1. `(app)/reports/error.tsx` — "Bu raporu yükleyemedik" + retry
  2. `(app)/purchase-orders/error.tsx` — "Sipariş verisini okuyamadık" + retry
  3. `(app)/stock-counts/error.tsx` — "Sayım oturumu yüklenemedi" + "aktif sayıma dön"
  4. `(app)/migrations/error.tsx` — "Migrasyon ekranı hata verdi" + "tekrar dene"
  5. `(app)/transfers/error.tsx`
  6. `(app)/items/error.tsx`
- **Pinlenmiş test önerisi:** `src/app/error-boundaries.test.ts` — static: her `(app)/*` klasöründe `error.tsx` var mı? `readdirSync('src/app/(app)')` → filter directory → her biri için `error.tsx` existence assertion.
- **Fix risk:** Sıfır. Pure ekleme.

### 5.22 P1 — CI does not run E2E suite

**MISSING**

- **Evidence:**
  - `.github/workflows/ci.yml:1-119` — jobs: `lint-and-type-check` (biome + tsc), `test` (vitest), `prisma-validate`. **`playwright test` adımı yok.**
  - `.github/workflows/e2e.yml` ayrı dosya. `ci.yml`'deki `needs:` zinciri E2E'ye ulaşmıyor → E2E PR merge için zorunlu değil.
  - `e2e/*.spec.ts` → 14 spec mevcut (auth, dashboard, exports, items, movements, notifications, permissions, purchase-orders, reports, scanner, settings, stock-counts, warehouses)
- **Impact:** 14 E2E spec yazılmış, yeşil, **ama PR gate değil**. Bir PR E2E'yi kırıp merge olabilir. Prod sonrası "auth broke" raporu gelene kadar sessiz kırılma.
- **Fix direction:** İki seçenek:
  - **(a)** `e2e.yml`'i `ci.yml`'e `needs: test` ile chain et. Tam koruma ama CI süresi ~+5 dk.
  - **(b)** `e2e.yml`'i PR branch'lerde her push'ta otomatik çalışacak şekilde `on: pull_request` ile sürükle ve branch protection'a `e2e` check'i ekle. Mahmut repo admin olduğu için Settings → Branches → `main` → Require status checks → `e2e` kutusu.
- **Pinlenmiş test önerisi:** `scripts/verify.sh` içinde Phase 7 genişlet: `ci.yml` içinde `playwright` string'i aranmalı; yoksa fail. Script-level guard static.
- **Fix risk:** Düşük — CI süresi uzar, ama zaten Playwright fixtures sandboxed.

### 5.23 P2 — i18n scaffold vs translation drift (8 locales declared, 1 exists)

**DRIFT**

- **Evidence:**
  - `src/lib/i18n/config.ts:17-26` —
    ```ts
    export const SUPPORTED_LOCALES = [
      "en", "es", "de", "fr", "pt", "it", "nl", "ar",
    ] as const;
    ```
  - `src/lib/i18n/messages/` → yalnız `en.ts` var. Geri kalan 7 dil için mesaj dosyası **yok**.
  - `README.md:89-99` — "8 languages scaffolded: en, es, de, fr, pt, it, nl, ar (RTL)" ifadesi var.
- **Impact:** Marketing / pazarlama iddiası vs ürün gerçeği arasında drift. Bir kullanıcı `oneace-locale=de` cookie'si ile gelirse, fallback logic'i muhtemelen `en`'e düşer — ama uygulama "supports German" iddia eder. Localization launch planı kolayca yanlış hesaplanır (7 dilin dosyaları yazılmamışken "tercüme maliyeti $X" diyebilirsin, aslında sıfırdan başlıyorsun).
- **Fix direction:** İki yön:
  - **(a) Dürüst scaffold:** `SUPPORTED_LOCALES`'i sadece `["en"]` yap, README'yi "en only, architecture ready for more" diye güncelle. 1 satırlık değişiklik. v1.1 için bunu öner.
  - **(b) Stub dosyaları üret:** `messages/{es,de,fr,pt,it,nl,ar}.ts` oluştur, hepsi `en.ts`'in clone'u olsun + `TODO: translate` header. Bir translation vendor geldiğinde doldurulur. 7 dosya, dakikalar.
- **Pinlenmiş test önerisi:** `src/lib/i18n/locale-parity.test.ts` — `SUPPORTED_LOCALES` içindeki her locale için `messages/{locale}.ts` dosyası var mı? Şu an fail; (a) seçilirse dizi tek eleman, (b) seçilirse 8 dosya.
- **Fix risk:** Sıfır. Dürüstlük kararı.

### 5.24 P2 — Notification model has no retention or dedup policy

**MISSING**

- **Evidence:**
  - `prisma/schema.prisma` Notification modeli:
    ```prisma
    model Notification {
      id, organizationId, userId, alertId?, title, message, href?,
      readAt?, createdAt
      @@index([userId, readAt])
      @@index([organizationId, userId])
      @@index([alertId])
      @@index([organizationId])
    }
    ```
  - `expiresAt` **yok**. `dedupKey` **yok**. Cron job ile Notification temizliği **yok** (`vercel.json` yalnız `stock-count-triggers` ve `cleanup-migration-files`).
- **Impact:**
  1. **Unbounded growth.** Aktif org × 50 notification/gün × 365 → milyonlarca satır. Hot path sorgular (`(userId, readAt)` üzerinden unread count) hâlâ hızlı ama `count(*)` ve full-table scan sorguları (audit, export) yavaşlar.
  2. **Dup storm.** Aynı low-stock alert'i 3 defa aynı dakika içinde tetiklenebilir → kullanıcı 3 duplicate notification görür. Dedup key (`alertId + createdDay + userId` unique) yok.
- **Fix direction:**
  1. Migration: `ALTER TABLE Notification ADD COLUMN expiresAt TIMESTAMP; ADD COLUMN dedupKey VARCHAR(128); ADD UNIQUE INDEX (organizationId, userId, dedupKey).`
  2. Cron: `src/app/api/cron/cleanup-notifications/route.ts` — her gün 03:15'te `deleteMany({ expiresAt: { lt: now() } })` ve opsiyonel "readAt > 90 days ago" retention.
  3. Notification create action: `dedupKey = hash(alertId + day + userId)` → `createMany({ skipDuplicates: true })`.
- **Pinlenmiş test önerisi:** (a) Prisma schema static check: Notification model'ında `expiresAt` field'ı mevcut. (b) Dedup key: aynı key ile iki çağrı → yalnız 1 satır.
- **Fix risk:** Migration var (orta); ama yalnız nullable kolon ekleme → geri alınabilir.

### 5.25 P2 — No keyboard-accessible skip link to main content

**MISSING**

- **Evidence:**
  - `src/app/(app)/layout.tsx:146` — `<main id="main-content" ...>` var. Id doğru, hazır.
  - `grep -rn "skip.*main\|sr-only.*skip\|href=\"#main-content\"" src` → **uygulama kodunda sıfır sonuç** (yalnız `src/generated/prisma/runtime/` içinde alakasız match).
- **Impact:** WCAG 2.1 AA best practice ihlali (SC 2.4.1 Bypass Blocks). Klavye navigasyonu yapan veya ekran okuyucu kullanan bir kullanıcı, her sayfada sidebar'ın 15+ linkine tab ederek geçmek zorunda. İlk `Tab` atıldığında "Skip to main content" linki görünmüyor.
- **Fix direction:** `src/app/(app)/layout.tsx`'te `<main>`'den önce:
  ```tsx
  <a
    href="#main-content"
    className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground focus:shadow-lg"
  >
    Skip to main content
  </a>
  ```
- **Pinlenmiş test önerisi:** `src/app/a11y-skip-link.test.ts` — static: `layout.tsx`'te `href="#main-content"` pattern'i mevcut. Tek satırlık guard.
- **Fix risk:** Sıfır. Pure ekleme, tek utility zinciri ile.

### 5.26 P2 — Supply chain automation missing (no Renovate/Dependabot, no `engines`/`packageManager`)

**MISSING**

- **Evidence:**
  - `.github/` → yalnız `workflows/` klasörü. **`dependabot.yml` yok**, root'ta `renovate.json` yok.
  - `package.json` top level → `engines` alanı **yok**, `packageManager` alanı **yok**. Node sürümünü dokümante eden tek yer `.github/workflows/ci.yml:41` (`node-version: "20"`).
- **Impact:**
  1. **CVE gecikmesi.** Bir bağımlılıkta yüksek CVE çıkarsa (örn. `next`, `@prisma/client`, `stripe`), otomatik PR yok; manuel `pnpm outdated` + update gerekir. Tipik gecikme: 1-4 hafta.
  2. **Reprodüksiyon zayıflığı.** Yeni bir developer `node v18` veya `pnpm v8` ile repo açarsa, `pnpm install` ya kırılır ya da subtle farklarla geçer. `packageManager` alanı Corepack ile enforce ederdi.
- **Fix direction:**
  1. `.github/dependabot.yml` → haftalık npm güncellemeleri, major bump'lar ayrı PR, github-actions için de ayrı schedule.
  2. `package.json` → `"engines": { "node": ">=20.0.0", "pnpm": ">=9.0.0" }`, `"packageManager": "pnpm@9.12.0"` (CI ile eşleşen versiyon).
- **Pinlenmiş test önerisi:** `scripts/verify.sh` Phase 3'e ek: `.github/dependabot.yml` var mı? `package.json`'da `engines.node` set edilmiş mi?
- **Fix risk:** Sıfır. Konfigürasyon.

### 5.27 P2 — Cron routes lack idempotency guards

**MISSING**

- **Evidence:**
  - `vercel.json:5-13` — 2 cron:
    ```json
    { "path": "/api/cron/stock-count-triggers", "schedule": "0 0 * * *" },
    { "path": "/api/cron/cleanup-migration-files", "schedule": "0 3 * * *" }
    ```
  - `src/app/api/cron/stock-count-triggers/route.ts` — CRON_SECRET header check ✓; idempotency key / `lastRunAt` check **yok**.
  - `src/app/api/cron/cleanup-migration-files/route.ts` — aynı pattern.
  - `src/app/api/cron/process-imports/route.ts` — vercel.json dışı; tetiği belirsiz.
- **Impact:** Vercel Cron, fonksiyon 5xx döndürürse retry eder (default policy). `cleanup-migration-files` handler'ı yarıda düşerse, ikinci çağrı aynı dosyaları silmeye çalışır → hata veya çift silme. `stock-count-triggers` için daha riskli: potansiyel olarak aynı gün iki kez sayım tetikleyebilir.
- **Fix direction:** Her cron route'a guard ekle:
  ```ts
  const runId = `cron:${name}:${new Date().toISOString().slice(0, 10)}`;
  await db.cronRun.upsert({
    where: { runId },
    create: { runId, startedAt: new Date() },
    update: {},
  });
  if (await db.cronRun.findUnique({ where: { runId, completedAt: { not: null } } })) {
    return NextResponse.json({ ok: true, skipped: "already ran today" });
  }
  // ... iş
  await db.cronRun.update({ where: { runId }, data: { completedAt: new Date() } });
  ```
- **Pinlenmiş test önerisi:** `src/app/api/cron/idempotency.test.ts` — her cron route için static: dosya içinde `CronRun` (veya eşdeğer) upsert/findUnique pattern'i grep'lenmeli.
- **Fix risk:** Düşük — yeni Prisma modeli (`CronRun`) ve her route için ~10 satır.

### 5.28 P2 — Email bounce/complaint webhook missing

**MISSING**

- **Evidence:**
  - `src/lib/mail/resend-mailer.ts` → `send()` implementasyonu var; Resend SDK retry handle eder.
  - `src/app/api/webhooks/` altında `resend/route.ts` **yok**. Bounce/complaint event'ini ingest eden hiçbir endpoint bulunmadı.
  - `User` Prisma modelinde `emailIsInvalid` veya benzeri bayrak yok.
- **Impact:** Hard-bounce eden bir email adresine sonsuza dek davetiye, parola reset, billing notification gönderilmeye devam edilir. Resend reputation'u erozyona uğrar (send-to-invalid ratio domain reputation'u düşürür). Maliyet: Resend plan'ının bounce rate limit'ini zorlar; GDPR `unsubscribe`/`opt-out` kayıtları tutulmaz.
- **Fix direction:**
  1. Resend Dashboard → Webhooks → `https://oneace.com/api/webhooks/resend` URL'si ekle (`bounced`, `complained`, `unsubscribed` event'leri).
  2. `src/app/api/webhooks/resend/route.ts` → Resend signing secret verify (`Resend-Signature` header) → olayları `User.emailStatus` kolonuna yaz.
  3. `resend-mailer.ts` → send öncesi `user.emailStatus !== 'BOUNCED'` kontrolü.
- **Pinlenmiş test önerisi:** (a) `src/app/api/webhooks/resend/route.test.ts` — HMAC signature verify (v1.0 Shopify webhook pattern'ını klonla). (b) `resend-mailer.test.ts` — `send()` çağrıldığında BOUNCED user'a 0 çağrı geçer.
- **Fix risk:** Orta. Yeni modeller + yeni webhook + Resend signing key env var.

### 5.29 P3 — Vitest coverage threshold not configured

**MISSING**

- **Evidence:**
  - `vitest.config.ts` — `test:` config'inde `coverage` bloğu yok.
  - `pnpm test` → yalnız pass/fail, coverage raporlamaz.
- **Impact:** Düşüş sessiz. v1.0 80 test ekledi; bir PR test'i kaldırabilir (örn. `describe.skip`) ve CI yeşil kalır. Coverage baseline olmadan regresyon tespiti el ile.
- **Fix direction:**
  ```ts
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      thresholds: { lines: 40, functions: 40, branches: 30, statements: 40 },
      exclude: ["src/generated/**", "src/**/*.test.ts", "e2e/**"],
    },
  },
  ```
  İlk iterasyonda threshold'ları mevcut coverage seviyesinde bırak (ramp-up later).
- **Pinlenmiş test önerisi:** `scripts/verify.sh` Phase 7 ek: `vitest.config.ts`'te `coverage:` bloğu grep'le, yoksa fail.
- **Fix risk:** Sıfır. Konfigürasyon.

### 5.30 P3 — API input validation missing on 2 mutation routes

**DRIFT**

- **Evidence:**
  - `src/app/api/billing/checkout/route.ts:69-88` — body parse inline:
    ```ts
    const body = await request.json();
    if (body.plan !== "PRO" && body.plan !== "BUSINESS") return 400;
    plan = body.plan;
    if (body.interval === "year") interval = "year"; // else silently monthly
    ```
    zod yok; `interval` için invalid değer sessizce `monthly`'ye düşer — kullanıcıya geri bildirim yok.
  - `src/app/api/account/delete/route.ts:42+` — `await request.json().catch(() => ({}))` → body zod ile parse edilmiyor, confirmation phrase inline check.
  - Diğer 40 route zod ile parse ediyor → iki route drift halinde.
- **Impact:** Düşük. İki route da defensive (401/403 önce dönüyor, body validation beklenmeyen field'a yanıt vermiyor). Risk: (a) yeni developer aynı pattern'i kopyalar → drift yayılır; (b) Stripe `interval` invalid değerle sessiz fallback kullanıcı şaşırtır ("I selected yearly but got monthly").
- **Fix direction:**
  ```ts
  const CheckoutSchema = z.object({
    plan: z.enum(["PRO", "BUSINESS"]),
    interval: z.enum(["month", "year"]).default("month"),
  });
  const parsed = CheckoutSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  ```
  account/delete için aynı pattern confirmation phrase ile.
- **Pinlenmiş test önerisi:** `src/lib/api-validation.test.ts` — her `src/app/api/**/route.ts` dosyasında `await request.json()` varsa, dosyada `zod` import'u veya `.safeParse(`/`.parse(` pattern'i de bulunmalı. 2 route şu an fail eder.
- **Fix risk:** Sıfır.

### 5.31 P3 — Repo hygiene: untracked artifacts, generic CLAUDE.md

**DRIFT**

- **Evidence:**
  - `git status --short`:
    ```
    ?? TEST_REPORT.md
    ?? src/app/_unused_onboarding_copy/
    ?? test-artifacts/
    ```
    `.gitignore`'da değiller.
  - Root `CLAUDE.md` → global RuFlo v3 template, OneAce'e özel mimari kararları dökümante etmiyor (i18n approach, capability model, soft-delete pattern, cron secret rotation).
- **Impact:** (a) `test-artifacts/` Playwright output'u — her E2E run'da diff üretir; commit bile edilebilir. (b) `_unused_onboarding_copy/` ölü kod, ne zaman silinmesi gerektiği belirsiz. (c) Yeni bir geliştiriciye repo'ya yön verecek "OneAce-specific" bir CLAUDE.md yok → architecture knowledge sadece `docs/`'ta dağınık.
- **Fix direction:**
  1. `.gitignore`'a ekle: `/test-artifacts/`, `/TEST_REPORT.md` (eğer geçiciyse), `/test-results/`.
  2. `_unused_onboarding_copy/` → sil veya branch'a taşı (v1.0 onboarding işini kapattıktan sonra artık referans değer taşımıyor).
  3. `CLAUDE.md` üzerine bir `## OneAce Architecture` bölümü ekle (100-150 satır): capability model, soft-delete lib, analytics taxonomy, i18n config, cron contract.
- **Pinlenmiş test önerisi:** `scripts/verify.sh` içinde Phase 1 genişlet: `test-artifacts/` veya `TEST_REPORT.md` git'te tracked mi? Eğer evet → warn.
- **Fix risk:** Sıfır.

### 5.32 P3 — OpenAPI spec drift risk (no automated sync check)

**DRIFT riski**

- **Evidence:**
  - `docs/openapi.yaml` var. Version `1.0.0`. Manuel yazılmış (auto-generated değil).
  - `src/app/api/` altında 42 route, `openapi.yaml` içindeki path sayısı doğrudan sayılmadı ama manuel sync gerektiren bir senaryoda tipik olarak 1-2 sürüm sonra drift başlar.
  - CI'da `openapi diff` veya benzeri validation adımı yok.
- **Impact:** Partnerlerin "API contract" olarak güvendiği tek doc kayma riski altında. Yeni bir endpoint eklenirse (v1.0 rc14 içinde 42 route var; rc3'te 23'tü v1.0'a göre), openapi.yaml elle güncellenmezse doc gerçekle eşleşmez.
- **Fix direction:**
  1. `next-openapi-router` veya benzeri ile auto-generate (büyük refactor).
  2. **VEYA daha hafif:** Her `src/app/api/**/route.ts` içinde yorum satırı olarak `@openapi-tag: <path>` header'ı + bir static test (`scripts/verify.sh` Phase 7) bu header'ı `docs/openapi.yaml`'de var mı diye kontrol eder. Drift yakalar ama otomatik üretmez.
- **Pinlenmiş test önerisi:** `src/lib/openapi-parity.test.ts` — route.ts içindeki her `export async function (POST|GET|…)` için openapi.yaml'de `path + method` var mı?
- **Fix risk:** Düşük (test-only), gerçek generator'a geçiş ayrı proje.

---

## 6. Test Confidence Deep-dive

### 6.1 Mevcut test şekli

- Unit/integration: 63 test dosyası, 972 test (vitest).
- Test türü dağılımı:
  - **Static-analysis guard'ları** (~40): CSP header regex, empty state adoption, dialog a11y, soft-delete lint, hot-path index, service-worker cache list
  - **Utility tests** (~15): logger, date formatting, permissions, rate-limit math
  - **Component tests** (~5): form behavior (JSDOM), image-upload
  - **Server action behavior tests:** 0
- E2E: 14 Playwright spec, happy-path dominant.

### 6.2 Kapsanmayan yüzey

| Yüzey | Test tipi ihtiyacı | Öncelik |
|---|---|---|
| `purchase-orders/actions.ts` — receive/close/cancel | Behavior (Prisma + state machine) | Yüksek |
| `transfers/actions.ts` — commit/cancel | Behavior + idempotency | Yüksek |
| `migrations/actions.ts` — import pipeline | Integration (sample CSV → DB) | Yüksek |
| `stock-counts/actions.ts` — count/rollback | v1.0 static var; behavior eksik | Yüksek |
| `kits/actions.ts` — kit build, disassemble | Behavior | Orta |
| `picks/actions.ts` — pick/allocate | Behavior | Orta |
| Webhook idempotency (Stripe, Shopify) | Replay test | Orta |
| `/api/reports/*` | Contract test (known input → known output row count) | Orta |
| Dashboard data (KPI cards) | Data trust regression | Düşük |

### 6.3 İlk 3 teste başla

`5.19`'da önerilen pattern. Hedef: 1 sprint içinde 3 hot action için 3 test dosyası (toplam ~200 satır test + fixtures).

---

## 7. Analytics / Data Trust Report v1.1

### 7.1 v1.0'dan kalan konu

v1.0 dashboard'daki **sentetik** trend'i sildi; yerine gerçek query koydu. İyi. Ama şunu da yaptı: **ölçüm API'sini build etti (AnalyticsEvents) ama tetikleyicileri yerleştirmedi**.

### 7.2 Aspirational event'ler

`src/lib/analytics/events.ts` içinde **call-site'ı olmayan 19 event**:

| Event | Olması gereken tetik yeri |
|---|---|
| `SIGNUP_COMPLETED` | `better-auth` sign-up callback veya `/api/auth/sign-up` success |
| `FIRST_ITEM_CREATED` | `items/actions.ts` içinde org'un ilk item'ı mı kontrolü ile |
| `FIRST_WAREHOUSE_CREATED` | `warehouses/actions.ts` ilk create |
| `FIRST_SCAN` | Barcode scanner component mount/first scan |
| `FIRST_COUNT_COMPLETED` | `stock-counts/actions.ts` complete action'ı ilk mi |
| `ONBOARDING_COMPLETED` | Onboarding wizard final step |
| `UPGRADE_CLICKED` | Billing CTA button `onClick` |
| `CHECKOUT_STARTED` | `/api/billing/checkout` 200 response |
| `SUBSCRIPTION_CREATED` | Stripe webhook `customer.subscription.created` |
| `ITEM_CREATED` | `items/actions.ts` create (her çağrıda, FIRST ile değil) |
| `MOVEMENT_LOGGED` | `items/actions.ts` movement record |
| `COUNT_STARTED` | `stock-counts/actions.ts` start |
| `REPORT_VIEWED` | Report page client-side mount (`useEffect(..., [])`) |
| `REPORT_EXPORTED` | Export server action başarılıysa |
| `PO_CREATED` | `purchase-orders/actions.ts` create |
| `TWO_FACTOR_ENABLED` | `settings/security/actions.ts` TOTP confirm |
| `BIN_CREATED` | `warehouses/[id]/bins/actions.ts` create |
| `BARCODE_SCANNED` | Her scan (yüksek hacim; sample etmek mantıklı) |
| `ITEM_IMAGE_UPLOADED` | ✓ (tek kapsanmış event) |

### 7.3 Funnel doğrulaması

Event'ler dolduruldukça PostHog'da aşağıdaki funnel'ları 1 haftada görebilmek hedef:

1. `SIGNUP_COMPLETED` → `FIRST_WAREHOUSE_CREATED` → `FIRST_ITEM_CREATED` → `FIRST_SCAN` (activation funnel)
2. `CHECKOUT_STARTED` → `SUBSCRIPTION_CREATED` (monetization conversion)
3. `COUNT_STARTED` → `FIRST_COUNT_COMPLETED` (core feature adoption)

Şu an hiçbir funnel çalışmıyor — PostHog boş.

### 7.4 PII hygiene

`src/lib/analytics/events.ts:65` — `posthog.capture(event, properties)` — properties objesinin PII içermediği garanti değil. v1.0 `logger`'da PII koruması iyi (email/password/token yok). Analytics layer'da da aynı guard gerekli: `properties` içinde `email`, `password`, `phone`, `address` key'leri olursa scrub'la.

**Öneri (P3, §5.30'a dahil edilebilir):** `trackEvent` wrapper'ında key denylist.

---

## 8. Error Boundary Topology

### 8.1 Next.js convention recap

Next 15 App Router'da her route segment kendi `error.tsx`'ini tanımlayabilir. Hata en yakın boundary'de yakalanır; ulaşmazsa parent'a yükselir. Shell-level (`(app)/error.tsx`) her şeyi yakalar ama shell'in kendisini kırar.

### 8.2 Mevcut boundary haritası

```
src/app/
├── global-error.tsx          ← root (Sentry capture + minimal UI)
├── (app)/
│   ├── error.tsx             ← app shell level
│   ├── dashboard/            (error.tsx YOK)
│   ├── reports/              (error.tsx YOK)  ← yüksek risk (Prisma heavy)
│   ├── items/                (error.tsx YOK)
│   ├── warehouses/           (error.tsx YOK)
│   ├── purchase-orders/      (error.tsx YOK)  ← state machine heavy
│   ├── stock-counts/         (error.tsx YOK)  ← state machine heavy
│   ├── migrations/           (error.tsx YOK)  ← file processing heavy
│   ├── transfers/            (error.tsx YOK)
│   ├── picks/                (error.tsx YOK)
│   └── settings/             (error.tsx YOK)
└── (auth)/                   (error.tsx YOK)  ← auth flow için önerilir
```

### 8.3 Öncelik sırası

1. `reports/error.tsx` — en yüksek trafik, en karmaşık Prisma sorguları
2. `purchase-orders/error.tsx` — state machine, `IllegalStateError` ihtimali
3. `stock-counts/error.tsx` — state machine
4. `migrations/error.tsx` — kullanıcı dosyası işliyor; file corruption durumları
5. `transfers/error.tsx`
6. `(auth)/error.tsx` — sign-in flow'da bir hata olduğunda kullanıcı "giriş yapamıyorum" demeli, blank screen değil

Her bir `error.tsx` yaklaşık 40-60 satır (Sentry capture + friendly UI + retry button).

---

## 9. i18n Deep-dive

### 9.1 Mevcut mimari

- `src/lib/i18n/config.ts` — `SUPPORTED_LOCALES`, `DEFAULT_LOCALE`, `RTL_LOCALES`, `RegionConfig` (currency, numberLocale, defaultTimeZone).
- `src/lib/i18n/messages/en.ts` — tek gerçek mesaj dosyası.
- Middleware locale cookie check'i muhtemelen var (v1.0 §5.5 middleware remediation sırasında dokunuldu).
- Region'lar ayrı eksen (iyi ayrım: locale ≠ region; İngilizce konuşan ama İsviçre fiyatlandırması isteyen kullanıcı için mantıklı).

### 9.2 Drift detayı

`SUPPORTED_LOCALES = ["en", "es", "de", "fr", "pt", "it", "nl", "ar"]` — 7 dil için `messages/*.ts` yok. Runtime'da:
- Eğer fallback = strict, çağrı undefined key'de crash eder → hiçbir kullanıcı Türkçe ayarlasa bile dashboard açılır (en fallback).
- Eğer fallback = en → tüm UI İngilizce gözükür, cookie `es`, `de`, etc. teatral kalır.

### 9.3 Tavsiye (§5.23'te tekrar)

**Dürüst** seçenek: `SUPPORTED_LOCALES = ["en"] as const` + README'yi güncelle. i18n altyapısı hazır, tercüme aldığımızda bir satırı değiştir.

**Alternatif:** 7 stub dosya (`es.ts` ... `ar.ts`) hepsi `en.ts` clone'u + "TODO: translate" + analytics event `i18n.missing_translation` (v1.1'e +1 event).

---

## 10. Notification Integrity Deep-dive

### 10.1 Mevcut durum

- Model: `Notification` (cuid, org+user scoped, readAt, alert ref).
- UI: `src/components/shell/notification-center.tsx`.
- Layout bir `getNotificationData()` çağrısı ile unread count'ı header'a basar (v1.0 sonrası cache'li).
- Mark-as-read API: muhtemelen `/api/notifications/*` — mevcut ama kapsamı doğrulanmadı.

### 10.2 Eksikler

1. **Retention.** Migration gerek (`expiresAt`, default = `createdAt + 90d`).
2. **Dedup.** `dedupKey` kolonu + unique index.
3. **Cleanup cron.** Günlük `deleteMany({ expiresAt: { lt: now() } })`.
4. **Mark-as-read race condition.** İki tab açık, ikisi de mark-as-read basarsa → 409 beklenir; şu an muhtemelen "last write wins". Düşük ciddiyet ama bir concurrency test'i değer.

### 10.3 Data health query (sanity check)

v1.1 remediation başlamadan önce prod'da tek seferlik:

```sql
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE "readAt" IS NULL) AS unread,
  MIN("createdAt") AS oldest,
  COUNT(DISTINCT "organizationId") AS orgs_with_notif
FROM "Notification";
```

Eğer `oldest` > 6 ay → retention ihtiyacı aciliyet kazanır.

---

## 11. Accessibility Beyond Dialogs

v1.0 §9.4 dialog a11y + `DialogDescription` sweep kapsadı. Kalan (WCAG 2.1 AA eksenleri):

| Alan | Durum | Öneri |
|---|---|---|
| Skip link to main | **MISSING** (§5.25) | Layout'a ekle, tek satır |
| Landmarks (`<main>`, `<nav>`) | `<main id="main-content">` var | Navigasyon için `<nav aria-label="Primary">` sidebar'da mevcut mu? (doğrulanacak) |
| Form labels (`htmlFor`/`id`) | `src/components/ui/form.tsx` shadcn pattern korur | OK — spot check yapılmalı ama default iyi |
| Focus trap (popover, dropdown) | Radix default trap yapar | OK |
| `prefers-reduced-motion` | `globals.css:685` var ✓ | OK (v1.1 design audit "yok" diyordu — yanlış pozitif) |
| Skip link | **YOK** | §5.25 |
| `tabindex` misuse | Grep temiz | OK |
| Color contrast | v1.0 §9 ve design audit zaten kapsadı | Ayrı eksen |
| ARIA live regions (toast, notifications) | Sonner default `role="status"` var | OK |

---

## 12. Supply Chain & Reproducibility

### 12.1 Paket manifest

`package.json`:
- 50+ runtime dep, 30+ dev dep.
- Version pinleme: çoğu `^` (minor bump serbest). `stripe ^17`, `@prisma/client ^6.1`, `better-auth ^1.1.9`, `next ^15`.
- **Yok:** `engines`, `packageManager`, `overrides` (alt dep pinleme).

### 12.2 Lockfile

`pnpm-lock.yaml` mevcut. CI `pnpm install --frozen-lockfile` ile reproducibility sağlar — **iyi**.

### 12.3 Otomasyon eksiği

- Dependabot yok.
- Renovate yok.
- `pnpm audit` CI'da yok.
- SBOM üretimi yok.

### 12.4 Öneri (§5.26)

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule: { interval: "weekly", day: "monday" }
    open-pull-requests-limit: 5
    groups:
      prod:
        dependency-type: "production"
      dev:
        dependency-type: "development"
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule: { interval: "monthly" }
```

```json
// package.json ekleme
"engines": { "node": ">=20.0.0", "pnpm": ">=9.0.0" },
"packageManager": "pnpm@9.12.0"
```

---

## 13. Cron / Scheduled Jobs

### 13.1 Mevcut cron'lar

| Path | Schedule | CRON_SECRET | Idempotency |
|---|---|---|---|
| `/api/cron/stock-count-triggers` | Günlük 00:00 UTC | ✓ | ✗ |
| `/api/cron/cleanup-migration-files` | Günlük 03:00 UTC | ✓ | ✗ |
| `/api/cron/process-imports` | vercel.json dışı | ✓ | ✓ (tek job/call design) |

### 13.2 Önerilen `CronRun` modeli

```prisma
model CronRun {
  runId       String   @id    // "cron:stock-count-triggers:2026-04-18"
  startedAt   DateTime @default(now())
  completedAt DateTime?
  error       String?
  @@index([startedAt])
}
```

### 13.3 Guard pattern

Her cron handler'ın ilk 10 satırı standardize edilmeli. `src/lib/cron/withIdempotency.ts` helper'ı yaz:

```ts
export async function withCronIdempotency<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<T | { skipped: true }> {
  const runId = `cron:${name}:${new Date().toISOString().slice(0, 10)}`;
  // ... upsert + check completedAt + run + update
}
```

---

## 14. Email / Transactional

### 14.1 Mevcut pipeline

- Gönderim: Resend (`src/lib/mail/resend-mailer.ts`).
- Template'ler: `src/lib/mail/templates/` (invitation-email, welcome-email, billing-emails).
- Dev fallback: ConsoleMailer (`RESEND_API_KEY` yoksa).
- Retry: Resend SDK handle eder.

### 14.2 Eksikler

1. **Bounce/complaint webhook** (§5.28).
2. **Unsubscribe flow** — `<unsubscribe@oneace.com>` veya `List-Unsubscribe` header. Legal zorunluluk (CAN-SPAM + RFC 8058).
3. **Email template preview** — dev'de render edilemiyor. `@react-email/preview` entegrasyonu 1-2 saatlik iş.

### 14.3 Kritik yolda görünürlük

Resend dashboard'da:
- Send rate
- Bounce rate (şu an invisible — webhook yok)
- Complaint rate
- Delivered-to-failed ratio

Kritik eşik: bounce rate > 5% → Resend otomatik send'i throttle'ler.

---

## 15. Sıralı Remediation Backlog (Phase-2 Execution Prompt)

v1.0 protokolünü tekrar kullan: tier-by-tier, her fix + pinlenmiş test, auto-commit, tier kapanışında tag.

### 15.1 Phase 2.1 (P1 — 4 finding)

Tag hedefi: `v1.1.0-rc1-p1-remediations`

1. **§5.19** Server action behavior tests — minimum 3 action (PO receive, transfer commit, stock-count rollback-confirm) için behavior test + Prisma test fixture
2. **§5.20** Analytics trigger propagation — 19 event için call-site yerleştir; pinlenmiş test: `events.test.ts` taxonomy-to-callsite parity
3. **§5.21** Error boundary topology — 6 route group için `error.tsx` + static existence test
4. **§5.22** CI E2E gate — `ci.yml`'e Playwright job ekle veya `e2e.yml`'i `needs: test` ile chain'le; verify.sh guard

### 15.2 Phase 2.2 (P2 — 6 finding)

Tag: `v1.1.0-rc2-p2-remediations`

5. **§5.23** i18n drift — `SUPPORTED_LOCALES` = `["en"]` VE/VEYA 7 stub dosya; README güncelle
6. **§5.24** Notification retention/dedup — migration (expiresAt, dedupKey) + cleanup cron + create action dedup
7. **§5.25** Skip link — layout.tsx'e tek `<a href="#main-content" sr-only focus:...>` + static test
8. **§5.26** Supply chain — dependabot.yml + package.json engines/packageManager
9. **§5.27** Cron idempotency — `CronRun` modeli + `withCronIdempotency` helper + 2 route'a uygulama
10. **§5.28** Email bounce/complaint — Resend webhook + User.emailStatus kolonu + send guard

### 15.3 Phase 2.3 (P3 — 4 finding)

Tag: `v1.1.0-rc3-p3-remediations`

11. **§5.29** Vitest coverage threshold — config + verify.sh guard
12. **§5.30** API input validation parity — 2 route'u zod'a çevir + `api-validation.test.ts`
13. **§5.31** Repo hygiene — `.gitignore` updates, `_unused_onboarding_copy/` removal, CLAUDE.md architecture section
14. **§5.32** OpenAPI parity test — static check

### 15.4 Stable branch updates

Her tier kapandığında:
```bash
git tag -a v1.1.0-rcN-pX-remediations -m "v1.1 PX remediations: <count> findings closed"
git branch -f stable HEAD
```

---

## 16. Definition of Done (v1.1 revision)

v1.0 §5.19 `Q5` sorusunda "definition of done inconsistent" dedi ama DoD yazmadı. v1.1 onu bu bölümde çözüyor:

Bir server action / API route / feature "done" sayılır, sadece ve sadece:

1. **İmza + Behavior test** — happy path + 1 error path pinlenmiş
2. **Audit log** — user-driven state change ise `recordAudit()` çağrısı
3. **Idempotency** — POST/PATCH ise `IdempotencyKey` kontratı (webhook'larda zaten var)
4. **Capability check** — `hasCapability(role, action)` server-side
5. **Input validation** — zod schema + `.safeParse()`
6. **Analytics event** — user milestone ise `trackEvent(AnalyticsEvents.X, ...)`
7. **Error boundary** — hosting page'in segment-level `error.tsx`'ini kırmıyor
8. **i18n** — user-facing string `messages/en.ts`'te key olarak (hardcoded değil)

Bir PR checklist'i olarak:
```md
- [ ] Unit/behavior test eklendi
- [ ] Audit log var (veya not-applicable)
- [ ] Idempotency guard (mutation için)
- [ ] Capability check
- [ ] zod validation
- [ ] Analytics event (activation/retention için)
- [ ] Error boundary var (segment'te)
- [ ] Hardcoded string yok (i18n key kullanıldı)
```

Bu liste `.github/pull_request_template.md` dosyasına taşınırsa her PR'da görünür.

---

## 17. Denetim Kapanışı

v1.0 "sessiz yalanları" susturdu. v1.1 "sessiz boşlukları" kapatmayı hedefliyor — kullanıcı görünmez ama product ve ops takımının uyuyamadığı boşluklar:
- Ölçmediğimiz activation,
- Test etmediğimiz hot path,
- Yakalayamadığımız hata,
- Döndüremediğimiz bağımlılık,
- Geri dönemediğimiz cron.

14 finding. P0 yok — şu anki baseline (`v1.0.0-rc14-p3-remediations`) **launch-safe**. v1.1 remediation'ı launch sonrası sprint-1'e bırakılabilir, ama §15.1 P1'leri (özellikle §5.20 analytics ve §5.22 CI E2E) launch'tan **önce** kapatılması güçlü şekilde önerilir.

Önerilen sonraki adım: v1.1 Phase-2.1'e başla. Komut:

```
Read ONEACE-FULL-STACK-AUDIT-v1.1.md §5.19, §5.20, §5.21, §5.22.
For each finding: fix → pin with test → auto-commit.
Tag v1.1.0-rc1-p1-remediations when tier closes.
Move `stable` to the tag.
```

— Son (v1.1 dossier). Remediation başladığında commit message'larına `§N.M` citation'u eklenmeli; v1.0 ile aynı protokol.
