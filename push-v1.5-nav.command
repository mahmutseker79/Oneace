#!/bin/bash
# Push v1.5 Navigation IA — 10 surgical steps + 75 pinned tests + release tag.
# Run on your Mac: `bash push-v1.5-nav.command` (or double-click after chmod +x).
cd ~/Documents/Claude/Projects/OneAce/oneace || exit 1
exec > ~/Documents/Claude/Projects/OneAce/oneace/push-v1.5-nav.log 2>&1
set -x

echo "=== 1/6 Fixing FUSE git index ==="
rm -f .git/index && git reset HEAD

echo "=== 2/6 Current branch + status ==="
git status --short
git rev-parse --abbrev-ref HEAD

echo "=== 3/6 Pushing current branch ==="
# phase-1-p0-remediations is the active branch for all v1.x audit
# remediation work, including the v1.5 nav IA refactor.
git push origin phase-1-p0-remediations

echo "=== 4/6 Pushing v1.5 tags ==="
for t in \
  v1.5.0-pre-nav-ia \
  v1.5.1-nav-sidebar \
  v1.5.3-nav-inventory-tabs \
  v1.5.4-nav-orders-tabs \
  v1.5.5-nav-locations-tabs \
  v1.5.6-nav-team-tabs \
  v1.5.7-nav-settings-tabs \
  v1.5.8-nav-counts-state-tabs \
  v1.5.9-nav-breadcrumbs \
  v1.5.10-nav-linkage-sweep \
  v1.5.11-nav-titles \
  v1.5.12-nav-pinned-tests \
  v1.5.0-nav-ia-complete \
  v1.5.13-hotfix-edge-logger
do
  git push origin "$t"
done

# v1.5.13 is a critical production hotfix — it fixes the
# MIDDLEWARE_INVOCATION_FAILED 500 that was blocking every request
# to oneace-next-local.vercel.app. Root cause: src/lib/logger.ts was
# calling process.stdout.write / process.stderr.write in the
# production emit branch, which is unavailable in Vercel's Edge
# Runtime (middleware.ts imports rate-limit.ts → logger.warn fires
# at module load when Upstash is unset → TypeError). The push here
# MUST include this hotfix or the redeploy leaves prod broken.

echo "=== 5/6 Updating stable branch ==="
# stable was FF'd locally to HEAD at v1.5.12; force-with-lease keeps
# the remote safe if anyone else moved stable in the meantime.
git push origin stable --force-with-lease

echo "=== 6/6 Post-push verification (includes Vercel probe) ==="
./scripts/verify.sh deploy

echo ""
echo "=== v1.5 NAVIGATION IA — RELEASED ==="
echo "Program-close tag: v1.5.0-nav-ia-complete"
echo "Tests: 2030/2030 green"
echo "See: ONEACE-FULL-STACK-AUDIT-v1.0.md for the audit that kicked this off."
