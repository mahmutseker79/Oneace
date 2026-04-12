# OneAce — Release Cutover Checklist

> From verified bundle to live production.
> Every step marked **MANUAL** requires operator credentials and cannot be automated.

---

## Prerequisites

- Verified bundle: `oneace-next-port-v0.42.0-phase7.bundle`
  (93 commits, 42 tags, all validation gates green)
- SSH key registered on GitHub (`ssh -T git@github.com` succeeds)
- `git` ≥ 2.40 and `pnpm` ≥ 9.12.0 available locally
- Accounts ready: GitHub, Vercel, Neon, Upstash, Resend (optional)

---

## 1. GitHub Repository Setup — MANUAL

### 1a. Create the repository (if it does not exist)

```bash
gh repo create mahmutseker79/oneace --private --confirm
# OR: create via https://github.com/new
# Do NOT initialize with README, .gitignore, or LICENSE — the bundle has them.
```

### 1b. Clone the empty repo locally

```bash
git clone git@github.com:mahmutseker79/oneace.git oneace-push
cd oneace-push
```

---

## 2. Import Bundle — MANUAL

### 2a. Fetch the bundle into the local clone

```bash
git fetch /path/to/oneace-next-port-v0.42.0-phase7.bundle next-port:next-port
```

### 2b. Checkout and verify

```bash
git checkout next-port
git log --oneline | head -5
git tag -l | wc -l          # expect: 42
```

---

## 3. Push to GitHub — MANUAL

### 3a. Push branch

```bash
git push -u origin next-port
```

### 3b. Push all tags

```bash
git push origin --tags
```

> Do NOT push a `main` branch. Per the project workflow, `main` is created
> only at MVP launch when `next-port` is merged for the first time.

---

## 4. Post-Push Verification — MANUAL

Run these checks from the same local clone:

```bash
# Commit SHA match
git rev-parse next-port
git rev-parse origin/next-port
# → must be identical

# Tree hash match (ensures file content integrity)
git rev-parse next-port^{tree}
git rev-parse origin/next-port^{tree}
# → must be identical

# Commit count
git log --oneline origin/next-port | wc -l
# → expect: 93

# Tag count on remote
git ls-remote origin --tags | wc -l
# → expect: 42

# Spot-check a mid-range tag
git rev-list -1 v0.20.0-sprint20
git ls-remote origin refs/tags/v0.20.0-sprint20
# → SHAs must match
```

---

## 5. Vercel Project Setup — MANUAL

### 5a. Create the project

Vercel Dashboard → Add New Project → Import `mahmutseker79/oneace`.
Vercel auto-detects: Next.js 15, pnpm, build command `pnpm build`.

### 5b. Set environment variables (Production scope)

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | Neon pooled (PgBouncer) URL |
| `DIRECT_URL` | Yes | Neon unpooled URL (for migrations) |
| `BETTER_AUTH_SECRET` | Yes | `openssl rand -base64 32` (≥32 chars) |
| `BETTER_AUTH_URL` | Yes | Production domain, e.g. `https://app.oneace.io` |
| `NEXT_PUBLIC_APP_URL` | Recommended | Same as `BETTER_AUTH_URL` |
| `UPSTASH_REDIS_REST_URL` | Paired | Required in production for safe rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Paired | Must be set with URL |
| `RESEND_API_KEY` | Paired | For invitation/digest emails |
| `MAIL_FROM` | Paired | Must be set with `RESEND_API_KEY` |
| `CRON_SECRET` | Optional | `openssl rand -base64 24` (≥16 chars) |
| `REGISTRATION_ENABLED` | Optional | Defaults to `"true"` |
| `EXPECTED_MIGRATION_COUNT` | Optional | Set to `2` after migrations land |

### 5c. Preview environment

Set fake `DATABASE_URL` and `DIRECT_URL` for preview builds (same pattern
as CI: `postgresql://ci:ci@localhost:5432/ci`). Set `BETTER_AUTH_SECRET` and
`BETTER_AUTH_URL` to any valid stubs.

---

## 6. Database Migration — MANUAL

> Migrations MUST complete before the first production build serves traffic.

### 6a. Create Neon production branch

Neon Dashboard → Branches → New Branch named "production".
Copy the pooled and unpooled URLs into the Vercel env vars from step 5b.

### 6b. Run migrations from a trusted local machine

```bash
cd oneace-push   # the local clone from step 1b

# Create a local .env with production Neon URLs (do NOT commit this file)
cat > .env.local << 'EOF'
DATABASE_URL="postgresql://<pooled-production-url>"
DIRECT_URL="postgresql://<unpooled-production-url>"
EOF

pnpm install --frozen-lockfile
pnpm prisma generate
pnpm prisma migrate deploy
```

Expected output: two migrations applied (baseline + phase5a_additive_domain_model).

### 6c. Verify

```bash
pnpm prisma migrate status
# → Both migrations should show as "applied"
```

See `MIGRATION_BASELINE.md` for full details on the baseline strategy.

---

## 7. First Build & Smoke Test

### 7a. Trigger build — AUTOMATED

Push to `next-port` (or Vercel will auto-build on the initial import).
CI runs: typecheck → biome → prisma validate → test → build.

### 7b. Smoke test — MANUAL

Get the preview URL from Vercel Deployments, then:

```bash
SMOKE_URL=https://<vercel-preview-url> pnpm smoke
```

Manual smoke (browser):

1. `GET /api/health` → 200, all sub-checks `"ok"`
2. `GET /` → redirects to `/login`
3. Visit `/register` → registration form loads
4. Create a test account + organization → lands on `/dashboard`
5. Create a test item, warehouse, stock movement → success toasts
6. Sign out → redirected to `/login`
7. Sign in with test credentials → returns to `/dashboard`

---

## 8. Production Promotion — MANUAL

Only after the smoke test passes:

1. Vercel Deployments → select the build → **Promote to Production**
2. Verify: `curl https://<production-domain>/api/health | jq .`
3. Repeat the browser smoke on the production domain

---

## 9. First-Owner Bootstrap — MANUAL

1. Ensure `REGISTRATION_ENABLED` is `"true"` (default) in Vercel Production env
2. Visit `https://<production-domain>/register`
3. Create the first owner account and organization
4. Flip `REGISTRATION_ENABLED` to `"false"` in Vercel env vars
5. Trigger a Vercel redeploy (Settings → Deployments → Redeploy, or push an empty commit)
6. Verify: `/register` now redirects to `/login`
7. Verify: `/login` no longer shows a "Register" link
8. Invite additional users via the `/users` page (requires `RESEND_API_KEY` + `MAIL_FROM`)

---

## 10. Post-Launch — MANUAL

- [ ] Set `EXPECTED_MIGRATION_COUNT=2` in Vercel env vars (enables health endpoint migration check)
- [ ] Wire Vercel Cron (or external scheduler) to call `/api/cron/notifications/daily` with `Authorization: Bearer <CRON_SECRET>`
- [ ] Set up uptime monitoring on `/api/health` (e.g. Vercel Health Checks, Betteruptime, or similar)
- [ ] Consider enabling Sentry (`SENTRY_DSN`) and PostHog (`NEXT_PUBLIC_POSTHOG_KEY`) when ready

---

## Rollback

- **Application rollback**: Vercel Deployments → promote a prior deployment. Safe because migrations are additive-only and nullable.
- **Database rollback** (last resort): Neon point-in-time restore to a new branch. Rewire `DATABASE_URL` and `DIRECT_URL` to the restored branch. Do NOT use `prisma migrate reset`.

---

## Summary of Manual vs Automated

| Step | Type |
|------|------|
| GitHub repo creation | MANUAL |
| Bundle import + push | MANUAL |
| Post-push SHA verification | MANUAL |
| Vercel project creation | MANUAL |
| Vercel env var configuration | MANUAL |
| Neon branch creation | MANUAL |
| `prisma migrate deploy` | MANUAL (local) |
| CI checks (typecheck, lint, test, build) | AUTOMATED (on push) |
| Vercel build | AUTOMATED (on push) |
| Smoke test | MANUAL |
| Production promotion | MANUAL |
| First-owner registration | MANUAL |
