#!/bin/bash
#
# Hotfix — Sprint 5a/5 CI Biome formatter error
#
# Root cause: the Cowork sandbox-written multi-line `expect(...).toBe(...)`
# calls in src/lib/ci/required-checks.static.test.ts didn't get
# flattened to single-line before the 5a commit. CI's `pnpm lint`
# caught 2 formatter errors → Lint (Biome) job red → required-check
# probe correctly refused to enable protection.
#
# This hotfix:
#   1) Runs `pnpm lint:fix` to apply any remaining formatter edits
#   2) Re-runs `pnpm exec biome check --diagnostic-level=error` to
#      assert 0 errors locally
#   3) Commits + tags v1.9.2.1-lint-hotfix (patch on 5a)
#   4) Pushes main + stable
#   5) Watches the new CI run for 'Lint (Biome)' success
#
# After this lands green, Sprint 5 runner will pass probe and can
# enable required-checks.
#
set -euo pipefail

REPO="/Users/bluefire/Documents/Claude/Projects/OneAce/oneace"
SPRINT_DIR="scripts/sprints/2026-04-24-required-checks"
HOTFIX_TAG="v1.9.2.1-lint-hotfix"
REPO_OWNER="mahmutseker79"
REPO_NAME="Oneace"

cd "$REPO"

# ─── Phase 0 — Preflight ──────────────────────────────────────────────────────
echo "== Phase 0 — preflight =="
[ "$(git rev-parse --abbrev-ref HEAD)" = "main" ] || { echo "FATAL: not on main."; exit 1; }
command -v gh >/dev/null || { echo "FATAL: gh CLI missing."; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "FATAL: gh not authenticated."; exit 1; }

# ─── Phase 1 — FUSE fix ───────────────────────────────────────────────────────
echo "== Phase 1 — FUSE fix =="
[ -f .git/HEAD.lock ] && mv .git/HEAD.lock ".git/HEAD.lock.stale-$(date +%s)" || true
find .git -name "*.bak*" -delete 2>/dev/null || true
git update-index --refresh >/dev/null 2>&1 || true

# ─── Phase 2 — Apply formatter ───────────────────────────────────────────────
echo "== Phase 2 — pnpm lint:fix =="
pnpm lint:fix || true

# ─── Phase 3 — Assert errors-only = 0 ────────────────────────────────────────
echo "== Phase 3 — errors-only assert =="
set +e
pnpm exec biome check --diagnostic-level=error . 2>&1 \
  | tee "$SPRINT_DIR/hotfix-biome-after.log"
EXIT=$?
set -e
if [ "$EXIT" -ne 0 ]; then
  echo ""
  echo "FATAL: Biome errors remain after lint:fix. Inspect:"
  echo "  $SPRINT_DIR/hotfix-biome-after.log"
  echo ""
  echo "If more multi-line expects are listed, either run 'pnpm lint:fix'"
  echo "manually or edit them to single-line before rerunning this script."
  exit 1
fi
echo "  ✓ Biome errors-only = 0"

# ─── Phase 4 — Stage + commit + tag ──────────────────────────────────────────
echo "== Phase 4 — stage + commit + tag =="
git add -A
git status --short | head

if git diff --cached --quiet; then
  echo "NOTE: tree clean — hotfix already committed."
else
  git commit -m "fix(lint): flatten multi-line expect() calls in required-checks pinned test" \
    -m "Sprint 5a (v1.9.2) landed with three multi-line expect(...).toBe(...)" \
    -m "calls the Cowork sandbox wrote. Biome formatter wants them" \
    -m "single-line at line-width 100; CI 'Lint (Biome)' job caught" \
    -m "2 errors → red baseline → Sprint 5 probe correctly refused" \
    -m "to enable required-checks." \
    -m "" \
    -m "Fix via 'pnpm lint:fix' + one regex-assignment split in" \
    -m "the 'continue-on-error' assertion where match() inline was too long." \
    -m "" \
    -m "Unblocks Sprint 5 (required-checks enable)."
fi

if git rev-parse --verify "$HOTFIX_TAG" >/dev/null 2>&1; then
  echo "  tag '$HOTFIX_TAG' already exists — reusing"
else
  git tag -a "$HOTFIX_TAG" -m "Sprint 5a hotfix — Biome multi-line expect flatten"
fi

# ─── Phase 5 — Push ──────────────────────────────────────────────────────────
echo "== Phase 5 — push =="
git branch -f stable HEAD
git push origin main
git push origin "$HOTFIX_TAG"
git push origin stable --force-with-lease

# ─── Phase 6 — Watch new CI run ──────────────────────────────────────────────
echo "== Phase 6 — watch new CI run =="
HEAD_SHA="$(git rev-parse HEAD)"
RUN_ID=""
for i in $(seq 1 30); do
  RUN_ID="$(
    gh run list \
      --repo "$REPO_OWNER/$REPO_NAME" \
      --branch main \
      --limit 20 \
      --json databaseId,headSha,status,name,workflowName \
      | jq -r --arg sha "$HEAD_SHA" \
          '[.[] | select(.headSha == $sha) | select((.name // .workflowName) == "CI")] | .[0].databaseId // empty'
  )"
  [ -n "$RUN_ID" ] && { echo "  found run #$RUN_ID"; break; }
  echo "  waiting for CI run on $HEAD_SHA... ($i/30)"
  sleep 5
done

if [ -z "$RUN_ID" ]; then
  echo "FATAL: no CI run found on sha $HEAD_SHA."
  exit 1
fi

gh run watch "$RUN_ID" --repo "$REPO_OWNER/$REPO_NAME" --exit-status --interval 15 \
  || echo "  run completed non-zero (Typecheck advisory may fail — job-check is authoritative)"

# ─── Phase 7 — Assert required jobs green ────────────────────────────────────
echo "== Phase 7 — assert required jobs green =="
JOBS_JSON="$(
  gh api "repos/$REPO_OWNER/$REPO_NAME/actions/runs/$RUN_ID/jobs" \
    --jq '.jobs | map({name, conclusion})'
)"
echo "$JOBS_JSON" | jq -r '.[] | "  [\(.conclusion)] \(.name)"'

for job in "Lint (Biome)" "Vitest" "Prisma Validate" "Prisma Migrations (scratch Postgres)"; do
  c="$(echo "$JOBS_JSON" | jq -r --arg n "$job" '.[] | select(.name == $n) | .conclusion' | head -1)"
  [ "$c" = "success" ] || { echo "  ✗ $job ($c) — still red"; exit 1; }
done
echo "  ✓ All 4 required jobs green"

echo ""
echo "== Hotfix DONE =="
echo "  tag  : $HOTFIX_TAG"
echo "  HEAD : $(git rev-parse --short HEAD)"
echo ""
echo "Next: rerun Sprint 5 — probe will pass now."
echo "  bash $SPRINT_DIR/sprint-5-required-checks.command"
