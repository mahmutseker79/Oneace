#!/bin/bash
#
# Hotfix-2 — Sprint 5a vitest fail
#
# Root cause: src/lib/ci/ci-migration-gate.static.test.ts hard-codes
# the OLD context names including "Lint · Typecheck". Sprint 5a split
# that job into "Lint (Biome)" (required) + "Typecheck (advisory)"
# (continue-on-error), but this pinned test wasn't updated in
# lockstep, so it asserts on the old name and fails CI.
#
# Sandbox updated the EXPECTED_JOB_NAMES list; this script commits,
# tags v1.9.2.2-vitest-hotfix, pushes, and watches the new CI run.
#
set -euo pipefail

REPO="/Users/bluefire/Documents/Claude/Projects/OneAce/oneace"
HOTFIX_TAG="v1.9.2.2-vitest-hotfix"
REPO_OWNER="mahmutseker79"
REPO_NAME="Oneace"

cd "$REPO"

echo "== Phase 0 — preflight =="
[ "$(git rev-parse --abbrev-ref HEAD)" = "main" ] || { echo "FATAL: not on main."; exit 1; }

echo "== Phase 1 — FUSE fix =="
[ -f .git/HEAD.lock ] && mv .git/HEAD.lock ".git/HEAD.lock.stale-$(date +%s)" || true
find .git -name "*.bak*" -delete 2>/dev/null || true

echo "== Phase 2 — local vitest smoke =="
pnpm vitest run src/lib/ci/ci-migration-gate.static.test.ts --reporter=default

echo "== Phase 3 — stage + commit + tag =="
git add -A
git status --short | head

if git diff --cached --quiet; then
  echo "NOTE: tree clean — hotfix already committed."
else
  git commit -m "fix(test): update ci-migration-gate pinned test for Sprint 5a job rename" \
    -m "Sprint 5a (v1.9.2) split 'Lint · Typecheck' into 'Lint (Biome)'" \
    -m "(required) + 'Typecheck (advisory)' (continue-on-error:true)." \
    -m "The P1-05 branch-protection pinned test in" \
    -m "src/lib/ci/ci-migration-gate.static.test.ts still hard-coded" \
    -m "the old name in EXPECTED_JOB_NAMES, causing CI Vitest red." \
    -m "" \
    -m "Updates the list + adds an explanatory comment about the" \
    -m "advisory exclusion."
fi

if git rev-parse --verify "$HOTFIX_TAG" >/dev/null 2>&1; then
  echo "  tag '$HOTFIX_TAG' already exists — reusing"
else
  git tag -a "$HOTFIX_TAG" -m "Sprint 5a vitest hotfix — ci-migration-gate job rename lockstep"
fi

echo "== Phase 4 — push =="
git branch -f stable HEAD
git push origin main
git push origin "$HOTFIX_TAG"
git push origin stable --force-with-lease

echo "== Phase 5 — watch new CI run =="
HEAD_SHA="$(git rev-parse HEAD)"
RUN_ID=""
for i in $(seq 1 30); do
  RUN_ID="$(
    gh run list --repo "$REPO_OWNER/$REPO_NAME" --branch main --limit 20 \
      --json databaseId,headSha,name,workflowName \
      | jq -r --arg sha "$HEAD_SHA" \
          '[.[] | select(.headSha == $sha) | select((.name // .workflowName) == "CI")] | .[0].databaseId // empty'
  )"
  [ -n "$RUN_ID" ] && { echo "  run #$RUN_ID"; break; }
  sleep 5
done
[ -z "$RUN_ID" ] && { echo "FATAL: no CI run on $HEAD_SHA."; exit 1; }

gh run watch "$RUN_ID" --repo "$REPO_OWNER/$REPO_NAME" --exit-status --interval 15 \
  || echo "  watch returned non-zero (Typecheck advisory expected; job-check is authoritative)"

echo "== Phase 6 — assert 4 required jobs green =="
JOBS="$(gh api "repos/$REPO_OWNER/$REPO_NAME/actions/runs/$RUN_ID/jobs" --jq '.jobs | map({name, conclusion})')"
echo "$JOBS" | jq -r '.[] | "  [\(.conclusion)] \(.name)"'
for job in "Lint (Biome)" "Vitest" "Prisma Validate" "Prisma Migrations (scratch Postgres)"; do
  c="$(echo "$JOBS" | jq -r --arg n "$job" '.[] | select(.name == $n) | .conclusion' | head -1)"
  [ "$c" = "success" ] || { echo "  ✗ $job ($c) — still red"; exit 1; }
done
echo "  ✓ All 4 required jobs green"

echo ""
echo "== Hotfix-2 DONE =="
echo "  tag  : $HOTFIX_TAG"
echo "  HEAD : $(git rev-parse --short HEAD)"
echo ""
echo "Next: rerun Sprint 5 — probe will pass now."
echo "  bash scripts/sprints/2026-04-24-required-checks/sprint-5-required-checks.command"
