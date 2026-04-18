#!/bin/bash
# Push v1.2 audit dossier — ONEACE-FULL-STACK-AUDIT-v1.2.md landed.
#
# Run this AFTER `push-v1.1-audit.command` has pushed all v1.1.x tags
# and main is up to date. This script only touches the v1.2-specific
# tag and fast-forwards stable again if the branch moved forward after
# the audit dossier commit(s).
#
# What this script does:
#   1. Fix FUSE git index.
#   2. Push the working branch (phase-1-p0-remediations) to main
#      (covers any commits added after v1.1.3 — e.g. the v1.2 audit
#      doc and any parallel-window work like a login-page update).
#   3. Push the v1.2.0-audit-brief tag.
#   4. Fast-forward the stable branch on the remote to HEAD.
#   5. Run the 7-phase verify in deploy mode to confirm Vercel sync.
#
# Tag included:
#   v1.2.0-audit-brief        — ONEACE-FULL-STACK-AUDIT-v1.2.md
#                              (60KB, 1092 lines, Turkish, v1.1 format).
#                              12 second-ring findings:
#                              • P1 (3) — §5.33 analytics call-site
#                                follow-through, §5.34 rate-limit
#                                coverage gap, §5.35 GDPR delete
#                                cascade correctness.
#                              • P2 (5) — §5.36 state machine neighbor
#                                tests, §5.37 OpenGraph metadata,
#                                §5.38 DR drill evidence, §5.39 session
#                                revocation UI/API, §5.40 WCAG AA sweep.
#                              • P3 (4) — §5.41 stale prisma dirs,
#                                §5.42 Sentry sample rate, §5.43
#                                bundle/perf budget, §5.44 CronRun
#                                retention.
#                              No remediation code landed yet — the
#                              dossier is the deliverable.
#
# If you have uncommitted work from a parallel window (e.g. a login
# page update made from another Cowork window), commit it BEFORE
# running this script — `git status` should be clean aside from
# expected untracked files (test-artifacts, playwright-report, etc.).

cd ~/Documents/Claude/Projects/OneAce/oneace || exit 1
exec > ~/Documents/Claude/Projects/OneAce/oneace/push-v1.2-audit.log 2>&1
set -x

echo "=== Fixing git index (FUSE safe) ==="
rm -f .git/index && git reset HEAD

echo "=== Status check (should be clean aside from untracked artifacts) ==="
git status --short

echo "=== Pushing branch → main ==="
git push origin phase-1-p0-remediations:main

echo "=== Pushing v1.2.0-audit-brief tag (dossier landed) ==="
git push origin v1.2.0-audit-brief

echo "=== Fast-forwarding stable on remote ==="
git push origin stable --force-with-lease

echo "=== Verify (full, incl. Vercel deploy) ==="
./scripts/verify.sh deploy

echo ""
echo "=== v1.2 AUDIT BRIEF RELEASED ==="
echo "ONEACE-FULL-STACK-AUDIT-v1.2.md is the source of truth for"
echo "Phase-3 remediation scope (12 findings, split 3 P1 + 5 P2 + 4 P3)."
echo ""
echo "Next session: v1.2 Phase-3.1 (P1) — target tag"
echo "v1.2.0-rc1-p1-remediations."
echo "  • §5.33 analytics call-site follow-through"
echo "  • §5.34 rate-limit coverage (middleware-level default)"
echo "  • §5.35 GDPR delete cascade (schema audit + integration test)"
