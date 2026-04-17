#!/bin/bash
# Push v1.2.0 — zero warnings, CI strict, monitoring docs
cd ~/Documents/Claude/Projects/OneAce/oneace || exit 1
exec > ~/Documents/Claude/Projects/OneAce/oneace/push-v1.2.log 2>&1
set -x
echo "=== Fixing git index ==="
rm -f .git/index && git reset HEAD
echo "=== Pushing main ==="
git push origin main
echo "=== Tagging v1.2.0 ==="
git tag -a "v1.2.0" -m "Zero ESLint warnings, CI strict mode (--max-warnings 0), lazy chart imports, Sentry/PostHog monitoring docs"
git push origin v1.2.0
echo "=== Updating stable ==="
git branch -f stable HEAD
git push origin stable --force-with-lease
echo "=== Running verify ==="
./scripts/verify.sh deploy
echo ""
echo "=== v1.2.0 RELEASED ==="
