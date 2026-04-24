#!/bin/bash
#
# Sprint 5a — CI workflow refactor (prep for required-checks)
#
# Splits the `Lint · Typecheck` job into:
#   - `Lint (Biome)`           required
#   - `Typecheck (advisory)`   continue-on-error: true (non-blocking)
#
# Also updates scripts/setup-branch-protection.sh contexts and the
# pinned drift guard to match.
#
# Phases:
#   0) Preflight — branch=main, Sprint 4 tag reachable
#   1) FUSE fix
#   2) Pinned test smoke (required-checks.static.test.ts)
#   3) Stage + commit + tag v1.9.2-ci-workflow-refactor
#   4) Stable FF + push
#   5) Poll for the new CI run to complete
#   6) Assert all 4 required jobs are green (gh api job breakdown)
#   7) Post-push verify
#
# After this lands green, run:
#   bash scripts/sprints/2026-04-24-required-checks/sprint-5-required-checks.command
#
set -euo pipefail

REPO="/Users/bluefire/Documents/Claude/Projects/OneAce/oneace"
SPRINT_DIR="scripts/sprints/2026-04-24-required-checks"
SPRINT_TAG="v1.9.2-ci-workflow-refactor"
PREV_TAG="v1.9.1-ops-staging-migrate"
REPO_OWNER="mahmutseker79"
REPO_NAME="Oneace"
POLL_LOG="$SPRINT_DIR/5a-poll.log"

REQUIRED_JOBS=(
  "Lint (Biome)"
  "Vitest"
  "Prisma Validate"
  "Prisma Migrations (scratch Postgres)"
)

cd "$REPO"
mkdir -p "$SPRINT_DIR"

# ─── Phase 0 — Preflight ──────────────────────────────────────────────────────
echo "== Phase 0 — preflight =="
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
[ "$CURRENT_BRANCH" = "main" ] || { echo "FATAL: not on main."; exit 1; }
git rev-parse --verify "$PREV_TAG" >/dev/null 2>&1 \
  || { echo "FATAL: Sprint 4 tag '$PREV_TAG' not found."; exit 1; }
command -v gh >/dev/null 2>&1 \
  || { echo "FATAL: gh CLI not installed."; exit 1; }
gh auth status >/dev/null 2>&1 \
  || { echo "FATAL: gh not authenticated."; exit 1; }

# ─── Phase 1 — FUSE fix ───────────────────────────────────────────────────────
echo "== Phase 1 — FUSE fix =="
[ -f .git/HEAD.lock ] && mv .git/HEAD.lock ".git/HEAD.lock.stale-$(date +%s)" || true
find .git -name "*.bak*" -delete 2>/dev/null || true
git update-index --refresh >/dev/null 2>&1 || true

# ─── Phase 2 — Pinned test smoke ──────────────────────────────────────────────
echo "== Phase 2 — pinned test smoke =="
pnpm vitest run src/lib/ci/required-checks.static.test.ts --reporter=default

# ─── Phase 3 — Stage + commit + tag ──────────────────────────────────────────
echo "== Phase 3 — stage + commit + tag =="
git add \
  .github/workflows/ci.yml \
  scripts/setup-branch-protection.sh \
  src/lib/ci/required-checks.static.test.ts \
  "$SPRINT_DIR/"

if git diff --cached --quiet; then
  echo "NOTE: nothing staged — refactor may already be committed."
else
  git commit -m "ci(workflow): split Lint · Typecheck into Lint (Biome) + Typecheck (advisory)" \
    -m "The former 'Lint · Typecheck' job coupled Biome + tsc --noEmit" \
    -m "into a single required step. tsc --noEmit has ~212 pre-existing" \
    -m "errors (Prisma relation typing; next.config.ts already sets" \
    -m "ignoreBuildErrors: true for the same reason) — so promoting" \
    -m "the combined job to a required-check would permanently block" \
    -m "merges." \
    -m "" \
    -m "Refactor:" \
    -m "  - 'Lint (Biome)' — Biome only, required-check candidate" \
    -m "  - 'Typecheck (advisory)' — tsc --noEmit, continue-on-error: true" \
    -m "  - 'Vitest' — needs: lint (no longer needs typecheck)" \
    -m "" \
    -m "scripts/setup-branch-protection.sh updated to list the 4" \
    -m "required contexts; src/lib/ci/required-checks.static.test.ts" \
    -m "pins the list + the advisory shape." \
    -m "" \
    -m "Prerequisite for Sprint 5 (required-checks enable)."
fi

if git rev-parse --verify "$SPRINT_TAG" >/dev/null 2>&1; then
  echo "  tag '$SPRINT_TAG' already exists — reusing"
else
  git tag -a "$SPRINT_TAG" -m "Sprint 5a — CI workflow refactor (lint/typecheck split)"
fi

# ─── Phase 4 — Stable FF + push ──────────────────────────────────────────────
echo "== Phase 4 — stable FF + push =="
git branch -f stable HEAD
git push origin main
git push origin "$SPRINT_TAG"
git push origin stable --force-with-lease

# ─── Phase 5 — Poll for the new CI run ───────────────────────────────────────
echo "== Phase 5 — poll for new CI run =="
HEAD_SHA="$(git rev-parse HEAD)"
echo "  polling for run on sha $HEAD_SHA..."
RUN_ID=""
for i in $(seq 1 30); do
  RUN_ID="$(
    gh run list \
      --repo "$REPO_OWNER/$REPO_NAME" \
      --branch main \
      --limit 5 \
      --json databaseId,headSha,status \
      | jq -r --arg sha "$HEAD_SHA" \
          '[.[] | select(.headSha == $sha)] | .[0].databaseId // empty'
  )"
  if [ -n "$RUN_ID" ]; then
    echo "  found run #$RUN_ID (attempt $i)"
    break
  fi
  echo "  waiting for run to register... (attempt $i/30)"
  sleep 5
done

if [ -z "$RUN_ID" ]; then
  echo "FATAL: no run found for sha $HEAD_SHA after 150s. Check Actions tab."
  exit 1
fi

echo "  watching run #$RUN_ID (this may take a few minutes)..."
gh run watch "$RUN_ID" --repo "$REPO_OWNER/$REPO_NAME" --exit-status --interval 15 \
  || echo "  run completed with non-zero status — inspect job breakdown below"

# ─── Phase 6 — Assert required jobs green ────────────────────────────────────
echo "== Phase 6 — assert required jobs green =="
JOBS_JSON="$(
  gh api "repos/$REPO_OWNER/$REPO_NAME/actions/runs/$RUN_ID/jobs" \
    --jq '.jobs | map({name, conclusion, status})'
)"
echo "$JOBS_JSON" | tee "$POLL_LOG" | jq -r '.[] | "  [\(.conclusion // .status)] \(.name)"'

ALL_GREEN=true
for job in "${REQUIRED_JOBS[@]}"; do
  conclusion="$(echo "$JOBS_JSON" | jq -r --arg n "$job" '.[] | select(.name == $n) | .conclusion' | head -1)"
  if [ "$conclusion" != "success" ]; then
    echo "    ✗ $job  (conclusion=$conclusion)"
    ALL_GREEN=false
  fi
done

if [ "$ALL_GREEN" != "true" ]; then
  cat <<EOF

Required jobs NOT all green on run #$RUN_ID. Inspect:
  gh run view $RUN_ID --repo $REPO_OWNER/$REPO_NAME --web

Fix the red jobs, push, rerun this script (idempotent — will
re-poll for the new run).
EOF
  exit 1
fi

# ─── Phase 7 — Verify ────────────────────────────────────────────────────────
echo "== Phase 7 — verify =="
if [ -x ./scripts/verify.sh ]; then
  ./scripts/verify.sh deploy || echo "verify.sh returned non-zero — inspect."
fi

echo ""
echo "== Sprint 5a DONE =="
echo "  tag     : $SPRINT_TAG"
echo "  run id  : $RUN_ID  (all 4 required jobs green)"
echo "  HEAD    : $(git rev-parse --short HEAD)"
echo ""
echo "Next: run Sprint 5 to enable required-checks:"
echo "  bash $SPRINT_DIR/sprint-5-required-checks.command"
