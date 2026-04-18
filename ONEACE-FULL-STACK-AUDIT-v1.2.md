# OneAce — Full-Stack Audit Dossier v1.2

**Proje:** OneAce (Next.js 15 Inventory / WMS SaaS)
**Repo:** `github.com/mahmutseker79/Oneace`
**Çalışma ağacı:** `~/Documents/Claude/Projects/OneAce/oneace`
**Deployed:** https://oneace-next-local.vercel.app
**Denetim anındaki sürüm:** `v1.1.3-auth-429-message` (HEAD = `1d8ceb5`, `stable` henüz FF edilmedi — push sonrasında hizalanacak)
**Denetim tarihi:** 2026-04-18
**Denetim kapsamı:** v1.0 + v1.1 remediation'ından sonra geriye kalan "ikinci halka" riskleri — (a) ölçüm **doğruluğu** (v1.1 ölçümü "başlattı", v1.2 "doğruladı" katmanı), (b) Phase-2 için kör nokta bırakan sistemik test boşlukları, (c) ops-side hazırlık (DR, session revocation), (d) launch sonrası polish (stale generated dirs, perf budget). v1.1'in kapattığı analytics taxonomy ve error boundary topology bulguları burada yeniden açılmıyor; onların **follow-through** eksikleri açılıyor.
**Yazar:** Claude (God-Mode audit protocol — v1.2 ikinci-halka delta)

> **Okuma kontratı.** v1.0 (24 finding) ve v1.1 (14 finding) remediation'ları bu doküman boyunca **tamamlanmış sayılır**. Aşağıdaki bulgular ya (a) v1.1 remediation'ının bıraktığı follow-through boşluklarını, ya (b) v1.0 + v1.1 kapsamı dışında kalmış yüzeyleri gösterir. Her bulgu yine file:line evidence ile bağlı ve pinlenmiş-test workflow'u için hazır. Bağlayıcı bölümler: §5 bulgu sıralı listesi ve §15 faz-3 execution prompt'u.

---

## 0. Bu dokümanı nasıl okumalı

- **Severity:** `P0` = ship-blocker / veri kaybı; `P1` = sessiz güven erozyonu veya ops kör noktası; `P2` = kullanıcı-görünür pürüz veya tek-sprint iş; `P3` = polish; `P4` = nice-to-have.
- **Status etiketleri:** `DARK` (telemetri var, ama bulgu "bir adım fazla" istiyor), `ASPIRATIONAL` (kod spec ediyor, uygulama tetiklemiyor), `DRIFT` (doc vs kod, veya kod vs kod), `UNTESTED` (hot path, neighbor test yok), `MISSING` (kategori tamamen yok), `FOLLOW-THROUGH` (v1.1 "başladı", v1.2 "doğrula" istiyor).
- **Evidence formatı:** `src/<path>:<line>` — `oneace/` root'a göreli. v1.1 denetimine göre satır numaraları **HEAD = 1d8ceb5** anında geçerlidir.
- **v1.0/v1.1'e referans:** `(v1.X §N.M kapsamında değildi)` ya da `(v1.X §N.M follow-through)` notu hangi pencerenin açıldığını kanıtlar.

---

## 1. Yönetici Özeti

v1.0 "sessiz yalanları" kapattı. v1.1 "sessiz boşlukları" kapattı. v1.2'nin odağı **ikinci halka**:

1. **Ölçüm doğrulama boşluğu.** v1.1 §5.20 analytics taxonomy'yi yerleştirdi: `track()` + `AnalyticsEvents` + `events.ts`'de 19 event sabiti. Bugün 19 event'ten yalnızca **4'ü** bir UI/action call-site'ı tarafından tetikleniyor (`SIGNUP_COMPLETED`, `ONBOARDING_COMPLETED`, `TWO_FACTOR_ENABLED`, `ITEM_IMAGE_UPLOADED`). Activation hunisi için kritik 6 event hâlâ boş: `FIRST_ITEM_CREATED`, `FIRST_WAREHOUSE_CREATED`, `FIRST_SCAN`, `FIRST_COUNT_COMPLETED`, `ITEM_CREATED`, `MOVEMENT_LOGGED`. v1.1'in "scaffold + parity test" işi doğru — ama **propagasyon** eksik kaldı. (§5.33)
2. **Rate-limit coverage asimetrisi.** 44 API route'un yalnızca **19'u** `rateLimit` veya `withRateLimit` ile sarılı. Kalan 25 route arasında: `/api/items/*`, `/api/stock-counts/*`, `/api/migrations/*` (upload/start hariç), `/api/notifications`, `/api/integrations/*`. Perimeter-auth (v1.0 §5.11) ayakta, ama enumerable endpoint'lerin tümü paralel brute-force hedefi. (§5.34)
3. **GDPR delete cascade testsizliği.** `POST /api/account/delete` (v1.1 §5.30'da zod'a çevrilmiş) manual `deleteMany` çağrıları zinciri ile ilerliyor — ama 69 modelli şemada `User` → 23 doğrudan FK relation'ı var; yalnızca 4'ünün (`membership`, `session`, `account`, `twoFactorAuth`) manual silme kaydı var. Kalanlar Prisma `onDelete: Cascade` veya `onDelete: SetNull`'a güveniyor — ama bu inançla; herhangi bir **davranış testi yok**. Hukuki olarak "sildik" dediğimiz bir kullanıcının arkasında hangi kayıtlar kalır? Şu an cevap testle değil, şemayı okuyarak. (§5.35)

Bunların yanında 9 ikincil bulgu: state machine neighbor test eksiği (§5.36), social/OG metadata seyrekliği (§5.37), DR rehearsal evidence'ı doc-only (§5.38), admin session revocation UI'ı yok (§5.39), WCAG AA full sweep yapılmadı (§5.40), 124MB stale Prisma generated artefact'ları (§5.41), Sentry trace sample rate hardcoded 0.1 (§5.42), bundle/perf budget yok (§5.43), `CronRun` ledger retention'sız (§5.44).

### 1.1 Olgunluk skor kartı (v1.1 → v1.2 delta)

| Boyut | v1.1 | v1.2 | Gerekçe |
|---|---:|---:|---|
| Product / IA | 7.5 | 7.5 | Stabil — yeni IA regresyonu yok |
| Onboarding / Activation | 5 | **5.5** | 4 event tetikleniyor (v1.1'de 3'tü); huninin başı ölçülebilir, ortası değil (§5.33) |
| Frontend / UI polish | 8 | 8 | Değişim yok |
| UX / Workflow correctness | 8 | 8 | State machine'ler tanımlı; ama behavior testi sadece stockcount'ta (§5.36) |
| Backend / Domain | 7.5 | 7.5 | Değişim yok |
| Analytics / Data trust | 4.5 | **5** | Taxonomy parity testi geldi, ama call-site coverage %21 (§5.33) |
| RBAC / Security / Tenancy | 8 | **7.5** | Rate-limit coverage %43 — perimeter-auth sağlam ama brute-force yüzeyi açık (§5.34) |
| Offline / PWA | 7.5 | 7.5 | Değişim yok |
| Performance / Scale | 7 | 7 | Hot-path OK; perf budget yok (§5.43) |
| Test / CI / Release confidence | 4 | **5** | Coverage baseline pinlendi, ratchet var (v1.1.2); ama state machines ve GDPR cascade testsiz (§5.35, §5.36) |
| Observability / Product metrics | 3.5 | **4.5** | PII denylist (§7.4) + Resend webhook var; analytics call-site eksik (§5.33) |
| Internationalization | 4 | 4 | en-only honest scaffold stabil (v1.1 §5.23 kapatma) |
| Supply chain hygiene | 5 | 5 | Dependabot v2 + engines pin (v1.1 §5.26) |
| **DR / Ops readiness** | — | **3.5** | Yeni eksen: backup doc'u var, ama drill evidence yok (§5.38) |
| **Accessibility depth** | — | **5** | Yeni eksen: skip link + dialog a11y OK, full WCAG AA sweep yok (§5.40) |
| **Genel** | 6.5 | **6.8** | Trust + ölçüm çerçevesi kuruldu; propagasyon ve ops-side hazırlık kasılmaya muhtaç |

### 1.2 En çok önemli üç şey

Tek sprint varsa:
- **(a)** 6 activation event için call-site yerleştir — `items/actions.ts`, `warehouses/actions.ts`, `stock-counts/actions.ts`, `scanner/scan-action.ts`, `movements/actions.ts`'de her biri ≤2 satır; parity testi (events.test.ts) zaten var, sadece expected-count'u büyütmek yeterli. Activation hunisi iki günde ölçülmeye başlar. (§5.33)
- **(b)** Kalan 25 `route.ts`'i `rateLimit` wrapper'ı ile sar — middleware şablonu zaten var; `api-validation.test.ts`'e benzer statik "her POST/PATCH/DELETE rate-limit altında" sweep testi pinle. Brute-force yüzeyi kapanır. (§5.34)
- **(c)** `account/delete/route.ts` için integration test yaz: Prisma in-memory veya test-db fixture'ında bir `User` + 15 child row oluştur, delete çağır, 0 orphan row assert et. Aynı test "cascade drift" guard'ı: yeni bir `@relation(..., User)` field'ı eklendiğinde test user'ı kurmazsa fail etmeli. (§5.35)

Bu üç hamle v1.2 Phase-3.1 (P1) çekirdeği: orta impact, düşük regresyon riski, 1-2 günlük iş.

---

## 2. Sistem Şekli Özeti (v1.1'den delta)

### 2.1 Teknoloji (değişmeyenler)

Next.js 15 + App Router, TypeScript strict (`tsc --noEmit` EXIT 0 — v1.1.2 remediation), Prisma 6.19.3 (`InputJsonValue` import path düzeltmesi v1.1.2'de kapandı), better-auth (message-shape fix v1.1.3'te kapandı), Tailwind 4, Sentry + PostHog + Resend, Dexie offline queue.

### 2.2 Yeni eklenen veya kapasitesi değişenler (v1.1 → v1.1.3)

- **`src/lib/instrumentation.ts`** — `PII_DENYLIST` (26 key) + `scrubPII()` her track() çağrısında çalışıyor (v1.1 §7.4).
- **`src/lib/cron/with-idempotency.ts`** — `CronRun` modeli + helper; 3 cron (`stock-count-triggers`, `cleanup-migration-files`, `cleanup-notifications`) bunu kullanıyor.
- **`src/app/api/webhooks/resend/route.ts`** — bounce/complaint handler (v1.1 §5.28).
- **`src/app/api/**/route.ts`** — 44 route tamamı `@openapi-tag: <path>` header'ı taşıyor; `openapi.yaml` 15 gap ve 2 method mismatch'i v1.1.1'de temizlendi.
- **`vitest.config.ts`** — coverage thresholds 0 → 3/3/19/45 (lines/statements/functions/branches), ratchet guard pinli.
- **`src/lib/repo-hygiene.test.ts`** — .gitignore + `_unused_onboarding_copy` temizlendi.
- **`src/app/api/auth/[...all]/route.ts`** — rate-limit response shape `{ message, code }` (better-auth client kontratına uyumlu).

### 2.3 Route topolojisi (sayılar — v1.1'den delta)

- `src/app/api/**/route.ts` → **44** route dosyası (v1.1 "42" dedi; artış: 1 yeni webhook + 1 yeni cron route — `cleanup-notifications`).
- `"use server"` içeren dosya → **54** (değişmedi).
- `loading.tsx` → **~46** (değişmedi).
- `error.tsx` + `global-error.tsx` → **10** (v1.1'de 2'ydi; 8 segment boundary eklendi).
- E2E spec → **14 dosya** (değişmedi).
- Unit/integration test → **89 test dosyası / 991 test** (v1.1'de 63/972; delta: +26 dosya, +19 test — ratchet guard, auth rate-limit shape guard, openapi parity, api-validation sweep, repo-hygiene, pii-denylist vb.).

### 2.4 Dark/unused yüzey (v1.2'de yeni görünen)

| Yüzey | Durum | Not |
|---|---|---|
| `src/generated/prisma.old/` | git untracked, 20MB | Eski client; `.gitignore`'da değil (§5.41) |
| `src/generated/prisma.stale.60437/` | git untracked, 48MB | Prisma regenerate artefact'ı (§5.41) |
| `src/generated/prisma.stale.62579/` | git untracked, 28MB | Aynı (§5.41) |
| `src/generated/prisma.stale.62675/` | git untracked, 28MB | Aynı (§5.41) |
| `AnalyticsEvents` enum | 19 event, 4 call-site | 6 activation event boş (§5.33) |
| 25 route.ts | rate-limit wrapper yok | Brute-force hedefi (§5.34) |
| `src/lib/sales-order/machine.ts` | 0 neighbor test | XState graph testsiz (§5.36) |
| `src/lib/transfer/machine.ts` | 0 neighbor test | Aynı (§5.36) |

---

## 3. Dosya-dosya Audit Matrisi (yalnızca v1.2 için anlamlı olanlar)

| Dosya | Rol | Bulgular |
|---|---|---|
| `src/lib/analytics/events.ts` | 19 event enum + wrapper | **P1** (§5.33): FOLLOW-THROUGH — 15 event call-site'sız |
| `src/app/(app)/items/actions.ts` | Item create/update | **P1** (§5.33): `ITEM_CREATED`, `FIRST_ITEM_CREATED` tetikleyicisi yok |
| `src/app/(app)/warehouses/actions.ts` | Warehouse create | **P1** (§5.33): `FIRST_WAREHOUSE_CREATED` tetikleyicisi yok |
| `src/app/(app)/stock-counts/actions.ts` | Count start/complete | **P1** (§5.33): `COUNT_STARTED`, `FIRST_COUNT_COMPLETED` yok |
| `src/app/(app)/scanner/**` | Scanner UI | **P1** (§5.33): `FIRST_SCAN`, `BARCODE_SCANNED` yok |
| `src/app/api/items/route.ts` | Item CRUD | **P1** (§5.34): rate-limit wrapper yok |
| `src/app/api/stock-counts/[id]/route.ts` | Count mutation | **P1** (§5.34): rate-limit wrapper yok |
| `src/app/api/notifications/route.ts` | Notification list | **P1** (§5.34): rate-limit wrapper yok |
| `src/app/api/integrations/shopify/sync/route.ts` | Shopify sync trigger | **P1** (§5.34): rate-limit wrapper yok |
| `src/app/api/account/delete/route.ts:42+` | GDPR delete | **P1** (§5.35): UNTESTED — cascade coverage assert edilmiyor |
| `prisma/schema.prisma` (User FK'leri) | 23 User FK | **P1** (§5.35): cascade policy driftle karşılaşırsa sessiz orphan |
| `src/lib/sales-order/machine.ts` | XState graph | **P2** (§5.36): UNTESTED |
| `src/lib/transfer/machine.ts` | XState graph | **P2** (§5.36): UNTESTED |
| `src/app/(marketing)/layout.tsx` | Marketing metadata | **P2** (§5.37): openGraph yalnızca 3 sayfada |
| `src/app/opengraph-image.tsx` | OG fallback | YOK — **P2** (§5.37): MISSING |
| `docs/backup-strategy.md` | DR doküman | **P2** (§5.38): UNTESTED — drill tarihi yok |
| `docs/DR-drill-log.md` | YOK | **P2** (§5.38): MISSING |
| `src/app/(app)/settings/security/sessions/page.tsx` | Session list | YOK — **P2** (§5.39): admin revoke UI yok |
| `src/app/api/account/sessions/[id]/revoke/route.ts` | Session revoke | YOK — **P2** (§5.39): MISSING |
| `src/app/(app)/layout.tsx`, modal/dialog'lar | a11y | **P2** (§5.40): full WCAG AA sweep yapılmadı |
| `src/generated/prisma.old/` | Stale client | **P3** (§5.41): 20MB, .gitignore'de değil |
| `src/generated/prisma.stale.*` | Regenerate artefact | **P3** (§5.41): 104MB, .gitignore'de değil |
| `sentry.client.config.ts:L?`, `sentry.server.config.ts`, `sentry.edge.config.ts` | Sampling | **P3** (§5.42): `tracesSampleRate` 0.1 hardcoded default |
| `package.json` `build:analyze` | Bundle analyzer var | **P3** (§5.43): CI'de çalışmıyor, budget yok |
| `lighthouserc.json` | YOK | **P3** (§5.43): MISSING |
| `prisma/schema.prisma` `CronRun` | Idempotency ledger | **P3** (§5.44): retention politikası yok |

---

## 4. 10 Yeni Çerçeve Sorusu

> v1.0 "yalanlar" için, v1.1 "ölçüm ve hazırlık" için sordu. v1.2 "yarın sabah" için soruyor.

**S1. Bir kullanıcı ilk warehouse'unu oluşturduğunda PostHog'da bunu görüyor muyuz?**
Hayır. `AnalyticsEvents.FIRST_WAREHOUSE_CREATED` sabit tanımlı ama `warehouses/actions.ts`'de `track()` çağrısı yok. "Signup'tan ilk warehouse'a kaç saat" sorusunun cevabı şu an tahmin. (§5.33)

**S2. `/api/items` endpoint'ine paralel brute-force yapılırsa ne olur?**
Hiçbir şey durdurmaz. `middleware.ts`'de session check var (perimeter-auth), ama her authenticated user için rate-limit yok. Tek bir tenant compromise'i → diğer tenant'ların write path'ine yük saldırısı. (§5.34)

**S3. Bir kullanıcı "GDPR sil" talep ederse arkada ne kalır?**
Şu anki `account/delete/route.ts` 4 modeli (membership, session, account, twoFactorAuth) manuel temizliyor. `User` delete'i sonrası Prisma cascade'ine kalan: `IdempotencyKey`, `AuditLog`, `ApiKey`, `Notification`, `Alert`, `OfflineOperation`, `Invitation` (invitedBy), `StockCount` (countedBy null), `Movement` (createdBy null) — 23 relation. Bunun doğruluğunu kanıtlayan **tek test yok**. (§5.35)

**S4. `sales-order/machine.ts` graph'ında `quote → fulfilled` gibi bir yasak transition var mı?**
Bilmiyoruz. XState v5 ile yazılmış ama neighbor `.test.ts` yok. Allocation, cancellation, partial shipment state'leri arasındaki geçişler regresyon koruması olmadan çalışıyor. (§5.36)

**S5. Social share linki paylaşıldığında hangi önizleme görünüyor?**
`src/app/(marketing)/layout.tsx` dışında `openGraph` metadata yalnızca 3 sayfada. Signup, pricing, product feature sayfalarının Twitter/LinkedIn önizlemesi generic. (§5.37)

**S6. Veritabanı silindiğinde geri dönüş süremiz nedir?**
`docs/backup-strategy.md` RTO ≤ 4 saat, RPO ≤ 1 saat promise ediyor. Ama drill yapılmadı — son bir backup'tan restore edilip 991 testin yeşil geçtiği gösterilmedi. Bu bir **iddia**, kanıt değil. (§5.38)

**S7. Eski cihazımdan "log out" demek nasıl?**
Şu an tek yol: o cihazdan çıkış yapmak veya hesabı silmek. `src/app/(app)/settings/security/*`'de "active sessions" listesi ve "revoke" butonu yok. better-auth session tablo olarak var, revoke API call'u yok. (§5.39)

**S8. Screen reader ile dashboard sidebar'ı nasıl hissediyor?**
Bilmiyoruz. v1.0 §5.16 dialog a11y'yi, v1.1 §5.25 skip-to-main'i kapattı. Ama form validation error association, live region, focus trap (dialog dışı), kontrast tam rampaları için **sistemik audit yapılmadı**. (§5.40)

**S9. `src/generated/` dizini neden 124MB şişirdi?**
3 stale Prisma regenerate artefact'ı (`prisma.old`, `prisma.stale.60437`, `prisma.stale.62579`, `prisma.stale.62675`) — eski session'larda `prisma generate` sırasında bırakılmış, temizlenmemiş. `.gitignore`'de yok. Nadiren `git add -A` yapılırsa repo'ya sızma riski. (§5.41)

**S10. Bundle boyutu artarsa haberdar olur muyuz?**
Olmayız. `@next/bundle-analyzer` yüklü, `build:analyze` script'i var ama CI'de koşmuyor. Lighthouse CI yok. `bundle-stats.json` snapshot'ı yok. 500KB'lık bir regresyon sessizce deploy edilir. (§5.43)

---

## 5. Kritik Bulgular (sıralı)

> Her bulgu: severity, başlık, evidence, impact, remediation direction, önerilen pinlenmiş test, fix-risk. Numaralandırma v1.1'den devam ediyor (§5.33, §5.34, ...).

### 5.33 P1 — Analytics call-site follow-through

**FOLLOW-THROUGH**

v1.1 §5.20 taxonomy'yi sabitledi, `events.test.ts` parity test'i yazıldı. Ama call-site propagasyonu tamamlanmadı: 19 event'ten yalnızca 4'ü tetikleniyor.

**Evidence**
- `src/lib/analytics/events.ts:60-85` — 19 event tanımlı (`SIGNUP_COMPLETED`, `ONBOARDING_COMPLETED`, `TWO_FACTOR_ENABLED`, `ITEM_IMAGE_UPLOADED`, `FIRST_ITEM_CREATED`, `FIRST_WAREHOUSE_CREATED`, `FIRST_SCAN`, `FIRST_COUNT_COMPLETED`, `UPGRADE_CLICKED`, `CHECKOUT_STARTED`, `SUBSCRIPTION_CREATED`, `ITEM_CREATED`, `MOVEMENT_LOGGED`, `COUNT_STARTED`, `REPORT_VIEWED`, `REPORT_EXPORTED`, `PO_CREATED`, `BIN_CREATED`, `BARCODE_SCANNED`).
- Call-site tarama: `grep -rn "track(AnalyticsEvents\." src/` → 4 sonuç:
  - `src/app/(auth)/register/register-form.tsx:104` — `SIGNUP_COMPLETED`
  - `src/app/(app)/onboarding/onboarding-form.tsx:408` — `ONBOARDING_COMPLETED`
  - `src/app/(app)/settings/security/two-factor-setup.tsx:77` — `TWO_FACTOR_ENABLED`
  - `src/components/ui/image-upload.tsx:60` — `ITEM_IMAGE_UPLOADED`
- Boş event'ler (15): `FIRST_ITEM_CREATED`, `FIRST_WAREHOUSE_CREATED`, `FIRST_SCAN`, `FIRST_COUNT_COMPLETED`, `UPGRADE_CLICKED`, `CHECKOUT_STARTED` (billing interval change tetiklemesi var ama `CHECKOUT_STARTED` değil), `SUBSCRIPTION_CREATED`, `ITEM_CREATED`, `MOVEMENT_LOGGED`, `COUNT_STARTED`, `REPORT_VIEWED`, `REPORT_EXPORTED`, `PO_CREATED`, `BIN_CREATED`, `BARCODE_SCANNED`.

**Impact**
Activation hunisi **ölçülmüyor**. Signup → first warehouse → first item → first scan → first count pipeline'ında sadece giriş ve çıkış (signup ve onboarding complete) görünüyor. Aktivasyon retention analizini yaparken "kaç kullanıcı 1. güne kadar warehouse yarattı" sorusunun cevabı tahmin — product decision'ları veri olmadan yapılıyor.

**Fix direction**
6 activation-kritik event için call-site yerleştir:
- `ITEM_CREATED` + `FIRST_ITEM_CREATED` → `src/app/(app)/items/actions.ts` `createItem()` sonrası (first-check için: `Item.count({ where: { organizationId } }) === 1`)
- `FIRST_WAREHOUSE_CREATED` → `src/app/(app)/warehouses/actions.ts` `createWarehouse()` sonrası (aynı first-check pattern)
- `COUNT_STARTED` + `FIRST_COUNT_COMPLETED` → `stock-counts/actions.ts` start + complete
- `BARCODE_SCANNED` + `FIRST_SCAN` → scanner client component (tetikleyici event handler)
- Diğer 9 event (PO, REPORT, UPGRADE, MOVEMENT, BIN, CHECKOUT, SUBSCRIPTION) Phase-3.2'de; P1 için 6 activation'ı yeterli.

**Önerilen pinlenmiş test**
`src/lib/analytics/events.test.ts`'i genişlet (veya yeni `analytics-call-site-coverage.test.ts`):
```ts
const EXPECTED_CALL_SITES: Partial<Record<keyof typeof AnalyticsEvents, string>> = {
  SIGNUP_COMPLETED: "src/app/(auth)/register/register-form.tsx",
  ITEM_CREATED: "src/app/(app)/items/actions.ts",
  FIRST_WAREHOUSE_CREATED: "src/app/(app)/warehouses/actions.ts",
  // ...
};
// Her key için `readFileSync(path).includes("track(AnalyticsEvents.KEY")` assert.
```
Bu test yeni bir event eklendiğinde ya EXPECTED_CALL_SITES'a yazılsın ya açıkça `@pending` diye not düşülsün ister.

**Fix risk:** Düşük. Her call-site ≤ 2 satır. `track()` zaten `scrubPII()` altında (v1.1 §7.4), ekstra PII risk yok.

---

### 5.34 P1 — Rate-limit coverage gap

**MISSING**

44 API route'un yalnızca 19'u `rateLimit` veya `withRateLimit` ile sarılı. Kalan 25 route — özellikle authenticated write path'leri — paralel brute-force veya kasıtlı bombardıman karşısında korumasız.

**Evidence**
- `find src/app/api -name "route.ts" | wc -l` → 44.
- `grep -rln "rateLimit\|withRateLimit\|RateLimit" src/app/api/ | wc -l` → 19.
- Sarılı olanlar (v1.1 §5.30 zod çalışmasının ek faydası): `migrations/[id]/start`, `migrations/[id]/upload`, `auth/[...all]`, `auth/two-factor/verify`, `account/delete`, `account/export`, `onboarding/organization`, `upload/image`, 10 `reports/*` route'u, `billing/checkout` (indirect via middleware).
- Sarılı **olmayanlar** (örnekler):
  - `src/app/api/items/route.ts` — item CRUD
  - `src/app/api/stock-counts/[id]/route.ts` — count state mutation
  - `src/app/api/notifications/route.ts` — read heavy
  - `src/app/api/integrations/shopify/sync/route.ts` — sync trigger
  - `src/app/api/integrations/quickbooks/oauth/callback/route.ts`
  - `src/app/api/cron/*` (burası OK — `CRON_SECRET` zaten koruyor, ama yine de spam guard iyi olur)
  - `src/app/api/webhooks/*` (HMAC var, OK — rate-limit gerekmez)

**Impact**
Tek bir compromise edilmiş session cookie ile saldırgan `POST /api/items`'ı saniyede 1000 kez çağırıp DB yükü yaratabilir. Notification endpoint'i enumerate edilerek cross-tenant probing yapılabilir. Shopify sync trigger endpoint'i spam'lendiğinde Shopify API quota'sı tükenir ve tenant etkilenir. Perimeter auth (middleware) erişimi engeller ama **hızı** engellemez.

**Fix direction**
İki yaklaşım; ikincisini öner:
1. **Manual per-route wrap** — 25 route'un her birine `const limited = rateLimit(...)` decorator ekle. Kalıcı drift riski yüksek.
2. **Middleware-level enforcement + opt-out** — `src/middleware.ts`'i genişlet: authenticated API route'lar için default `rateLimit({ window: "1m", max: 120 })` uygula; webhook ve HMAC route'ları `WEBHOOK_PATH_PREFIXES` allow-list'i ile exempt et. Kod değişimi küçük, drift riski düşük.

İkinci yaklaşımı seç. Implementation:
```ts
// middleware.ts
const WEBHOOK_PATHS = ["/api/webhooks/", "/api/cron/"];
if (pathname.startsWith("/api/") &&
    !WEBHOOK_PATHS.some(p => pathname.startsWith(p))) {
  const rl = await limitByIp(request.ip, "api.authenticated", 120, "1m");
  if (!rl.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
}
```

**Önerilen pinlenmiş test**
`src/lib/api-rate-limit-coverage.test.ts`:
```ts
// Statik analiz. Her route.ts için:
//   - middleware.ts'e `/api/` path match ediyor (not exempted), VEYA
//   - route body'sinde `rateLimit(` / `withRateLimit(` geçiyor
// İstisna: allow-list = WEBHOOK_PATHS + CRON_PATHS (path-prefix ile).
```
api-validation.test.ts'e benzer sweep; yeni route eklendiğinde coverage düşerse fail eder.

**Fix risk:** Orta. Middleware-level rate-limit eklenirse (a) Vercel Edge Runtime'da KV/Redis-backed store'a ihtiyaç var — mevcut `src/lib/rate-limit.ts` store'u Edge uyumlu mu kontrol gerekiyor; (b) authenticated ama legitimate (PDF export, bulk import) endpoint'leri 120/min'lik tavanı aşabilir — burst-tolerant limit (ör. `tokenBucket` algoritması) veya per-role override gerekli.

---

### 5.35 P1 — GDPR delete cascade correctness

**UNTESTED**

`POST /api/account/delete` (v1.1 §5.30'da zod'a çevrildi) manuel `deleteMany` zinciri ile User'ı siliyor. Ama 23 User FK relation'ından yalnızca 4'ü manuel temizleniyor — kalan 19 relation için Prisma `onDelete` policy'sine güveniyoruz. Bu inançla; herhangi bir integration testi yok.

**Evidence**
- `src/app/api/account/delete/route.ts:42-110` — manuel silme adımları:
  ```
  db.membership.deleteMany({ where: { userId } })
  db.session.deleteMany({ where: { userId } })
  db.account.deleteMany({ where: { userId } })
  db.twoFactorAuth.deleteMany({ where: { userId } })
  db.user.delete({ where: { id: userId } })
  ```
- `prisma/schema.prisma` — User'a FK koyan 23 relation (grep `fields: \[.*userId.*\]`). Bazı örnekler:
  - `Invitation.invitedById` → `onDelete: Cascade` (hard delete — invitee'nin invitation history'si kaybolur; legally OK)
  - `Invitation.acceptedById` → `onDelete: SetNull` (davet edilen user silinirse, davetin "acceptedBy" alanı null; invitation kaydı kalır — **edge case: başka bir kullanıcının geçmişinde silinmiş user'a referans**)
  - `AuditLog.userId` → policy ne? Schema inspection gerekli; eğer `Cascade` ise audit log kaybolur (compliance için istenen değil); `SetNull` ise "anonymized" bir audit kaydı kalır.
  - `Notification.userId` → `Cascade` (OK — user gitti, bildirim gerekmez)
  - `Alert.createdByUserId` → policy ne?
  - `StockCount.countedByUserId`, `Movement.createdByUserId` → `SetNull` olmalı (inventory history kalmalı, counter anonim olmalı)
- Integration test taraması: `grep -rln "account.*delete\|deleteAccount" src/ e2e/ 2>&1` → yalnızca `src/lib/api-validation.test.ts` (zod shape guard) ve e2e'de YOK.

**Impact**
Hukuki: GDPR Art. 17 "right to erasure" iddia ediliyor. Eğer:
- Bir relation `Cascade` olmalıyken `SetNull` ise → user silindikten sonra onun PII'sini içeren row'lar kalır (`Movement.createdByUserId = null` ama `Movement.notes` içinde user'ın adı olabilir — ayrı konu).
- Bir relation `SetNull` olmalıyken `Restrict` ise → delete patlar, kullanıcıya "delete failed" hatası döner; biz başarılı olduğunu söyleriz → compliance yalanı.
- Yeni bir relation eklenir (Phase-3'te yapılacak iş) ama manuel silme listesine eklenmez → silent orphan birikir.

Operational: destek ekibi "bu user'ı sildim ama dashboard'da hâlâ görünüyor" bug'ı alırsa root-cause analysis uzun sürer.

**Fix direction**
1. **Cascade policy audit** — `prisma/schema.prisma`'da User'a FK koyan 23 relation için policy matrix yaz (`docs/gdpr-cascade-matrix.md`): her relation için `Cascade` / `SetNull` / `Restrict` seçimi + gerekçe (hukuki / operational / audit-retention).
2. **Integration test** — `src/app/api/account/delete/route.test.ts`:
   - Test DB setup (SQLite in-memory veya Prisma test-db adapter)
   - Seed: 1 user + 15 child row (en az bir her relation tipinden)
   - `POST /api/account/delete` çağır
   - Assert: user tablo 0 row (o user için), child row'lar ya 0 ya anonymized (`userId = null`)
3. **Drift guard** — schema'ya yeni User FK eklendiğinde `prisma/schema.prisma`'yı parse edip `EXPECTED_USER_RELATIONS` listesi ile diff alan static test. Yeni relation eklenirse test fail → dev manuel listeyi güncelleyip policy seçsin.

**Önerilen pinlenmiş test**
Üç katman:
1. **Static schema guard** (`src/lib/gdpr-cascade.test.ts`):
   ```ts
   const EXPECTED: Record<string, "Cascade" | "SetNull" | "Restrict"> = {
     "Membership.userId": "Cascade",
     "Session.userId": "Cascade",
     "Notification.userId": "Cascade",
     "AuditLog.userId": "SetNull",
     "Movement.createdByUserId": "SetNull",
     // ... 23 entry
   };
   // Parse schema.prisma, extract every relation targeting User, compare.
   ```
2. **Integration behavior test** (gerçek DB): üstte tarif edilen.
3. **API shape guard** (zaten v1.1 §5.30'da var): request body shape drift etmesin.

**Fix risk:** Yüksek. Test-DB setup (SQLite vs Postgres uyumluluğu) dikkat ister. Cascade matrix kararları ürün/legal konsültasyonu ister (ör. "AuditLog anonymized mi yoksa silinsin mi" GDPR Art. 17 + Art. 30 dengesi — genelde "SetNull + scrub free-text" tercih edilir, ama bu politika kararı).

---

### 5.36 P2 — State machine neighbor tests missing (sales-order, transfer)

**UNTESTED**

`src/lib/*/machine.ts` üç dosyada XState graph tanımlı: `stockcount`, `sales-order`, `transfer`. Yalnızca `stockcount` için neighbor test'ler var (`rollback-policy.test.ts`, `triggers.test.ts`, `variance.test.ts`). Sales-order ve transfer graph'ları testsiz.

**Evidence**
- `ls src/lib/*/machine.ts` → 3 dosya.
- `ls src/lib/*/*.test.ts` → stockcount için 3 test; sales-order ve transfer için 0.
- Transfer graph state transitions (estimate): `draft → approved → in_transit → received | rejected`. Yasak transition: `draft → received` (intermediate state atlama).
- Sales-order graph: `quote → confirmed → allocated → shipped → fulfilled | returned`. Yasak: `quote → fulfilled`, `allocated → returned`.

**Impact**
Bir developer allocation state'ini "optimize" etmek için intermediate state'i atlayan bir action yazarsa, regresyon radarı yok. v1.0 §5.10 sales-order allocate davranış testini kapattı — ama bu, **tek eylemin** testi. Graph bütünlüğü testsiz.

**Fix direction**
Her machine için neighbor test yaz. XState v5 ile:
```ts
import { createActor } from "xstate";
import { salesOrderMachine } from "./machine";

describe("sales-order machine", () => {
  it("rejects quote → fulfilled transition", () => {
    const actor = createActor(salesOrderMachine).start();
    actor.send({ type: "FULFILL" });
    expect(actor.getSnapshot().value).not.toBe("fulfilled");
  });
  // Happy path (quote → confirmed → allocated → shipped → fulfilled)
  // Rejection path (quote → rejected)
  // Cancel path (confirmed → cancelled)
});
```

**Önerilen pinlenmiş test**
Her machine için ≥5 test:
- Happy path (initial → terminal)
- En az 2 forbidden transition
- En az 1 rollback/cancel path
- State invariant'i (ör. `fulfilled` state'den çıkılmaz)

**Fix risk:** Düşük. XState actor'leri sync, DB dokunmuyor; coverage'ın koşu süresine etkisi milisaniye mertebesinde.

---

### 5.37 P2 — Social / OpenGraph metadata seyrekliği

**DRIFT**

42 sayfa `export const metadata` tanımlı; ama `openGraph` (Facebook, LinkedIn önizlemesi) ve `twitter:` yalnızca 3 sayfada. Pricing, feature, auth sayfalarının social share önizlemesi generic.

**Evidence**
- `grep -rln "openGraph" src/app/ | wc -l` → 3.
- `ls src/app/opengraph-image.tsx src/app/(marketing)/opengraph-image.tsx` → yok; default fallback yok.
- `grep -rln "twitter:" src/app/` → 0 (veya minimal).

**Impact**
Marketing:
- Pricing sayfası Twitter'da paylaşıldığında: "OneAce" title, generic description, no image. "What is OneAce?" sorusunun cevabı preview'dan gelmiyor.
- Product blog post veya changelog paylaşıldığında (eğer yazılırsa) aynı sorun.
SEO:
- OG card'ları paylaşım sonrası social sinyal üretmiyor → low-quality share signal → organik erişim kaybı.

**Fix direction**
1. `src/app/opengraph-image.tsx` (route-level fallback) — Next.js 15 convention:
   ```tsx
   import { ImageResponse } from "next/og";
   export default function OGImage() {
     return new ImageResponse(<div style={{ ... }}>OneAce</div>, { width: 1200, height: 630 });
   }
   ```
2. Her `(marketing)/*/page.tsx`'in `metadata` export'unu genişlet:
   ```ts
   export const metadata: Metadata = {
     title: "...",
     openGraph: { title, description, images: ["/og/pricing.png"] },
     twitter: { card: "summary_large_image", title, description },
   };
   ```
3. Statik testle guard: marketing sayfalarının tümü OG ve Twitter metadata'sına sahip olsun.

**Önerilen pinlenmiş test**
`src/lib/metadata-coverage.test.ts`:
```ts
// Her src/app/(marketing)/**/page.tsx için:
//   - metadata export etmek
//   - metadata.openGraph.images tanımlamak (non-empty)
//   - metadata.twitter.card tanımlamak
```

**Fix risk:** Düşük. OG image generation Vercel ImageResponse ile, cold-start dışında serverless maliyeti minimal.

---

### 5.38 P2 — Backup / DR rehearsal evidence

**UNTESTED**

`docs/backup-strategy.md` RTO ≤ 4 saat, RPO ≤ 1 saat promise ediyor. Ama **drill yapılmadı** — son bir backup'tan staging ortamına restore edilip 991 test koşup yeşil assert eden bir kayıt yok. Bu bir iddia, kanıt değil.

**Evidence**
- `ls docs/backup-strategy.md` → var.
- `grep -rn "RTO\|RPO\|drill\|last-tested" docs/ | head` → RTO/RPO tanımlı, ama "last tested" tarihi yok.
- `docs/DR-drill-log.md` → dosya yok.
- CI/CD workflow'ları içinde scheduled DR drill yok (`.github/workflows/dr-drill.yml` yok).

**Impact**
Prod DB compromise'i veya accidental DROP TABLE olduğunda:
- Neo tier Vercel/Neon PITR (point-in-time-recovery) 7 gün back. Bu biliniyor, ama **kullanıldığı kanıtlanmadı**.
- Restore → migration drift (`prisma migrate resolve --applied`) → app bootup → smoke test → kullanıcı trafiğine açma sürecinin her bir adımı dokümante değil.
- "4 saatte dönerim" diyoruz; gerçekte ilk drill'de 12+ saat sürebilir.

**Fix direction**
1. **Manuel drill log** — `docs/DR-drill-log.md` oluştur. Her drill için: tarih, baseline DB boyutu, restore süresi, anomaly, lessons.
2. **İlk drill** — staging ortamında (veya `main`'den branch'lenmiş disposable Neon branch'te):
   - Prod backup al (Neon branch veya logical dump).
   - Staging'e restore et.
   - `pnpm prisma migrate deploy` → drift kontrolü.
   - `pnpm vitest run` → 991 test yeşil mi?
   - `pnpm e2e` → smoke suite yeşil mi?
   - Süreyi ölç, log'a yaz.
3. **Otomasyon** — aylık scheduled GitHub Actions workflow (`.github/workflows/dr-drill.yml`) `DRY_RUN` modunda:
   - Neon API ile test branch oluştur
   - Disposable `DATABASE_URL` ile `prisma migrate deploy` + `prisma db seed` + `vitest run`
   - Branch'i temizle
   - Süreyi `docs/DR-drill-log.md`'ye append et (veya GitHub issue olarak açsın).

**Önerilen pinlenmiş test**
Doğrudan test değil; ama guard:
`src/lib/dr-drill-freshness.test.ts`:
```ts
// docs/DR-drill-log.md parse et, en son drill tarihini bul.
// Today - last_drill > 30 gün ise fail.
```
Bu test CI'yi kırmak istemediğimiz için `describe.skipIf(process.env.CI)` veya soft-fail (warning) modunda olabilir — ama en azından local dev'de uyarı verir.

**Fix risk:** Orta. İlk drill 1-2 günlük iş. Scheduled workflow'un idempotency'si ve maliyet (Neon branch çağrısı) dikkat ister.

---

### 5.39 P2 — Admin session revocation path

**MISSING**

`better-auth.Session` tablosu aktif session'ları tutuyor; kullanıcı başka bir cihazdan login olursa yeni session kayıt oluyor. Ama kullanıcı **eski cihazımdan çıkış yap** demek istediğinde, yapamıyor — UI yok, API yok.

**Evidence**
- `src/app/(app)/settings/security/` → `two-factor-setup.tsx`, `password-change.tsx`, ama `sessions/page.tsx` yok.
- `src/app/api/account/sessions/` → dizin yok.
- `src/lib/auth.ts:L?` — `session: { expiresIn: 7 days, updateAge: 1 day }`. Revoke endpoint yok.
- better-auth'ın kendi `listSessions` / `revokeSession` plugin'i kurulu mu? `grep -rn "listSessions\|revokeSession" src/` → 0 sonuç.

**Impact**
Kullanıcı deneyimi: "Şifremi değiştirdim ama eski telefonum hâlâ oturumda" — çünkü session 7 gün geçerli, password change session'ları invalidate etmiyor.
Security: bir laptop çalındığında "kill all sessions" seçeneği yok. Kullanıcı hesabı silmek zorunda kalıyor.

**Fix direction**
1. better-auth config'te `session.revocation` plugin'ini etkinleştir (varsa):
   ```ts
   // src/lib/auth.ts
   plugins: [...existing, sessionRevocationPlugin()]
   ```
2. Minimal UI:
   ```tsx
   // src/app/(app)/settings/security/sessions/page.tsx
   // Server component: listSessions() → [{ id, userAgent, ipAddress, lastActive }]
   // Her row'un "Revoke" butonu → POST /api/account/sessions/[id]/revoke
   // "Revoke all other sessions" butonu (current session hariç)
   ```
3. Password change hook'unu güncelle: parola değişimi → `revokeAllSessionsExcept(currentSessionId)`.

**Önerilen pinlenmiş test**
`src/app/api/account/sessions/[id]/revoke/route.test.ts` (integration):
- 2 session oluştur (aynı user, farklı userAgent)
- Session A'dan session B'yi revoke et
- Session B'nin cookie'si ile korumalı endpoint'e git → 401.

**Fix risk:** Orta. better-auth API contract'ına göre plugin mevcut mu? Doğrulama gerekiyor; değilse manuel implementation (Prisma `db.session.delete`) mümkün ama cookie-sync dikkat ister.

---

### 5.40 P2 — Full WCAG 2.1 AA sweep

**UNTESTED**

v1.0 §5.16 dialog a11y'yi, v1.1 §5.25 skip-to-main link'i kapattı. Ama **sistemik WCAG AA sweep** yapılmadı: kontrast rampaları, form validation error association, live region, focus trap (dialog dışı), keyboard-only navigation completeness.

**Evidence**
- Pinlenmiş a11y test'leri: dialog `aria-modal`/`role` statik checker, skip-link varlığı. Dynamic runtime check yok.
- axe-core entegrasyonu: `grep -rn "axe-core\|@axe-core\|jest-axe" package.json` → 0 sonuç.
- Playwright'ta a11y assertion: `grep -rn "toHaveNoViolations\|injectAxe" e2e/` → 0 sonuç.

**Impact**
- Form error'ları: `<input aria-invalid aria-describedby="...">` pattern'ı her form'da uygulanıyor mu? Screen reader kullanıcıları "field invalid" sinyalini alıyor mu?
- Live region (`aria-live`) toast/notification'larda kullanılıyor mu? Screen reader kullanıcısı push notification'ı duyuyor mu?
- Kontrast: Tailwind token'ları WCAG AA (normal text 4.5:1, large 3:1) uyuyor mu? Design system'de 12 token var, manuel kontrast grid'i üretilmedi.
- Keyboard trap: modal dışında focus trap yok (bu OK); ama custom combobox (`shadcn/ui select`) tab cycling doğru mu?

**Fix direction**
1. **axe-core + Playwright** integration:
   ```ts
   // e2e/a11y.spec.ts
   import AxeBuilder from "@axe-core/playwright";
   for (const path of CRITICAL_PATHS) {
     test(`${path} has no axe violations`, async ({ page }) => {
       await page.goto(path);
       const results = await new AxeBuilder({ page })
         .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
         .analyze();
       expect(results.violations).toEqual([]);
     });
   }
   ```
2. **Kontrast grid** — `scripts/check-contrast.ts`: Tailwind tokenlerini parse et, WCAG AA check et, fail durumunda issue aç.
3. **ARIA hygiene linter** — `eslint-plugin-jsx-a11y` zaten varsa strict rule set'ine geç.

**Önerilen pinlenmiş test**
axe test'i zaten CI'ye eklenirse o bir guard. Ek olarak static:
`src/lib/a11y-token-contrast.test.ts` — design tokenleri WCAG AA kontrast oranını geçmeyi assert eder.

**Fix risk:** Orta. axe-core false-positive'leri var (Tailwind reset kurallarına takılabilir); allow-list / baseline dosyası yönetimi dikkat ister. İlk koşuda muhtemelen 5-15 gerçek ihlal çıkar — bu iş kendi kendine remediation batch'i.

---

### 5.41 P3 — Stale Prisma generated directories

**POLISH**

`src/generated/` altında **4 stale artefact dizini** var (toplam 124MB). `.gitignore` bunları kapsamıyor — `git add -A` yapılırsa sessizce repo'ya sızabilirler.

**Evidence**
- `du -sh src/generated/*`:
  ```
  20M  src/generated/prisma.old
  48M  src/generated/prisma.stale.60437
  28M  src/generated/prisma.stale.62579
  28M  src/generated/prisma.stale.62675
  ```
- `.gitignore` → `src/generated/prisma/` pattern'i var, ama `prisma.old` ve `prisma.stale.*` explicitly değil.
- `git status --short src/generated/` → hepsi untracked.

**Impact**
- Repo boyutu risk: 124MB ekstra ağırlık. Bir dev `git add src/generated/` derse commit patlar.
- Disk maliyeti: her session sandbox'ta 124MB boşa.
- Grep noise: `grep -r "SomeModel" src/` çalıştırıldığında 4x duplicate match (her stale dizinde aynı types.d.ts var).

**Fix direction**
1. **Temizle** — 4 dizini sil:
   ```bash
   rm -rf src/generated/prisma.old src/generated/prisma.stale.*
   ```
2. **.gitignore pattern'ı genişlet**:
   ```
   # .gitignore
   src/generated/prisma.old/
   src/generated/prisma.stale.*/
   ```
3. **Post-generate hook** — `scripts/prisma-generate.sh` cleanup adımı:
   ```bash
   #!/usr/bin/env bash
   pnpm prisma generate
   rm -rf src/generated/prisma.stale.*
   ```

**Önerilen pinlenmiş test**
v1.1 §5.31 `src/lib/repo-hygiene.test.ts`'i genişlet:
```ts
it("no prisma.stale.* or prisma.old dirs exist", () => {
  const entries = readdirSync("src/generated");
  const stale = entries.filter(e => /^prisma\.(stale|old)/.test(e));
  expect(stale).toEqual([]);
});
```

**Fix risk:** Sıfır. Yalnızca temizlik.

---

### 5.42 P3 — Sentry trace sample rate (hardcoded default)

**DRIFT**

3 Sentry config dosyası (`client`, `server`, `edge`) `tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1")` satırı ile aynı default'u kullanıyor. Production'da aslında %10 trace sample ediliyor (default). Dev/staging/prod için sinyal ayrımı yapılmamış.

**Evidence**
```
sentry.client.config.ts:L?   tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1")
sentry.edge.config.ts:L?     aynı satır
sentry.server.config.ts:L?   aynı satır
```
Vercel env vars'ta `SENTRY_TRACES_SAMPLE_RATE` set mi? Muhtemelen hayır → production fiilen %10'da.

**Impact**
- Low traffic: %10 iyi bir default; tüm trace'i görmüyoruz ama cost OK.
- High traffic (ileride): %10 yeterli olabilir ama event'ten trace çıkaramadığımız için "slow endpoint" incidentlerinde kanıt eksik olabilir.
- Dev: %10 dev için çok düşük — local reproduction için %100 olmalı.

**Fix direction**
1. Ortam-aware default:
   ```ts
   const DEFAULT_RATE = process.env.NODE_ENV === "production" ? 0.1 : 1.0;
   tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? DEFAULT_RATE),
   ```
2. Vercel env vars:
   - `SENTRY_TRACES_SAMPLE_RATE=0.1` (prod)
   - `SENTRY_TRACES_SAMPLE_RATE=0.5` (preview / staging)
3. Dokümante et (`docs/MONITORING.md`): trace sample rate tablosu + gerekçe.

**Önerilen pinlenmiş test**
`src/lib/sentry-config.test.ts`:
```ts
// Her sentry.*.config.ts için:
//   - tracesSampleRate expression'ı var
//   - env var fallback var (hardcoded number değil)
//   - DEFAULT_RATE prod/dev ayrımı yapıyor
```

**Fix risk:** Sıfır. Config-only.

---

### 5.43 P3 — Bundle size / performance budget

**MISSING**

`@next/bundle-analyzer` yüklü ve `pnpm build:analyze` script'i var. Ama CI'de koşmuyor, size snapshot'ı repo'da yok, Lighthouse CI yok. Bundle 500KB büyürse sessizce deploy edilir.

**Evidence**
- `package.json:scripts` → `"build:analyze": "ANALYZE=true next build"` — manuel tool.
- `.github/workflows/*` → `analyze` step'i yok.
- `lighthouserc.json` veya `.lighthouserc.js` → yok.
- `bundle-stats.json` veya size-limit config → yok.

**Impact**
- LCP / TTI regresyon radarı yok.
- Yeni bir ağır dependency (ör. moment.js) eklendiğinde uyarı yok.
- Performance budget (ör. first-load JS < 200KB) yazılı değil.

**Fix direction**
1. **`size-limit`** ekle:
   ```json
   // package.json
   "size-limit": [
     { "path": ".next/static/chunks/main-*.js", "limit": "100 KB" },
     { "path": ".next/static/chunks/framework-*.js", "limit": "50 KB" }
   ]
   ```
   `.github/workflows/ci.yml`'e `size-limit` step ekle (threshold'u aşarsa fail).
2. **Lighthouse CI** — `.lighthouserc.json`:
   ```json
   { "ci": { "assert": { "assertions": {
       "first-contentful-paint": ["error", { "maxNumericValue": 2000 }],
       "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }]
     }}}}
   ```
   Scheduled (haftalık) workflow'la `lhci autorun`.

**Önerilen pinlenmiş test**
Doğrudan vitest test değil, ama CI gate'leri. `size-limit` CI step'inin varlığını pinleyen static test:
`src/lib/perf-budget.test.ts`:
```ts
// package.json'da size-limit array'ı non-empty
// .github/workflows/ci.yml'de "size-limit" keyword'ü geçiyor
```

**Fix risk:** Düşük. size-limit baseline'ı ilk koşuda set edilir; sonraki PR'lar delta gösterir.

---

### 5.44 P3 — CronRun ledger retention

**POLISH**

v1.1 §5.27'de eklenen `CronRun` modeli (idempotency ledger) her cron çalışmasında bir row yazar. 3 cron × günde 1 = 1095 row/yıl. Naïve görünür ama 5 yılda 5475 row + 20 yılda 21900. Retention cron'u yok.

**Evidence**
- `prisma/schema.prisma` — `model CronRun` (v1.1 §5.27).
- `grep -rn "CronRun.*deleteMany\|cronRun.*prune" src/app/api/cron/` → 0 sonuç.
- `src/lib/cron/with-idempotency.ts` → `upsert` yapıyor, `delete` yapmıyor.

**Impact**
Tablodaki row sayısı bounded kalmıyor ama büyüme çok yavaş (1095/yıl). Yine de "5. yılda bir gün migration vermek zorunda kalmak" ileride iş.

**Fix direction**
`cleanup-notifications` cron'unu örnek al, `CronRun` için de 90-gün retention cron yaz:
```ts
// src/app/api/cron/cleanup-cronruns/route.ts
export async function GET(request: NextRequest) {
  await withCronIdempotency("cleanup-cronruns", async () => {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    await db.cronRun.deleteMany({ where: { startedAt: { lt: cutoff } } });
  });
  return NextResponse.json({ ok: true });
}
```
`vercel.json`'a schedule ekle (haftalık).

**Önerilen pinlenmiş test**
`src/app/api/cron/cleanup-cronruns/route.test.ts`:
```ts
// Seed CronRun: 5 row, 3 of them > 90 gün eski
// GET çağır → deleteMany 3 row sil
// Kalan 2 row < 90 gün
```

**Fix risk:** Sıfır. Tek endpoint + basit query.

---

## 6. Deep-dive: Analytics propagation stratejisi

v1.1 §5.20 analytics taxonomy'yi sabitledi. v1.2 §5.33 propagasyonu tamamlıyor. Bu bölüm call-site'lara nasıl karar verileceğinin rehberi:

### 6.1 Event kategorileri

| Kategori | Event'ler | Kritikliği |
|---|---|---|
| Activation | `FIRST_WAREHOUSE_CREATED`, `FIRST_ITEM_CREATED`, `FIRST_SCAN`, `FIRST_COUNT_COMPLETED` | **P1** — huni tanımı |
| Core engagement | `ITEM_CREATED`, `MOVEMENT_LOGGED`, `COUNT_STARTED`, `BARCODE_SCANNED` | **P1** — retention sinyali |
| Monetization | `UPGRADE_CLICKED`, `CHECKOUT_STARTED`, `SUBSCRIPTION_CREATED` | **P2** — revenue funnel |
| Secondary | `PO_CREATED`, `BIN_CREATED`, `REPORT_VIEWED`, `REPORT_EXPORTED` | **P3** — feature usage |

### 6.2 "First" semantic

`FIRST_*` event'leri için pattern:
```ts
// After createItem():
const count = await db.item.count({ where: { organizationId } });
if (count === 1) {
  track(AnalyticsEvents.FIRST_ITEM_CREATED, { organizationId });
}
track(AnalyticsEvents.ITEM_CREATED, { itemId, organizationId });
```
Count query ekstra latency ekler; minimize için "first" check'i background job'a taşımak (veya `Organization.firstItemCreatedAt` kolonu eklemek) bir sonraki optimizasyon.

### 6.3 PII dikkati

v1.1 §7.4 `PII_DENYLIST` 26 key'i scrub ediyor. Ama call-site'ta **ne props geçeceğine** dikkat:
- ✅ `track(FIRST_ITEM_CREATED, { organizationId, itemType })`
- ❌ `track(FIRST_ITEM_CREATED, { user: fullUserObject })` — user objesi email/name içeriyor, denylist yakalar ama guardrail neden tetiklensin
- ❌ `track(MOVEMENT_LOGGED, { notes: userEnteredNotes })` — free-form text'te PII olabilir

Call-site'ta sadece ID'ler ve kategorik enum'lar geç. Bu kural §16 DoD checklist'ine eklenmeli.

---

## 7. Deep-dive: Rate-limit coverage

### 7.1 Middleware vs per-route trade-off

Middleware-level rate-limit:
- ✅ Coverage otomatik (yeni route eklendikçe default uygulanır)
- ✅ Drift riski düşük
- ❌ Per-endpoint custom policy yazılamaz (ör. upload 10/min, list 100/min)
- ❌ Edge Runtime store kontratına bağımlı

Per-route rate-limit:
- ✅ Custom policy serbest
- ✅ Node Runtime store (Upstash Redis) ile tam kontrol
- ❌ Drift: yeni route eklendiğinde unutulur
- ❌ 25 route için tekrar eden boilerplate

**Önerilen hibrit:** Middleware-level default (`120/min`), kritik endpoint'ler için route-level override. `src/lib/api-rate-limit-coverage.test.ts` sweep'i hem default'u hem override'ı tanısın.

### 7.2 Rate-limit policy matrix (öneri)

| Path prefix | Policy | Neden |
|---|---|---|
| `/api/auth/*` | 5/min | Login/reset brute-force koruması (mevcut) |
| `/api/webhooks/*` | exempt | HMAC auth, trusted caller |
| `/api/cron/*` | exempt | CRON_SECRET auth |
| `/api/upload/*` | 10/min | Dosya upload bandwidth kontrolü (mevcut) |
| `/api/reports/*/pdf` | 20/min | PDF render expensive (mevcut) |
| `/api/account/delete` | 1/hour | Idempotent değil, accidental double-click koruması (mevcut) |
| **diğer** (`/api/items`, `/api/stock-counts`, ...) | **120/min default** | **EKLE** |

---

## 8. Deep-dive: GDPR cascade policy

### 8.1 Relation policy matrix (önerilen)

User'a FK koyan 23 relation için önerilen policy (schema inspection gerekli — gerçek değerler `prisma/schema.prisma` ile doğrulanmalı):

| Relation | Mevcut policy | Önerilen | Gerekçe |
|---|---|---|---|
| `Membership.userId` | ? | Cascade | Org üyeliği user'a bağlı, orphan anlamsız |
| `Session.userId` | Cascade | Cascade | OK |
| `Account.userId` | ? | Cascade | OAuth/credentials bağlantısı |
| `TwoFactorAuth.userId` | ? | Cascade | User kredensiyelinin devamı |
| `Notification.userId` | Cascade | Cascade | OK |
| `Alert.createdByUserId` | ? | SetNull | Alert kaydı kalmalı, anonymize |
| `AuditLog.userId` | ? | SetNull | Compliance gereği kayıt kalır, actor anonim |
| `IdempotencyKey.userId` | ? | Cascade | Kısa-ömürlü, orphan faydasız |
| `Invitation.invitedById` | Cascade | Cascade | User gitti, gönderdiği invitation'lar geçersiz |
| `Invitation.acceptedById` | SetNull | SetNull | OK — davet kaydı kalır |
| `StockCount.countedByUserId` | SetNull | SetNull | Inventory tarih kalır, counter anonim |
| `Movement.createdByUserId` | SetNull | SetNull | Inventory hareket logu kalır |
| `PurchaseOrder.createdByUserId` | ? | SetNull | İş kaydı kalır |
| `Transfer.createdByUserId` | ? | SetNull | Aynı |
| `SalesOrder.createdByUserId` | ? | SetNull | Aynı |
| `ApiKey.userId` | ? | Cascade | User kredensiyelinin devamı |
| `OfflineOperation.userId` | ? | Cascade | Queue orphan anlamsız |
| (diğer 6 relation) | — | — | Schema'dan çıkarılacak |

### 8.2 Free-text scrub

Cascade policy doğru olsa bile, `Movement.notes`, `AuditLog.metadata`, `Notification.message` gibi free-text alanlarda user email/ismi geçebilir. İleri bir aşamada (v1.3+) bunlara bir scrub pass eklenebilir — ama bu v1.2 kapsamı dışında.

---

## 9. Deep-dive: State machines

### 9.1 Mevcut graph'lar

| Machine | State sayısı (tahmini) | Terminal | Rollback path |
|---|---|---|---|
| `stockcount/machine.ts` | ~6 | completed | rollback-policy'de |
| `sales-order/machine.ts` | ~5 | fulfilled | returned |
| `transfer/machine.ts` | ~4 | received | rejected |

### 9.2 Test coverage önerisi

Her machine için:
1. Initial state doğru
2. Happy path end-to-end
3. En az 1 forbidden transition
4. En az 1 rollback/cancel path
5. Context invariant (ör. fulfilled state'de allocated quantity = shipped quantity)

Toplam ~15 ek test. Vitest koşu süresine etkisi < 50ms (actor'lar sync).

---

## 10. Deep-dive: DR drill workflow

### 10.1 İlk drill adımları (manuel, 2-4 saat)

```
1. Vercel dashboard → Settings → Environment → Production → DATABASE_URL kopyala
2. Neon dashboard → "Branches" → "Create branch from latest" → disposable `drill-YYYY-MM-DD` branch
3. Drill branch'in DATABASE_URL'unu al
4. Local: export DATABASE_URL="postgresql://...drill-branch..."
5. pnpm prisma migrate deploy     # migration drift var mı?
6. pnpm vitest run                # 991 test yeşil mi?
7. pnpm e2e --grep @smoke         # Smoke path yeşil mi?
8. Süre ölç, docs/DR-drill-log.md'ye yaz
9. Neon drill branch'i sil (maliyet)
```

### 10.2 Otomatik scheduled drill

`.github/workflows/dr-drill.yml` — aylık cron:
```yaml
on:
  schedule: [{ cron: "0 3 1 * *" }]  # Ayın 1'i 03:00 UTC
  workflow_dispatch: {}
jobs:
  drill:
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install
      - name: Create Neon branch
        # ... Neon API ile branch oluştur, DATABASE_URL al
      - run: pnpm prisma migrate deploy
      - run: pnpm vitest run
      - run: pnpm e2e --grep @smoke
      - name: Log drill
        # ... docs/DR-drill-log.md'ye append
      - name: Cleanup Neon branch
        if: always()
```

Bu ayrı bir 1-2 günlük iş; v1.2 P2'de kapsamda.

---

## 11. Route-level sondaj (v1.1'den delta)

44 route'un rate-limit durumu (özet):

```
Covered (19):
  /api/auth/*                      (login, register, 2FA)
  /api/account/{delete, export}
  /api/onboarding/organization
  /api/migrations/[id]/{start, upload}
  /api/upload/image
  /api/reports/*/pdf               (10 route)
  /api/reports/{department-variance, variance-trend, abc-analysis, count-comparison}
  /api/billing/checkout            (indirect)

Uncovered (25):
  /api/items, /api/items/[id]
  /api/warehouses, /api/warehouses/[id]
  /api/bins, /api/bins/[id]
  /api/stock-counts, /api/stock-counts/[id], /api/stock-counts/[id]/variance
  /api/notifications, /api/notifications/[id]/read
  /api/integrations/shopify/sync
  /api/integrations/quickbooks/{oauth/callback, sync}
  /api/settings/{profile, team}
  /api/movements
  /api/transfers, /api/transfers/[id]
  /api/purchase-orders, /api/purchase-orders/[id]
  /api/alerts
```

Middleware-level default eklenirse 25'inin hepsi tek hamle ile kapanır.

---

## 12. v1.1'in kapatmadığı 2 "drift budget"

v1.1.1 `DOCUMENTED_GAPS` ve `KNOWN_METHOD_MISMATCHES`'i boşalttı. Bugün:
- `src/lib/openapi-parity.test.ts` `DOCUMENTED_GAPS = []`
- `KNOWN_METHOD_MISMATCHES = new Map()`

v1.2 boyunca yeni route eklenecekse (§5.34 middleware değişikliği, §5.39 session revoke, §5.44 cleanup-cronruns), her biri için **aynı anda**:
1. `@openapi-tag: <path>` header eklenmeli
2. `docs/openapi.yaml`'a path eklenmeli
3. `openapi-parity.test.ts` yeşil kalmalı

Yeni route'lar ile drift birikmesin — bu v1.2 remediation'ı boyunca tekrar edilecek disiplin.

---

## 13. Data model büyüme projeksiyonu (1-yıl)

| Tablo | Row/gün/tenant | 100 tenant/yıl | Retention cron | Risk |
|---|---|---|---|---|
| `Movement` | ~50 | 1.8M | yok | Hot-path index olmazsa seq scan |
| `Notification` | ~10 | 365K | **v1.1 §5.24 ✓** | OK |
| `AuditLog` | ~30 | 1.1M | yok | Retention politikası belirsiz |
| `CronRun` | 3/gün (total) | 1095 | **yok (§5.44)** | Yavaş büyüme ama bounded değil |
| `IdempotencyKey` | ~100 | 3.6M | yok | Hot-path, TTL gerekli |
| `OfflineOperation` | değişken | değişken | Dexie (client-side) | OK |

v1.2 §5.44 yalnızca `CronRun` için retention ekliyor. `AuditLog` ve `IdempotencyKey` retention'ı — v1.3 kapsamında olabilir.

---

## 14. Performance budget (öneri)

### 14.1 Önerilen limitler

| Metrik | Prod limit | Gerekçe |
|---|---|---|
| First-load JS | < 200KB | Next.js 15 RSC hedefi |
| LCP | < 2.5s | Core Web Vital |
| FID / INP | < 200ms | Interaction hedefi |
| CLS | < 0.1 | Layout shift |
| Bundle delta per PR | +5% warning, +10% fail | Regression alarm |

### 14.2 Tool zinciri

- **size-limit** — bundle boyutu PR-level gate
- **Lighthouse CI** — LCP/FID/CLS scheduled (haftalık)
- **@next/bundle-analyzer** — manuel analiz (şu an var, workflow'a bağlanmamış)

§5.43 bu zincirin kurulumunu spec ediyor.

---

## 15. Sıralı Remediation Backlog (Phase-3 Execution Prompt)

v1.0 + v1.1 protokolünü tekrar kullan: tier-by-tier, her fix + pinlenmiş test, auto-commit, tier kapanışında tag.

### 15.1 Phase 3.1 (P1 — 3 finding)

Tag hedefi: `v1.2.0-rc1-p1-remediations`

1. **§5.33** Analytics call-site follow-through — 6 activation event için call-site yerleştir (`items/actions.ts`, `warehouses/actions.ts`, `stock-counts/actions.ts`, scanner component); pinlenmiş test: `analytics-call-site-coverage.test.ts` EXPECTED_CALL_SITES map'i.
2. **§5.34** Rate-limit coverage — middleware-level default `120/min` + exempt list; pinlenmiş test: `api-rate-limit-coverage.test.ts` her route için middleware-covered veya route-level-wrapped.
3. **§5.35** GDPR delete cascade — `schema.prisma` cascade audit matrix + `gdpr-cascade.test.ts` (static) + `account-delete.test.ts` (integration).

### 15.2 Phase 3.2 (P2 — 5 finding)

Tag: `v1.2.0-rc2-p2-remediations`

4. **§5.36** State machine neighbor tests — `sales-order`, `transfer` için ≥5 test/machine; forbidden transitions + happy path + rollback.
5. **§5.37** OpenGraph metadata — `src/app/opengraph-image.tsx` fallback + marketing page metadata genişletme + `metadata-coverage.test.ts`.
6. **§5.38** DR drill evidence — ilk manuel drill + `docs/DR-drill-log.md` + scheduled workflow skeleton + `dr-drill-freshness.test.ts` (soft-fail).
7. **§5.39** Session revocation UI + API — `sessions/page.tsx` + `/api/account/sessions/[id]/revoke` route + integration test + password-change hook'u güncelle.
8. **§5.40** WCAG AA full sweep — axe-core + Playwright entegrasyonu + CRITICAL_PATHS[] + baseline violation kaydı + `a11y-token-contrast.test.ts`.

### 15.3 Phase 3.3 (P3 — 4 finding)

Tag: `v1.2.0-rc3-p3-remediations`

9. **§5.41** Stale Prisma dirs — temizle + `.gitignore` genişlet + `repo-hygiene.test.ts` extend.
10. **§5.42** Sentry sample rate — ortam-aware default + Vercel env vars dokümante + `sentry-config.test.ts`.
11. **§5.43** Performance budget — `size-limit` config + CI step + Lighthouse CI skeleton + `perf-budget.test.ts`.
12. **§5.44** CronRun retention — `cleanup-cronruns` cron + schedule + `route.test.ts`.

### 15.4 Stable branch updates

Her tier kapandığında:
```bash
git tag -a v1.2.0-rcN-pX-remediations -m "v1.2 PX remediations: <count> findings closed"
git branch -f stable HEAD
```

`push-v1.2-audit.command` helper script'i, v1.1'in push helper'ı ile aynı pattern'le, tier'lar kapandıkça güncellenir.

---

## 16. Definition of Done (v1.2 revision)

v1.1 §16'da 8 kalemlik DoD yazıldı. v1.2 onu **iki kalem** daha ekliyor:

Bir server action / API route / feature "done" sayılır, sadece ve sadece:

1. **İmza + Behavior test** — happy path + 1 error path pinlenmiş
2. **Audit log** — user-driven state change ise `recordAudit()` çağrısı
3. **Idempotency** — POST/PATCH ise `IdempotencyKey` kontratı (webhook'larda zaten var)
4. **Capability check** — `hasCapability(role, action)` server-side
5. **Input validation** — zod schema + `.safeParse()`
6. **Analytics event** — user milestone ise `track(AnalyticsEvents.X, ...)` **call-site parity test'e kaydedilmiş** (§5.33 ekledi)
7. **Error boundary** — hosting page'in segment-level `error.tsx`'ini kırmıyor
8. **i18n** — user-facing string `messages/en.ts`'te key olarak
9. **Rate-limit** — authenticated write endpoint ise middleware-default veya route-override altında (§5.34 ekledi)
10. **Cascade policy** — yeni User/Organization FK eklendiyse `gdpr-cascade.test.ts` EXPECTED map'ine yazılmış (§5.35 ekledi)

PR checklist güncellemesi:
```md
- [ ] Unit/behavior test eklendi
- [ ] Audit log var (veya not-applicable)
- [ ] Idempotency guard (mutation için)
- [ ] Capability check
- [ ] zod validation
- [ ] Analytics event + call-site parity (activation için)
- [ ] Error boundary var (segment'te)
- [ ] Hardcoded string yok (i18n key)
- [ ] Rate-limit covered (middleware default yeterli mi yoksa route-override mı?)
- [ ] GDPR cascade policy (User/Org FK eklendiyse)
```

---

## 17. Denetim Kapanışı

v1.0 sessiz yalanları kapattı. v1.1 sessiz boşlukları kapattı. v1.2'nin odağı: **"yaptığını iddia ettiği şeyi kanıtlamak"** — analytics ölçüyor ama call-site yok; rate-limit var ama coverage eksik; GDPR silme iddia ediliyor ama cascade testsiz; backup promise'i var ama drill yok; state machine kodu var ama graph testsiz.

12 finding. **P0 yok** — mevcut baseline (`v1.1.3-auth-429-message`) **launch-safe**. Ama v1.2 üç P1'i (§5.33, §5.34, §5.35) launch-sonrası **birinci sprint'e** kapatılmazsa, product-side metrikler (activation huni) ve security-side postür (brute-force, GDPR kanıtı) ikinci halka riski taşımaya devam eder.

Olgunluk skoru 6.5 → 6.8'e çıktı. Gerçek sıçrama P1'lerin kapatılmasından sonra beklenir (7.0+).

Önerilen sonraki adım: v1.2 Phase-3.1'e başla. Komut:

```
Read ONEACE-FULL-STACK-AUDIT-v1.2.md §5.33, §5.34, §5.35.
For each finding: fix → pin with test → auto-commit.
Tag v1.2.0-rc1-p1-remediations when tier closes.
Move `stable` to the tag.
```

— Son (v1.2 dossier). Remediation başladığında commit message'larına `§N.M` citation'u eklenmeli; v1.0 ve v1.1 ile aynı protokol. Phase 3.2 ve 3.3 aynı pattern'le ilerler; her tier'ın kapanışında `push-v1.2-audit.command` helper'ı güncellenir.
