#!/bin/bash
# Push unused-import cleanup — v1.0.0-rc11
cd ~/Documents/Claude/Projects/OneAce/oneace || exit 1
exec > ~/Documents/Claude/Projects/OneAce/oneace/push-rc11.log 2>&1
set -x
echo "=== Fixing git index ==="
rm -f .git/index && git reset HEAD
echo "=== Pushing main ==="
git push origin main
echo "=== Tagging v1.0.0-rc11 ==="
git tag -a "v1.0.0-rc11" -m "Unused import/variable cleanup, 92 files, ESLint warnings 388→172, 580/580 tests"
git push origin v1.0.0-rc11
echo "=== Updating stable ==="
git branch -f stable HEAD
git push origin stable --force-with-lease
echo "=== Running verify ==="
./scripts/verify.sh deploy
echo ""
echo "=== DONE ==="
