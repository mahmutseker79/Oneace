#!/bin/bash
#
# Sprint 4 — Ops: prisma migrate deploy (staging)
#
# Applies the 5 pending migrations to the STAGING database:
#   - 20260417142430_migration_job_bootstrap    (Sprint 3)
#   - 20260423* (P0-03.1)  stock_movement_idempotency_not_null
#   - 20260424* (P0-03.2)  stock_movement_idempotency_not_null  [confirm #s at runtime]
#   - 20260425* (P0-03.3)  landed_cost                          [confirm]
#   - 20260426* (P0-03.4)  webhook_delivery_event               [confirm]
#
# Reads STAGING connection from (in order):
#   1) $DATABASE_URL_STAGING env var
#   2) .env.staging (DATABASE_URL=)
#   3) .env.staging.local (DATABASE_URL=)
#
# Aborts if neither is present. Requires interactive confirmation
# before executing `prisma migrate deploy` — this script WILL mutate
# the staging schema.
#
# Does NOT touch prod. A separate sprint-4b-prod-migrate.command
# should be used after staging passes a smoke test.
#
set -euo pipefail

REPO="/Users/bluefire/Documents/Claude/Projects/OneAce/oneace"
SPRINT_DIR="scripts/sprints/2026-04-24-ops-staging"
SPRINT_TAG="v1.9.1-ops-staging-migrate"
PREV_TAG="v1.9.0-ci-migration-chain"
STATUS_BEFORE_LOG="$SPRINT_DIR/status-before.log"
DEPLOY_LOG="$SPRINT_DIR/deploy.log"
STATUS_AFTER_LOG="$SPRINT_DIR/status-after.log"

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
  echo "FATAL: Sprint 3 tag '$PREV_TAG' not found. Run Sprint 3 first."
  exit 1
fi
if ! git merge-base --is-ancestor "$PREV_TAG" HEAD; then
  echo "FATAL: $PREV_TAG is not an ancestor of HEAD."
  exit 1
fi

# ─── Phase 1 — Resolve staging connection ────────────────────────────────────
echo "== Phase 1 — resolve staging connection =="
STAGING_URL=""
if [ -n "${DATABASE_URL_STAGING:-}" ]; then
  STAGING_URL="$DATABASE_URL_STAGING"
  echo "  source: \$DATABASE_URL_STAGING"
elif [ -f ".env.staging" ]; then
  STAGING_URL="$(grep -E '^DATABASE_URL=' .env.staging | head -1 | sed -E 's/^DATABASE_URL=//;s/^"//;s/"$//')"
  echo "  source: .env.staging"
elif [ -f ".env.staging.local" ]; then
  STAGING_URL="$(grep -E '^DATABASE_URL=' .env.staging.local | head -1 | sed -E 's/^DATABASE_URL=//;s/^"//;s/"$//')"
  echo "  source: .env.staging.local"
fi

if [ -z "$STAGING_URL" ]; then
  cat <<'EOF'
FATAL: staging DATABASE_URL not found.

Provide one of:

  export DATABASE_URL_STAGING="postgres://…"
  # or
  echo 'DATABASE_URL="postgres://…"' >> .env.staging       # gitignored
  # or
  echo 'DATABASE_URL="postgres://…"' >> .env.staging.local  # gitignored

Then rerun this script.
EOF
  exit 1
fi

# Redact password before printing
REDACTED_URL="$(echo "$STAGING_URL" | sed -E 's#(://[^:]+:)[^@]+@#\1****@#')"
echo "  URL: $REDACTED_URL"

# ─── Phase 2 — Status before ──────────────────────────────────────────────────
echo "== Phase 2 — prisma migrate status (before) =="
set +e
DATABASE_URL="$STAGING_URL" pnpm exec prisma migrate status 2>&1 | tee "$STATUS_BEFORE_LOG"
STATUS_BEFORE_EXIT=$?
set -e
echo "  status exit: $STATUS_BEFORE_EXIT (non-zero means pending migrations — expected)"

PENDING_COUNT="$(grep -cE '^\s*• ' "$STATUS_BEFORE_LOG" || true)"
echo "  pending migrations detected: $PENDING_COUNT"

# ─── Phase 3 — Confirm ───────────────────────────────────────────────────────
echo ""
echo "── About to apply pending migrations to STAGING ──"
echo "  connection: $REDACTED_URL"
echo "  pending   : $PENDING_COUNT"
echo ""
printf "Type 'APPLY STAGING' to continue: "
read -r CONFIRM
if [ "$CONFIRM" != "APPLY STAGING" ]; then
  echo "Aborted by operator. No changes made."
  exit 1
fi

# ─── Phase 4 — Deploy ────────────────────────────────────────────────────────
echo "== Phase 4 — prisma migrate deploy =="
set +e
DATABASE_URL="$STAGING_URL" pnpm exec prisma migrate deploy 2>&1 | tee "$DEPLOY_LOG"
DEPLOY_EXIT=$?
set -e
if [ "$DEPLOY_EXIT" -ne 0 ]; then
  echo ""
  echo "FATAL: migrate deploy failed (exit $DEPLOY_EXIT). See $DEPLOY_LOG."
  echo "       Staging DB may be in a partial state. Inspect before prod."
  exit "$DEPLOY_EXIT"
fi

# ─── Phase 5 — Status after ───────────────────────────────────────────────────
echo "== Phase 5 — prisma migrate status (after) =="
DATABASE_URL="$STAGING_URL" pnpm exec prisma migrate status 2>&1 | tee "$STATUS_AFTER_LOG"

REMAINING="$(grep -cE '^\s*• ' "$STATUS_AFTER_LOG" || true)"
if [ "$REMAINING" -gt 0 ]; then
  echo "WARN: $REMAINING migrations still pending post-deploy — investigate."
  exit 1
fi
echo "  ✓ Staging in sync with migrations dir"

# ─── Phase 6 — Tag + push ────────────────────────────────────────────────────
echo "== Phase 6 — tag + push =="
if git rev-parse --verify "$SPRINT_TAG" >/dev/null 2>&1; then
  echo "  tag '$SPRINT_TAG' already exists — reusing"
else
  git add "$SPRINT_DIR/"
  if ! git diff --cached --quiet; then
    git commit -m "ops(staging): apply pending migrations to staging DB" \
      -m "Logs from \`prisma migrate deploy\` against staging. No schema" \
      -m "or code changes — this commit only captures the deploy receipt" \
      -m "(status-before, deploy, status-after) for audit." \
      -m "" \
      -m "Closes Sprint 4 of the 2026-04-24 CI-hygiene roadmap."
  fi
  git tag -a "$SPRINT_TAG" -m "Sprint 4 — staging migrate deploy receipt"
fi

git branch -f stable HEAD
git push origin main
git push origin "$SPRINT_TAG"
git push origin stable --force-with-lease

# ─── Phase 7 — Verify ────────────────────────────────────────────────────────
echo "== Phase 7 — verify =="
if [ -x ./scripts/verify.sh ]; then
  ./scripts/verify.sh deploy || echo "verify.sh returned non-zero — inspect."
fi

echo ""
echo "== Sprint 4 DONE =="
echo "  tag     : $SPRINT_TAG"
echo "  HEAD    : $(git rev-parse --short HEAD)"
echo "  logs    : $SPRINT_DIR/{status-before,deploy,status-after}.log"
echo ""
echo "Next step: manual staging smoke (pages, auth, QB webhook) before prod."
