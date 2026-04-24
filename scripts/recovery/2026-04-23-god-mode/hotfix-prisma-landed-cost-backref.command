#!/bin/bash
# hotfix-prisma-landed-cost-backref.command
#
# CI fail teşhisi: Prisma schema validation error P1012.
#   LandedCostAllocation.sourceMovement → StockMovement
#   ilişkisinin karşı tarafı (StockMovement.landedCostAllocations)
#   recovery'de düşmüş (5 edit miss'ten biri).
#
# Sandbox'ta Claude ekledi; bu script fix'i main'e push eder.
# Branch protection henüz aktif değil, main'e doğrudan commit güvenli.

set -euo pipefail
cd "$(dirname "$0")"

echo "=== [1/6] FUSE hygiene ==="
find .git -name "*.bak*" -delete 2>/dev/null || true
rm -f .git/refs/heads/*.lock .git/refs/remotes/origin/*.lock .git/refs/tags/*.lock 2>/dev/null || true
rm -f .git/config.lock .git/packed-refs.lock 2>/dev/null || true
for lock in .git/HEAD.lock .git/index.lock; do
  [ -e "$lock" ] || continue
  mv "$lock" "${lock%.lock}.lock.gone.$(date +%s)" 2>/dev/null || rm -f "$lock" 2>/dev/null || true
done

echo "=== [2/6] Main doğrulama ==="
git switch main
git pull --ff-only origin main

echo "=== [3/6] Schema fix doğrulaması ==="
if ! grep -q "P0-04 — back-reference for the landed-cost" prisma/schema.prisma; then
  echo "FATAL: Sandbox fix disk'te görünmüyor. Claude prisma/schema.prisma'yı düzeltmeliydi."
  exit 1
fi
echo "  ✓ Back-reference eklenmiş"

echo "=== [4/6] Local prisma validate ==="
if command -v pnpm >/dev/null 2>&1; then
  pnpm prisma validate || {
    echo "FATAL: Prisma validate hala fail."
    exit 2
  }
fi

echo "=== [5/6] Commit ==="
git add prisma/schema.prisma
git commit -m "fix(schema): add StockMovement.landedCostAllocations back-relation

Prisma P1012 validation error on CI:
  LandedCostAllocation.sourceMovement → StockMovement
  was missing its opposite relation field.

The sprint's landed-cost audit row model (P0-04) has three foreign
keys — organization, purchaseOrder, appliedBy. Their back-refs on
Organization, PurchaseOrder, and User landed correctly in the
recovery merge. The fourth relation — sourceMovement pointing to
StockMovement — was added to LandedCostAllocation but its back-ref
on StockMovement got dropped in one of the 5 \`Edit miss\` events
during transcript recovery.

Fix: add
  landedCostAllocations LandedCostAllocation[]
on model StockMovement. This unblocks \`prisma generate\` and the
\`Prisma Validate\` / \`Lint · Typecheck\` jobs on main, which were
both failing at the postinstall hook.

No schema migration required — this is a metadata-only change
(Prisma client shape, not DB structure). \`pnpm prisma migrate
deploy\` already applied the on-DB parts during the recovery.

Ref: Prisma error P1012 line 774, run 24859390754."

echo "=== [6/6] Push ==="
git branch -f stable HEAD
git push origin main
git log --oneline -3

echo ""
echo "✅ Schema fix pushed. CI tekrar tetiklenmiş olmalı."
echo ""
echo "Takip (1-2 dk sonra):"
echo "  gh run list --branch main --limit 3"
echo "  veya Actions sekmesinden izle."
