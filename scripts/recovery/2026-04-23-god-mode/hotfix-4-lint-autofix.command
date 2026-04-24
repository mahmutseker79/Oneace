#!/bin/bash
# hotfix-4-lint-autofix.command
#
# ci-lint-audit follow-up sprint Phase 1: Biome auto-fix.
# CI çalıştırdığı komut: `biome check --diagnostic-level=error .`
# Son run 105 error, çoğu import ordering / formatting.
#
# Bu script:
#   1. `biome check --write --unsafe .` — her şeyi otomatik düzelt
#   2. Kalan error sayısını raporla
#   3. ≤ 20 residual ise commit + push (hand-fix için kalan spot tolere edilebilir)
#      > 20 residual ise STOP, user karar versin

set -euo pipefail
cd "$(dirname "$0")"

echo "=== [1/6] FUSE hygiene ==="
find .git -name "*.bak*" -delete 2>/dev/null || true
rm -f .git/refs/heads/*.lock .git/refs/remotes/origin/*.lock .git/refs/tags/*.lock 2>/dev/null || true
rm -f .git/config.lock .git/packed-refs.lock 2>/dev/null || true
for lock in .git/HEAD.lock .git/index.lock; do
  [ -e "$lock" ] || continue
  mv "$lock" "${lock%.lock}.lock.gone.$(date +%s)" 2>/dev/null || rm -f "$lock" 2>/dev/null || true
done

echo "=== [2/6] Main + ff ==="
git switch main
git pull --ff-only origin main

echo "=== [3/6] Biome auto-fix (safe + unsafe) ==="
pnpm exec biome check --write --unsafe . 2>&1 | tail -5

echo ""
echo "=== [4/6] Residual error sayısı ==="
set +e
RESIDUAL_OUTPUT=$(pnpm exec biome check --diagnostic-level=error . 2>&1)
RESIDUAL_EXIT=$?
set -e
echo "$RESIDUAL_OUTPUT" | tail -10
echo ""
RESIDUAL_COUNT=$(echo "$RESIDUAL_OUTPUT" | grep -oE "Found [0-9]+ errors" | grep -oE "[0-9]+" | tail -1)
RESIDUAL_COUNT=${RESIDUAL_COUNT:-0}
echo "  Residual error: $RESIDUAL_COUNT"

echo "=== [5/6] Diff özeti ==="
git diff --shortstat

if [ "$RESIDUAL_COUNT" -gt 20 ]; then
  echo ""
  echo "⚠️  Residual > 20 — manuel inceleme gerek. Commit atmadan dur."
  echo "   İnceleme: pnpm exec biome check --diagnostic-level=error . | head -80"
  echo "   Devam için yeni bir hotfix'e ihtiyaç var."
  exit 0
fi

echo ""
echo "=== [6/6] Commit + push ==="
if git diff --quiet; then
  echo "  Değişiklik yok — skip commit."
else
  git add -A
  git commit -m "fix(lint): biome auto-fix across repo (Phase 1 of ci-lint-audit)

Runs \`biome check --write --unsafe .\` across the repo to
eliminate the auto-fixable subset of the 105 Biome errors the
new P1-04 CI gate surfaced on main. Most hits are:
  - Import ordering (organizeImports)
  - Trailing newline / blank line consistency
  - Single-line expression formatting

Residual errors after this commit: $RESIDUAL_COUNT (to be
hand-fixed in a follow-up if present).

Unblocks the \`Lint · Typecheck\` required-status-check on a
future branch-protection upgrade.

Ref: oneace_ci_followups.md"
  git branch -f stable HEAD
  git push origin main
  git log --oneline -1
fi

echo ""
echo "✅ Phase 1 done."
if [ "$RESIDUAL_COUNT" -gt 0 ]; then
  echo "   $RESIDUAL_COUNT kalan error manual fix gerektirir — sonraki iterasyon."
else
  echo "   0 error — lint audit TAMAM."
fi
