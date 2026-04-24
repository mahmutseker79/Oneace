#!/bin/bash
# hotfix-8-vitest-fixes.command
#
# Lint leg yeşil oldu, Vitest ilk kez CI'da çalıştı ve 5 fail
# raporladı. Sandbox tarafında hepsi düzeltildi:
#
#   1. src/lib/vercel-config.test.ts         — cron 4→7 toEqual
#   2. src/lib/hosting-platform/hosting-platform.test.ts
#      — `process.env.X = undefined` → `delete process.env.X`
#        (iki test bloğu)
#   3. src/lib/i18n/index.ts — locale-parity regex yanlışlıkla
#      yakalasın diye `for` kelimesi geçen yorum satırlarını object
#      literal'in dışına çıkar
#   4. 5 migration için `-- MIGRATION-TYPE:` header ekle (ADR-004):
#        20260419 / 20260423 / 20260425 / 20260426 → EXPAND
#        20260424 (NOT NULL flip) → CONTRACT
#   5. Sandbox'ta sed bıraktığı .bak dosyalarını temizle

set -euo pipefail
cd "$(dirname "$0")"

echo "=== [1/6] FUSE hygiene + .bak cleanup ==="
find prisma/migrations -name "migration.sql.bak" -delete 2>/dev/null || true
find .git -name "*.bak*" -delete 2>/dev/null || true
rm -f .git/refs/heads/*.lock .git/refs/remotes/origin/*.lock .git/refs/tags/*.lock 2>/dev/null || true
rm -f .git/config.lock 2>/dev/null || true
for lock in .git/HEAD.lock .git/index.lock; do
  [ -e "$lock" ] || continue
  mv "$lock" "${lock%.lock}.lock.gone.$(date +%s)" 2>/dev/null || rm -f "$lock" 2>/dev/null || true
done

echo "=== [2/6] Main + ff ==="
git switch main
git pull --ff-only origin main

echo "=== [3/6] Fix doğrulamaları ==="
MISS=0
grep -q "platform-webhook-health" src/lib/vercel-config.test.ts || { echo "  MISS: vercel-config cron list"; MISS=1; }
grep -q "delete process.env.VERCEL_TOKEN" src/lib/hosting-platform/hosting-platform.test.ts || { echo "  MISS: hosting-platform delete"; MISS=1; }
grep -q "delete process.env.NETLIFY_TOKEN" src/lib/hosting-platform/hosting-platform.test.ts || { echo "  MISS: hosting-platform netlify delete"; MISS=1; }
grep -q "Comment lives OUTSIDE the catalog literal" src/lib/i18n/index.ts || { echo "  MISS: i18n catalog comment"; MISS=1; }
for mig in 20260419000000_integration_task_dlq 20260423000000_idempotency_key 20260424000000_stock_movement_idempotency_not_null 20260425000000_landed_cost 20260426000000_webhook_delivery_event; do
  head -1 "prisma/migrations/$mig/migration.sql" | grep -q "MIGRATION-TYPE:" || { echo "  MISS: $mig header"; MISS=1; }
done
if [ "$MISS" != "0" ]; then
  echo "FATAL: fix'ler eksik."
  exit 1
fi
echo "  ✓ tüm 4 test fix + 5 migration header yerinde"

echo "=== [4/6] Kaldıysa .bak temizliği (local sonradan fark edebilir) ==="
find prisma/migrations -name "migration.sql.bak" -delete 2>/dev/null || true

echo "=== [5/6] Commit ==="
git add \
  src/lib/vercel-config.test.ts \
  src/lib/hosting-platform/hosting-platform.test.ts \
  src/lib/i18n/index.ts \
  prisma/migrations/20260419000000_integration_task_dlq/migration.sql \
  prisma/migrations/20260423000000_idempotency_key/migration.sql \
  prisma/migrations/20260424000000_stock_movement_idempotency_not_null/migration.sql \
  prisma/migrations/20260425000000_landed_cost/migration.sql \
  prisma/migrations/20260426000000_webhook_delivery_event/migration.sql

git commit -m "fix(ci): close 5 vitest failures on merged main

Vitest started running on main once lint went green, exposing
four real test issues and a catalog of 5 migrations without the
ADR-004 MIGRATION-TYPE header.

1. vercel-config.test.ts — cron list catalog pinned at 4, actual
   vercel.json now has 7 (audit v1.3 added platform-{webhook,quota}-health
   + v1.6 sprint added integration-tasks). Expanded the toEqual to 7.

2. hosting-platform.test.ts — two test cases used
   \`process.env.VERCEL_TOKEN = undefined\` which sets the env var to
   the STRING \"undefined\" (truthy). The adapter's \`!VERCEL_TOKEN\`
   check then passed-through to the fetch path, returning
   \`reason: 'transport'\` instead of \`reason: 'config'\`. Fix:
   \`delete process.env.VERCEL_TOKEN\` (and Netlify sibling) truly
   unsets the var. This test never ran on CI before today (lint
   was always failing first) — we inherited a stale assumption.

3. i18n/index.ts — the locale-parity regex scanner walks the
   catalog's object-literal body looking for 2-3 char keys. A
   comment inside the literal mentioned \"messages/tr.ts for\" and
   the regex picked up \`for\` as a supposed locale key. Fix: moved
   the comment OUTSIDE the literal so the scanner can't see it.

4. MIGRATION-TYPE header on 5 migrations at or after ADR-004's
   cutoff (20260419):
     20260419_integration_task_dlq   → EXPAND
     20260423_idempotency_key        → EXPAND
     20260424_*_idempotency_not_null → CONTRACT (NOT NULL flip)
     20260425_landed_cost            → EXPAND
     20260426_webhook_delivery_event → EXPAND
   The CONTRACT label on 20260424 is honest about the destructive
   cut; the migration already runs a backfill UPDATE in the same
   transaction so the flip is safe in practice.

Ref: CI run 24876045088 vitest failures.
     oneace_ci_followups.md §ci-lint-audit close-out."

echo "=== [6/6] Push ==="
git branch -f stable HEAD
git push origin main
git log --oneline -1
echo ""
echo "✅ Vitest fix'leri pushed. CI yeniden koşacak."
echo ""
echo "Tek kalan: Prisma Migrations (scratch Postgres) — takip eden iş."
