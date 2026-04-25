# OneAce Project Memory

## Quick Reference
- **Version**: v1.11.0-node24-actions-bump (tag: `v1.11.0-node24-actions-bump`)
- **Branch**: main
- **Stable**: `stable` branch = last verified state — branch protection active (4 required jobs)
- **Required Jobs**: Lint (Biome), Vitest, Prisma Validate, Prisma Migrations (scratch Postgres). Typecheck = advisory (continue-on-error, but pipeline runs clean — 0 TS errors).
- **Deploy**: https://oneace-next-local.vercel.app
- **Repo**: git@github.com:mahmutseker79/Oneace.git

## Session Start Checklist
```bash
cd ~/Documents/Claude/Projects/OneAce/oneace
rm -f .git/index && git reset HEAD          # Fix FUSE index
git status --short                            # Should show only untracked temp files
./scripts/version.sh status                   # Quick version check
pnpm prisma generate                          # Refresh generated types (idempotent)
```

## Architecture
- **Framework**: Next.js 15.1.9 (App Router)
- **DB**: Prisma 6 + PostgreSQL (Neon, eu-west-2 — `ep-silent-forest-abrpv9sl-pooler`)
- **Auth**: better-auth with 2FA TOTP
- **Styling**: Tailwind CSS 4, Inter font, CVA for component variants
- **Charts**: Recharts 3.8 (client-only — never import in server components)
- **Analytics**: PostHog + Vercel Analytics + Sentry
- **Build**: `next.config.ts` does NOT set `ignoreBuildErrors`. Strict TS by default. CI typecheck job is still labelled `(advisory)` because branch protection only lists 4 required jobs — promoting Typecheck to required is a backlog sprint.
- **TS error count**: 0 (was assumed 212 in earlier docs — stale claim, never reverified after Prisma model expansion).

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

## File Counts (last verified after v1.11.x)
- 985 TS/TSX in src/
- 73 Prisma models, 49 enums, 26 migrations (all applied to PROD)
- 39 validation schemas
- 28+ unit test files (incl. pinned static tests under src/lib/ci/ + src/lib/ops/), 13 E2E specs
- 22 report pages, 23 API routes, 46 loading skeletons
- 19 app module directories under (app)/

## CI / Branch Protection (since v1.10.0)
- `main` and `stable` branches require 4 status checks to pass before merge.
- `Lint (Biome)` job is split from `Typecheck (advisory)` (Sprint 5a, v1.9.2).
- All GitHub Actions on Node 24 (v5 majors): actions/checkout@v5, actions/setup-node@v5, actions/upload-artifact@v5, pnpm/action-setup@v5 (since v1.11.0). No more Node 20 deprecation warnings.
- `protection-after.json` snapshot lives under `scripts/sprints/2026-04-24-required-checks/`. Biome ignore covers `scripts/sprints/**`.
- Pinned static tests in `src/lib/ci/` + `src/lib/ops/` lock the workflow ↔ branch-protection ↔ runbook contract.
- E2E workflow currently failing (env validation in WebServer — DATABASE_URL/DIRECT_URL/BETTER_AUTH_SECRET secrets missing). Not in required-checks list, doesn't block merges. Owner action item.

## Known Issues
1. **Git index corruption**: FUSE mount causes phantom deletions in `git status`. Fix: `rm -f .git/index && git reset HEAD`.
2. **macOS duplicates**: Files like `en 2.ts`, `schema 2.prisma` appear. Delete on sight.
3. **Escaped paths**: Files under `src/app/\(app\)/`. Copy to correct path, delete escaped dir.
4. **Recharts in server components**: Must be lazy-loaded.
5. **Bash `grep -qF "$term"` arg-parse trap**: When `$term` begins with `-`, grep treats it as a flag and crashes silently. Use `[[ "$str" == *"$term"* ]]` (bash built-in) or `grep -qF -- "$term"` (argument separator). Pinned by `src/lib/ops/sprint-4b-sanity.static.test.ts`.
6. **Stale local Prisma generated types**: After a session checkout, run `pnpm prisma generate` before typecheck; otherwise `pnpm typecheck` may report dozens of phantom TS2339 errors against schema fields that exist in the DB but not in the local `node_modules/.prisma/client` cache. CI is fine because `postinstall` re-runs generate.
7. **E2E workflow env validation**: Playwright WebServer aborts on missing `DATABASE_URL` / `DIRECT_URL` / `BETTER_AUTH_SECRET`. GitHub Secrets need to be populated (or the workflow needs an env-stub step).

## Backlog (open sprints)
- **D4 — Typecheck → required** (`Sprint 6` candidate): now that the TS error count is 0, the `Typecheck (advisory)` job can be promoted to required. Touches ci.yml (drop continue-on-error, drop "(advisory)" suffix), `setup-branch-protection.sh` (5 contexts), `src/lib/ci/required-checks.static.test.ts` (rewrite advisory describe block), and a branch-protection API call gated on `ENABLE REQUIRED CHECKS`.
- **E2E env fix**: populate GitHub Secrets so `pnpm dev`'s env validation passes during Playwright web-server boot.

## Version History (Recent)
| Tag | Description |
|---|---|
| v1.11.0-node24-actions-bump | All GitHub Actions v4 → v5 (Node 24 ready, deprecation warnings cleared) |
| v1.10.2.1-sanity-pin-biome-format | Biome formatter compliance for sanity pin test |
| v1.10.2-pinned-test-and-memory | Sanity-gate pinned static test + memory refresh |
| v1.10.1.1-sanity-gate-fix | Sprint 4b Phase 2 grep arg-parse trap fix |
| v1.10.1-ops-prod-migrate | Prod migrate (no-op, audit trail — schema already current) |
| v1.10.0.1-biome-sprints-ignore | Biome `scripts/sprints` ignore |
| v1.10.0-required-checks | Branch protection: 4 required status checks on main + stable |
| v1.9.2.2-vitest-hotfix | ci-migration-gate pinned test job-rename lockstep |
| v1.9.2.1-lint-hotfix | Biome formatter post-Sprint-5a |
| v1.9.2-ci-workflow-refactor | Sprint 5a: split Lint · Typecheck into Lint (Biome) + Typecheck (advisory) |
| v1.9.1-ops-staging-migrate | Sprint 4: prisma migrate deploy on staging |
| v1.9.0-ci-migration-chain | P1-04: migrations job in CI (scratch Postgres + idempotency check) |
| v1.8.1-ci-lint-audit | CI lint audit baseline |
| v1.0.0-rc3 | Sprint 2+3: low-stock SQL opt, email rate limit, webhook hardening |

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
