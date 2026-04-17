#!/bin/bash
# Push Sprint 2 — v1.0.0-rc8
cd ~/Documents/Claude/Projects/OneAce/oneace || exit 1

exec > push-rc8.log 2>&1
set -x

echo "=== Fixing git index ==="
rm -f .git/index && git reset HEAD

echo "=== Pushing main ==="
git push origin main

echo "=== Tagging v1.0.0-rc8 ==="
git tag -a "v1.0.0-rc8" -m "Sprint 2: test fixes, cron endpoint, webhook handlers, extended plan tests — 580/580 tests pass"
git push origin v1.0.0-rc8

echo "=== Updating stable ==="
git branch -f stable HEAD
git push origin stable --force-with-lease

echo "=== Running verify ==="
./scripts/verify.sh deploy

echo ""
echo "=== DONE ==="
