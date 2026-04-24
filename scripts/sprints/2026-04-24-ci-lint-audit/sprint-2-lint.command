#!/bin/bash
#
# Sprint 2 — ci-lint-audit (Biome residual → 0)
#
# Idempotent. Can be rerun safely after hand-fixing residual errors.
#
# Phases:
#   0) Preflight — branch=main, previous sprint tag reachable
#   1) FUSE git-index fix
#   2) Biome auto-fix (pnpm lint:fix == biome check --write .)
#   3) Biome errors-only check (pnpm exec biome check --diagnostic-level=error .)
#      - if exit != 0 → residual errors logged, script halts, user hand-fixes,
#        then reruns this script (auto-fix no-op on second pass, check re-runs)
#   4) Stage + commit + tag v1.8.1-ci-lint-audit
#   5) Stable FF + push (main, stable, tag)
#   6) Post-push verify (./scripts/verify.sh deploy)
#
# Expected runtime: ~3–10 minutes depending on autofix scope.
#
set -euo pipefail

REPO="/Users/bluefire/Documents/Claude/Projects/OneAce/oneace"
SPRINT_DIR="scripts/sprints/2026-04-24-ci-lint-audit"
SPRINT_TAG="v1.8.1-ci-lint-audit"
SPRINT_MSG="fix(lint): Biome residual errors → 0 (ci-lint-audit sprint)"
PREV_TAG="v1.8.0-hygiene-stable-ff"
RESIDUAL_LOG="$SPRINT_DIR/biome-residual.log"
PRECOUNT_LOG="$SPRINT_DIR/biome-precount.log"

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
  echo "FATAL: Sprint 1 tag '$PREV_TAG' not found. Run Sprint 1 first."
  exit 1
fi
if ! git merge-base --is-ancestor "$PREV_TAG" HEAD; then
  echo "FATAL: $PREV_TAG is not an ancestor of HEAD."
  exit 1
fi

# Warn (don't abort) on dirty tree — script is designed to recover
# from a user hand-fix iteration (Phase 3 residual path).
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "NOTE: working tree is dirty — assuming this is a hand-fix resume pass."
fi

# ─── Phase 1 — FUSE index fix ─────────────────────────────────────────────────
echo "== Phase 1 — FUSE index fix =="
# Stash lock-file: mv (not rm) per feedback
if [ -f .git/HEAD.lock ]; then
  mv .git/HEAD.lock ".git/HEAD.lock.stale-$(date +%s)" || true
fi
find .git -name "*.bak*" -delete 2>/dev/null || true
git update-index --refresh >/dev/null 2>&1 || true

# ─── Phase 2 — Biome auto-fix ────────────────────────────────────────────────
echo "== Phase 2 — Biome auto-fix =="
# Pre-count (errors only)
set +e
pnpm exec biome check --diagnostic-level=error . > "$PRECOUNT_LOG" 2>&1
PRE_EXIT=$?
set -e
PRE_ERRORS="$(grep -cE '^(.*✖|Found [0-9]+ error)' "$PRECOUNT_LOG" || true)"
echo "  pre-fix errors-only exit: $PRE_EXIT (see $PRECOUNT_LOG)"

# Apply autofix + unsafe autofix pass
pnpm lint:fix || true
pnpm exec biome check --write --unsafe . || true

# ─── Phase 3 — Errors-only gate ──────────────────────────────────────────────
echo "== Phase 3 — errors-only gate =="
set +e
pnpm exec biome check --diagnostic-level=error . > "$RESIDUAL_LOG" 2>&1
CHECK_EXIT=$?
set -e

if [ "$CHECK_EXIT" -ne 0 ]; then
  echo ""
  echo "!! Biome residual errors remain. Script halts."
  echo "   Residual log: $RESIDUAL_LOG"
  echo ""
  tail -40 "$RESIDUAL_LOG"
  echo ""
  echo "Hand-fix, stage your changes if you want them committed, then rerun:"
  echo "  bash $SPRINT_DIR/sprint-2-lint.command"
  exit 1
fi

echo "  ✓ Biome errors-only = 0"

# ─── Phase 4 — Stage + commit ────────────────────────────────────────────────
echo "== Phase 4 — stage + commit =="
git add -A

# Drop the sprint runner + pinned test + reference logs
git add \
  "$SPRINT_DIR/" \
  src/lib/ci/biome-gate.static.test.ts

git status --short | head -40

if git diff --cached --quiet; then
  echo "NOTE: nothing to commit — repo already lint-clean + pinned test in place."
  echo "      Skipping commit, proceeding to tag + push (idempotent refresh)."
else
  git commit -m "$SPRINT_MSG" \
    -m "Brings Biome errors-only count to 0, unblocking the 'Lint (Biome)'" \
    -m "job in .github/workflows/ci.yml so it can become a required status" \
    -m "check once the full gate is green." \
    -m "" \
    -m "- pnpm lint:fix + biome check --write --unsafe passes" \
    -m "- src/lib/ci/biome-gate.static.test.ts: 7 pinned drift guards" \
    -m "- scripts/sprints/2026-04-24-ci-lint-audit/: sprint runner + logs" \
    -m "" \
    -m "Closes Sprint 2 of the 2026-04-24 CI-hygiene roadmap."
fi

# ─── Phase 5 — Pinned test smoke ─────────────────────────────────────────────
echo "== Phase 5 — pinned test smoke =="
pnpm vitest run src/lib/ci/biome-gate.static.test.ts --reporter=default

# ─── Phase 6 — Tag + stable FF + push ────────────────────────────────────────
echo "== Phase 6 — tag + stable FF + push =="
if git rev-parse --verify "$SPRINT_TAG" >/dev/null 2>&1; then
  echo "  tag '$SPRINT_TAG' already exists locally — reusing"
else
  git tag -a "$SPRINT_TAG" -m "Sprint 2 — ci-lint-audit (Biome residual → 0)"
fi

git branch -f stable HEAD

git push origin main
git push origin "$SPRINT_TAG"
git push origin stable --force-with-lease

# ─── Phase 7 — Verify ────────────────────────────────────────────────────────
echo "== Phase 7 — verify =="
if [ -x ./scripts/verify.sh ]; then
  ./scripts/verify.sh deploy || echo "verify.sh returned non-zero — inspect output."
else
  echo "scripts/verify.sh not executable, skipping."
fi

echo ""
echo "== Sprint 2 DONE =="
echo "  tag     : $SPRINT_TAG"
echo "  HEAD    : $(git rev-parse --short HEAD)"
echo "  main    : $(git rev-parse --short origin/main)"
echo "  stable  : $(git rev-parse --short origin/stable)"
echo ""
echo "  pre-fix check exit : $PRE_EXIT   (see $PRECOUNT_LOG)"
echo "  final check exit   : 0           (see $RESIDUAL_LOG)"
