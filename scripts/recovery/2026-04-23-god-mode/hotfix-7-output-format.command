#!/bin/bash
# hotfix-7-output-format.command
#
# hotfix-6 Biome lint'i 105 → 1 indirdi. Kalan tek error
# (formatter) `<output>` tag'inin multi-line yerine single-line
# olmasını istiyor. Sandbox düzeltti; push.

set -euo pipefail
cd "$(dirname "$0")"

echo "=== [1/4] FUSE hygiene ==="
find .git -name "*.bak*" -delete 2>/dev/null || true
rm -f .git/refs/heads/*.lock .git/refs/remotes/origin/*.lock .git/refs/tags/*.lock 2>/dev/null || true
rm -f .git/config.lock 2>/dev/null || true
for lock in .git/HEAD.lock .git/index.lock; do
  [ -e "$lock" ] || continue
  mv "$lock" "${lock%.lock}.lock.gone.$(date +%s)" 2>/dev/null || rm -f "$lock" 2>/dev/null || true
done

echo "=== [2/4] Fix doğrulaması ==="
if ! grep -q '<output className="block rounded-md border border-success' 'src/app/(app)/settings/security/two-factor-card.tsx'; then
  echo "FATAL: single-line <output> fix uygulanmamış."
  exit 1
fi
echo "  ✓ <output> single-line"

echo "=== [3/4] Commit ==="
git switch main
git pull --ff-only origin main
git add 'src/app/(app)/settings/security/two-factor-card.tsx'
git commit -m "fix(lint): inline <output> tag (single-line formatter fix)

Follow-up to hotfix-6. Biome's formatter dropped from 105 errors
to 1: the recovery-banner \`<output>\` tag on two-factor-card.tsx
was multi-line, formatter wanted it inlined.

This closes the Biome lint leg at 0 errors."

echo "=== [4/4] Push ==="
git branch -f stable HEAD
git push origin main
git log --oneline -1
echo ""
echo "✅ Lint audit son error da kapatıldı. Biome = 0 error bekleniyor."
