# Git Workflow — OneAce Next.js Port

This document is the exact runbook for getting the `oneace-next/` scaffold onto
GitHub as a long-lived `next-port` branch, opening a draft PR against `main`,
and iterating on it through Sprint 0 → Sprint 11.

> **Why this lives in a markdown file and not a git commit:** the port was
> scaffolded inside a sandboxed environment that cannot finalize `git` writes.
> Run the commands below **from your local machine** where your SSH key, GPG
> signing, and GitHub identity already work.

---

## 0. Fast path — use the pre-built bundle (RECOMMENDED, 2026-04-11)

Sprint 0 **and** Sprint 1 are already committed in a portable git bundle at:

```
oneace-next/oneace-next-port.bundle
```

This bundle contains:

- **9 commits** — 8 Sprint 0 commits + 1 Sprint 1 commit
- **Branch:** `next-port`
- **Tag:** `v0.1.0-sprint1` (annotated, marks Sprint 1 complete)

Instead of running all the manual commits in section 1.4, just restore the
bundle into a fresh clone. This skips 300+ lines of manual git surgery.

```bash
# From your local machine, in an empty working directory:
cd ~/code
git clone https://github.com/mahmutseker79/oneace.git oneace-port-workspace
cd oneace-port-workspace

# Pull in the bundle (path wherever you synced the sandbox folder to)
git fetch /path/to/SimplyCount/oneace-next/oneace-next-port.bundle \
          next-port:next-port

# Also pull the tag
git fetch /path/to/SimplyCount/oneace-next/oneace-next-port.bundle \
          refs/tags/v0.1.0-sprint1:refs/tags/v0.1.0-sprint1

# Verify
git log --oneline next-port                # should show 9 commits
git tag -l                                 # should include v0.1.0-sprint1

# Push to GitHub
git push -u origin next-port
git push origin v0.1.0-sprint1
```

> **Note on history:** the bundle's `next-port` branch has no common ancestor
> with `main` because the port is a full replacement of the Vite source, not
> an incremental patch. GitHub will show "no common history" on the draft PR —
> that's expected and correct. The merge at MVP launch will be handled with
> `--allow-unrelated-histories` or by force-replacing `main`. Decide at launch.

After pushing, open the draft PR following section 1.5 below.

If the bundle is missing or corrupt, fall back to the manual runbook in
section 1.

---

## 1. One-time setup (do this once)

### 1.1 Copy the scaffold into your local clone

Assuming you already have `github.com/mahmutseker79/oneace` cloned locally at
`~/code/oneace` and the sandbox folder `oneace-next/` copied next to it:

```bash
cd ~/code/oneace

# Make sure you're on a clean main, up to date with origin
git checkout main
git pull --ff-only origin main

# Tag the current Vite/Figma template as an immortal reference
git tag -a v0-figma-template -m "Figma export — Vite + React + shadcn template (pre-port)"
git push origin v0-figma-template
```

### 1.2 Create and switch to the port branch

```bash
git checkout -b next-port
```

### 1.3 Drop the scaffold into the repo

The scaffold lives at `SimplyCount/oneace-next/` in the sandbox. From your
local machine, pull that directory into the repo root **in place of** the Vite
source. The Next.js port is a **full replacement**, not a sibling.

```bash
# From the repo root (~/code/oneace), after checking out next-port:

# 1. Remove the Vite shell (the UI layer we're porting FROM)
rm -rf src/ index.html vite.config.ts vite-env.d.ts tsconfig.json \
       tsconfig.app.json tsconfig.node.json package.json package-lock.json \
       postcss.config.mjs eslint.config.js

# 2. Copy the Next.js scaffold on top
#    (replace the source path with wherever you synced the sandbox folder)
rsync -av --exclude node_modules --exclude .next --exclude tsconfig.tsbuildinfo \
      /path/to/sandbox/SimplyCount/oneace-next/ ./

# 3. Sanity check — should show Next.js scaffold files
ls -la
cat package.json | head -20
```

> **Heads up:** the sandbox folder contains a partially-initialized `.git`
> directory with a stuck index lock. Make sure `rsync` does **not** copy it. The
> `--exclude .git` flag is belt-and-suspenders; the command above already
> excludes it implicitly because we're running from the destination repo root.
> If you see any `.git/` files from the sandbox sneak in, delete them with
> `rm -rf .git/index.lock` (yours, not the sandbox's).

### 1.4 First commit on `next-port`

Break the scaffold into logical commits so the draft PR reads like a story.

```bash
# Commit 1 — tooling & config
git add .gitignore .env.example biome.json next.config.ts postcss.config.mjs \
        tsconfig.json package.json package-lock.json
git commit -m "Sprint 0: Next.js 15 + Tailwind 4 + Biome tooling

- Next.js 15.1.3 App Router, React 19, TypeScript 5.7 strict
- Tailwind 4 via @tailwindcss/postcss
- Biome 1.9 replaces ESLint + Prettier
- noUncheckedIndexedAccess enabled
- .env.example documents Neon + Better Auth + Resend + Sentry + PostHog"

# Commit 2 — Prisma schema + database layer
git add prisma/ src/lib/db.ts
git commit -m "Sprint 0: Prisma schema + multi-tenant foundation

- Organization, Membership with OWNER/ADMIN/MANAGER/MEMBER/VIEWER roles
- Better Auth tables (User, Session, Account, Verification)
- Plan enum (FREE/PRO/BUSINESS)
- Singleton PrismaClient via globalThis to survive HMR in dev"

# Commit 3 — Better Auth + session helpers + middleware
git add src/lib/auth.ts src/lib/auth-client.ts src/lib/session.ts \
        src/middleware.ts src/app/api/auth
git commit -m "Sprint 0: Better Auth email/password + route guards

- Better Auth 1.1.9 with Prisma adapter
- Session helpers: getCurrentSession, requireSession, requireActiveMembership
- Middleware public-path allowlist with /login?redirect=... pattern
- Auth API route: /api/auth/[...all]"

# Commit 4 — i18n scaffold (the rule: no Turkish anywhere)
git add src/lib/i18n/
git commit -m \"Sprint 0: i18n + region scaffold (English default, 8 locales)

- SUPPORTED_LOCALES: en (default), es, de, fr, pt, it, nl, ar (RTL)
- SUPPORTED_REGIONS: US, GB, EU, CA, AU, AE, SG with currency + locale
- Cookie-first detection (oneace-locale, oneace-region) with
  Accept-Language fallback and React cache wrappers
- Non-English catalogs fall through to English until translations ship
- getDirection() drives the <html dir> attribute for Arabic RTL\"

# Commit 5 — shell + theme tokens + full shadcn primitive set
git add src/app/globals.css src/components/ui/ src/components/shell/ \
        src/lib/utils.ts
git commit -m "Sprint 0: App shell + theme tokens + shadcn primitives

- globals.css: 200+ design tokens ported verbatim from src/styles/
- 23 shadcn/ui primitives — full Sprint-1-ready set:
  alert, alert-dialog, avatar, badge, button, card, checkbox,
  dialog, dropdown-menu, form, input, label, popover, scroll-area,
  select, separator, sheet, skeleton, sonner, table, tabs,
  textarea, tooltip
- Sidebar (10 nav items) + Header — thin hand-written versions,
  real ports from the Vite repo land in Sprint 1 feature work
- formatCurrency/formatNumber accept locale + currency
- slugify uses NFKD normalization (no Turkish-specific replacements)"

# Commit 6 — auth + app routes
git add src/app/layout.tsx src/app/page.tsx \
        \"src/app/(auth)\" \"src/app/(app)\" src/app/api/onboarding
git commit -m "Sprint 0: Auth + dashboard routes with i18n dictionary

- / → session-based redirect (login | onboarding | dashboard)
- (auth) layout: split-screen brand panel, all copy from dictionary
- /login, /register forms with labels prop pattern
- /onboarding org creation, POST /api/onboarding/organization
  with Zod validation + slug collision retry
- (app) layout: sidebar + header + main
- /dashboard: 4 KPI placeholders + Sprint 0 welcome card,
  stock value formatted via region.currency"

# Commit 7 — CI pipeline
git add .github/workflows/ci.yml
git commit -m "Sprint 0.5: GitHub Actions CI (typecheck + biome + build)

- ci.yml: check job runs pnpm typecheck, pnpm lint (biome),
  prisma validate, prisma generate
- build job: next build smoke with fake env vars to catch
  build-time regressions without needing a real database
- concurrency group cancels superseded runs on the same ref
- Triggers on push + pull_request for main and next-port"

# Commit 8 — documentation
git add README.md SETUP.md PORT_CHECKLIST.md GIT_WORKFLOW.md
git commit -m "Sprint 0: README, SETUP, PORT_CHECKLIST, GIT_WORKFLOW

- README: tech stack overview, i18n section, contribution flow
- SETUP: step-by-step local env setup, Neon + Prisma + Better Auth
- PORT_CHECKLIST: done (Sprint 0) vs parked work per sprint
- GIT_WORKFLOW: this file"
```

### 1.5 Push and open a draft PR

```bash
git push -u origin next-port

gh pr create \
  --base main \
  --head next-port \
  --draft \
  --title "Next.js 15 port — long-lived integration branch" \
  --body "$(cat <<'EOF'
## Summary

Long-lived integration branch for the Vite → Next.js 15 port. Tracks
Sprint 0 through MVP Launch (Sprint 12, target 2026-07-03).

**This PR will stay open until MVP.** Each sprint pushes additional commits.
Merge back to `main` happens at launch, once:

- [ ] All 12 sprint checklists are done (see `PORT_CHECKLIST.md`)
- [ ] Playwright e2e suite is green on CI
- [ ] Vercel preview deploy passes manual smoke test
- [ ] Design review confirms 1:1 visual parity with the Figma source

## Sprint 0 status

- [x] Next.js 15.1.3 scaffold + Biome + Tailwind 4
- [x] Prisma schema (Organization, Membership, Better Auth)
- [x] Better Auth email/password
- [x] App shell (Sidebar + Header) wired to dictionary
- [x] i18n scaffold (8 locales, 7 regions, English default)
- [x] /login /register /onboarding /dashboard flows
- [x] 23 shadcn primitives (full Sprint 1 feature-work unblock)
- [x] `pnpm typecheck` → EXIT 0
- [x] CI: typecheck + biome check + prisma validate + next build smoke
- [ ] Vercel preview deploy with Neon dev branch attached *(next)*

## Out of scope for this PR

Reference-only files from the Vite era (design-spec, 01-sikayet-beklenti
analizi, feature-matrix.xlsx) stay on `main` unchanged — this branch only
touches the buildable app source.

## How to review

Check out locally:

```bash
git fetch origin
git checkout next-port
pnpm install
cp .env.example .env.local   # fill in DATABASE_URL, DIRECT_URL, BETTER_AUTH_SECRET
pnpm prisma migrate dev --name init
pnpm dev
```

Smoke test: register → onboarding → dashboard should complete in under 30 seconds.
EOF
)"
```

---

## 2. Day-to-day workflow (every sprint)

During each sprint, keep pushing commits to `next-port`. The draft PR updates
automatically. Push at least once per day so Vercel previews and CI catch
regressions early.

```bash
git checkout next-port
git pull --ff-only origin next-port

# ... do work ...

pnpm typecheck
pnpm biome check .

git add -p              # review hunks before committing
git commit -m "Sprint 2: ItemForm + server action"
git push
```

### 2.1 Pulling emergency fixes from `main`

If a hotfix lands on `main` that you need on the port branch (unlikely but
possible — e.g. a README typo a beta user complained about):

```bash
git checkout next-port
git fetch origin
git merge origin/main     # prefer merge over rebase on a shared branch
git push
```

### 2.2 Keeping PR hygiene

- **Never force-push** `next-port` once the draft PR is open. Collaborators
  (even just future-you) will rely on the commit history for context.
- **Squash only at merge time.** When merging to `main` at MVP launch, use
  "Create a merge commit" — the sprint-by-sprint history is the project log.
- **Run `pnpm typecheck && pnpm biome check .` before every push.** The CI we
  add in Sprint 0.5 will enforce this, but catching it locally is faster.

---

## 3. Milestone tags

Tag each sprint boundary so we can diff Sprint 3 vs Sprint 5, etc. Push tags
immediately after the sprint-closing commit.

```bash
git tag -a sprint-0-complete -m "Sprint 0 done: scaffold + auth + shell + i18n"
git push origin sprint-0-complete
```

Planned tags:

| Tag | Marks |
|---|---|
| `v0-figma-template` | The pre-port Vite state of `main` (step 1.1) |
| `sprint-0-complete` | End of Apr 20 — scaffold + auth + i18n |
| `sprint-1-complete` | End of Apr 27 — Item/Warehouse/Category CRUD |
| `sprint-3-complete` | End of May 11 — Moat 1 (barcode UX) |
| `sprint-5-complete` | End of May 25 — Moat 2 (offline stock count) |
| `sprint-7-complete` | End of Jun 8 — Moat 4 (PO + suppliers) |
| `sprint-11-complete` | End of Jul 2 — beta-ready |
| `v1.0.0` | Jul 3 — MVP launch (merged to `main`) |

---

## 4. Merging at MVP launch

On `2026-07-03`, once all Sprint 12 boxes are ticked:

```bash
git checkout main
git pull --ff-only origin main
git merge --no-ff next-port -m "Merge next-port: OneAce v1.0.0 — Next.js rewrite"
git tag -a v1.0.0 -m "OneAce MVP launch"
git push origin main --tags
```

After the merge lands, delete the `next-port` branch on GitHub (the history is
preserved on `main` and in the `v1.0.0` tag):

```bash
git push origin --delete next-port
git branch -D next-port
```

---

## 5. If something goes wrong

**"Accidentally committed to `main`."**
```bash
git checkout main
git reset --soft HEAD~1    # undoes the commit, keeps changes staged
git stash
git checkout next-port
git stash pop
git commit -m "..."
```

**"Forgot `.env.local` in a commit."**
```bash
git rm --cached .env.local
git commit -m "Remove .env.local from tracking"
# Then rotate any secrets that leaked
```

**"Need to start over cleanly."** Worst case: delete the local clone, re-clone,
re-checkout `next-port` from origin. The branch on GitHub is the source of truth.
