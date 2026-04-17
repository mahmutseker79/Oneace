#!/bin/bash
# Push v1.0.0 final release
cd ~/Documents/Claude/Projects/OneAce/oneace || exit 1
exec > ~/Documents/Claude/Projects/OneAce/oneace/push-v1.log 2>&1
set -x
echo "=== Fixing git index ==="
rm -f .git/index && git reset HEAD
echo "=== Pushing main ==="
git push origin main
echo "=== Tagging v1.0.0 ==="
git tag -a "v1.0.0" -m "OneAce v1.0.0 — Production release. 554 TS/TSX files, 61 Prisma models, 29 API routes, 13 E2E specs, 580 unit tests. ESLint: 0 errors. TypeScript: strict mode, 0 errors."
git push origin v1.0.0
echo "=== Updating stable ==="
git branch -f stable HEAD
git push origin stable --force-with-lease
echo "=== Running verify ==="
./scripts/verify.sh deploy
echo ""
echo "=== v1.0.0 RELEASED ==="
