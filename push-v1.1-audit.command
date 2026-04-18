#!/bin/bash
# Push v1.1 audit remediations (P1 + P2 tiers).
#
# Run from the sandbox into your terminal after a session ends.
# What this script does:
#   1. Fix FUSE git index.
#   2. Push the working branch (phase-1-p0-remediations) to main.
#   3. Push both audit tags (rc1 = P1 close, rc2 = P2 close).
#   4. Fast-forward the stable branch on the remote to HEAD.
#   5. Run the 7-phase verify in deploy mode to confirm Vercel sync.
#
# Tags included:
#   v1.1.0-rc1-p1-remediations — §5.19–§5.22 (prior session)
#   v1.1.0-rc2-p2-remediations — §5.23–§5.28 (this session)
#
# Stable points at rc2 HEAD (commit 6dd542c).

cd ~/Documents/Claude/Projects/OneAce/oneace || exit 1
exec > ~/Documents/Claude/Projects/OneAce/oneace/push-v1.1-audit.log 2>&1
set -x

echo "=== Fixing git index (FUSE safe) ==="
rm -f .git/index && git reset HEAD

echo "=== Pushing branch → main ==="
git push origin phase-1-p0-remediations:main

echo "=== Pushing P1 tag (rc1) ==="
git push origin v1.1.0-rc1-p1-remediations

echo "=== Pushing P2 tag (rc2) ==="
git push origin v1.1.0-rc2-p2-remediations

echo "=== Fast-forwarding stable on remote ==="
git push origin stable --force-with-lease

echo "=== Verify (full, incl. Vercel deploy) ==="
./scripts/verify.sh deploy

echo ""
echo "=== v1.1 AUDIT REMEDIATIONS RELEASED (rc1 + rc2) ==="
echo "Next phase: P3 tier (TBD) — see ONEACE-FULL-STACK-AUDIT-v1.1.md §6."
