#!/usr/bin/env bash
# v1.2 full-ring push — all P1 + P2 + P3 remediation tags + main/stable FF.
# Run from the oneace working copy root on the Mac.
set -euo pipefail

cd "$(dirname "$0")"

echo "→ Pushing v1.2 audit remediation to origin…"
echo "  HEAD: $(git rev-parse HEAD)"
echo "  branch: $(git rev-parse --abbrev-ref HEAD)"
echo

# Main branch — fast-forward origin/main to HEAD of current branch.
git push origin HEAD:main

# Stable pointer — FF to same HEAD, force-with-lease for safety.
git branch -f stable HEAD
git push origin stable --force-with-lease

# All v1.2 tags (safe to re-run; git skips existing remote tags).
for tag in \
  v1.2.0-audit-brief \
  v1.2.0-rc1-p1-remediations \
  v1.2.1-phase1-user-facing \
  v1.2.2-phase2-security \
  v1.2.3-phase3-lint-gate \
  v1.2.4-phase4-i18n-truth \
  v1.2.5-phase5-hygiene \
  v1.2.6-god-mode-complete \
  v1.2.7-p2-state-machines \
  v1.2.8-p2-og-metadata \
  v1.2.9-p2-dr-drill-evidence \
  v1.2.10-p2-session-revocation \
  v1.2.11-p2-wcag-contrast \
  v1.2.12-p3-sentry-sample-rate \
  v1.2.13-p3-perf-budget \
  v1.2.14-p3-cronrun-retention \
  v1.2.15-p3-ci-wiring \
  v1.2.16-vercel-build-fix \
  v1.2.17-node-22-upgrade
do
  if git rev-parse "$tag" >/dev/null 2>&1; then
    echo "→ push tag $tag"
    git push origin "$tag" || true
  else
    echo "⚠ tag $tag missing locally — skipped"
  fi
done

echo
echo "✓ Push complete."
echo "  Remote HEAD: $(git rev-parse origin/main)"
echo "  Remote stable: $(git rev-parse origin/stable)"
echo
echo "Tip: run './scripts/verify.sh deploy' to confirm Vercel picked up the push."
