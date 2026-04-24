# GOD MODE Recovery Archive — 2026-04-23 sprint

This directory preserves the 16 `.command` helper scripts that drove the
recovery and stabilisation of the 2026-04-23 "GOD MODE" multi-agent
audit remediation sprint. They were originally generated at the repo
root during the recovery session and are archived here for
reproducibility.

**Do not run these again on `origin/main`.** They are release artefacts.
The state they produce is already merged into `main` (tag
`v1.7.0-god-mode-recovery-merged-to-main`) and `v1.7.6-auth-hardening-merged-to-main`.

## Run order (historical)

| # | Script | Purpose | Landed as |
|---|--------|---------|-----------|
| 1 | `apply-recovery.command` | Staged `.recovery-stage/` → working tree | `b05f442 recovery: restore GOD MODE sprint…` |
| 2 | `hotfix-prisma-landed-cost-backref.command` | Schema back-relation fix | `47dec2c fix(schema)…` |
| 3 | `hotfix-2-ci-green.command` | Typecheck + scratch-Postgres unblock | `e7942a5 fix(ci)…` |
| 4 | `hotfix-3-ci-green.command` | AnyFunction + duplicate import + gate.reset + locale keys | `361dfee fix(ci)…` |
| 5 | `hotfix-4-lint-autofix.command` | Biome auto-fix (`--fix --unsafe`) | `f435839 fix(lint)…` |
| 6 | `hotfix-4b-lint-finalize.command` | Biome residual hand-fix | folded into `f435839` |
| 7 | `hotfix-5-migration-chain.command` | `MigrationSource` enum bootstrap | `c834241 fix(migrate)…` |
| 8 | `hotfix-6-lint-commit.command` | Lint closure commit | `f435839` |
| 9 | `hotfix-7-output-format.command` | Biome `<output>` single-line fix | `2ed9160 fix(lint)…` |
| 10 | `hotfix-8-vitest-fixes.command` | 5 vitest failures closed | `1d475dc fix(ci)…` |
| 11 | `hotfix-9-delete-to-empty.command` | `delete` → empty-string assign | `708a279 fix(lint)…` |
| 12 | `hotfix-10-final-vitest.command` | 8 remaining vitest failures | `f797b37 fix(ci)…` |
| 13 | `hotfix-11-migration-gate-dual-track.command` | Advisory + authoritative gate split | `7c623cb fix(ci)…` + `075f0de fix(ci)…` |
| 14 | `merge-god-mode-recovery-to-main.command` | `phase-god-mode-recovery` → main | `b5274df merge…` |
| 15 | `merge-v1.7.6-auth-hardening-to-main.command` | `phase-p2-auth-hardening` → main | `cfa537a merge…` |
| 16 | `finish-recovery.command` | Final tag + stable-branch bump | `v1.7.0-god-mode-recovery` |

## Why the archive

- **Reproducibility:** if the sprint ever needs to be replayed on a
  fresh branch (e.g. for a hotfix on an older release line), these
  scripts are the historical record.
- **Training data:** future recovery sprints can crib from the
  structure (stash-safe, untracked-safe, explicit `set -euo pipefail`).
- **Accountability:** every commit in the `b05f442..075f0de` range has
  a corresponding script, and the script lineage is captured in-repo
  (the memory `oneace_god_mode_roadmap.md` links to this dir).

## Related memories

- `oneace_god_mode_roadmap.md` — full sprint dossier
- `feedback_push_script_safety.md` — `git clean -fd` yasağı (lesson from
  the pre-recovery accident)
- `oneace_ci_followups.md` — 3 CI hijyen sprint listesi (bu arşivden
  sonra sıradakiler)
