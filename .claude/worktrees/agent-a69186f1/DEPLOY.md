# OneAce — Deploy Runbook

**Audience:** whoever cuts the first production release of OneAce and
every subsequent operator touching a shared environment.

**Scope:** this runbook is Phase 7A. It documents the minimum set of
steps to take OneAce from a clean Neon branch and a blank Vercel
project to a running production deploy. It does **not** cover CI-side
migration automation, blue/green cutovers, or observability vendor
setup — those are explicit post-MVP items.

Sister runbooks:

- `SETUP.md` — local dev bootstrap.
- `MIGRATION_BASELINE.md` — Prisma baseline mechanics for the
  pre-Phase-5A `db push` branches.

---

## 1. Deploy target assumptions

OneAce is shipped to **Vercel** (Next.js 15 native host) in front of
**Neon Postgres** (pooled via PgBouncer) with **Upstash Redis REST**
as the distributed rate-limit backend. Outbound email is **Resend**.

The stack is deliberately simple:

| Layer          | Service                                | Notes                                                     |
| -------------- | -------------------------------------- | --------------------------------------------------------- |
| App            | Vercel                                 | Node runtime, no edge-function Prisma, single region.     |
| Database       | Neon Postgres                          | `DATABASE_URL` = pooled, `DIRECT_URL` = unpooled.         |
| Rate limiting  | Upstash Redis (REST)                   | Required in production — in-process fallback is dev-only. |
| Mail           | Resend                                 | Optional pair; invitations and password resets use it.   |
| Health probes  | `/api/health` on the app itself         | Node runtime, no auth, `SELECT 1` + schema sentinel.     |

There is no Dockerfile, no Kubernetes manifest, and no custom CI
deploy job. Vercel's git integration does the build: a push to the
tracked branch triggers `pnpm install` → `pnpm build` → deploy.

> If the deploy target changes (Fly.io, Railway, containerised on a
> VPS, etc.), this runbook has to be rewritten. It is not designed to
> be platform-agnostic.

---

## 2. Required production environment variables

Set these in the Vercel project's **Environment Variables** panel for
the `Production` environment. Each required variable below is
validated at server startup by `src/lib/env.ts` — a missing or
malformed value will crash the Node process on first import, which
Vercel surfaces as a failed deploy.

| Key                         | Required? | What it is                                                            |
| --------------------------- | --------- | --------------------------------------------------------------------- |
| `DATABASE_URL`              | yes       | Pooled Neon connection (PgBouncer). Used by the app at runtime.       |
| `DIRECT_URL`                | yes       | Unpooled Neon connection. Used only by `prisma migrate deploy`.       |
| `BETTER_AUTH_SECRET`        | yes       | 32+ character random string. Generate with `openssl rand -base64 32`. |
| `BETTER_AUTH_URL`           | yes       | Absolute URL of the deployed app (e.g. `https://app.oneace.io`).      |
| `NEXT_PUBLIC_APP_URL`       | yes       | Same absolute URL. Embedded in the client bundle.                     |
| `UPSTASH_REDIS_REST_URL`    | yes       | Distributed rate limiter. In-process fallback is **not** acceptable.  |
| `UPSTASH_REDIS_REST_TOKEN`  | yes       | Paired with the URL — env schema rejects half-set pairs.              |
| `RESEND_API_KEY`            | yes*      | Required if you want invitations and password resets to actually send. |
| `MAIL_FROM`                 | yes*      | Paired with `RESEND_API_KEY`. Format: `OneAce <noreply@oneace.app>`.  |
| `REGISTRATION_ENABLED`      | no        | `true` (default) allows public sign-up; `false` blocks `/register` (redirects to `/login`) and returns 403 on the sign-up API. Use the first-owner bootstrap in §3 to create the admin, then flip to `false` for invite-only mode. |
| `EXPECTED_MIGRATION_COUNT`  | no        | Opt-in gate for `/api/health` migrations sub-check. Set to the number of migration folders in `prisma/migrations/` at build time. Unset → the sub-check reports `skipped` and Phase 7A behaviour is preserved. |
| `LOG_LEVEL`                 | no        | Defaults to `info` in production. Override to `debug` for incidents.  |

\* The Resend pair is technically optional (the env schema allows
both-unset for dev), but production without it means silent email
failure. Treat it as required for any environment real users hit.

**Secret hygiene.** Never commit a real value into `.env.example` or
any file tracked by git. `BETTER_AUTH_SECRET` rotation is Post-MVP —
rotating today would log every live session out and has no rollback.

> **Advisory-driven rotation.** Per the Next.js advisory for
> CVE-2025-66478 (RSC protocol RCE, CVSS 10.0, fixed for the
> 15.1.x line in 15.1.9), any OneAce deploy that **has served
> real traffic** on an unpatched Next.js version **must** rotate
> `BETTER_AUTH_SECRET` and any other HMAC/signing secrets as part
> of the upgrade. OneAce has not served production traffic yet,
> so this is documentation today, not a live action — but it
> becomes mandatory the first time the app is publicly reachable
> on a pre-fix version. Treat this as a go-live checklist item,
> not an ongoing rotation cadence.

---

## 3. First production deploy

This is the cold-start path. Assume the Vercel project exists, the
Neon branch exists and is **empty**, and the env vars from §2 are set.

```
1. Create the Neon production branch (separate from dev/staging).
   Copy its pooled + direct URLs into Vercel env vars.

2. Provision Upstash Redis. Copy the REST URL + token into Vercel.

3. From a clean working copy on a trusted machine with both
   DATABASE_URL and DIRECT_URL pointing at the production Neon
   branch, run:

     pnpm install --frozen-lockfile
     pnpm prisma migrate deploy

   Expected: the baseline migration (00000000000000_baseline) runs
   from empty, creating every table; then phase5a_additive_domain_model
   applies the Phase 5A additive columns and indexes on top.

   See MIGRATION_BASELINE.md §"How to apply this on a brand-new
   database" for the exact expected output.

4. Push the release commit to the tracked branch. Vercel runs
   `pnpm install && pnpm build` and promotes the deploy.

5. Once Vercel reports the deploy is ready, run the smoke test in §5
   before announcing the URL to anyone.

6. First-owner bootstrap (Phase 7C registration gate):
   a. Deploy with REGISTRATION_ENABLED=true (or unset — it defaults
      to true).
   b. Visit /register and create the first owner account + org.
   c. Flip REGISTRATION_ENABLED=false in Vercel env vars and
      redeploy (or trigger a Vercel instant-rollback-style env-only
      redeploy if available).
   d. Verify /register now redirects to /login and the "Register"
      link no longer appears on the login page.
   e. All subsequent users join via invitation only: the owner
      invites them from /users, and invitees sign in (if they
      already have an account) or the owner temporarily re-enables
      registration for new-account invitees.
```

The order matters: migrations must land **before** the application
code that expects them. Running Vercel's build first risks the app
booting against a schema that doesn't have Phase 5A's columns and
failing at the first write that touches `StockMovement.purchaseOrderLineId`
or `Membership.deactivatedAt`.

---

## 4. Subsequent deploys (with a new migration)

The same order, now operating on a database that already has every
prior migration applied.

```
1. Author the migration locally against a disposable Neon branch:
     pnpm prisma migrate dev --name <descriptive-name> --create-only
   Review the generated SQL. Edit the comment header with the intent
   and any operator notes. Commit the migration folder to git.

2. Merge the PR. CI runs typecheck + biome + vitest + prisma validate
   + `next build`. DB migrations are NOT applied by CI today — that
   is an explicit Phase 7+ follow-up.

3. On a trusted machine with the production DATABASE_URL + DIRECT_URL:
     pnpm install --frozen-lockfile
     pnpm prisma migrate deploy
   If this step fails, DO NOT promote the deploy. See §7.

4. Push the merge commit to the tracked branch. Vercel builds and
   deploys the application code.

5. Smoke test §5.
```

**Invariant:** the application deploy step (4) must not run against a
database schema older than what the code expects. If the migration
step in (3) failed, the safe response is to roll back step 4 as
well — either by reverting the merge or by pinning Vercel to the
prior deploy (Vercel → Deployments → "Promote to Production").

---

## 5. Smoke test checklist

Run these immediately after every production deploy. They are
deliberately short — the goal is "did the deploy land in a state
where real users can actually sign in and write data?", not "is every
feature working". The full feature surface is exercised by staging.

```
[ ] 0. SMOKE_URL=https://<prod-url> pnpm smoke
       → Machine-readable floor. The script fetches /api/health,
         asserts 200, asserts status=="ok", asserts database=="ok"
         and schema=="ok", and accepts migrations=="ok" or
         migrations=="skipped" (the Phase 7A floor). Fails
         non-zero on any unhealthy signal. Run this first; if it
         fails, do not bother with the manual steps below.

[ ] 1. GET https://<prod-url>/api/health
       → 200 with {"status":"ok","checks":{"database":"ok","schema":"ok","migrations":"ok"|"skipped"}}
       → `version` and `commit` should match the deploy you just
         shipped (VERCEL_GIT_COMMIT_REF / VERCEL_GIT_COMMIT_SHA).
       → `checks.migrations` is `"ok"` when EXPECTED_MIGRATION_COUNT
         is set and matches; `"skipped"` when the env var is unset.
         A `"fail"` here means `prisma migrate deploy` did not
         finish — treat the deploy as not-accepted and see §7.

[ ] 2. GET https://<prod-url>/
       → 302 to /login (unauthenticated).

[ ] 3. POST /register with a throwaway org + user, complete the
       onboarding flow, land on /dashboard. Delete the throwaway org
       afterwards via the admin console / SQL (or mark it with a
       `smoketest-` prefix so it's easy to find).

[ ] 4. Create one item, one warehouse, one stock movement. Watch for
       toast errors and console exceptions.

[ ] 5. Sign out, sign back in — confirms the Better Auth session
       round-trip is healthy end-to-end.

[ ] 6. Vercel Deployments → Functions → check /api/health latency.
       > 500 ms consistently means either the Neon branch is cold
       (wake it) or the pooled connection is saturated (scale up or
       wait for first request storm to subside).
```

If any step fails, treat the deploy as not-accepted and follow §7.

---

## 6. Health endpoint — what to watch

`GET /api/health` (no auth) is the one endpoint uptime monitors should
poll. Body shape:

```json
{
  "status": "ok" | "degraded",
  "uptime": 123,
  "timestamp": "2026-04-12T...",
  "environment": "production",
  "version": "main",
  "commit": "abc1234",
  "checks": {
    "database":   "ok" | "fail",
    "schema":     "ok" | "fail",
    "migrations": "ok" | "fail" | "skipped"
  },
  "errors": ["..."]   // present only when degraded
}
```

Status codes:

- `200` — `status === "ok"`. `database` and `schema` both pass;
  `migrations` is either `"ok"` or `"skipped"` (the Phase 7A floor
  for environments that have not wired `EXPECTED_MIGRATION_COUNT`).
- `503` — `status === "degraded"`. At least one check failed. The
  body still carries full detail; alert on `503` plus the `errors`
  array for the specific sub-check that tripped.

Cache-Control is `no-store` and the route is `force-dynamic`, so no
upstream CDN will ever cache a stale snapshot of the probe.

---

## 7. Rollback posture

OneAce's migrations are written **additive-only** and **nullable** on
purpose. The concrete consequence for rollback:

- **Application rollback is safe and fast.** Vercel → Deployments →
  select the last-known-good deploy → "Promote to Production". The
  prior deploy did not read any of the new columns or enums — by
  construction, because we only add new columns/indexes/rows — so it
  will run happily against the newer schema.
- **Database rollback is NOT the first resort.** We do not ship
  destructive DDL in normal migrations. Forward-only recovery (patch
  the regression and deploy again) is the expected path.
- **If database-side rollback is genuinely required** (the migration
  itself was destructive, e.g. a Phase 7+ index removal that broke a
  hot query), use Neon's point-in-time restore on a **new branch**,
  rewire `DATABASE_URL` + `DIRECT_URL` to that branch, and redeploy.
  Do **not** `prisma migrate reset` on the existing branch — it drops
  every table.

Phase 5A is strictly additive, so a documented Phase 5A rollback is
explicitly Post-MVP (see `MIGRATION_BASELINE.md` §"What this runbook
intentionally does NOT cover").

---

## 8. Known gaps (not blockers, but tracked)

These are known-missing and are being handled in later phases. Listed
here so operators are not surprised when they hit them.

- **No CI migration step.** `prisma migrate deploy` is a manual
  operator action today. A dedicated workflow step with a shadow
  database check is planned.
- **No staging environment as of Phase 7A.** The single Neon branch
  used during the port doubles as dev. Cutting a staging branch is
  the first thing to do when a second pair of eyes joins the project.
- **No observability vendor.** Logs land in Vercel's built-in log
  drain only. Structured-log aggregation (Datadog / Logtail / etc.)
  is a Post-MVP decision.
- **No load test.** The app has been validated interactively only.
  First production traffic will be the first real load test. Monitor
  `/api/health` latency and Neon's connection count chart closely
  during the first week.
- **No automated rollback trigger.** Health degradation alerts exist
  (or will once uptime monitoring is wired), but promoting the prior
  deploy is a human decision.
- **Phase 7A dependency refresh.** Phase 7A regenerated
  `pnpm-lock.yaml` from scratch (no prior lockfile existed), which
  resolved several top-level deps forward inside the caret ranges
  `package.json` already permitted: `better-auth 1.1.9 → 1.6.2`,
  `prisma 6.1.0 → 6.19.3`, `@prisma/client 6.1.0 → 6.19.3`,
  `typescript 5.7.2 → 5.9.3`. Phase 6B's test suite passed against
  the regenerated tree and `pnpm prisma validate` / `pnpm build`
  are both clean, but this is not the tree Phases 1–6 were
  validated against at the exact version level. The Better Auth
  cookie round-trip (§5 step 5) is therefore a **mandatory** smoke
  step on the first production deploy, not optional. A dual
  `zod 3.x + 4.x` also lives in the tree because a sibling
  transitive pulled in the 4.x context; `better-call`'s `zod@^4`
  peer is marked optional via `peerDependenciesMeta.zod.optional`
  so the pnpm WARN is advisory only — do not chase it.
