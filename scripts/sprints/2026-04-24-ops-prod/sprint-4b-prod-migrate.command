#!/bin/bash
#
# Sprint 4b — Ops: prisma migrate deploy (PRODUCTION)
#
# Applies pending migrations to the PRODUCTION database. Requires:
#   - Sprint 4 (staging migrate deploy) tag reachable
#   - Staging smoke-tested (user-asserted via 'CONFIRMED' prompt)
#   - DATABASE_URL_PROD env var OR .env.production[.local]
#   - Interactive 'APPLY PRODUCTION' second confirmation
#
# The migrations applied here are the same 4 additive ones landed
# via Sprints 1–3 + P0-03 (all NOT NULL columns backfilled in
# migration.sql, so safe under concurrent writes):
#   20260417142430_migration_job_bootstrap
#   20260423*_stock_movement_idempotency_not_null
#   20260425*_landed_cost
#   20260426*_webhook_delivery_event
#
# Phases:
#   0) Preflight
#   1) Resolve PROD connection (redact+print)
#   2) Sanity: URL must NOT contain "staging", "stage", "test", "dev"
#   3) prisma migrate status (before)
#   4) Early-exit if pending=0
#   5) First confirm — "CONFIRMED" (staging smoke)
#   6) Second confirm — "APPLY PRODUCTION"
#   7) prisma migrate deploy
#   8) prisma migrate status (after) — assert 0 pending
#   9) Commit receipt + tag v1.10.1-ops-prod-migrate
#  10) Stable FF + push
#  11) Post-push verify (./scripts/verify.sh deploy)
#
set -euo pipefail

REPO="/Users/bluefire/Documents/Claude/Projects/OneAce/oneace"
SPRINT_DIR="scripts/sprints/2026-04-24-ops-prod"
SPRINT_TAG="v1.10.1-ops-prod-migrate"
PREV_TAG="v1.10.0-required-checks"
STAGING_TAG="v1.9.1-ops-staging-migrate"
STATUS_BEFORE_LOG="$SPRINT_DIR/status-before.log"
DEPLOY_LOG="$SPRINT_DIR/deploy.log"
STATUS_AFTER_LOG="$SPRINT_DIR/status-after.log"

cd "$REPO"
mkdir -p "$SPRINT_DIR"

# ─── Phase 0 — Preflight ──────────────────────────────────────────────────────
echo "== Phase 0 — preflight =="
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
[ "$CURRENT_BRANCH" = "main" ] || { echo "FATAL: not on main."; exit 1; }
git rev-parse --verify "$PREV_TAG" >/dev/null 2>&1 \
  || { echo "FATAL: Sprint 5 tag '$PREV_TAG' not found."; exit 1; }
git rev-parse --verify "$STAGING_TAG" >/dev/null 2>&1 \
  || { echo "FATAL: Sprint 4 (staging) tag '$STAGING_TAG' not found."; exit 1; }
git merge-base --is-ancestor "$STAGING_TAG" HEAD \
  || { echo "FATAL: staging tag $STAGING_TAG is not an ancestor of HEAD."; exit 1; }

# ─── Phase 1 — Resolve PROD connection ───────────────────────────────────────
echo "== Phase 1 — resolve PROD connection =="
PROD_URL=""
PROD_URL_SOURCE=""
if [ -n "${DATABASE_URL_PROD:-}" ]; then
  PROD_URL="$DATABASE_URL_PROD"
  PROD_URL_SOURCE='$DATABASE_URL_PROD'
elif [ -f ".env.production.local" ]; then
  PROD_URL="$(grep -E '^DATABASE_URL=' .env.production.local | head -1 | sed -E 's/^DATABASE_URL=//;s/^"//;s/"$//')"
  PROD_URL_SOURCE=".env.production.local"
elif [ -f ".env.production" ]; then
  PROD_URL="$(grep -E '^DATABASE_URL=' .env.production | head -1 | sed -E 's/^DATABASE_URL=//;s/^"//;s/"$//')"
  PROD_URL_SOURCE=".env.production"
fi

if [ -z "$PROD_URL" ]; then
  cat <<'EOF'
FATAL: PROD DATABASE_URL not found.

Provide one of:

  export DATABASE_URL_PROD="postgres://…"
  # or edit .env.production.local (gitignored) and put:
  DATABASE_URL="postgres://…"

Then rerun this script.
EOF
  exit 1
fi

REDACTED_URL="$(echo "$PROD_URL" | sed -E 's#(://[^:]+:)[^@]+@#\1****@#')"
echo "  source: $PROD_URL_SOURCE"
echo "  URL   : $REDACTED_URL"

# ─── Phase 2 — Sanity: not a staging/test URL ────────────────────────────────
echo "== Phase 2 — URL sanity scan =="
URL_LOWER="$(echo "$PROD_URL" | tr '[:upper:]' '[:lower:]')"
BAD_TERMS=("staging" "stage" "_test" "-test" "_dev" "-dev" "sandbox" "localhost")
for term in "${BAD_TERMS[@]}"; do
  if echo "$URL_LOWER" | grep -qF "$term"; then
    echo ""
    echo "WARN: PROD URL contains suspicious substring '$term'."
    echo "      Host/DB name: $(echo "$REDACTED_URL" | sed -E 's#^postgres(?:ql)?://[^@]+@##')"
    printf "Really continue (this script will call 'prisma migrate deploy')? Type 'YES PROD' to override: "
    read -r OVERRIDE
    if [ "$OVERRIDE" != "YES PROD" ]; then
      echo "Aborted. If the URL is genuinely prod, rename away from '$term' or accept the override."
      exit 1
    fi
    break
  fi
done

# ─── Phase 3 — Status before ──────────────────────────────────────────────────
echo "== Phase 3 — prisma migrate status (before) =="
set +e
DATABASE_URL="$PROD_URL" pnpm exec prisma migrate status 2>&1 | tee "$STATUS_BEFORE_LOG"
STATUS_BEFORE_EXIT=$?
set -e
PENDING_COUNT="$(grep -cE '^\s*• ' "$STATUS_BEFORE_LOG" || true)"
echo "  status exit: $STATUS_BEFORE_EXIT, pending: $PENDING_COUNT"

# ─── Phase 4 — Early exit if nothing pending ─────────────────────────────────
if [ "$PENDING_COUNT" = "0" ]; then
  echo ""
  echo "✓ PROD already up-to-date. No migrations to apply."
  echo "  Tagging the receipt anyway for audit trail."

  git add "$SPRINT_DIR/"
  if ! git diff --cached --quiet; then
    git commit -m "ops(prod): prisma migrate status — no pending (receipt-only)" \
      -m "No-op prod deploy check. Status log captured; no schema change."
  fi
  if ! git rev-parse --verify "$SPRINT_TAG" >/dev/null 2>&1; then
    git tag -a "$SPRINT_TAG" -m "Sprint 4b — prod status check (no pending)"
  fi
  git branch -f stable HEAD
  git push origin main
  git push origin "$SPRINT_TAG"
  git push origin stable --force-with-lease
  echo "== Sprint 4b DONE (no-op) =="
  exit 0
fi

# ─── Phase 5 — First confirm (staging smoke) ─────────────────────────────────
echo ""
echo "── About to apply $PENDING_COUNT migration(s) to PRODUCTION ──"
echo "  connection: $REDACTED_URL"
echo "  HEAD      : $(git rev-parse --short HEAD)"
echo "  staging   : $STAGING_TAG is reachable"
echo ""
echo "Confirm staging was smoke-tested after Sprint 4 (pages, auth,"
echo "critical flows, QB webhook)."
printf "Type 'CONFIRMED' to continue: "
read -r CONFIRM1
if [ "$CONFIRM1" != "CONFIRMED" ]; then
  echo "Aborted. Smoke-test staging first, then rerun."
  exit 1
fi

# ─── Phase 6 — Second confirm (go/no-go) ─────────────────────────────────────
echo ""
echo "Final go/no-go for PRODUCTION migrate deploy."
printf "Type 'APPLY PRODUCTION' (case-sensitive, exact): "
read -r CONFIRM2
if [ "$CONFIRM2" != "APPLY PRODUCTION" ]; then
  echo "Aborted by operator. No changes made."
  exit 1
fi

# ─── Phase 7 — Deploy ────────────────────────────────────────────────────────
echo "== Phase 7 — prisma migrate deploy (PROD) =="
set +e
DATABASE_URL="$PROD_URL" pnpm exec prisma migrate deploy 2>&1 | tee "$DEPLOY_LOG"
DEPLOY_EXIT=$?
set -e
if [ "$DEPLOY_EXIT" -ne 0 ]; then
  echo ""
  echo "FATAL: migrate deploy failed (exit $DEPLOY_EXIT). See $DEPLOY_LOG."
  echo "       PROD may be in a partial state. Investigate BEFORE anything else."
  exit "$DEPLOY_EXIT"
fi

# ─── Phase 8 — Status after ──────────────────────────────────────────────────
echo "== Phase 8 — prisma migrate status (after) =="
DATABASE_URL="$PROD_URL" pnpm exec prisma migrate status 2>&1 | tee "$STATUS_AFTER_LOG"
REMAINING="$(grep -cE '^\s*• ' "$STATUS_AFTER_LOG" || true)"
if [ "$REMAINING" -gt 0 ]; then
  echo "FATAL: $REMAINING migration(s) still pending post-deploy — investigate."
  exit 1
fi
echo "  ✓ PROD in sync with migrations dir"

# ─── Phase 9 — Commit + tag ──────────────────────────────────────────────────
echo "== Phase 9 — commit + tag =="
git add "$SPRINT_DIR/"
if ! git diff --cached --quiet; then
  git commit -m "ops(prod): apply pending migrations to production DB" \
    -m "Logs from 'prisma migrate deploy' against prod. Companion to" \
    -m "$STAGING_TAG (staging receipt). Applied after staging smoke." \
    -m "" \
    -m "- status-before: $PENDING_COUNT pending" \
    -m "- deploy      : exit 0" \
    -m "- status-after: 0 pending" \
    -m "" \
    -m "Closes Sprint 4b of the 2026-04-24 CI-hygiene + ops roadmap."
fi
if git rev-parse --verify "$SPRINT_TAG" >/dev/null 2>&1; then
  echo "  tag '$SPRINT_TAG' already exists — reusing"
else
  git tag -a "$SPRINT_TAG" -m "Sprint 4b — prod migrate deploy receipt"
fi

# ─── Phase 10 — Stable FF + push ─────────────────────────────────────────────
echo "== Phase 10 — stable FF + push =="
git branch -f stable HEAD
git push origin main
git push origin "$SPRINT_TAG"
git push origin stable --force-with-lease

# ─── Phase 11 — Verify ───────────────────────────────────────────────────────
echo "== Phase 11 — verify =="
if [ -x ./scripts/verify.sh ]; then
  ./scripts/verify.sh deploy || echo "verify.sh returned non-zero — inspect."
fi

echo ""
echo "== Sprint 4b DONE =="
echo "  tag     : $SPRINT_TAG"
echo "  HEAD    : $(git rev-parse --short HEAD)"
echo "  applied : $PENDING_COUNT migration(s)"
echo "  logs    : $SPRINT_DIR/{status-before,deploy,status-after}.log"
echo ""
echo "NEXT: smoke-test prod (pages, auth, QB webhook, a write path)"
echo "      and consider 'rm .env.production.local' to clean up the"
echo "      cached credential."
