# OneAce Project Memory

## Quick Reference
- **Version**: v1.0.0-rc3 (tag: `v1.0.0-rc3`)
- **Branch**: main
- **Stable**: `stable` branch = last verified state
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
- **DB**: Prisma 6 + PostgreSQL (Neon)
- **Auth**: better-auth with 2FA TOTP
- **Styling**: Tailwind CSS 4, Inter font, CVA for component variants
- **Charts**: Recharts 3.8 (client-only — never import in server components)
- **Analytics**: PostHog + Vercel Analytics + Sentry
- **Build**: `ignoreBuildErrors: true` in next.config.ts (212 pre-existing TS errors, all Prisma relation types from GOD MODE expansion)

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

## File Counts
- 542 TS/TSX in src/
- 61 Prisma models, 40 enums, 10 migrations
- 39 validation schemas
- 27 unit test files, 13 E2E specs
- 18 report pages, 23 API routes, 46 loading skeletons
- 26 app module directories under (app)/

## Known Issues
1. **Git index corruption**: FUSE mount causes phantom deletions in `git status`. Fix: `rm -f .git/index && git reset HEAD`. Git configs already set to minimize recurrence.
2. **macOS duplicates**: Files like `en 2.ts`, `schema 2.prisma` appear. Delete on sight.
3. **Escaped paths**: Files under `src/app/\(app\)/` instead of `src/app/(app)/`. Copy to correct path, delete escaped dir.
4. **Recharts in server components**: Recharts must be lazy-loaded. Never directly import in server component files under reports/.

## Version History (Recent)
| Tag | Description |
|---|---|
| v1.0.0-rc3 | Sprint 2+3: low-stock SQL opt, email rate limit, webhook hardening |
| v1.0.0-rc2 | Sprint 0+1: 3 critical + 5 high security fixes, CHECK constraints, 9 indexes |
| v1.0.0-rc1 | Full audit passed, version management added |
| v0.49.0-deployment-fixes | Build/deployment fixes |
| v0.48.0-security-hardening | Sprint 0-3 security hardening |
| v0.47.0-v4-expansion | V4: industry features, 7 reports, design elevation |
| v0.46.0-pre-launch | 2FA, rate limit, GDPR, PostHog, 525 tests |
| v0.45.0-p9-complete | Dashboard charts, PDF export, bin labels, PWA |
| v0.44.0-ux-phases-9-20 | UX Phase 9-20: plan gates, 46 skeletons |
| v0.43.0-ux-phases-1-8 | UX Phase 1-8: loading, sidebar, onboarding |

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
