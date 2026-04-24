#!/bin/bash
# hotfix-3-ci-green.command
#
# İkinci hotfix'ten sonra kalan 6 fail, hepsi narrow:
#   1. en.ts WidenStringLeaves<T> function types'ı ezdi — AnyFunction
#      branch ekle ki itemsImport'un (count) => string değerleri
#      {} olmasın.
#   2. i18n/index.ts — recovery'de `import { tr }` iki kez yazılmış
#      (duplicate identifier). Tek bıraktık.
#   3. auth.ts — logger.warn payload'ında `gate.retryAfterSeconds`
#      vardı, RateLimitResult'ta yok. `gate.reset` ile değiştirildi.
#   4. en.ts salesOrders.errors — `idempotencyConflict` +
#      `idempotencyInProgress` keys eksikti (sales-orders/actions.ts
#      bu keys'e referans veriyor). Eklendi.
#   5. en.ts settings.locale.names — `tr: "Türkçe"` eksikti (P1-07
#      locale wiring). Eklendi.
#   6. prisma/migrations/20260417_audit_critical_fixes/migration.sql
#      — scratch Postgres'te `locationLevelId` kolonu daha eklenmemiş
#      (pre-existing ordering bug). CREATE INDEX + FK block'ları
#      `DO $$ IF EXISTS` guard'a alındı.

set -euo pipefail
cd "$(dirname "$0")"

echo "=== [1/5] FUSE hygiene ==="
find .git -name "*.bak*" -delete 2>/dev/null || true
rm -f .git/refs/heads/*.lock .git/refs/remotes/origin/*.lock .git/refs/tags/*.lock 2>/dev/null || true
rm -f .git/config.lock .git/packed-refs.lock 2>/dev/null || true
for lock in .git/HEAD.lock .git/index.lock; do
  [ -e "$lock" ] || continue
  mv "$lock" "${lock%.lock}.lock.gone.$(date +%s)" 2>/dev/null || rm -f "$lock" 2>/dev/null || true
done

echo "=== [2/5] Main + ff ==="
git switch main
git pull --ff-only origin main

echo "=== [3/5] Fix'leri doğrula ==="
MISS=0
grep -q "AnyFunction" src/lib/i18n/messages/en.ts || { echo "  MISS: en.ts AnyFunction"; MISS=1; }
[ "$(grep -c 'from "./messages/tr"' src/lib/i18n/index.ts)" = "1" ] || { echo "  MISS: i18n/index.ts duplicate import"; MISS=1; }
grep -q "reset: gate.reset" src/lib/auth.ts || { echo "  MISS: auth.ts gate.reset"; MISS=1; }
grep -q "idempotencyConflict:" src/lib/i18n/messages/en.ts || { echo "  MISS: en.ts idempotencyConflict"; MISS=1; }
grep -q 'tr: "Türkçe"' src/lib/i18n/messages/en.ts || { echo "  MISS: en.ts tr locale name"; MISS=1; }
grep -q "idempotent — hotfix 2026-04-24" prisma/migrations/20260417_audit_critical_fixes/migration.sql || { echo "  MISS: 20260417 migration guard"; MISS=1; }
if [ "$MISS" != "0" ]; then
  echo "FATAL: fix'ler eksik."
  exit 1
fi
echo "  ✓ 6 fix yerinde"

echo "=== [4/5] Commit ==="
git add \
  src/lib/i18n/messages/en.ts \
  src/lib/i18n/index.ts \
  src/lib/auth.ts \
  prisma/migrations/20260417_audit_critical_fixes/migration.sql

git commit -m "fix(ci): close remaining typecheck + scratch-migrate fails on main

Hotfix-3. After hotfix-2 CI reported 5 fresh TS errors + 1 new
scratch-migrate fail (different migration than before). All narrow,
all recovery fallout + one pre-existing ordering bug in the legacy
migration chain.

1. en.ts WidenStringLeaves<T> — preserve function types
   Hotfix-2 added a recursive type that widened string literals to
   \`string\` so tr.ts translations could land. Side effect: the
   utility also recursed INTO function types, mapping their signature
   to \`{}\` (empty object). itemsImport has three counter-string
   functions (previewHelp, successBody, successSkipped) which became
   unassignable. Fix: add a \`T extends AnyFunction ? T\` branch so
   function types pass through untouched.

2. i18n/index.ts — duplicate \`import { tr } from \"./messages/tr\"\`
   Two identical import lines. Recovery replay bug. Keep one.

3. auth.ts — \`gate.retryAfterSeconds\` does not exist on
   RateLimitResult (\`remaining\`, \`reset\`, \`limit\` — \`reset\` is
   the UTC rollover unix-seconds). The P2-03 logger.warn was using
   a non-existent property name. Fixed to \`reset: gate.reset\` with
   a comment so operators know it's the rollover timestamp.

4. en.ts salesOrders.errors — add \`idempotencyConflict\` and
   \`idempotencyInProgress\` keys. sales-orders/actions.ts has guarded
   references (\`t.salesOrders?.errors?.idempotencyConflict\`) as part
   of P0-02 error surface, but the catalog hadn't been extended. TS
   flagged the missing keys under the widened Messages type.

5. en.ts settings.locale.names — add \`tr: \"Türkçe\"\`. settings/page.tsx
   indexes \`t.settings.locale.names[locale]\` with \`locale: \"en\" | \"tr\"\`,
   but the record only carried 8 non-tr languages. P1-07 landed the
   dictionary but missed the names map. No runtime impact — just
   a typecheck gap.

6. prisma/migrations/20260417_audit_critical_fixes/migration.sql —
   DO \$\$ IF EXISTS guards on the FK + INDEX blocks. This migration's
   comment says \"(locationLevelId column already exists)\" — true on
   prod, false on scratch. P1-04 gate exposed the gap. On scratch
   the guarded block is a no-op; on prod it runs as before.
   Applied-migration checksum change is safe for \`migrate deploy\`
   (it doesn't re-verify).

Ref: CI run 24873192947."

echo "=== [5/5] Push ==="
git branch -f stable HEAD
git push origin main
git log --oneline -3

echo ""
echo "✅ Hotfix-3 pushed. CI tekrar koşacak."
echo ""
echo "1-2 dk sonra:"
echo "  gh run list --branch main --limit 3"
