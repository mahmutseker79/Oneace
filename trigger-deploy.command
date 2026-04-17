#!/bin/bash
# Trigger Vercel redeploy with empty commit
cd ~/Documents/Claude/Projects/OneAce/oneace || exit 1
exec > ~/Documents/Claude/Projects/OneAce/oneace/trigger-deploy.log 2>&1
set -x
echo "=== Fixing git index ==="
rm -f .git/index && git reset HEAD
echo "=== Empty commit to trigger Vercel ==="
git commit --allow-empty -m "chore: trigger Vercel redeploy for v1.4.0 (UI redesign Phase 1-8)"
echo "=== Pushing main ==="
git push origin main
echo "=== Pushing stable ==="
git branch -f stable HEAD
git push origin stable --force-with-lease
echo "=== DONE — Vercel should start building ==="
