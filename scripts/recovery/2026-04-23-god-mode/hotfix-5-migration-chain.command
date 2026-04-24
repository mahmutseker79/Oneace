#!/bin/bash
# hotfix-5-migration-chain.command
#
# ci-migration-chain-audit Phase 2. Scratch Postgres zincirinde
# kalan kırık halka:
#   Migration: 20260417142431_migration_foundation
#   ERROR: type "MigrationSource" does not exist
#
# Kök neden: MigrationSource enum pre-mig-chain zamanında prod'a
# doğrudan eklenmiş (prisma db push), migrations dizininde CREATE
# TYPE komutu yok. P1-04 gate scratch Postgres'te fresh DB'den
# başladığı için enum'u bulamıyor.
#
# Fix: migration'ın başına idempotent CREATE TYPE IF NOT EXISTS
# bloğu eklendi. Mevcut ALTER TYPE ADD VALUE zaten idempotent (IF
# NOT EXISTS var) — yeni blok prod'da no-op, scratch'te bootstrap.

set -euo pipefail
cd "$(dirname "$0")"

echo "=== [1/5] FUSE hygiene ==="
find .git -name "*.bak*" -delete 2>/dev/null || true
rm -f .git/refs/heads/*.lock .git/refs/remotes/origin/*.lock .git/refs/tags/*.lock 2>/dev/null || true
rm -f .git/config.lock 2>/dev/null || true
for lock in .git/HEAD.lock .git/index.lock; do
  [ -e "$lock" ] || continue
  mv "$lock" "${lock%.lock}.lock.gone.$(date +%s)" 2>/dev/null || rm -f "$lock" 2>/dev/null || true
done

echo "=== [2/5] Main + ff ==="
git switch main
git pull --ff-only origin main

echo "=== [3/5] Fix doğrulaması ==="
if ! grep -q "Hotfix 2026-04-24 — bootstrap CREATE TYPE" prisma/migrations/20260417142431_migration_foundation/migration.sql; then
  echo "FATAL: CREATE TYPE bootstrap bloğu eksik."
  exit 1
fi
echo "  ✓ MigrationSource bootstrap eklenmiş"

echo "=== [4/5] Commit ==="
git add prisma/migrations/20260417142431_migration_foundation/migration.sql
git commit -m "fix(migrate): bootstrap MigrationSource enum on scratch Postgres

The MigrationSource enum exists on production (added via an earlier
\`prisma db push\` before this migration chain started formally
tracking schema mutations) but has no explicit \`CREATE TYPE\` in
the migrations/ directory. The subsequent \`ALTER TYPE ADD VALUE\`
at 20260417142431 assumes the type exists.

Prod: works (enum was ambiently created pre-chain).
Scratch Postgres (P1-04 gate): fails with 42704, cascading the
whole chain and blocking the migrate gate.

Fix: add a DO \$\$ IF NOT EXISTS guard at the top of 20260417142431
that \`CREATE TYPE \"MigrationSource\"\` with its pre-SOS_INVENTORY
member set when the type is missing. The existing ALTER TYPE ADD
VALUE lines for SOS_INVENTORY / QUICKBOOKS_ONLINE / QUICKBOOKS_DESKTOP
are already guarded by \`IF NOT EXISTS\`, so the combined block is
idempotent on both paths:
  - scratch → CREATE with base set, then ADDs round out
  - prod    → CREATE skipped, ADDs are no-ops

Applied-migration checksum changes are safe for \`migrate deploy\`
(it doesn't re-verify applied-migration SQL).

Ref: oneace_ci_followups.md §ci-migration-chain-audit,
     CI run 24874385899 (previous scratch migrate failure)."

echo "=== [5/5] Push ==="
git branch -f stable HEAD
git push origin main
git log --oneline -1

echo ""
echo "✅ Migration chain hotfix pushed. CI tekrar çalışacak."
echo ""
echo "1-2 dk sonra:"
echo "  gh run list --branch main --limit 3"
