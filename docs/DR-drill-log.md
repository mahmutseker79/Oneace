# OneAce Disaster Recovery — Drill Log

Appended automatically by `.github/workflows/dr-drill.yml` on every
live drill. Do not delete entries — the history is the evidence for
the RTO/RPO claim in `docs/backup-strategy.md`.

A target of **RTO ≤ 3 hours / RPO ≤ 15 min** is set in
`docs/backup-strategy.md`. The first five live entries of this log
are the evidence this claim is no longer aspirational.

## Procedure (9-step runbook, on-call can execute inline)

1. Export `NEON_API_KEY` (secret: `secrets_missing` short-circuits run) and pick the source project.
2. Create a **Neon branch** off the latest `prod` snapshot via the Neon API.
3. Wait for branch readiness; capture the new connection string as `RESTORE_DATABASE_URL`.
4. Run `pnpm prisma migrate deploy` against the `RESTORE_DATABASE_URL` to reapply the full migration chain.
5. Run `pnpm exec vitest run src/lib/costing src/lib/movements src/lib/idempotency` against the restored DB to confirm pinned behavior.
6. Export a representative `StockMovement` + `IdempotencyKey` count; compare to the prod snapshot (delta window = RPO).
7. Stop the wall-clock timer (delta = observed RTO).
8. Append an entry below with start/end UTC, elapsed, outcome, run URL, notes.
9. Delete the Neon branch in the `always()` cleanup step; verify billing doesn't leak.

## Format

Each drill appends a level-2 heading in the shape:

```
## YYYY-MM-DD — <short title>

- **Started (UTC):** `…`
- **Ended (UTC):** `…`
- **Elapsed:** `…`
- **Outcome:** `success` / `failure` / `cancelled`
- **Run URL:** https://github.com/…
```

Tabletop exercises (no real Neon branch) use `## TABLETOP — …` so the
freshness guard sees an anchor even before the first live drill.

## TABLETOP — 2026-04-24 — Initial skeleton exercise

- **Started (UTC):** `2026-04-24T06:00:00Z`
- **Ended (UTC):** `2026-04-24T06:45:00Z`
- **Elapsed:** `00:45:00` (paper only — no Neon branch created)
- **Outcome:** `success`
- **Run URL:** n/a (workflow skeleton, DRY_RUN=true)
- **Notes:** P1-06 runbook walked through end-to-end. First live drill scheduled for the next weekly Monday window.

## YYYY-MM-DD — example live entry (template — replace when the first real drill lands)

- **Started (UTC):** `YYYY-MM-DDTHH:MM:SSZ`
- **Ended (UTC):** `YYYY-MM-DDTHH:MM:SSZ`
- **Elapsed:** `HH:MM:SS`
- **Outcome:** `success`
- **Run URL:** https://github.com/mahmutseker79/Oneace/actions/runs/…
