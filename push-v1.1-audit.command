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
#   v1.1.3-auth-429-message   — register-form showed a generic "Sign up
#                              failed." on throttle because /api/auth
#                              returned `{ error: ... }` instead of the
#                              `{ message, code }` shape better-auth's
#                              client reads; fixed + pinned (session 6)
#   v1.2.0-audit-brief        — v1.2 audit dossier (12 second-ring
#                              findings: §5.33 analytics propagation,
#                              §5.34 rate-limit coverage, §5.35 GDPR
#                              cascade, +9 P2/P3); brief landed, no
#                              code changes yet (session 7)
#
# Stable points at v1.2.0-audit-brief HEAD (commit fdeefd3).

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

echo "=== Pushing v1.1.3-auth-429-message tag (sign-up UX fix) ==="
git push origin v1.1.3-auth-429-message

echo "=== Pushing v1.2.0-audit-brief tag (v1.2 dossier landed) ==="
git push origin v1.2.0-audit-brief

echo "=== Fast-forwarding stable on remote ==="
git push origin stable --force-with-lease

echo "=== Verify (full, incl. Vercel deploy) ==="
./scripts/verify.sh deploy

echo ""
echo "=== v1.1 AUDIT RELEASED + v1.2 BRIEF LANDED ==="
echo "rc3 closed §5.29 (coverage), §5.30 (zod bodies), §5.31"
echo "(hygiene), §5.32 (OpenAPI parity) + §7.4 (PII denylist bonus)."
echo "v1.1.1 emptied the §5.32 drift allowlists — full spec coverage,"
echo "zero known mismatches."
echo "v1.1.2-typecheck-clean closed residual tsc --noEmit drift"
echo "(Prisma 6 InputJsonValue); §5.17 pin now fully green."
echo "v1.1.2-coverage-baseline raised vitest thresholds from 0 to"
echo "measured baseline (lines/st 3, fn 19, br 45) and added a ratchet"
echo "guard so floors can only move UP, never DOWN."
echo "v1.1.3-auth-429-message fixed the register-form 429 UX bug:"
echo "/api/auth rate-limit responses now use the { message, code } shape"
echo "better-auth's client reads; regression pinned in"
echo "auth-rate-limit-policy.test.ts."
echo "v1.2.0-audit-brief captured the second-ring findings dossier —"
echo "ONEACE-FULL-STACK-AUDIT-v1.2.md, 12 findings split 3 P1 + 5 P2"
echo "+ 4 P3, no code changes yet. Next session: v1.2 Phase-3.1 (P1)"
echo "— §5.33 analytics call-site follow-through, §5.34 rate-limit"
echo "coverage, §5.35 GDPR delete cascade — target tag"
echo "v1.2.0-rc1-p1-remediations."
