#!/bin/bash
# Push ESLint + TS cleanup — v1.0.0-rc10
cd ~/Documents/Claude/Projects/OneAce/oneace || exit 1
exec > ~/Documents/Claude/Projects/OneAce/oneace/push-rc10.log 2>&1
set -x
echo "=== Fixing git index ==="
rm -f .git/index && git reset HEAD
echo "=== Pushing main ==="
git push origin main
echo "=== Tagging v1.0.0-rc10 ==="
git tag -a "v1.0.0-rc10" -m "ESLint setup, ignoreBuildErrors removed, 0 TS errors, 0 lint errors, 580/580 tests"
git push origin v1.0.0-rc10
echo "=== Updating stable ==="
git branch -f stable HEAD
git push origin stable --force-with-lease
echo "=== Running verify ==="
./scripts/verify.sh deploy
echo ""
echo "=== DONE ==="
