#!/bin/bash
# Push v1.1 audit remediations (P1 + P2 + P3 + v1.1.1 drift close).
#
# Run from the sandbox into your terminal after a session ends.
# What this script does:
#   1. Fix FUSE git index.
#   2. Push the working branch (phase-1-p0-remediations) to main.
#   3. Push all audit tags (rc1 = P1, rc2 = P2, rc3 = P3,
#      v1.1.1-openapi-complete = drift backlog close).
#   4. Fast-forward the stable branch on the remote to HEAD.
#   5. Run the 7-phase verify in deploy mode to confirm Vercel sync.
#
# Tags included:
#   v1.1.0-rc1-p1-remediations — §5.19–§5.22 (session 1)
#   v1.1.0-rc2-p2-remediations — §5.23–§5.28 (session 2)
#   v1.1.0-rc3-p3-remediations — §5.29–§5.32 + §7.4 PII (session 3)
#   v1.1.1-openapi-complete   — §5.32 drift backlog empty (session 4)
#   v1.1.2-typecheck-clean    — residual Prisma 6 InputJsonValue drift
#                              closed; tsc --noEmit EXIT 0 (session 5)
#   v1.1.2-coverage-baseline  — vitest thresholds raised from 0 to
#                              measured baseline (3/3/19/45); ratchet
#                              guard added to shape-guard test (session 5)
#
# Stable points at v1.1.2-coverage-baseline HEAD (commit e28a55a).

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

echo "=== Pushing P3 tag (rc3) ==="
git push origin v1.1.0-rc3-p3-remediations

echo "=== Pushing v1.1.1 tag (openapi drift close) ==="
git push origin v1.1.1-openapi-complete

echo "=== Pushing v1.1.2 tag (typecheck clean) ==="
git push origin v1.1.2-typecheck-clean

echo "=== Pushing v1.1.2-coverage-baseline tag (thresholds raised) ==="
git push origin v1.1.2-coverage-baseline

echo "=== Fast-forwarding stable on remote ==="
git push origin stable --force-with-lease

echo "=== Verify (full, incl. Vercel deploy) ==="
./scripts/verify.sh deploy

echo ""
echo "=== v1.1 AUDIT RELEASED (rc1 + rc2 + rc3 + v1.1.1 + v1.1.2 x2) ==="
echo "rc3 closed §5.29 (coverage), §5.30 (zod bodies), §5.31"
echo "(hygiene), §5.32 (OpenAPI parity) + §7.4 (PII denylist bonus)."
echo "v1.1.1 emptied the §5.32 drift allowlists — full spec coverage,"
echo "zero known mismatches."
echo "v1.1.2-typecheck-clean closed residual tsc --noEmit drift"
echo "(Prisma 6 InputJsonValue); §5.17 pin now fully green."
echo "v1.1.2-coverage-baseline raised vitest thresholds from 0 to"
echo "measured baseline (lines/st 3, fn 19, br 45) and added a ratchet"
echo "guard so floors can only move UP, never DOWN."
echo "Next phase: audit v1.2 scoping — review audit doc §7 outstanding."
