#!/bin/bash
# Push v1.4.0 — UI redesign Phase 5-8: tables, forms, dark QA, final
cd ~/Documents/Claude/Projects/OneAce/oneace || exit 1
exec > ~/Documents/Claude/Projects/OneAce/oneace/push-v1.4.log 2>&1
set -x
echo "=== Fixing git index ==="
rm -f .git/index && git reset HEAD
echo "=== Pushing main ==="
git push origin main
echo "=== Tagging v1.4.0 ==="
git tag -a "v1.4.0" -m "UI redesign Phase 5-8: table Card consistency, form audit clean, dark mode QA pass, duplicate overflow cleanup"
git push origin v1.4.0
echo "=== Updating stable ==="
git branch -f stable HEAD
git push origin stable --force-with-lease
echo "=== Running verify ==="
./scripts/verify.sh deploy
echo ""
echo "=== v1.4.0 RELEASED ==="
