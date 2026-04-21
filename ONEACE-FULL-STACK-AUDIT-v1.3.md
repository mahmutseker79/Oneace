# OneAce — Full-Stack Audit Dossier v1.3

**Proje:** OneAce (Next.js 15 Inventory / WMS SaaS)
**Repo:** `github.com/mahmutseker79/Oneace`
**Çalışma ağacı:** `~/Documents/Claude/Projects/OneAce/oneace`
**Deployed:** https://oneace-next-local.vercel.app
**Denetim anındaki sürüm:** `v1.5.17-vercel-dependabot-gate` (HEAD = `3b7e761`, `stable` = `3b7e761` — Mac push bekleniyor)
**Denetim tarihi:** 2026-04-19
**Denetim kapsamı:** **Post-incident lens.** 2026-04-18 tarihinde v1.5.13 edge-logger incident'i (`process.stderr.write` Edge Runtime'da → `MIDDLEWARE_INVOCATION_FAILED` → prod 500) bir günden fazla farkedilmeden durdu; çözüm tarafı hızlı, **görünürlük tarafı zayıf**. Bu dossier'ın açtığı "üçüncü halka" o görünürlük açıklarıdır — (a) observability + webhook delivery, (b) deploy pipeline resilience + rollback readiness, (c) rate-limit / plan telemetry sinyali, (d) ERP-correctness surface sweep (integrations DLQ, 2FA recovery).
**Yazar:** Claude (oneace-council DEEP PATH, post-v1.5.13 incident retrospective)

> **Okuma kontratı.** v1.0 (24 finding), v1.1 (14), v1.2 (12) ve v1.3-ADR-004 remediation'larının tamamı kapalıdır. v1.5 nav-IA programı da kapandı (`v1.5.0-nav-ia-complete`). Aşağıdaki 10 bulgu **bu kapanmış yüzeyin üstüne** eklenen ve v1.5.13 incident'inin açtığı pencereden görünen açıklardır. v1.2'de "call-site yok" (§5.33) / "rate-limit %43" (§5.34) / "GDPR cascade untested" (§5.35) gibi bulgular burada **tekrar açılmaz** — hepsi kapalı. Her bulgu yine `file:line` evidence ile bağlı ve pinned-test workflow'u için hazır.

---

## 0. Bu dokümanı nasıl okumalı

- **Severity:** `P0` = prod-blocker / veri kaybı; `P1` = sessiz güven erozyonu veya ops kör noktası; `P2` = kullanıcı-görünür pürüz; `P3` = polish.
- **Status:** `DARK` (telemetri var, sinyal eksik), `MISSING` (kategori yok), `FOLLOW-THROUGH` (v1.5.13-v1.5.17 fix'i başladı, v1.3 doğrula), `UNTESTED` (hot path, neighbor test yok), `DRIFT` (doc vs kod).
- **Evidence formatı:** `src/<path>:<line>` — `oneace/` root'a göreli. HEAD = `3b7e761` anında geçerli.
- **Önceki dossier'lara referans:** `(v1.X §N.M kapsamında değildi)` ya da `(v1.X §N.M follow-through)`.

---

## 1. Yönetici Özeti

v1.0 "sessiz yalanları" kapattı. v1.1 "sessiz boşlukları" kapattı. v1.2 "ölçüm doğruluğu" katmanını kapattı. v1.3'ün odağı **v1.5.13 incident'inin öğrettiği**: hata **üretiminden** → **görünürlüğüne** → **recovery'sine** giden operasyonel yolun her basamağındaki sinyal zayıflığı.

1. **Silent-main-webhook sendromu.** 2026-04-14 → 2026-04-18 arasında `main` branch'ine 3 push (merge `9241de8`, tag `v1.5.16`, retrigger `dcb144a`) ve stable'a 1 force-push yapıldı. Vercel sadece stable push'larını fark etti; `main` push'larının üçü için GitHub→Vercel webhook tetiklenmedi. Ne repo'da ne dashboard'da bunu izleyen bir sentinel yok — fark etmek için manuel Vercel dashboard ziyareti gerekti. (§5.45)

2. **Edge runtime safety generic değil.** v1.5.13 hotfix'i `src/lib/logger.ts`'deki `process.stderr.write` çağrısını `console.error`'a çevirdi ve `logger-edge-safety.test.ts` ile pinledi. Ama pinned test **sadece logger'a özgü**: başka edge-imported module'ler (`rate-limit.ts`, `middleware.ts`, `env.ts`) `process.env` dışında `process.*` ya da `Buffer.*` ya da `fs.*` kullanırsa aynı class-of-bug geri gelir. Guard module-specific, incident class-level. (§5.47)

3. **Deploy telemetrisi teorik kaldı.** `/api/health` Phase 7A/7B'de zenginleşti (DB + schema + migrations probe), ama bu endpoint'i **kim periyodik çağırıyor**, **hangi uptime dashboard'a yansıyor**, **503 dönerse nereye alert gidiyor** — hiçbiri repo'da yazılı değil. Vercel free-plan quota 80/100'de warning veren bir cron yok; 100'de bounce alınca sürpriz oldu. (§5.46, §5.48)

Bunların yanında 7 ikincil bulgu: Dependabot burst threshold alarm (§5.49), prod rollback playbook eksikliği (§5.50), plan-limit hit telemetrisi (§5.51), rate-limit 429 PostHog yansıması (§5.52), integrations DLQ discipline (§5.53), 2FA recovery code rotation policy (§5.54).

### 1.1 Olgunluk skor kartı (v1.2 → v1.3 delta)

| Boyut | v1.2 | v1.3 | Gerekçe |
|---|---:|---:|---|
| Product / IA | 7.5 | **8** | v1.5 nav-IA programı kapandı (breadcrumbs + counts + titles + linkage pinned) |
| Onboarding / Activation | 5.5 | **6.5** | 6 activation event'in 6'sı artık call-site'lı (v1.2 §5.33 kapandı) |
| Frontend / UI polish | 8 | 8 | Stabil |
| UX / Workflow correctness | 8 | 8 | Stabil |
| Backend / Domain | 7.5 | 7.5 | Stabil |
| Analytics / Data trust | 5 | **5.5** | Activation hunisi ölçülüyor; plan-limit telemetrisi yok (§5.51) |
| RBAC / Security / Tenancy | 7.5 | 7.5 | Rate-limit perimeter middleware-default stabil (v1.2 §5.34 kapandı) |
| Offline / PWA | 7.5 | 7.5 | Stabil |
| Performance / Scale | 7 | 7 | Stabil |
| Test / CI / Release confidence | 5 | **6** | ADR-004 migration-safety + edge-logger + vercel-config pinned — üç kritik sınıf-of-bug testle kapalı |
| Observability / Product metrics | 4.5 | **4** | Incident gösterdi: endpoint'ler var, çağıran sessiz; 429/plan-limit telemetrisi yok (§5.45, §5.46, §5.51, §5.52) |
| Internationalization | 4 | 4 | Stabil |
| Supply chain hygiene | 5 | **5.5** | Dependabot deploy-gate (v1.5.17) eklendi |
| DR / Ops readiness | 3.5 | **3** | Rollback playbook hâlâ yok; incident boyunca adımlar hafızadan çalıştırıldı (§5.50) |
| Accessibility depth | 5 | 5 | Stabil |
| **Edge runtime safety** | — | **4** | Yeni eksen: logger pinli, class-level generic guard yok (§5.47) |
| **Integration durability** | — | **4** | Yeni eksen: 15+ adapter var, DLQ/retry state modeli yok (§5.53) |
| **Genel** | 6.8 | **6.75** | Net ≈ nötr: nav-IA + activation propagation gelişim; observability + ops gerileme; toplam öğrenilen incident dersi 4 bulguda kilitli |

### 1.2 En çok önemli üç şey

Tek sprint varsa:
- **(a)** Vercel webhook delivery sentinel — yeni cron `/api/cron/vercel-webhook-health`: GitHub REST API'den son 10 `main` push'un `sha`'larını al, Vercel REST API'den o `sha`'lara karşılık deployment event'i sorgula; eksikse Sentry capture + PostHog `INFRA_WEBHOOK_SILENT` event. Pinned test: mock GitHub + mock Vercel, biri sessiz, Sentry capture çağrıldı assert. Operasyonel etki: silent-main-webhook 5dk içinde fark edilir. (§5.45)
- **(b)** `track(PLAN_LIMIT_HIT, { plan, feature, tenant })` — `src/lib/plans.ts`'deki limit-dönüşü call-site'larına ekle. Taxonomy zaten v1.1'den beri hazır (analytics/events.ts). Owner 7 gün içinde "Pro upgrade için en çok sıkışan feature" sorusunu ölçülebilir hale getirir; monetization grafiği aslen burada başlıyor. (§5.51)
- **(c)** `IntegrationTask` + `IntegrationDeadLetter` Prisma modelleri + `SyncEngine.enqueueRetry()` helper. 15 adapter (`src/lib/integrations/*/`) bu helper'ı kullanır; cron `/api/cron/process-imports` (zaten var) DLQ'ü okur, 3 retry sonrası owner'a Resend e-postası gönderir. Shopify/QB sync silent-failure biter, cascade DR imkanı doğar. (§5.53)

Bu üç hamle v1.3 Phase-3.1 (P1) çekirdeği: yüksek operational-trust impact, düşük regresyon riski, 1-2 günlük iş.

---

## 2. Sistem Şekli Özeti (v1.2'den delta)

### 2.1 Yeni eklenen veya kapasitesi değişenler (v1.2 → v1.5.17)

- **`src/lib/logger.ts`** — Edge runtime uyumlu (`console.error/log`, v1.5.13 hotfix).
- **`src/lib/logger-edge-safety.test.ts`** — 82 satır pinned test (prose regex + module-level assertion).
- **`src/lib/migration-safety.ts`** — ADR-004 header + SQL validator (v1.3.0-rc1 + v1.5.15 strict-index fix).
- **`src/lib/migration-safety.test.ts`** — ADR-004 pinned test (static-analysis vitest).
- **`vercel.json`** — `git.deploymentEnabled: { "dependabot/*": false }` (v1.5.17).
- **`src/lib/vercel-config.test.ts`** — 5-test pinned guard (v1.5.17).
- **v1.5 nav-IA program** — `breadcrumbs.ts`, `nav-titles-parity.test.ts`, `nav-counts-state.test.ts`, `nav-linkage.test.ts` (v1.5.0-v1.5.12).
- **`CronRun` ledger** — idempotency helper 3 cron'da aktif (v1.2 §5.44 follow-through sonrası retention kuralı hâlâ yok — yeniden açılmıyor, v1.2 kapsamı).

### 2.2 Route topolojisi

- `src/app/api/**/route.ts` → **48** route (v1.2'de 44'tü; delta: +4 = `/api/health` Phase 7B, `/api/cron/cleanup-cronruns`, `/api/billing/portal`, `/api/cron/process-imports`).
- `"use server"` içeren dosya → **54+** (v1.2.16 sonrası non-async export split ile temizlendi).
- Unit/integration test → **~110 dosya / ~1960 test** (v1.2'de 89/991; delta: +21 dosya, +970 test — v1.5 nav-IA pinning + ADR-004 + hotfix guard).

### 2.3 Route rate-limit coverage (v1.2 §5.34 kapanışı doğrulaması)

`src/middleware.ts:147` — tüm `/api/*` path'leri default IP-based rate-limit altında (exempt list: `/api/health`, `/api/webhooks/*`, `/api/cron/*` — bunlar ayrı secret-guard'da). 48 route'tan 21'i ayrıca per-route `withRateLimit` ile daha sıkı limitlere bağlı. Brute-force perimeter kapalı; v1.2 §5.34 "25 route açık" bulgusunun endişesi **middleware default** ile kapanmış durumda. **Bu dossier'da rate-limit coverage tekrar açılmıyor** — ama 429 telemetrisi ayrı bir finding (§5.52).

### 2.4 Dark/unused yüzey (v1.3'te yeni görünen)

| Yüzey | Durum | Not |
|---|---|---|
| Vercel project webhook delivery log | Dashboard-only, repo sentinel yok | §5.45 |
| `/api/health` probe caller | Belirsiz (uptime dashboard?, cron?) | §5.46 |
| Edge-imported module class-of-bug guard | Sadece logger için pinli | §5.47 |
| Plan-limit hit event | `plans.ts` mesaj üretiyor, track yok | §5.51 |
| `429` rate-limit hit | Middleware dönüyor, PostHog görmüyor | §5.52 |
| `IntegrationDeadLetter` model | YOK — 15 adapter webhook failure'ı sessiz düşer | §5.53 |
| `recoveryCode` rotation UI | Generate var, rotate/expire yok | §5.54 |

---

## 3. Dosya-dosya Audit Matrisi (yalnızca v1.3 için anlamlı olanlar)

| Dosya | Rol | Bulgu |
|---|---|---|
| `vercel.json`, Vercel dashboard webhook settings | Webhook delivery | **P1** (§5.45): MISSING sentinel |
| `src/app/api/health/route.ts` | Liveness + readiness probe | **P2** (§5.46): DARK caller surface |
| `src/lib/logger-edge-safety.test.ts:15-46` | Edge-logger prose guard | **P2** (§5.47): module-specific, class-generic değil |
| `src/middleware.ts`, `src/lib/rate-limit.ts`, `src/lib/env.ts` | Edge-imported modules | **P2** (§5.47): aynı class-of-bug sürprizine açık |
| Vercel plan settings + `/api/cron/*` | Quota ops | **P1** (§5.48): MISSING quota threshold alarm cron |
| `.github/dependabot.yml` + `vercel.json` git-gate | Dependabot ingestion | **P2** (§5.49): FOLLOW-THROUGH — burst alarm yok |
| `docs/runbooks/rollback.md` | Prod rollback playbook | YOK — **P1** (§5.50): MISSING |
| `src/lib/plans.ts`, `src/app/(app)/items/actions.ts`, `src/app/(app)/warehouses/actions.ts`, `src/app/(app)/users/actions.ts` | Plan-limit surface | **P1** (§5.51): DARK — `track()` yok |
| `src/middleware.ts:147-165`, `src/lib/analytics/track.ts` | 429 telemetry | **P2** (§5.52): DARK |
| `src/lib/integrations/sync-engine.ts`, `src/lib/integrations/base-client.ts`, 15x adapter dir | Integration retry | **P1** (§5.53): MISSING DLQ model |
| `src/lib/totp.ts`, `src/app/(app)/settings/security/two-factor-setup.tsx` | 2FA recovery codes | **P2** (§5.54): UNTESTED rotation/expiry |

---

## 4. 8 Yeni Çerçeve Sorusu

> v1.2 "yarın sabah" için sordu. v1.3 "o yarın sabah kör mü?" diye soruyor.

**S1. `main` branch'ine push yaptığımda Vercel bunu 60 saniye içinde fark ediyor mu?**
Şu an: belirsiz. 2026-04-14 → 2026-04-18 arasında 3 main push'un 3'ü de sessiz düştü, manuel dashboard ziyareti olmadan fark edilmezdi. (§5.45)

**S2. Prod `/api/health` şu an `200` mu `503` mü dönüyor? Bunu kim izliyor?**
Şu an: cevap için bizzat çağırmak gerek. Uptime dashboard bağlantısı repo'da yazılı değil. (§5.46)

**S3. `src/lib/env.ts` içinde yarın biri `Buffer.from` kullanırsa edge runtime'da patlar mı?**
Muhtemelen evet. Edge runtime `Buffer` yok (Web streams var). Guard module-specific: sadece `logger.ts` taranıyor. (§5.47)

**S4. Free-plan Vercel quota'sı 85/100'e geldiğinde bir alarm var mı?**
Hayır. Sinyal ancak 101. deploy'da "Resource is limited" error'u olarak geliyor. (§5.48)

**S5. Prod 500 vermeye başlasa **hangi deploy'u** promote ediyoruz?**
Kafadan cevaplanıyor. Doküman edilmiş "last known good deployment ID"si yok; rollback adımları 2026-04-18 incident'inde geçici memory'den çalıştırıldı. (§5.50)

**S6. 47 kullanıcı Free plan'da multi-warehouse'a takıldı. Owner bunu biliyor mu?**
Hayır. `plans.ts:L206` kullanıcıya "Upgrade to Pro" mesajı dönüyor, ama `track(PLAN_LIMIT_HIT, ...)` çağrısı yok. Monetization grafiği burada başlayamıyor. (§5.51)

**S7. Bir tenant'ın IP'si dakikada 500 `429` alıyor. PostHog'da bunu görüyor muyuz?**
Hayır. Middleware 429 dönüyor ama event emit etmiyor. Abuse spike sessiz. (§5.52)

**S8. Shopify webhook 3 gün üst üste `500` verirse kullanıcının haberi oluyor mu?**
Hayır. 15+ integration adapter var, ortak DLQ/retry state modeli yok. Sync sessiz düşer, owner "niye stok eşleşmiyor?" diye manuel debug eder. (§5.53)

---

## 5. Bulgular (tek liste, severity'ye göre)

### §5.45 — F-01 · Vercel webhook delivery monitoring eksikliği

**Severity:** P1 · **Status:** MISSING · **Evidence:** Vercel dashboard webhook delivery log (dış sistem); repo tarafında `src/app/api/cron/*` içinde webhook-health cron yok; `docs/` altında webhook-monitoring runbook yok.

**Problem.** 2026-04-14 → 2026-04-18 penceresinde `main` branch'ine yapılan 3 push'un (merge `9241de8`, tag `v1.5.16-main-merge-prod`, retrigger commit `dcb144a`) hiçbiri Vercel'de production build tetiklemedi. GitHub → Vercel webhook'u ya Vercel tarafında drop edildi ya sessiz düştü. Fark edilmesi ancak manuel Vercel dashboard ziyareti sonucu (deploy listesinde ilgili SHA'ların olmaması) oldu — bu 1+ gün sürdü. v1.5.13 hotfix'i repo'da hazır dururken prod 500 döndü.

**Neden önemli.** Bu sınıf kör nokta her infra-tarafı drift (Vercel GitHub App izin düşmesi, webhook secret rotation, Vercel plan downgrade) için aynen tekrar eder. Signal latency = ops latency.

**Fix.**

1. Yeni cron `src/app/api/cron/vercel-webhook-health/route.ts` (5 dakikada bir, Vercel cron ayrı quota'sı var — free plan'ın "api-deployments" limit'ini etkilemez). Adımlar:
   - GitHub REST `/repos/mahmutseker79/Oneace/commits?sha=main&per_page=10` → son 10 main SHA'sı.
   - Vercel REST `/v6/deployments?projectId=prj_9FjMCA1Iszsv1g0eJ1ZVDwJCuFE6&target=production&limit=30` → Vercel'in gördüğü son 30 production deployment.
   - GitHub'daki her SHA için Vercel'de karşılık var mı kontrol et. 1 eksik → Sentry `captureMessage("vercel-webhook-silent", { sha, githubTimestamp })`. 2+ eksik → Resend `ops@` adresine e-posta + PostHog `INFRA_WEBHOOK_SILENT`.
2. Pinned test `src/app/api/cron/vercel-webhook-health/route.test.ts` — GitHub API mock (3 SHA) + Vercel API mock (2 SHA). Beklenti: `Sentry.captureMessage` 1 kez çağrıldı, 3. SHA için. Static-analysis vitest değil (integration yeterli; HTTP client'ı wrap'le).

**Effort:** ~4 saat (cron route + Sentry + pinned test). **Regression riski:** Çok düşük — yeni cron, başka kodu etkilemiyor.

---

### §5.46 — F-02 · `/api/health` caller surface belirsizliği

**Severity:** P2 · **Status:** DARK · **Evidence:** `src/app/api/health/route.ts` (Phase 7A + 7B, DB + schema + migrations probe, 503 on degraded). `docs/` altında hangi uptime dashboard'un bu endpoint'i izlediği yazılı değil; Vercel project integrations listesinde ilgili bir monitor yok.

**Problem.** Endpoint production-ready — Phase 7B'de `_prisma_migrations` count probe'u bile var — ama caller surface'ı belirsiz. 503 dönerse kim duyuyor? UptimeRobot, BetterUptime, Vercel Monitoring, Sentry Crons — hiçbiri repo'da referanslanmıyor. Incident sırasında "sağlık check'i 503 mü döndü acaba?" sorusunun cevabı manuel curl ile alındı.

**Fix.**

1. Karar ver: Sentry Crons (zaten Sentry var, ekstra vendor yok) veya BetterUptime (daha zengin dashboard). Sentry Crons tercih edilmeli — tek vendor, cost ≈ 0.
2. `docs/runbooks/health-monitoring.md` yaz: endpoint URL'i, beklenen 200 response shape, 503 durumunda hangi alert routing'e düştüğü. Vercel project settings'e Sentry integration notu.
3. Pinned test yok — bu bir ops-side ayar kararı. `docs/runbooks/health-monitoring.md` eksikse yazılsın.

**Effort:** ~2 saat (Sentry Crons setup + runbook). **Regression riski:** Sıfır.

---

### §5.47 — F-03 · Edge-safety guard class-generic değil

**Severity:** P2 · **Status:** FOLLOW-THROUGH (v1.5.13-hotfix-edge-logger) · **Evidence:** `src/lib/logger-edge-safety.test.ts:15-46` sadece `src/lib/logger.ts` dosyasını prose tarıyor — `process.stderr.write` / `process.stdout.write` regex'i. `src/middleware.ts`, `src/lib/rate-limit.ts`, `src/lib/env.ts`, `src/lib/instrumentation.ts` edge-runtime-imported olmasına rağmen aynı tarama kapsamında değil.

**Problem.** Edge runtime'da yasak semantik yalnızca `process.stdout/stderr.write` değil:

- `Buffer.from()` / `Buffer.alloc()` — yasak
- `fs.readFileSync()` ve herhangi Node `fs` API — yasak
- `process.nextTick()` — yasak
- `setImmediate()` — yasak
- `crypto.createHash()` (node:crypto) — yasak; Web Crypto API kullanılmalı

v1.5.13 class-of-bug `process.stderr.write` üzerinden geldi ama başka bir developer yarın `rate-limit.ts`'e `Buffer.from(secret, 'base64')` eklerse middleware aynı şekilde 500 döner. Mevcut pinned test bu yolu görmez.

**Fix.**

1. Pinned test'i generic hale getir: `src/lib/edge-safety.test.ts` (rename veya yeni dosya). Tarama kapsamı: `src/middleware.ts` + `src/lib/**/*.ts` içinde **bir edge-import-graph'tan erişilebilen tüm dosyalar**.
2. Graph walk yok — basit yaklaşım: `runtime = "edge"` export eden tüm route'ları ve `src/middleware.ts`'i ve onların `import` graph'ini static olarak tara. Yasak pattern'ler için prose regex:

```typescript
const FORBIDDEN_PATTERNS = [
  { name: "process.stderr.write", re: /process\.stderr\.write\b/ },
  { name: "process.stdout.write", re: /process\.stdout\.write\b/ },
  { name: "Buffer.from", re: /\bBuffer\.from\b/ },
  { name: "Buffer.alloc", re: /\bBuffer\.alloc\b/ },
  { name: "fs.readFileSync", re: /\bfs\.readFileSync\b/ },
  { name: "process.nextTick", re: /\bprocess\.nextTick\b/ },
  { name: "setImmediate", re: /\bsetImmediate\b/ },
];
```

3. Import-graph walker için `dependency-cruiser` veya basit AST parser. İlk sürüm için **prose regex + explicit allowlist** yeterli: `src/middleware.ts`, `src/lib/rate-limit.ts`, `src/lib/env.ts`, `src/lib/logger.ts`, `src/lib/instrumentation.ts`.

**Effort:** ~3 saat (yeni test + allowlist). **Regression riski:** Düşük — mevcut kod zaten temiz, test sadece future-proofing.

---

### §5.48 — F-04 · Vercel quota threshold alarm eksikliği

**Severity:** P1 · **Status:** MISSING · **Evidence:** v1.5.17 `vercel.json` `git.deploymentEnabled` dependabot'u kapattı ama free-plan `api-deployments-free-per-day` (100/day) sayacını **izleyen** bir cron yok. 2026-04-18 incident'inde quota 100'e ulaşana kadar hiçbir sinyal gelmedi.

**Problem.** Free plan sessiz davranır: 99/100 → build başarılı, 100/100 → "Resource is limited - try again in 24 hours". Owner için bu bir **on-off switch gibi görünür**; oysa 80/100 geldiğinde bir warning almış olsa Dependabot PR burst'üne müdahale edilirdi.

**Fix.**

1. Cron route `src/app/api/cron/vercel-quota-health/route.ts` (saatlik, §5.45 ile aynı pattern). Vercel REST `/v2/user` veya account usage endpoint'inden günlük deploy sayacı oku. >80% → Sentry `captureMessage("vercel-quota-threshold-80", { used, limit })`. >95% → Resend e-postası.
2. Pinned test: mock Vercel API response'u (used=85, limit=100), Sentry capture 1 kez çağrıldı assert.

**Effort:** ~3 saat. **Regression riski:** Sıfır.

---

### §5.49 — F-05 · Dependabot burst alarm pinned değil

**Severity:** P2 · **Status:** FOLLOW-THROUGH (v1.5.17) · **Evidence:** `.github/dependabot.yml` haftalık Pazartesi schedule + `open-pull-requests-limit: 5`. `vercel.json` `git.deploymentEnabled: { "dependabot/*": false }` (v1.5.17). Ama açık PR sayısı 5'i aşarsa ya da ingestion-time gibi ani burst (major migration, repo re-init) gelirse bunu izleyen bir sentinel yok.

**Problem.** v1.5.17 **preview build** tarafını kapattı (Vercel quota). Ama Dependabot'un 20+ PR açması **yine de gürültü** — PR list UI kalabalıklaşır, gerçek hotfix PR'lar gözden kaçar. v1.5.17 "quota tarafını" kapattı, "attention tarafını" değil.

**Fix.**

1. Cron `/api/cron/dependabot-burst-check` (günlük): GitHub REST `/repos/.../pulls?state=open&base=main` → yazar `dependabot[bot]` filtresi → count. >8 → Sentry warning (policy 5, buffer 3'e kadar tolere).
2. Pinned test: GitHub mock (10 dependabot PR), Sentry capture beklenir.

**Effort:** ~2 saat. **Regression riski:** Sıfır. **Not:** P2 çünkü v1.5.17 production impact'i zaten aldı; bu aesthetic/attention surface.

---

### §5.50 — F-06 · Prod rollback playbook eksikliği

**Severity:** P1 · **Status:** MISSING · **Evidence:** `docs/runbooks/` altında rollback.md yok. 2026-04-18 incident'i boyunca "hangi deploy'u promote edeyim" kararı geçici memory'den çalıştı: `dpl_gE67LKhWJitkL7YxYx2rwdQ9fxMB` (v1.2.16, pre-hotfix) vs `dpl_cTbSr4k95E1Sgt37oWbQsss8UTqe` (v1.5.13 stable preview).

**Problem.** 5 yıl sonra farklı bir insan aynı sorunu yaşarsa:
- "Son known-good production deployment'ın ID'si ne?" → cevap yok.
- "Deploy protection auth wall'a takılırsak ne yapıyoruz?" → cevap yok.
- "Promote also builds, quota bitmişse ne yapıyoruz?" → incident sırasında keşfedildi, yazılı değil.

Incident response'un bir sonraki round'unda aynı 1 saat manuel debug tekrar harcanır.

**Fix.**

1. `docs/runbooks/prod-rollback.md` yaz. Bölümler:
   - **Last known good deployment** — her release commit'inde güncellenen bir ledger (`docs/runbooks/.last-known-good.json` + pre-commit hook).
   - **Rollback path A**: Vercel dashboard → Deployments → last-known-good `dpl_...` → "Promote to Production". Süre: ~5 dk (cache varsa) / ~3 dk (yoksa).
   - **Rollback path B** (promote quota hit): Git revert commit + force push stable + stable preview'i promote.
   - **Rollback path C** (webhook silent): Manual deployment oluşturma (Vercel dashboard → Create Deployment).
   - **Deployment Protection bypass**: Signature-based `_vercel_share` URL nasıl üretilir, 23-saat TTL.
2. Pre-commit hook `scripts/update-last-known-good.sh` — `git tag | grep -E "^v[0-9]+" | tail -1` → JSON'a yaz. Her release tag sonrası otomatik günceller.

**Effort:** ~4 saat (runbook yazımı + pre-commit hook). **Regression riski:** Sıfır.

---

### §5.51 — F-07 · Plan-limit hit telemetrisi yok

**Severity:** P1 · **Status:** DARK · **Evidence:** `src/lib/plans.ts:L206` kullanıcıya `"Bin-level inventory tracking is available on Pro and Business plans. Upgrade to continue."` mesajı dönüyor ama `track(...)` çağrısı yok. `src/app/(app)/items/actions.ts`, `src/app/(app)/warehouses/actions.ts`, `src/app/(app)/users/actions.ts` plan-limit guard'larını çağırıyor ama hit'i event'e çevirmiyor.

**Problem.** Monetization sinyali sıfır. Owner "Free plan kullanıcıları en çok hangi feature'da takılıyor?" sorusunu cevaplayamıyor. Pro upgrade CTA'sının yerleştirileceği high-intent an **ölçülmüyor** = optimize edilemiyor.

**Taxonomy zaten hazır:** `src/lib/analytics/events.ts` içinde `PLAN_LIMIT_HIT` sabitini ekle (yeni event, parity test (`analytics-events-coverage.test.ts`) bunu görür ve call-site yoksa fail eder — §5.33 v1.2 follow-through pattern'i).

**Fix.**

1. `src/lib/analytics/events.ts` → `PLAN_LIMIT_HIT` event ekle. Properties: `plan` (free/pro/business), `feature` (bin_tracking, multi_warehouse, advanced_reports, ...), `tenantId`, `userId`.
2. `src/lib/plans.ts` guard fonksiyonlarına (örn. `requireBinTrackingAccess`, `requireMultiWarehouseAccess`) `track(PLAN_LIMIT_HIT, ...)` çağrısı ekle — guard fırlatmadan **önce**.
3. Pinned test `src/lib/plans-telemetry.test.ts`: vi.mock('@/lib/analytics/track'), guard'ı çağır, `track` 1 kez doğru payload ile çağrıldı assert. Static-analysis değil, birim testi (lightweight).

**Effort:** ~3 saat. **Regression riski:** Düşük — mevcut guard davranışını değiştirmez, sadece event emit eder.

---

### §5.52 — F-08 · Rate-limit 429 telemetry eksikliği

**Severity:** P2 · **Status:** DARK · **Evidence:** `src/middleware.ts:147-165` 429 döndüğünde `X-RateLimit-Remaining: 0` header set ediyor ama PostHog `track()` çağrısı yok. `src/lib/rate-limit.ts` içinde de event emit yok.

**Problem.** Abuse spike sessiz. Bir tenant dakikada 500 `429` alıyorsa bu ya buggy integration ya da brute-force — ikisinin de owner'a gitmesi lazım. Şu an ancak Vercel analytics dashboard'da "5xx rate" bakarak dolaylı fark edilir.

**Fix.**

1. `src/middleware.ts` 429 branch'ine `track(RATE_LIMIT_HIT, { path, ip, tenantId })` ekle (tenantId mümkünse session'dan, yoksa null). Taxonomy: `RATE_LIMIT_HIT` event'ini `src/lib/analytics/events.ts`'e ekle.
2. Pinned test `src/middleware.rate-limit-telemetry.test.ts`: mock rate-limit `{ success: false }`, middleware çağır, `track` 1 kez doğru payload ile çağrıldı assert.

**Effort:** ~2 saat. **Regression riski:** Düşük.

---

### §5.53 — F-09 · Integrations DLQ/retry discipline eksikliği

**Severity:** P1 · **Status:** MISSING · **Evidence:** `src/lib/integrations/` altında 15 adapter dizini (amazon, bigcommerce, magento, odoo, quickbooks, quickbooks-desktop, shopify, wix, woocommerce, xero, zoho, custom-webhook, ...) + `sync-engine.ts` + `base-client.ts` + `conflict-resolver.ts`. `prisma/schema.prisma` içinde `IntegrationTask` ve `IntegrationDeadLetter` modelleri yok. `retryCount`, `nextAttemptAt`, `errorKind` kolonları hiçbir integration modelinde yok.

**Problem.** Shopify webhook 3 gün üst üste `500` verirse:
- Adapter exception fırlatır.
- `sync-engine.ts` (muhtemelen) log'lar ve çıkar.
- Kullanıcıya bildirim yok.
- Owner "stok neden eşleşmiyor?" diye manuel debug eder.
- Retry olmadığı için webhook gönderen tarafta dead-letter'a düşer → veri kaybı.

Bu ERP-correctness probleminin kendisi: stok/finans sayıları **external source-of-truth** ile senkronize tutulamıyorsa kayıt-gerçeklik ayrışır.

**Fix (Phase-3.1 çekirdeği):**

1. Prisma model `IntegrationTask`:

```prisma
model IntegrationTask {
  id            String   @id @default(cuid())
  organizationId String
  integrationKind String   // "shopify" | "quickbooks" | "amazon" | ...
  taskKind      String   // "sync_products" | "sync_inventory" | "webhook_received"
  payload       Json
  status        String   // "pending" | "in_progress" | "done" | "dead"
  retryCount    Int      @default(0)
  nextAttemptAt DateTime?
  lastError     String?
  lastErrorKind String?  // "auth" | "rate-limit" | "500" | "schema-mismatch"
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  @@index([status, nextAttemptAt])
  @@index([organizationId, integrationKind])
}
```

2. `src/lib/integrations/sync-engine.ts` içine `enqueue(task)` + `retry(task)` + `markDead(task)` helper'ları. Exponential backoff: 1min, 5min, 30min, 2h, 8h. 3. retry'dan sonra `status = "dead"` + Resend e-postası.
3. Cron `/api/cron/process-imports` (zaten var) queue consumer haline getir. Her çalışmasında `status: "pending" AND nextAttemptAt <= now()` → işle → başarı: `status: "done"`, hata: `retryCount++`, `nextAttemptAt = now() + backoff(retryCount)`.
4. 15 adapter'in `try/catch` exception path'leri `throw` yerine `enqueue()` çağırsın.
5. Pinned test `src/lib/integrations/sync-engine-dlq.test.ts`: vitest + Prisma test-db veya memory fake. 3 kere `shopify-sync` başarısız → `status: "dead"`, Resend mock çağrıldı assert.

**Effort:** ~2 gün (migration + helper + adapter refactor + pinned test). **Regression riski:** Orta — 15 adapter'in retry behavior'u değişir. Mitigate: feature-flag per-integration, staged rollout.

**Dinamik uzman çağrı:** Bu finding Shopify Integration + QuickBooks Integration uzmanlığına dokunuyor. Çağrı nedeni: webhook retry contract'ları farklı (Shopify HMAC re-verify ister, QB OAuth token refresh'i exception eşiğine girer). Katkıları: adapter'in her birinin `errorKind` classifier'ı (auth vs rate-limit vs 500) kendi API semantiğine göre yazılmalı — generic `catch (e) { enqueue() }` kaba olur. Her adapter için ~30dk classifier yazımı.

---

### §5.54 — F-10 · 2FA recovery code rotation/expiry policy eksikliği

**Severity:** P2 · **Status:** UNTESTED · **Evidence:** `src/lib/totp.ts` recovery code **generate** eder; `src/app/(app)/settings/security/two-factor-setup.tsx` kullanıcıya bir kez gösterir. Rotate UI yok, expiry yok, used-code tracking yok (Prisma `TwoFactorAuth` modelinde `recoveryCodesUsed` array kolonu var mı? — schema'ya bakılmadı, ama UI-side rotate akışı yok).

**Problem.** Kullanıcı recovery code'u bir kez aldı, cüzdanına koydu. 2 yıl sonra cüzdanı kaybetti. Ya da birisine gösterdiği için compromise oldu. Rotate yapamıyor — yeni kod üretmek için full 2FA setup reset gerekli, ki bu aşamada auth-factor kaybedilmiş olabilir (catch-22).

**Fix.**

1. `src/app/(app)/settings/security/two-factor-setup.tsx` içine "Generate new recovery codes" CTA'sı. Eski kodları invalide et (set `TwoFactorAuth.recoveryCodes` = new array), yeni 10 kod göster.
2. Policy: recovery code tek-kullanımlık; `used` set et. Expire: 1 yıl sonra `track(RECOVERY_CODE_EXPIRED, ...)` + UI banner "Refresh your recovery codes".
3. Pinned test `src/app/(app)/settings/security/security-actions.test.ts` (zaten var) — rotate fonksiyonu için test ekle: eski kodlar invalide, yeni kodlar Prisma'da saklı, `track` çağrıldı.

**Effort:** ~4 saat (UI + action + test). **Regression riski:** Düşük — mevcut 2FA setup akışı değişmez, yeni flow eklenir.

---

## 6. Alan Skor Kartı

| Alan | Bulgu sayısı | P1 | P2 | P3 | Toplam effort |
|---|---:|---:|---:|---:|---:|
| A — Observability | 3 (§5.45, §5.46, §5.47) | 1 | 2 | 0 | ~9 saat |
| B — Deploy pipeline resilience | 3 (§5.48, §5.49, §5.50) | 2 | 1 | 0 | ~9 saat |
| C — Rate-limit + plan telemetry | 2 (§5.51, §5.52) | 1 | 1 | 0 | ~5 saat |
| D — ERP-correctness surface | 2 (§5.53, §5.54) | 1 | 1 | 0 | ~20 saat |
| **Toplam** | **10** | **5** | **5** | **0** | **~43 saat** |

---

## 7. Incident-Forensics Ekran Özeti

v1.5.13 incident'inin yol haritası (retrospective):

| Aşama | Aldığı süre | Neden? |
|---|---|---|
| Bug yazıldı | geçmiş | `process.stderr.write` edge-safe değildi |
| Prod'a deploy | ~dakika | Webhook OK, build OK |
| Bug tetiklendi | ilk request | Rate-limit Redis unconfigured → logger.warn → Edge crash |
| Fark edildi | **~1 gün** | Uptime probe client yok (§5.46); manual gözle farkedildi |
| Fix yazıldı | ~1 saat | `console.error` substitution + pinned test |
| Fix push edildi | ~dakika | Fix commit → stable push OK |
| Fix prod'a çıkmadı | **~1+ gün** | Silent-main-webhook (§5.45) + free-plan quota exhausted (§5.48) |
| Workaround — quota | **beklendi** | UTC midnight reset, alternatif yok |
| Workaround — webhook | **dashboard-only** | Rollback runbook yok (§5.50) |

**Retrospective ders:** Bug-to-fix yol hızlı. **Fix-to-prod** yol şeytanda. v1.3 dossier'ı bu ikinci yolu açan 10 bulgudur.

---

## 8. Phase-3 Execution Prompt

### 8.1 Phase-3.1 (P1, tek sprint)

Hedef: 5 P1 bulguyu kapat (§5.45, §5.48, §5.50, §5.51, §5.53). Süre: ~1-2 gün.

1. `vercel-webhook-health` cron + test (§5.45) — 4 saat.
2. `vercel-quota-health` cron + test (§5.48) — 3 saat.
3. `docs/runbooks/prod-rollback.md` + pre-commit ledger (§5.50) — 4 saat.
4. `PLAN_LIMIT_HIT` event + track() call + test (§5.51) — 3 saat.
5. `IntegrationTask` + DLQ pattern (§5.53) — 16 saat (en büyük kalem).

**Commit plan:** Her bulgu kendi commit'i, tag: `v1.5.19-p1-webhook-sentinel`, `v1.5.20-p1-quota-sentinel`, ... `v1.5.23-p1-integration-dlq`. Stable branch FF her P1 sonrası.

### 8.2 Phase-3.2 (P2, opportunistic)

§5.46, §5.47, §5.49, §5.52, §5.54 — toplam ~14 saat. Teknik borç sprint'ine veya Phase-3.1 yavaşlarsa araya sıkıştır.

---

## 9. Dinamik Uzman Katkıları (bu dossier için)

- **Shopify Integration** (§5.53): Shopify webhook HMAC re-verify + rate-limit 2/sec semantiği. Adapter'in `errorKind` classifier'ı HTTP status + Shopify-specific header'ları okumalı.
- **QuickBooks Integration** (§5.53): QB OAuth token refresh exception'ı retry'a girmeden önce re-auth. Dead-letter'a düşerken owner'a **reconnect URL** gönderilmeli.
- **Security** (§5.54): Recovery code'un rotate akışı auth-factor-independent olmalı — mevcut 2FA session üzerinden, şifre re-entry ile.

---

## 10. Referans

- v1.0 dossier: closed (24 finding)
- v1.1 dossier: closed (14 finding)
- v1.2 dossier: closed (12 finding)
- v1.3 dossier: **bu doküman** (10 finding, post-v1.5.13 incident lens)
- v1.5 nav-IA program: closed (12 steps, `v1.5.0-nav-ia-complete`)
- v1.5.13 incident log: `~/Documents/Claude/Projects/OneAce/oneace/push-v1.5.17-vercel-gate.command` + auto-memory `oneace_prod_deploy_state.md`
- ADR-004 (migration safety): `src/lib/migration-safety.ts` + test, closed

---

**Denetim sonu.** 10 bulgu açık; remediation Phase-3.1 ile başlar. Dosyanın kendisi git'te commit edilir, tag: `v1.5.18-audit-v1.3-dossier-opened`.
