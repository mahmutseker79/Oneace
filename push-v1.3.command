#!/bin/bash
# Push v1.3.0 — UI redesign: token system, PageHeader, dashboard polish
cd ~/Documents/Claude/Projects/OneAce/oneace || exit 1
exec > ~/Documents/Claude/Projects/OneAce/oneace/push-v1.3.log 2>&1
set -x
echo "=== Fixing git index ==="
rm -f .git/index && git reset HEAD
echo "=== Pushing main ==="
git push origin main
echo "=== Tagging v1.3.0 ==="
git tag -a "v1.3.0" -m "UI redesign Phase 1-4: semantic token system (240+ hardcoded colors replaced), PageHeader 100% adoption, dashboard polish, premium shadow/blur shell"
git push origin v1.3.0
echo "=== Updating stable ==="
git branch -f stable HEAD
git push origin stable --force-with-lease
echo "=== Running verify ==="
./scripts/verify.sh deploy
echo ""
echo "=== v1.3.0 RELEASED ==="
