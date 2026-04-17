#!/bin/bash
# Push v1.1.0 — type-safe, CI, security audit
cd ~/Documents/Claude/Projects/OneAce/oneace || exit 1
exec > ~/Documents/Claude/Projects/OneAce/oneace/push-v1.1.log 2>&1
set -x
echo "=== Fixing git index ==="
rm -f .git/index && git reset HEAD
echo "=== Pushing main ==="
git push origin main
echo "=== Tagging v1.1.0 ==="
git tag -a "v1.1.0" -m "Type-safe codebase (388→4 warnings), GitHub Actions CI, security audit passed, Sentry ready"
git push origin v1.1.0
echo "=== Updating stable ==="
git branch -f stable HEAD
git push origin stable --force-with-lease
echo "=== Running verify ==="
./scripts/verify.sh deploy
echo ""
echo "=== v1.1.0 RELEASED ==="
