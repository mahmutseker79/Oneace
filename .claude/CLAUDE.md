# OneAce Project Memory

## Quick Reference
- **Version**: v1.12.2-e2e-db-push (tag: `v1.12.2-e2e-db-push`)
- **Branch**: main
- **Stable**: `stable` branch = last verified state — branch protection active (5 required jobs)
- **Required Jobs (post-Sprint-6)**: Lint (Biome), Vitest, Prisma Validate, Prisma Migrations (scratch Postgres), Typecheck. No advisory.
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
- **Build**: `next.config.ts` does NOT set `ignoreBuildErrors`. Strict TS by default. CI Typecheck job is required (Sprint 6, v1.12.0).
- **TS error count**: 0.

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

## File Counts (last verified after v1.12.x)
- 986 TS/TSX in src/
- 73 Prisma models, 49 enums, 26 migrations
- 39 validation schemas
- 152 unit test files (incl. pinned static tests under src/lib/ci/ + src/lib/ops/), 14 E2E specs
- 22 report pages, 53 API routes, 115 loading skeletons
- 19 app module directories under (app)/

## CI / Branch Protection (since v1.12.0)
- `main` and `stable` branches require **5** status checks:
  Lint (Biome), Vitest, Prisma Validate, Prisma Migrations (scratch Postgres), Typecheck.
- All 4 workflows on Node 24 (v5 majors): actions/checkout@v5, actions/setup-node@v5, actions/upload-artifact@v5, pnpm/action-setup@v5 (since v1.11.0).
- Biome ignore covers `scripts/sprints/**` so future sprint artifacts don't break Lint.
- Pinned static tests in `src/lib/ci/` + `src/lib/ops/` lock the workflow ↔ branch-protection ↔ runbook contract.
- E2E workflow now self-contained: scratch Postgres service + literal env + `prisma db push` (Sprint 6, v1.12.1 + v1.12.2). Doesn't depend on repo Secrets.

## Known Issues
1. **Git index corruption**: FUSE mount causes phantom deletions in `git status`. Fix: `rm -f .git/index && git reset HEAD`.
2. **macOS duplicates**: Files like `en 2.ts`, `schema 2.prisma` appear. Delete on sight.
3. **Escaped paths**: Files under `src/app/\(app\)/`. Copy to correct path, delete escaped dir.
4. **Recharts in server components**: Must be lazy-loaded.
5. **Bash `grep -qF "$term"` arg-parse trap**: When `$term` begins with `-`, grep treats it as a flag and crashes silently. Use `[[ "$str" == *"$term"* ]]` (bash built-in) or `grep -qF -- "$term"` (argument separator). Pinned by `src/lib/ops/sprint-4b-sanity.static.test.ts`.
6. **Stale local Prisma generated types**: After a session checkout, run `pnpm prisma generate` before typecheck; otherwise `pnpm typecheck` may report dozens of phantom TS2339 errors. CI is fine because `postinstall` re-runs generate.
7. **Migration chain has bootstrap drift** (E2E-MIG-1 fixed v1.12.4, MIG-CHAIN-AUDIT pending): the historical chain predates ADR-004 (2026-04-19), so several pre-cutoff migrations rely on tables/enums created out-of-band via early `prisma db push`. v1.12.4 fixed `MigrationSource` (E2E-MIG-1: `20260417142430` referenced an enum created in 142431). v1.12.5 push then revealed E2E-MIG-2: `20260418000000_integration_schema_drift_fix` ALTER TABLE on `Integration` without an upstream CREATE TABLE in the chain. Probably more. Until a full audit lands, ci.yml `migrations` job's Track A (`migrate deploy`) carries `continue-on-error: true` and Track B (`db push`) is the hard gate. E2E uses `db push` for the same reason.

## Backlog (open sprints)
- **MIG-CHAIN-AUDIT** — full migration chain audit. Walk every pre-ADR-004 migration, identify ALTER TABLEs / DO blocks that reference tables or enums never created in the chain, inject CREATE TABLE IF NOT EXISTS / CREATE TYPE IF NOT EXISTS bootstraps. End state: `prisma migrate deploy` runs end-to-end on a fresh Postgres, both ci.yml Track A and e2e.yml can drop their bypasses. v1.12.4 already shows the pattern.
- **Perf-LH-1** — Lighthouse re-enable. lhci autorun was disabled in v1.12.5 because it boots `next start` against a stub Postgres URL with no DB behind it; the middleware's auth path returns a non-200 page and Chrome shows an interstitial that LH interprets as page-load failure. Fix: copy the Postgres service container + env stubs from e2e.yml into the lighthouse job, run `prisma db push` before `lhci autorun`. Then drop `if: false` guard.

## Version History (Recent)
| Tag | Description |
|---|---|
| v1.12.2-e2e-db-push | E2E uses `db push` to bypass migration ordering bug |
| v1.12.1-e2e-scratch-postgres | E2E scratch Postgres + literal env (no Secrets dep) |
| v1.12.0-typecheck-required | Sprint 6: Typecheck advisory → required (5 required jobs) |
| v1.11.1-memory-refresh | TS error count = 0 verified, action versions on v5, backlog notes |
| v1.11.0-node24-actions-bump | All GitHub Actions v4 → v5 (Node 24 ready) |
| v1.10.2.1-sanity-pin-biome-format | Biome formatter compliance for sanity pin test |
| v1.10.2-pinned-test-and-memory | Sanity-gate pinned static test + memory refresh |
| v1.10.1.1-sanity-gate-fix | Sprint 4b Phase 2 grep arg-parse trap fix |
| v1.10.1-ops-prod-migrate | Prod migrate (no-op, audit trail) |
| v1.10.0.1-biome-sprints-ignore | Biome `scripts/sprints` ignore |
| v1.10.0-required-checks | Branch protection: 4 required status checks (pre-Sprint-6) |
| v1.9.2.2-vitest-hotfix | ci-migration-gate pinned test job-rename lockstep |
| v1.9.2-ci-workflow-refactor | Sprint 5a: split Lint · Typecheck → Lint (Biome) + Typecheck (advisory) |
| v1.9.1-ops-staging-migrate | Sprint 4: prisma migrate deploy on staging |
| v1.9.0-ci-migration-chain | P1-04: migrations job in CI (scratch Postgres + idempotency check) |
| v1.0.0-rc3 | Sprint 2+3: low-stock SQL opt, email rate limit, webhook hardening |

## Verification Script
Run `./scripts/verify.sh` — 8-phase health check (39 checks):
- `quick` — git + files only (no network), use at session start
- `full` — all 8 phases including Vercel + test infrastructure
- `deploy` — post-push check including Vercel HTTP status

## Push & Verify Commands
```bash
git push origin main && git push origin stable && git push origin --tags
./scripts/verify.sh deploy    # Confirm everything landed correctly
```
