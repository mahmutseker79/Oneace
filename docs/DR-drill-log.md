# DR Drill Log

Appended automatically by `.github/workflows/dr-drill.yml` on every
live drill. Do not delete entries — the history is the evidence for
the RTO/RPO claim in `docs/backup-strategy.md`.

A target of **≤ 3 hours** is set in `docs/backup-strategy.md`. The
first five live entries of this log are the evidence this claim is
no longer aspirational.

## Format

Each drill appends a level-2 heading section in the shape:

```
## YYYY-MM-DD — <short title>

- **Started (UTC):** `…`
- **Ended (UTC):** `…`
- **Elapsed:** `…`
- **Outcome:** `success` / `failure` / `cancelled`
- **Run URL:** https://github.com/…

<optional notes>
```

The workflow's append step writes into this file in exactly that
shape; the pinned test at `src/lib/ci/dr-drill-wiring.static.test.ts`
locks the contract so a docs refactor that flips to a table silently
breaks the append step.

## YYYY-MM-DD — example entry (template — remove when first real drill lands)

- **Started (UTC):** `YYYY-MM-DDTHH:MM:SSZ`
- **Ended (UTC):** `YYYY-MM-DDTHH:MM:SSZ`
- **Elapsed:** `HH:MM:SS`
- **Outcome:** `success`
- **Run URL:** https://github.com/mahmutseker79/Oneace/actions/runs/…

The first real live drill will replace this template section.
