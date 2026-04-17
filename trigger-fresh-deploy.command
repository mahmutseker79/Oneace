#!/bin/bash
# Fresh push to trigger Vercel with reconnected webhook
cd ~/Documents/Claude/Projects/OneAce/oneace || exit 1
exec > ~/Documents/Claude/Projects/OneAce/oneace/trigger-fresh-deploy.log 2>&1
set -x
echo "=== Fixing git index ==="
rm -f .git/index && git reset HEAD
echo "=== Empty commit ==="
git commit --allow-empty -m "chore: trigger fresh Vercel build after webhook reconnect (v1.4.0)"
echo "=== Push main ==="
git push origin main
echo "=== Push stable ==="
git branch -f stable HEAD
git push origin stable --force-with-lease
echo "=== DONE ==="
