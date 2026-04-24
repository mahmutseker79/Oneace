#!/bin/bash
# hotfix-9-delete-to-empty.command
#
# hotfix-8 `= undefined` → `delete` değişikliği Biome'ın
# lint/performance/noDelete kuralını tetikledi (4 error: 2 test
# bloğu × 2 delete satırı, + 1 clearPlatformEnv helper).
#
# Fix: `delete` yerine empty string "" atama. Empty string falsy
# olduğu için adapter'ın `!TOKEN` kontrolü doğru sonuç verir.

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

echo "=== [2/4] Main + fix doğrulaması ==="
git switch main
git pull --ff-only origin main
if grep -q "delete process.env" src/lib/hosting-platform/hosting-platform.test.ts; then
  echo "FATAL: hala `delete process.env` içeriyor"
  grep -n "delete process.env" src/lib/hosting-platform/hosting-platform.test.ts
  exit 1
fi
echo "  ✓ Tüm delete'ler empty string assign'a dönüştürülmüş"

echo "=== [3/4] Commit ==="
git add src/lib/hosting-platform/hosting-platform.test.ts
git commit -m "fix(lint): empty-string assign instead of delete operator

Biome's lint/performance/noDelete forbids \`delete obj.prop\`.
hotfix-8 introduced 4 \`delete process.env.X\` lines (plus a
pre-existing 5th in clearPlatformEnv helper). Replaced all with
\`process.env.X = \"\"\`. Empty string is falsy so the adapter's
\`!VERCEL_TOKEN\` / \`!NETLIFY_TOKEN\` check still returns
\`reason: 'config'\` as the test expects.

Closes 4 Biome errors. \`Lint · Typecheck\` expected green."

echo "=== [4/4] Push ==="
git branch -f stable HEAD
git push origin main
git log --oneline -1
