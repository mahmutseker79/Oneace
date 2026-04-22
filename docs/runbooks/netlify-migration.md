# Netlify Migration Runbook

**Status:** Faz 1 POC scaffold landed 2026-04-22. Vercel remains primary production.
**Owner:** Mahmut
**Related docs:** `docs/runbooks/prod-rollback.md`, audit v1.3 F-01/F-04, auto-memory `oneace_prod_deploy_state.md`.

---

## Why this migration exists

Vercel Hobby plan Build Minutes quota (`3h 32m / 0s`) silently rejects git webhook builds when the monthly rolling window is exhausted. v1.5.13 edge-logger hotfix was stranded on the `stable` branch for ~3 days because pushes to `main` never queued. The chosen remediation is migration to Netlify Free (300 build minutes / month, 125k function invocations) in parallel with the Vercel pipeline until we're confident the new platform is stable.

Other alternatives considered and rejected:

- **Upgrade Vercel to Pro ($20/mo):** solves quota but leaves us paying for a platform we don't need to stay on.
- **Self-host on a small VPS:** more ops overhead than justified for current traffic.
- **Cloudflare Pages:** lacks Netlify's full Next.js App Router runtime parity at Free tier.

## The three-phase plan

| Phase | Scope | State | Ref |
| --- | --- | --- | --- |
| **Faz 0** | Vercel "Ignored Build Step" — stop dependabot from burning Hobby quota | ✅ DONE 2026-04-22 | auto-memory |
| **Faz 1** | Netlify POC — parallel deploy to `oneace-next-local.netlify.app`, Vercel untouched | 🟡 scaffold landed | this doc |
| **Faz 2** | Platform-agnostic refactor — audit v1.3 F-01 `/api/cron/vercel-webhook-health` and F-04 `/api/cron/vercel-quota-health` | ⏳ blocked by Faz 1 | task #36 |
| **Faz 3** | Production cutover — Shopify + QuickBooks webhook URL swap, DNS CNAME flip | ⏳ blocked by Faz 2 | task #37 |

---

## Faz 1 — What was scaffolded

1. **`netlify.toml`** — build command (with env shim pre-step), Node 22 pin, pnpm package manager, `@netlify/plugin-nextjs` runtime, deploy-preview + branch-deploy context env, Prisma AWS Lambda binary target, branch allow-list (`main | stable | phase-1-p0-remediations | netlify-poc`).
2. **`netlify/functions/cron-*.mts`** — 7 Netlify Scheduled Function bridges, one per `vercel.json` cron. Each bridge calls the existing `/api/cron/*` route over HTTPS with the same `Authorization: Bearer ${CRON_SECRET}` header Vercel Cron uses. Schedules are literal-copied from `vercel.json` — a pinned static test (`src/lib/netlify-poc/netlify-poc-scaffold.static.test.ts`) enforces parity.
3. **`scripts/netlify-env-shim.mjs`** — maps Netlify's build env (`COMMIT_REF`, `BRANCH`, `DEPLOY_PRIME_URL`, `CONTEXT`, `REPOSITORY_URL`) onto the `VERCEL_GIT_COMMIT_SHA` / `VERCEL_GIT_COMMIT_REF` / `VERCEL_URL` / `VERCEL_ENV` names existing code reads. No-op on Vercel (detects `VERCEL=1`). Faz 2 replaces the shim with a platform-agnostic accessor.
4. **`prisma/schema.prisma`** — `binaryTargets = ["native", "rhel-openssl-3.0.x"]`. Netlify Functions run on AWS Lambda (Amazon Linux 2 = `rhel-openssl-3.0.x`); without this the query engine bundled for Vercel's runtime fails to load at function invocation.
5. **Pinned test** — `netlify-poc-scaffold.static.test.ts` enforces the contract between all four surfaces. If someone adds a new Vercel cron without a Netlify bridge, the test fails at the same line reference as a code regression.

Files NOT touched in Faz 1 (intentional):
- `next.config.ts` — security headers stay as-is; Netlify Next Runtime respects them.
- `src/middleware.ts` — already edge-compat (raw cookie read, no jose decode).
- Existing `/api/cron/*` route handlers — zero changes; Faz 2 refactors F-01/F-04 only.
- `vercel.json` — untouched; Vercel keeps serving prod.

## Required Netlify site environment variables

Set via Netlify UI → Site settings → Environment variables. Do NOT commit these.

Minimum for POC deploy to succeed:

- `DATABASE_URL` (same Neon Postgres pool Vercel uses)
- `DIRECT_URL` (same Neon direct connection for migrations)
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL` — set to `https://oneace-next-local.netlify.app` for POC; flip to prod domain in Faz 3
- `CRON_SECRET` (shared with Vercel; same value)

Integration credentials (needed for the quota-health + integration-tasks crons to return useful data):

- `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` (until Faz 2 refactor)
- `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_WEBHOOK_SECRET`
- `QUICKBOOKS_CLIENT_ID`, `QUICKBOOKS_CLIENT_SECRET`
- Any other secrets the current Vercel project has — run `vercel env pull` first and diff before copying.

## Deploy steps (user-side, from Mac)

```bash
cd ~/Documents/Claude/Projects/OneAce/oneace

# Ensure you're on the netlify-poc branch.
git fetch origin
git checkout netlify-poc

# Install Netlify CLI if missing.
npm i -g netlify-cli

# Link to the new Netlify site (creates oneace-next-local.netlify.app).
netlify init
# ↳ choose "Create & configure a new site"
# ↳ team: personal
# ↳ site name: oneace-next-local
# ↳ build command: auto-detected from netlify.toml
# ↳ publish directory: auto-detected (.next)

# Copy env vars.
netlify env:import .env.production        # or set manually via UI
# ↳ at minimum the 5 required secrets above

# First deploy.
netlify deploy --build
# ↳ deploys to a preview URL first — smoke-test it

# Promote preview → production.
netlify deploy --build --prod
```

## Post-deploy smoke tests

Run against the Netlify URL (`https://oneace-next-local.netlify.app`):

```bash
curl -s https://oneace-next-local.netlify.app/api/health | jq .
#   expect: {ok: true, commit: "<sha from netlify-poc HEAD>", checks: {...}}

curl -s https://oneace-next-local.netlify.app/
#   expect: 200 OK, HTML shell

# Scheduled functions land at /.netlify/functions/cron-*
netlify functions:list
#   expect: 7 cron-* functions + any Next.js-generated route handlers
```

## Rollback

Faz 1 is additive-only; Vercel prod keeps serving unchanged. If the Netlify POC breaks:

1. **Site-level pause:** Netlify UI → Site settings → Build & deploy → Stop auto publishing.
2. **Delete the site:** Netlify UI → Site settings → Danger zone → Delete this site. Removes the `oneace-next-local.netlify.app` alias.
3. **Revert code:** `git checkout main && git branch -D netlify-poc` locally, `git push origin :netlify-poc` remotely.
4. **File cleanup (optional):** the scaffold files (`netlify.toml`, `netlify/functions/`, `scripts/netlify-env-shim.mjs`, `prisma/schema.prisma` binaryTargets) are inert on Vercel — leaving them in place costs nothing. The shim short-circuits on `VERCEL=1`; the Prisma target is additive; the `netlify/` dir isn't touched by Vercel's build.

## Known gaps (handled in Faz 2)

- `/api/cron/vercel-webhook-health` — currently returns `{ok:false}` on Netlify because it checks Vercel-specific build health. Faz 2 renames to `/api/cron/platform-webhook-health` with `HOSTING_PLATFORM` env dispatch.
- `/api/cron/vercel-quota-health` — same story; Faz 2 adds a Netlify adapter that hits Netlify's Functions/Minutes API.
- `@vercel/analytics` imports in `src/app/(app)/settings/billing/billing-client.tsx` and `src/components/analytics.tsx` — they're static imports. On Netlify the script loads but `track()` calls noop (Vercel endpoint is unreachable from our domain). Swap to a platform-agnostic telemetry wrapper in Faz 2.
- `@vercel/blob` — already a dynamic import with a graceful fallback, safe to leave.

## Known gaps (handled in Faz 3)

- Shopify partner webhook URL → update in Shopify admin after DNS cutover.
- QuickBooks webhook URL → update in Intuit Developer console after DNS cutover.
- DNS CNAME swap on the prod domain — 300s TTL ahead of cutover so rollback is fast.
- Suspend (not delete) Vercel project for 24h post-cutover as a warm standby.
