# OneAce Launch Checklist

Pre-launch verification list for the first public release.

## Code & Infrastructure ✅

- [x] TypeScript clean (0 errors)
- [x] Biome lint clean
- [x] 327/327 tests passing
- [ ] `pnpm install` (installs stripe package)
- [ ] `pnpm typecheck` — confirm 0 errors with stripe installed
- [ ] `git push origin main`

## Database ✅

- [ ] `npx prisma migrate deploy` (applies 2 outstanding migrations)
  - `20260413120000_p10_2_alerts_notifications`
  - `20260414120000_p12_stripe_billing`
- [ ] Verify migration ran: check `_prisma_migrations` table in production

## Stripe Setup

- [ ] Create Stripe account (or use existing)
- [ ] Create Pro monthly product + price ($29/mo)
  → copy price ID to `STRIPE_PRO_PRICE_ID`
- [ ] Create Business monthly product + price ($79/mo)
  → copy price ID to `STRIPE_BUSINESS_PRICE_ID`
- [ ] Set up webhook endpoint in Stripe dashboard:
  - URL: `https://yourapp.com/api/billing/webhook`
  - Events: `checkout.session.completed`, `customer.subscription.updated`,
    `customer.subscription.deleted`, `invoice.payment_failed`
  → copy webhook signing secret to `STRIPE_WEBHOOK_SECRET`

## Vercel Environment Variables

Required (must be set before deploying):
```
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
BETTER_AUTH_SECRET=<32+ char random string>
BETTER_AUTH_URL=https://yourapp.com
NEXT_PUBLIC_APP_URL=https://yourapp.com
```

Billing (required for Stripe to work):
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_BUSINESS_PRICE_ID=price_...
NEXT_PUBLIC_SENTRY_DSN=https://...@ingest.sentry.io/...
SENTRY_DSN=<same value>
```

Optional:
```
RESEND_API_KEY=re_...
MAIL_FROM=noreply@yourapp.com
LOG_LEVEL=info
REGISTRATION_ENABLED=true   (set to false after creating owner account)
```

## Post-Deploy Verification

- [ ] `GET /` — landing page loads
- [ ] `GET /pricing` — pricing page loads with competitor table
- [ ] `GET /docs` — docs index loads
- [ ] `GET /docs/getting-started` — sub-page loads
- [ ] `GET /sitemap.xml` — sitemap renders
- [ ] `GET /robots.txt` — robots.txt renders
- [ ] `/opengraph-image` — og:image renders (check in browser)
- [ ] Register a new account — creates FREE org
- [ ] Create an item, warehouse, movement — basic flow
- [ ] `GET /api/health` — returns healthy status
- [ ] Stripe test checkout — verify plan upgrades
- [ ] Webhook test — verify `stripe listen` works

## Registration Gate

After creating the owner account, optionally disable public registration:
```
REGISTRATION_ENABLED=false
```
New users join via invitation only.

## Monitoring

- [ ] Sentry project created and DSN set
- [ ] Vercel deployment notifications enabled
- [ ] First error alert tested (throw an error in a test env)

## Launch Day

- [ ] Run beta smoke-test matrix (see `docs/beta-smoke-test.md`)
- [ ] Invite 3–5 beta users
- [ ] Monitor Sentry for first 24 hours
- [ ] Monitor Stripe webhook delivery in Stripe dashboard
