# OneAce Disaster Recovery — Drill Log

<!--
v1.2 P2 §5.38 — DR drill evidence log.

`docs/backup-strategy.md` has long promised RTO ≤ 4 hours, RPO ≤ 1 hour.
Until now, that was a *claim* — we had never restored a production
backup to a disposable environment and measured how long it actually
takes. This file is the ledger of every DR drill we've run, including
the first one (which is deliberately a "tabletop" entry so the
freshness test has a baseline to parse).

FORMAT CONTRACT (pinned by `src/lib/dr-drill-freshness.test.ts`):
  - Every real drill starts with a level-2 heading:  `## YYYY-MM-DD — <title>`
  - The date field MUST match ISO-8601 `YYYY-MM-DD` so the freshness
    test can parse the most-recent entry without heuristics.
  - Tabletop / non-executed drills use a `## TABLETOP — <title>` heading
    (no date); the freshness parser skips these when computing last-run.

AUTHORED PROCEDURE (run every real drill via):
  1. Create a Neon branch off `main` (or a disposable Neon project).
  2. Export `DATABASE_URL` + `DIRECT_URL` to point at the branch.
  3. `pnpm prisma migrate deploy` — assert zero drift.
  4. `pnpm prisma db seed` (optional; smoke with real data if dumped).
  5. `pnpm vitest run` — MUST be green.
  6. `pnpm e2e --project=smoke` — MUST be green (if smoke project exists).
  7. Record the wall-clock timing for each step + total RTO.
  8. Destroy the Neon branch.
  9. Append a new entry below (keep newest on top).
-->

## TABLETOP — 2026-04-18 · Procedure authored, no live drill yet

**Status:** Tabletop (no database restore performed)
**Operator:** @mahmutseker79
**Baseline DB size:** unknown (prod DB not yet sampled for drill sizing)
**Elapsed (end-to-end):** n/a — tabletop only
**RTO target:** ≤ 4 hours (per `docs/backup-strategy.md`)
**RPO target:** ≤ 1 hour (Neon PITR, continuous WAL shipping)

### What was covered
- Reviewed `docs/backup-strategy.md` against actual Neon Pro plan capabilities.
- Wrote the 9-step procedure above (authored here for the first time).
- Confirmed `pnpm prisma migrate deploy` is the correct migration reconciliation entry point — matches `package.json` scripts.
- Confirmed Vitest suite is the smoke-after-restore assertion surface (1828 tests at the time of this tabletop; a green run = schema + seed + helpers round-tripped intact).
- Landed a scheduled-workflow skeleton at `.github/workflows/dr-drill.yml` so the first real drill has a runbook, not a scratch buffer.

### Gaps / to-do
- No live Neon branch was created.
- `pg_restore --list <file>` was not exercised for manual-dump drills.
- The e2e smoke project (`pnpm e2e --project=smoke`) does not exist yet — a future drill will either wire one in or be honest about running the full e2e suite.

### Lessons (pre-drill)
- The freshness guard (`src/lib/dr-drill-freshness.test.ts`) needs a TABLETOP-vs-drill distinction so CI doesn't go red on day 1.
- The workflow is intentionally `workflow_dispatch` + monthly `schedule` with a **`DRY_RUN=true`** default. The first live drill should be run manually with `DRY_RUN=false` to keep surprises out of the scheduled path.

---

<!--
When a real drill happens, paste a new entry ABOVE this divider using
the template below. Keep the TABLETOP entry in place — it documents
why the workflow exists.

## YYYY-MM-DD — <one-line title>

**Operator:** @handle
**Environment:** Neon branch `drill-YYYY-MM-DD` off `main`
**Baseline DB size:** <MB>
**Elapsed (end-to-end):** <h>h <m>m
**RTO target:** ≤ 4 hours
**RPO target:** ≤ 1 hour

### Steps
| Step | Command | Elapsed | Result |
|------|---------|---------|--------|
| 1    | Neon branch create (API) | 00:00:00 → … | ✅/❌ |
| 2    | `prisma migrate deploy`  | … | … |
| 3    | `prisma db seed`         | … | … |
| 4    | `vitest run`             | … | … |
| 5    | `e2e --project=smoke`    | … | … |
| 6    | Neon branch destroy      | … | … |

### Anomalies
- …

### Lessons
- …
-->
