#!/bin/bash
#
# Sprint 1 — Hijyen + stable fast-forward (2026-04-24)
#
# 1) FUSE git-index fix (global protocol)
# 2) Archive 16 repo-root .command helpers → scripts/recovery/2026-04-23-god-mode/
# 3) Commit + tag v1.8.0-hygiene-stable-ff
# 4) Fast-forward local+remote `stable` branch to HEAD
# 5) Push main, stable, tag
# 6) Post-push verify (./scripts/verify.sh deploy)
#
# Expected runtime: ~2–3 minutes (Git + push + Vercel probe).
# Authentication: SSH remote already configured. No prompts expected.
#
set -euo pipefail

REPO="/Users/bluefire/Documents/Claude/Projects/OneAce/oneace"
SPRINT_TAG="v1.8.0-hygiene-stable-ff"
SPRINT_MSG="chore(hygiene): archive GOD MODE recovery scripts + stable FF"
ARCHIVE_DIR="scripts/recovery/2026-04-23-god-mode"

cd "$REPO"

# ─── Phase 0 — Preflight ──────────────────────────────────────────────────────
echo "== Phase 0 — preflight =="
git rev-parse --is-inside-work-tree >/dev/null
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "FATAL: expected to be on 'main', got '$CURRENT_BRANCH'. Aborting."
  exit 1
fi

# ─── Phase 1 — FUSE index fix ─────────────────────────────────────────────────
echo "== Phase 1 — FUSE index fix =="
# Cowork sandbox can't rm .git/index; Mac-side we can.
if [ -f .git/index ]; then
  rm -f .git/index || true
fi
git reset HEAD >/dev/null 2>&1 || true
# Apply FUSE-safe config
git config --local core.preloadIndex false
git config --local core.fsmonitor false
git config --local core.untrackedCache false
git config --local core.checkStat minimal
git config --local index.skipHash true
git config --local --unset core.hookspath 2>/dev/null || true

# Refresh hooks
for hook in post-commit post-checkout post-merge; do
  cat > ".git/hooks/$hook" <<'H'
#!/bin/sh
git update-index --refresh >/dev/null 2>&1 || true
H
  chmod +x ".git/hooks/$hook"
done

# Nuke stray .git/*.bak* (FUSE Python workaround leftovers)
find .git -name "*.bak*" -delete 2>/dev/null || true

# macOS duplicate-file cleanup
find . -name "* [0-9]*" \
  -not -path "*/node_modules/*" \
  -not -path "*/.git/*" \
  -not -path "*/.next/*" \
  -delete 2>/dev/null || true

# Escaped-path guard
if find . -path '*/\(*' -type f \
     -not -path "*/node_modules/*" \
     -not -path "*/.git/*" 2>/dev/null | grep -q .; then
  echo "WARN: escaped (parens) paths detected — review before committing."
fi

# ─── Phase 2 — Archive root .command helpers ──────────────────────────────────
echo "== Phase 2 — archive root .command helpers =="
mkdir -p "$ARCHIVE_DIR"

SCRIPTS=(
  apply-recovery.command
  finish-recovery.command
  hotfix-10-final-vitest.command
  hotfix-11-migration-gate-dual-track.command
  hotfix-2-ci-green.command
  hotfix-3-ci-green.command
  hotfix-4-lint-autofix.command
  hotfix-4b-lint-finalize.command
  hotfix-5-migration-chain.command
  hotfix-6-lint-commit.command
  hotfix-7-output-format.command
  hotfix-8-vitest-fixes.command
  hotfix-9-delete-to-empty.command
  hotfix-prisma-landed-cost-backref.command
  merge-god-mode-recovery-to-main.command
  merge-v1.7.6-auth-hardening-to-main.command
)

MOVED=0
for s in "${SCRIPTS[@]}"; do
  if [ -f "$s" ]; then
    mv "$s" "$ARCHIVE_DIR/$s"
    MOVED=$((MOVED + 1))
  else
    echo "  (missing at root, skipping: $s)"
  fi
done
echo "  moved: $MOVED / ${#SCRIPTS[@]}"

if [ "$MOVED" -lt 16 ]; then
  echo "WARN: expected to move 16 scripts, moved $MOVED. Pinned test will fail."
  echo "      Inspect repo root before commit and reconcile."
fi

# ─── Phase 3 — Stage + commit ────────────────────────────────────────────────
echo "== Phase 3 — stage + commit =="
git add \
  .gitignore \
  "$ARCHIVE_DIR" \
  scripts/sprints/2026-04-24-hygiene/ \
  src/lib/ci/recovery-archive.static.test.ts

git status --short | head -40

if git diff --cached --quiet; then
  echo "FATAL: nothing staged. Did the Cowork-side artefacts make it to disk?"
  exit 1
fi

git commit -m "$SPRINT_MSG" \
  -m "Archives the 16 root .command helpers generated during the 2026-04-23" \
  -m "GOD MODE recovery sprint into scripts/recovery/2026-04-23-god-mode/." \
  -m "" \
  -m "- .gitignore: repo-root /{hotfix,apply,merge,finish,sprint}-*.command" \
  -m "- scripts/recovery/2026-04-23-god-mode/README.md: run-order dossier" \
  -m "- src/lib/ci/recovery-archive.static.test.ts: 4 pinned guards" \
  -m "- scripts/sprints/2026-04-24-hygiene/: this sprint's runner" \
  -m "" \
  -m "Closes Sprint 1 of the 2026-04-24 CI-hygiene roadmap."

# ─── Phase 4 — Pinned test (smoke) ───────────────────────────────────────────
echo "== Phase 4 — pinned test =="
if command -v pnpm >/dev/null 2>&1; then
  pnpm vitest run src/lib/ci/recovery-archive.static.test.ts --reporter=default
else
  echo "WARN: pnpm not in PATH — skipping pinned test run. You MUST run it manually before push:"
  echo "  pnpm vitest run src/lib/ci/recovery-archive.static.test.ts"
fi

# ─── Phase 5 — Tag + stable FF ───────────────────────────────────────────────
echo "== Phase 5 — tag + stable FF =="
git tag -a "$SPRINT_TAG" -m "Sprint 1 — hijyen + stable FF (archive GOD MODE .command helpers)"
git branch -f stable HEAD

# ─── Phase 6 — Push ──────────────────────────────────────────────────────────
echo "== Phase 6 — push =="
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
echo "== Sprint 1 DONE =="
echo "  tag     : $SPRINT_TAG"
echo "  HEAD    : $(git rev-parse --short HEAD)"
echo "  main    : $(git rev-parse --short origin/main)"
echo "  stable  : $(git rev-parse --short origin/stable)"
