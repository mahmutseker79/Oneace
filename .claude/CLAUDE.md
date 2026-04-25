# OneAce Project Memory

## Quick Reference
- **Version**: v1.10.2-pinned-test-and-memory (tag: `v1.10.2-pinned-test-and-memory`)
- **Branch**: main
- **Stable**: `stable` branch = last verified state — branch protection active (4 required jobs)
- **Required Jobs**: Lint (Biome), Vitest, Prisma Validate, Prisma Migrations (scratch Postgres). Typecheck = advisory (continue-on-error, 212 Prisma TS errors).
- **Deploy**: https://oneace-next-local.vercel.app
- **Repo**: git@github.com:mahmutseker79/Oneace.git

## Session Start Checklist
```bash
cd ~/Documents/Claude/Projects/OneAce/oneace
rm -f .git/index && git reset HEAD          # Fix FUSE index
git status --short                            # Should show only untracked temp files
./scripts/version.sh status                   # Quick version check
```

## Architecture
- **Framework**: Next.js 15.1.9 (App Router)
- **DB**: Prisma 6 + PostgreSQL (Neon, eu-west-2 — `ep-silent-forest-abrpv9sl-pooler`)
- **Auth**: better-auth with 2FA TOTP
- **Styling**: Tailwind CSS 4, Inter font, CVA for component variants
- **Charts**: Recharts 3.8 (client-only — never import in server components)
- **Analytics**: PostHog + Vercel Analytics + Sentry
- **Build**: `ignoreBuildErrors: true` in next.config.ts (212 pre-existing TS errors, all Prisma relation types from GOD MODE expansion). Typecheck stays in CI as `continue-on-error: true` advisory job.

## Design System Tokens (globals.css)
- Shadows: `--shadow-card`, `--shadow-card-hover`, `--shadow-elevated`, `--shadow-popover`
- Gradients: `--gradient-card`, `--gradient-accent`
- Transitions: `--transition-fast` (150ms), `--transition-normal` (200ms), `--transition-slow` (300ms)
- Font: `--font-sans: var(--font-inter)` (Inter loaded via next/font/google in layout.tsx)
- Domain colors: stock-level, count-status, scanner, PO, serial/lot, connectivity
- All tokens have dark mode variants in `.dark {}` block

## Key Components
- **badge.tsx**: 8 variants (default, secondary, destructive, outline, success, warning, info, processing w/ animate-pulse)
- **sidebar.tsx**: 6 nav groups (Core, Operations, Warehouse, Commerce, Utilities, Analytics) + collapsible Admin. Active state = `border-l-primary`
- **Dashboard**: 8 chart components (movement-trend, top-items, category-value, low-stock-trend + lazy loaders + loading)

## File Counts (last verified after v1.10.x)
- 985 TS/TSX in src/
- 73 Prisma models, 49 enums, 26 migrations (all applied to PROD)
- 39 validation schemas
- 28+ unit test files (incl. pinned static tests under src/lib/ci/ + src/lib/ops/), 13 E2E specs
- 22 report pages, 23 API routes, 46 loading skeletons
- 19 app module directories under (app)/

## CI / Branch Protection (since v1.10.0)
- `main` and `stable` branches require 4 status checks to pass before merge.
- `Lint (Biome)` job is split from `Typecheck (advisory)` (Sprint 5a, v1.9.2). Typecheck has `continue-on-error: true` because of the 212 Prisma relation TS errors.
- `protection-after.json` snapshot (single-line gh-api dump) lives under `scripts/sprints/2026-04-24-required-checks/`. Biome ignore covers `scripts/sprints/**` so future sprint artifacts don't break Lint.
- Pinned static tests in `src/lib/ci/` lock the workflow ↔ branch-protection ↔ runbook contract.

## Known Issues
1. **Git index corruption**: FUSE mount causes phantom deletions in `git status`. Fix: `rm -f .git/index && git reset HEAD`. Git configs already set to minimize recurrence.
2. **macOS duplicates**: Files like `en 2.ts`, `schema 2.prisma` appear. Delete on sight.
3. **Escaped paths**: Files under `src/app/\(app\)/` instead of `src/app/(app)/`. Copy to correct path, delete escaped dir.
4. **Recharts in server components**: Recharts must be lazy-loaded. Never directly import in server component files under reports/.
5. **Bash `grep -qF "$term"` arg-parse trap**: When `$term` begins with a hyphen (e.g. `-test`), grep treats it as a flag and crashes the loop silently. Use `[[ "$str" == *"$term"* ]]` (bash built-in, no arg parsing) or `grep -qF -- "$term"` (argument separator). Fixed in v1.10.1.1; pinned by `src/lib/ops/sprint-4b-sanity.static.test.ts`.
6. **Node.js 20 deprecation in Actions**: actions/checkout@v4, setup-node@v4, pnpm/action-setup@v4 emit deprecation warnings. Forced Node 24 default on 2026-06-02; Node 20 removal 2026-09-16. Plan an action-bump sprint before June.

## Version History (Recent)
| Tag | Description |
|---|---|
| v1.10.2-pinned-test-and-memory | Sanity-gate pinned static test + memory refresh |
| v1.10.1.1-sanity-gate-fix | Sprint 4b Phase 2 grep arg-parse trap fix |
| v1.10.1-ops-prod-migrate | Prod migrate (no-op, audit trail — schema already current) |
| v1.10.0.1-biome-sprints-ignore | Biome `scripts/sprints` ignore (sprint artifacts not source) |
| v1.10.0-required-checks | Branch protection: 4 required status checks on main + stable |
| v1.9.2.2-vitest-hotfix | ci-migration-gate pinned test job-rename lockstep |
| v1.9.2.1-lint-hotfix | Biome formatter post-Sprint-5a |
| v1.9.2-ci-workflow-refactor | Sprint 5a: split Lint · Typecheck into Lint (Biome) + Typecheck (advisory) |
| v1.9.1-ops-staging-migrate | Sprint 4: prisma migrate deploy on staging |
| v1.9.0-ci-migration-chain | P1-04: migrations job in CI (scratch Postgres + idempotency check) |
| v1.8.1-ci-lint-audit | CI lint audit baseline |
| v1.0.0-rc3 | Sprint 2+3: low-stock SQL opt, email rate limit, webhook hardening |
| v1.0.0-rc2 | Sprint 0+1: 3 critical + 5 high security fixes, CHECK constraints, 9 indexes |
| v1.0.0-rc1 | Full audit passed, version management added |

## Verification Script
Run `./scripts/verify.sh` — 7-phase health check (37+ checks):
- `quick` — git + files only (no network), use at session start
- `full` — all 7 phases including Vercel
- `deploy` — post-push check including Vercel HTTP status

Also available via `./scripts/version.sh verify`

## Push & Verify Commands
```bash
git push origin main && git push origin stable && git push origin --tags
./scripts/verify.sh deploy    # Confirm everything landed correctly
```
