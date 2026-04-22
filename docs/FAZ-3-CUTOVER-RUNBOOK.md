# Faz 3 — Netlify Cutover Runbook

**Scope.** Vercel'de çalışan OneAce prod'unu (`oneace-next-local.vercel.app`) Netlify'e (`oneace-next-local.netlify.app`) taşımanın son adımı: DNS + Shopify webhook + QuickBooks webhook flip.

**Precondition.** Faz 1 (netlify.toml + cron bridges, tag `v1.5.31`) ve Faz 2 (platform-agnostic cron split, tag `v1.5.32`) merged ve yeşil. Bu runbook sadece **cutover operasyonu** için — kod değişikliği içermez (auth.ts trustedOrigins + pinned test hariç, onlar bu tag altında — `v1.5.33-faz3-cutover-plan`).

**Council karar dosyası.** Seçenek C — dual-delivery + senkron DNS flip. Rationale: Shopify dual-subscribe destekli + idempotency kodumuzda canlı (`src/app/api/integrations/shopify/webhooks/idempotency-policy.test.ts`) → parity window'da çift event zararsız. QuickBooks tek URL → DNS ile senkron flip zorunlu.

---

## Cutover Timeline

### T-48h — Netlify bootstrap + smoke

**Mac-side**, netlify CLI + vercel CLI authenticated:

```bash
cd ~/Documents/Claude/Projects/OneAce/oneace
git checkout netlify-poc
git pull
./scripts/faz3a-bootstrap-netlify.sh
```

**Expected.** Script idempotent. İlk çalıştırmada:
1. `oneace-next-local.netlify.app` site'ı oluşur (zaten varsa skip).
2. `vercel env pull` → `.env.vercel.snapshot` → `netlify env:import`. **Kritik env'ler**: `DATABASE_URL`, `SHOPIFY_API_SECRET`, `QUICKBOOKS_*`, `BETTER_AUTH_SECRET`, `SENTRY_DSN`.
3. İlk prod deploy tetiklenir (Netlify branch = `netlify-poc`).
4. Smoke: `/api/health`, `/api/integrations/shopify/webhooks` (POST w/ dummy HMAC → 401 expected), `/api/integrations/quickbooks/webhooks` aynı şekilde.

**Exit gate.**
- `curl -I https://oneace-next-local.netlify.app` → 200
- Netlify build log'da "Ready" + "published"
- Sentry'de Netlify deploy event görünür
- `./scripts/verify.sh deploy` çalıştır → pass

**Bu gate düşerse**: T-0'a GİTME. Netlify deploy'u debug et, tekrar bootstrap çalıştır.

### T-24h — DNS TTL azalt

**DNS provider panelinde** (Cloudflare / Route53 / vb.):

1. A record (veya CNAME) için TTL'i **60 saniye**ye indir (şu anki değer ne olursa olsun).
2. Kaydet ve 24h bekle (mevcut cache expire olsun).

**Neden.** Flip anında hata olursa DNS revert maksimum 60s'lik gecikme ile propagate olur. Hiç değiştirmezsen TTL 3600 veya daha uzun olabilir → 1h+ kesinti.

### T-12h — Shopify dual subscription

**Shopify admin (veya Partner dashboard)** üzerinden, her aktif webhook topic için:

1. Mevcut subscription'ı **silme**. Hâlâ vercel.app'e basacak.
2. **İkinci subscription ekle**: aynı topic, URL = `https://oneace-next-local.netlify.app/api/integrations/shopify/webhooks`.
3. HMAC secret ikisi için de aynı (aynı Shopify app secret'i → aynı `SHOPIFY_API_SECRET` env'i).

**Parity check (sandbox'tan, sonraki 12h içinde)**:

```bash
# Log'da iki origin'den de aynı X-Shopify-Webhook-Id görünmeli
grep "x-shopify-webhook-id" /var/log/sentry-breadcrumbs | awk '{print $N}' | sort | uniq -c | sort -n
```

Her `webhook-id` için 2 kayıt: biri Vercel, biri Netlify. Idempotency tablosu (`ShopifyWebhookEvent`) ikinci kaydı reject eder → veri drift olmaz.

**Hata durumu.** Eğer Netlify tarafı 500'e giderse:
- Shopify ikinci subscription'ı sil, eski tek-subscription moduna dön.
- Netlify logs + Sentry'de root cause bul.
- Fix merge + redeploy, tekrar ikinci subscription ekle.

### T-0 — DNS flip + QuickBooks URL swap

**Bu üç adım aynı dakika içinde yapılmalı.** Sıra:

1. **QuickBooks developer portal** — app settings → Notifications URL → yeni URL:
   `https://oneace-next-local.netlify.app/api/integrations/quickbooks/webhooks`
   Save. (QB verification ping gönderir, yeni URL 200 dönmeli — smoke'dan biliyoruz.)

2. **DNS A/CNAME kaydı** — Vercel origin → Netlify origin swap. TTL 60s.

3. **Shopify eski (Vercel) subscription sil** (dual-delivery kapanır). İsteğe bağlı: 24-48h daha bekle, Vercel tarafı sessizleşsin, sonra sil.

**Observability gate (ilk 30 dk).**
- Sentry error rate Netlify tarafında eski baseline'ın max %2 üzerinde mi? → OK
- Webhook handler p50 latency < 500ms, p99 < 2s mi? → OK
- `/api/health` 200 dönüyor mu? → OK
- ERP-kritik event'ler (inventory, order) parity dashboard'unda Vercel ≈ Netlify'a mı akıyor? → OK

Herhangi biri kırmızı → **ROLLBACK**.

### T+7d — Vercel warm shutdown

1. Vercel project → **Pause**. Production deploy durdurulur, env'ler korunur.
2. Vercel'deki aktif dependabot/PR preview deploy'lar yeşilse, birkaç gün daha izle (Netlify branch deploy paralel çalışıyor).
3. T+14d → Vercel project → **Delete** (env'i önce JSON export et).

---

## Rollback prosedürü

**Herhangi bir post-flip observability gate'i kırılırsa, DNS TTL=60s sayesinde aşağıdaki sırada revert edebiliriz:**

1. **DNS** — A/CNAME → Vercel origin'e geri. En fazla 60s propagation gecikmesi.
2. **QuickBooks** — developer portal → eski Notifications URL (`vercel.app`) geri yaz. QB retry penceresi 24h → cutover anındaki event'ler eski URL'de replay edilir.
3. **Shopify** — vercel.app subscription'ı zaten silmemişsen (dual window'dasın) hiçbir şey yapmana gerek yok. Sildıysen, manuel olarak yeniden oluştur. Shopify retry 48h.
4. Vercel prod aktif, Netlify branch deploy kalır — tekrar debug + retry için.

**Rollback karar kriteri** — aşağıdakilerden herhangi biri:
- Error rate baseline'ın 2x üstü, 10 dk sürüyor
- Critical webhook (inventory/order) fail rate %5'in üstü
- p99 latency > 5s
- Sentry'de unhandled exception akışı (> 5/dk)

---

## Kritik env var'ların her iki platformda eşitliği

Bootstrap script env'leri import eder. Ama aşağıdakiler **manuel doğrulama** gerektirir (platform-agnostic olmayan değerler):

| Env var | Vercel | Netlify |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://oneace-next-local.vercel.app` | `https://oneace-next-local.netlify.app` |
| `BETTER_AUTH_URL` | aynı ↑ | aynı ↑ |
| `DATABASE_URL` | same | same (ikisi aynı DB'ye bağlanıyor) |
| `SHOPIFY_API_SECRET` | same | same |
| `QUICKBOOKS_CLIENT_SECRET` | same | same |
| `BETTER_AUTH_SECRET` | same | same |
| `CRON_SECRET` | same | same (Netlify scheduled functions bunu kullanır) |

`auth.ts` trustedOrigins (bu tag altında) **iki** fallback origin içerir — `NEXT_PUBLIC_APP_URL` lag'lerse bile session reject olmaz.

---

## Pinned test kapsamı

`src/lib/faz3-cutover/faz3-cutover-readiness.static.test.ts` şunları kilitliyor:
1. Webhook route dosyalarında hardcoded hostname yok (platform-agnostic).
2. `auth.ts` trustedOrigins hem vercel hem netlify fallback içeriyor.
3. Bu runbook doc'u mevcut ve 5 cutover fazı (T-48h / T-24h / T-12h / T-0 / T+7d) işaretli.
4. Runbook her iki webhook sağlayıcısını (Shopify + QuickBooks) anıyor.
5. Rollback path belgelenmiş.

Bu test her verify.sh deploy çalıştırmasında koşar — Faz 3 yeşilken merge'i bloklar.

---

## Post-cutover cleanup (T+14d sonrası, ayrı tag)

- `auth.ts` trustedOrigins → vercel.app fallback'ini sil, sadece netlify.app kalsın.
- `faz3-cutover-readiness.static.test.ts` → vercel-app-fallback assertion'ını sil.
- Vercel project delete.
- `vercel.json` → sil veya `deprecated.vercel.json` olarak arşivle.
- Memory kaydı: `oneace_prod_deploy_state.md` → "Netlify prod only, Vercel decommissioned".

Ayrı tag: `v1.6.0-vercel-decommissioned` (MINOR bump — platform değişti).
