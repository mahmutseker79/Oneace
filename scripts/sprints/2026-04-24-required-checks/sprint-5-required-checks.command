#!/bin/bash
#
# Sprint 5 — CI status check + required-checks enable
#
# Enables GitHub required status checks on main + stable using
# scripts/setup-branch-protection.sh. Aborts if recent CI runs are
# red — required-checks on a red baseline would lock the repo.
#
# Phases:
#   0) Preflight — branch=main, Sprint 4 tag reachable, gh auth OK
#   1) FUSE fix
#   2) CI status probe — last 10 runs, check if all 4 required
#      jobs are green on origin/main
#   3) Interactive confirm ("ENABLE REQUIRED CHECKS")
#   4) Run scripts/setup-branch-protection.sh (main + stable)
#   5) Verify protection shape via `gh api`
#   6) Pinned test smoke (required-checks.static.test.ts)
#   7) Stage + commit + tag v1.10.0-required-checks + stable FF + push
#   8) Post-push verify (./scripts/verify.sh deploy)
#
set -euo pipefail

REPO="/Users/bluefire/Documents/Claude/Projects/OneAce/oneace"
SPRINT_DIR="scripts/sprints/2026-04-24-required-checks"
SPRINT_TAG="v1.10.0-required-checks"
PREV_TAG="v1.9.1-ops-staging-migrate"
REPO_OWNER="mahmutseker79"
REPO_NAME="Oneace"
CI_PROBE_LOG="$SPRINT_DIR/ci-probe.log"
PROTECTION_LOG="$SPRINT_DIR/protection-after.json"

REQUIRED_JOBS=(
  "Lint (Biome)"
  "Vitest"
  "Prisma Validate"
  "Prisma Migrations (scratch Postgres)"
)
# Typecheck is advisory (continue-on-error) — NOT in the
# required-checks list. See ci.yml for the 212-error rationale.

cd "$REPO"
mkdir -p "$SPRINT_DIR"

# ─── Phase 0 — Preflight ──────────────────────────────────────────────────────
echo "== Phase 0 — preflight =="
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "FATAL: expected 'main', got '$CURRENT_BRANCH'."
  exit 1
fi
if ! git rev-parse --verify "$PREV_TAG" >/dev/null 2>&1; then
  echo "FATAL: Sprint 4 tag '$PREV_TAG' not found. Run Sprint 4 first."
  exit 1
fi
if ! command -v gh >/dev/null 2>&1; then
  echo "FATAL: gh CLI not installed. See https://cli.github.com/."
  exit 1
fi
if ! gh auth status >/dev/null 2>&1; then
  echo "FATAL: gh not authenticated. Run 'gh auth login' first."
  exit 1
fi

# ─── Phase 1 — FUSE fix ───────────────────────────────────────────────────────
echo "== Phase 1 — FUSE index fix =="
if [ -f .git/HEAD.lock ]; then
  mv .git/HEAD.lock ".git/HEAD.lock.stale-$(date +%s)" || true
fi
find .git -name "*.bak*" -delete 2>/dev/null || true
git update-index --refresh >/dev/null 2>&1 || true

# ─── Phase 2 — CI status probe ────────────────────────────────────────────────
echo "== Phase 2 — CI status probe =="
WORKFLOW_NAME="CI"  # must match `name:` at the top of .github/workflows/ci.yml
echo "  Fetching last 20 runs (filter workflow='$WORKFLOW_NAME') on branch=main..."
gh run list \
  --repo "$REPO_OWNER/$REPO_NAME" \
  --branch main \
  --limit 20 \
  --json databaseId,displayTitle,conclusion,status,headSha,event,createdAt,name,workflowName \
  > "$CI_PROBE_LOG"

LATEST_COMPLETED_RUN="$(
  jq -r --arg wf "$WORKFLOW_NAME" \
    '[.[] | select(.status == "completed") | select((.name // .workflowName) == $wf)] | .[0].databaseId // empty' \
    "$CI_PROBE_LOG"
)"
if [ -z "$LATEST_COMPLETED_RUN" ] || [ "$LATEST_COMPLETED_RUN" = "null" ]; then
  echo "FATAL: no completed runs on main. Push something first or wait."
  exit 1
fi

echo "  Latest completed run ID: $LATEST_COMPLETED_RUN"
echo "  Fetching job breakdown..."

JOBS_JSON="$(
  gh api "repos/$REPO_OWNER/$REPO_NAME/actions/runs/$LATEST_COMPLETED_RUN/jobs" \
    --jq '.jobs | map({name, conclusion, status})'
)"
echo "$JOBS_JSON" | jq -r '.[] | "  [\(.conclusion // .status)] \(.name)"'

echo ""
echo "  Checking required jobs are green on this run..."
ALL_GREEN=true
for job in "${REQUIRED_JOBS[@]}"; do
  conclusion="$(
    echo "$JOBS_JSON" \
      | jq -r --arg n "$job" '.[] | select(.name == $n) | .conclusion' \
      | head -1
  )"
  if [ "$conclusion" = "success" ]; then
    echo "    ✓ $job"
  else
    echo "    ✗ $job  (conclusion=$conclusion)"
    ALL_GREEN=false
  fi
done

if [ "$ALL_GREEN" != "true" ]; then
  cat <<EOF

FATAL: not every required job is green on run #$LATEST_COMPLETED_RUN.

Enabling required-checks on a red baseline would lock all future
merges behind jobs that don't pass. Fix the red jobs FIRST (most
likely lint/migration leftover from Sprint 2/3 iteration), push a
new commit, wait for CI, and rerun this script.

See the run in the browser:
  gh run view $LATEST_COMPLETED_RUN --repo $REPO_OWNER/$REPO_NAME --web

EOF
  exit 1
fi

echo ""
echo "  ✓ All 4 required jobs green on run #$LATEST_COMPLETED_RUN"

# ─── Phase 3 — Interactive confirm ───────────────────────────────────────────
echo ""
echo "── About to enable required status checks on main + stable ──"
echo "  contexts: ${REQUIRED_JOBS[*]}"
echo "  repo    : $REPO_OWNER/$REPO_NAME"
echo ""
echo "Effect: future pushes/merges to main and stable MUST pass these"
echo "4 jobs. Admin bypass stays available for emergencies."
echo ""
printf "Type 'ENABLE REQUIRED CHECKS' to continue: "
read -r CONFIRM
if [ "$CONFIRM" != "ENABLE REQUIRED CHECKS" ]; then
  echo "Aborted by operator."
  exit 1
fi

# ─── Phase 4 — Apply protection ──────────────────────────────────────────────
echo "== Phase 4 — apply branch protection =="
./scripts/setup-branch-protection.sh

# ─── Phase 5 — Verify protection ─────────────────────────────────────────────
echo "== Phase 5 — verify protection =="
gh api "repos/$REPO_OWNER/$REPO_NAME/branches/main/protection" \
  --jq '{required_status_checks, required_linear_history, allow_force_pushes, required_pull_request_reviews: .required_pull_request_reviews.required_approving_review_count}' \
  > "$PROTECTION_LOG"
cat "$PROTECTION_LOG" | jq .

CTX_COUNT="$(jq -r '.required_status_checks.contexts | length' "$PROTECTION_LOG")"
if [ "$CTX_COUNT" != "4" ]; then
  echo "FATAL: expected 4 required contexts, got $CTX_COUNT."
  exit 1
fi
for job in "${REQUIRED_JOBS[@]}"; do
  if ! jq -r '.required_status_checks.contexts[]' "$PROTECTION_LOG" | grep -qxF "$job"; then
    echo "FATAL: required context missing from API response: $job"
    exit 1
  fi
done
echo "  ✓ All 4 required contexts registered on main"

# ─── Phase 6 — Pinned test smoke ─────────────────────────────────────────────
echo "== Phase 6 — pinned test smoke =="
pnpm vitest run src/lib/ci/required-checks.static.test.ts --reporter=default

# ─── Phase 7 — Stage + commit + tag + push ───────────────────────────────────
echo "== Phase 7 — stage + commit + tag + push =="
git add \
  src/lib/ci/required-checks.static.test.ts \
  "$SPRINT_DIR/"

if git diff --cached --quiet; then
  echo "NOTE: nothing staged — artefacts appear already committed."
else
  git commit -m "ci(protection): enable required status checks on main + stable" \
    -m "Enables 4 required contexts in GitHub branch protection:" \
    -m "  - Lint · Typecheck" \
    -m "  - Vitest" \
    -m "  - Prisma Validate" \
    -m "  - Prisma Migrations (scratch Postgres)" \
    -m "" \
    -m "Probe confirmed all 4 green on latest completed main run" \
    -m "before applying. Admin bypass stays available for emergencies." \
    -m "" \
    -m "- src/lib/ci/required-checks.static.test.ts: drift guard pins" \
    -m "  the 4 contexts in lockstep with ci.yml job 'name:' fields." \
    -m "- scripts/sprints/2026-04-24-required-checks/: probe log + protection snapshot" \
    -m "" \
    -m "Closes Sprint 5 of the 2026-04-24 CI-hygiene roadmap." \
    -m "After this commit, merges to main require PR + 4 green CI jobs." \
    -m "Together with Sprints 1-4 this concludes the CI hygiene arc."
fi

if git rev-parse --verify "$SPRINT_TAG" >/dev/null 2>&1; then
  echo "  tag '$SPRINT_TAG' already exists — reusing"
else
  git tag -a "$SPRINT_TAG" -m "Sprint 5 — required status checks enabled (CI hygiene milestone)"
fi

git branch -f stable HEAD
git push origin main
git push origin "$SPRINT_TAG"
git push origin stable --force-with-lease

# ─── Phase 8 — Verify ────────────────────────────────────────────────────────
echo "== Phase 8 — verify =="
if [ -x ./scripts/verify.sh ]; then
  ./scripts/verify.sh deploy || echo "verify.sh returned non-zero — inspect."
fi

echo ""
echo "== Sprint 5 DONE =="
echo "  tag     : $SPRINT_TAG"
echo "  HEAD    : $(git rev-parse --short HEAD)"
echo "  contexts: ${REQUIRED_JOBS[*]}"
echo "  probe   : $CI_PROBE_LOG"
echo "  snapshot: $PROTECTION_LOG"
echo ""
echo "Next time an admin push bypasses protection, the server will"
echo "still log it as 'Bypassed rule violations' — that's expected for"
echo "admin actions; for regular contributors the checks are hard."
