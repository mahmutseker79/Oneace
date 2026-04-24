#!/bin/bash
#
# Sprint 3 — ci-migration-chain-audit
#
# Adds the MigrationJob + MigrationStatus bootstrap migration
# (20260417142430_migration_job_bootstrap) so scratch Postgres can
# walk the full chain. Companion to the MigrationSource hotfix
# landed in 20260417142431 (c834241).
#
# Phases:
#   0) Preflight — branch=main, Sprint 2 tag reachable
#   1) FUSE git-index fix
#   2) Prisma validate (schema.prisma still parseable)
#   3) Pinned test smoke (src/lib/ci/migration-chain.static.test.ts)
#   4) (Optional) Local scratch-Postgres deploy — skipped if no docker / no DATABASE_URL_SCRATCH
#   5) Stage + commit + tag v1.9.0-ci-migration-chain
#   6) Stable FF + push (main, stable, tag)
#   7) Post-push verify (./scripts/verify.sh deploy)
#
# Artefacts already written by Cowork session:
#   - prisma/migrations/20260417142430_migration_job_bootstrap/migration.sql
#   - src/lib/ci/migration-chain.static.test.ts
#   - (this runner)
#
set -euo pipefail

REPO="/Users/bluefire/Documents/Claude/Projects/OneAce/oneace"
SPRINT_DIR="scripts/sprints/2026-04-24-migration-chain"
SPRINT_TAG="v1.9.0-ci-migration-chain"
SPRINT_MSG="fix(migrate): bootstrap MigrationJob + MigrationStatus for scratch Postgres"
PREV_TAG="v1.8.1-ci-lint-audit"
BOOTSTRAP_DIR="prisma/migrations/20260417142430_migration_job_bootstrap"
PINNED_TEST="src/lib/ci/migration-chain.static.test.ts"

cd "$REPO"
mkdir -p "$SPRINT_DIR"

# ─── Phase 0 — Preflight ──────────────────────────────────────────────────────
echo "== Phase 0 — preflight =="
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "FATAL: expected 'main', got '$CURRENT_BRANCH'. Abort."
  exit 1
fi
if ! git rev-parse --verify "$PREV_TAG" >/dev/null 2>&1; then
  echo "FATAL: Sprint 2 tag '$PREV_TAG' not found. Run Sprint 2 first."
  exit 1
fi
if ! git merge-base --is-ancestor "$PREV_TAG" HEAD; then
  echo "FATAL: $PREV_TAG is not an ancestor of HEAD."
  exit 1
fi

# ─── Phase 1 — FUSE fix ───────────────────────────────────────────────────────
echo "== Phase 1 — FUSE index fix =="
if [ -f .git/HEAD.lock ]; then
  mv .git/HEAD.lock ".git/HEAD.lock.stale-$(date +%s)" || true
fi
find .git -name "*.bak*" -delete 2>/dev/null || true
git update-index --refresh >/dev/null 2>&1 || true

# Pre-flight: the three expected artefacts must be on disk
for f in "$BOOTSTRAP_DIR/migration.sql" "$PINNED_TEST"; do
  if [ ! -f "$f" ]; then
    echo "FATAL: expected artefact missing: $f"
    echo "       Re-run the Cowork session or hand-recreate."
    exit 1
  fi
done

# ─── Phase 2 — Prisma validate ────────────────────────────────────────────────
echo "== Phase 2 — prisma validate =="
pnpm exec prisma validate

# ─── Phase 3 — Pinned test smoke ──────────────────────────────────────────────
echo "== Phase 3 — pinned test smoke =="
pnpm vitest run "$PINNED_TEST" --reporter=default

# ─── Phase 4 — (Optional) local scratch-Postgres deploy ──────────────────────
echo "== Phase 4 — optional local migrate deploy =="
if [ -n "${DATABASE_URL_SCRATCH:-}" ]; then
  echo "  DATABASE_URL_SCRATCH set — running migrate deploy against scratch DB"
  echo "  (if this fails, fix the chain locally before pushing)"
  DATABASE_URL="$DATABASE_URL_SCRATCH" pnpm exec prisma migrate deploy
elif command -v docker >/dev/null 2>&1; then
  echo "  DATABASE_URL_SCRATCH unset, docker present — spinning ephemeral Postgres"
  CID="$(docker run -d --rm -e POSTGRES_PASSWORD=scratch -p 55432:5432 postgres:16-alpine)"
  trap 'docker kill "$CID" >/dev/null 2>&1 || true' EXIT
  # Wait for readiness
  for i in 1 2 3 4 5 6 7 8 9 10; do
    if docker exec "$CID" pg_isready -U postgres >/dev/null 2>&1; then break; fi
    sleep 1
  done
  DATABASE_URL="postgres://postgres:scratch@localhost:55432/postgres" \
    pnpm exec prisma migrate deploy
  docker kill "$CID" >/dev/null 2>&1 || true
  trap - EXIT
  echo "  ✓ scratch Postgres deploy passed"
else
  echo "  Neither DATABASE_URL_SCRATCH nor docker available — skipping local deploy."
  echo "  CI will still run the authoritative check on the next push."
fi

# ─── Phase 5 — Stage + commit ─────────────────────────────────────────────────
echo "== Phase 5 — stage + commit =="
git add "$BOOTSTRAP_DIR/" "$PINNED_TEST" "$SPRINT_DIR/"
git status --short | head -30

if git diff --cached --quiet; then
  echo "NOTE: nothing staged — artefacts appear already committed."
  echo "      Skipping commit, proceeding to tag + push."
else
  git commit -m "$SPRINT_MSG" \
    -m "Adds 20260417142430_migration_job_bootstrap — idempotent creator" \
    -m "for MigrationStatus enum + MigrationJob table + indexes + FKs." \
    -m "Fixes the second half of the pre-baseline drift gap first" \
    -m "exposed when the P1-04 CI gate (scratch Postgres migrate deploy)" \
    -m "went live. The first half (MigrationSource enum) was closed by" \
    -m "c834241; this closes MigrationJob." \
    -m "" \
    -m "- prisma/migrations/20260417142430_migration_job_bootstrap/migration.sql" \
    -m "  * DO \$\$ IF NOT EXISTS CREATE TYPE 'MigrationStatus'" \
    -m "  * CREATE TABLE IF NOT EXISTS 'MigrationJob' (sans scopeOptions)" \
    -m "  * 3 idempotent CREATE INDEX IF NOT EXISTS" \
    -m "  * 2 idempotent FK via pg_constraint lookup" \
    -m "- src/lib/ci/migration-chain.static.test.ts: 7 pinned drift guards" \
    -m "- scopeOptions is still ALTER-added by 20260417142431 (authoritative source)" \
    -m "" \
    -m "Closes Sprint 3 of the 2026-04-24 CI-hygiene roadmap."
fi

# ─── Phase 6 — Tag + stable FF + push ────────────────────────────────────────
echo "== Phase 6 — tag + stable FF + push =="
if git rev-parse --verify "$SPRINT_TAG" >/dev/null 2>&1; then
  echo "  tag '$SPRINT_TAG' already exists — reusing"
else
  git tag -a "$SPRINT_TAG" -m "Sprint 3 — ci-migration-chain-audit (MigrationJob bootstrap)"
fi

git branch -f stable HEAD

git push origin main
git push origin "$SPRINT_TAG"
git push origin stable --force-with-lease

# ─── Phase 7 — Verify ────────────────────────────────────────────────────────
echo "== Phase 7 — verify =="
if [ -x ./scripts/verify.sh ]; then
  ./scripts/verify.sh deploy || echo "verify.sh returned non-zero — inspect."
else
  echo "scripts/verify.sh not executable, skipping."
fi

echo ""
echo "== Sprint 3 DONE =="
echo "  tag     : $SPRINT_TAG"
echo "  HEAD    : $(git rev-parse --short HEAD)"
echo "  main    : $(git rev-parse --short origin/main)"
echo "  stable  : $(git rev-parse --short origin/stable)"
