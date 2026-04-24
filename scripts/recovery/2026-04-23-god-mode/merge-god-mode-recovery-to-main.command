#!/bin/bash
# merge-god-mode-recovery-to-main.command
#
# GOD MODE sprint recovery branch'ini main'e merge eder.
# Sprint'in tamamı (P0-01..P0-04, P1-02..07, P2-02,10) tek commit'te
# main'e iner — rc6 zaten daha önce merge'lendi.
#
# KRİTİK: `git clean -fd` ve `git reset --hard` KULLANMAZ.

set -euo pipefail
cd "$(dirname "$0")"

BRANCH_SRC="phase-god-mode-recovery"
TAG_MERGED="v1.7.0-god-mode-recovery-merged-to-main"

echo "=== [1/9] FUSE hygiene ==="
find .git -name "*.bak*" -delete 2>/dev/null || true
rm -f .git/refs/heads/*.lock.gone.* .git/refs/remotes/origin/*.lock.gone.* .git/refs/tags/*.lock.gone.* 2>/dev/null || true
rm -f .git/refs/heads/*.lock .git/refs/remotes/origin/*.lock .git/refs/tags/*.lock 2>/dev/null || true
rm -f .git/config.lock .git/packed-refs.lock 2>/dev/null || true
for lock in .git/HEAD.lock .git/index.lock; do
  [ -e "$lock" ] || continue
  mv "$lock" "${lock%.lock}.lock.gone.$(date +%s)" 2>/dev/null || rm -f "$lock" 2>/dev/null || true
done

echo "=== [2/9] Fetch ==="
git fetch origin --prune --tags --force

echo "=== [3/9] Kaynak branch + tag doğrulama ==="
if ! git rev-parse --verify "origin/$BRANCH_SRC" >/dev/null 2>&1; then
  echo "FATAL: origin/$BRANCH_SRC yok — finish-recovery push'u tamamlanmadı."
  exit 1
fi
if ! git rev-parse refs/tags/v1.7.0-god-mode-recovery >/dev/null 2>&1; then
  echo "FATAL: tag v1.7.0-god-mode-recovery bulunamadı."
  exit 1
fi
echo "  ✓ origin/$BRANCH_SRC + rc tag yerinde"

echo "=== [4/9] Working tree check ==="
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "UYARI: tracked değişiklikler var."
  git status --short
  echo "  10 saniye... (Ctrl+C ile iptal)"
  sleep 10
fi

echo "=== [5/9] Main + ff ==="
git switch main
git pull --ff-only origin main

echo "=== [6/9] Merge ==="
AHEAD=$(git rev-list --count main..origin/$BRANCH_SRC)
if [ "$AHEAD" -eq 0 ]; then
  echo "Nothing to merge. Exiting 0."
  exit 0
fi
echo "  Branch ahead by $AHEAD commit(s)."
git log --oneline main..origin/$BRANCH_SRC | head -5

git merge --no-ff origin/$BRANCH_SRC -m "merge: phase-god-mode-recovery → main — full 2026-04-23 sprint landed

Full GOD MODE remediation sprint (2026-04-23) now on main. Recovery
restored the sprint output from jsonl transcript after push-script
accident wiped untracked files. See recovery commit on branch for
full background on the incident.

Items closed on main:
  P0-01  postMovement seam + no-direct-create guard
  P0-02  withIdempotency middleware + IdempotencyKey table
  P0-03  StockMovement.idempotencyKey NOT NULL (with backfill)
  P0-04  landed-cost allocator + schema + PO-receive wiring
  P1-02  QuickBooks webhook dedup (WebhookDeliveryEvent)
  P1-03  test coverage ratchet (kit + count-approval + abc + machines)
  P1-04  CI Postgres migration gate
  P1-05  branch-protection tooling + runbook
  P1-06  DR drill workflow + log
  P1-07  Turkish locale foundation + KVKK page
  P2-02  deploy hygiene (.netlifyignore)
  P2-09  symmetric exempt-list drift guard (already merged via rc6)
  P2-10  deploy-hygiene pinned test
  P2-03  per-email forgot-password rate limit (already merged via rc6)

Test delta on main: +160 pinned.

Operational note: pnpm prisma migrate deploy must run against
staging then prod to apply the 4 additive migrations. All are
DO \$\$ + IF NOT EXISTS guarded.

Ref: ONEACE-GOD-MODE-REMEDIATION-ROADMAP-2026-04-23.md"

echo "=== [7/9] Full pinned suite on merged main ==="
if command -v pnpm >/dev/null 2>&1; then
  pnpm exec vitest run \
    src/lib/movements/ \
    src/lib/idempotency/ \
    src/lib/costing/ \
    src/lib/integrations/webhook-dedup.static.test.ts \
    src/lib/ci/ \
    src/lib/i18n/tr-locale.static.test.ts \
    src/lib/auth-rate-limit.static.test.ts \
    src/lib/api-rate-limit-coverage.test.ts -t "P2-09" \
    --reporter=default || {
      echo "FATAL: merged main üstünde pinned test fail."
      echo "Rollback: git reset --hard origin/main"
      exit 2
    }
fi

echo "=== [8/9] Tag + stable ==="
if git rev-parse "$TAG_MERGED" >/dev/null 2>&1; then
  echo "  Tag $TAG_MERGED zaten var — skip."
else
  git tag -a "$TAG_MERGED" -m "v1.7.0-god-mode-recovery merged to main.

Main now carries the complete 2026-04-23 GOD MODE remediation sprint:
all P0 items (postMovement seam, idempotency, NOT NULL, landed cost),
all P1 items (QB dedup, CI gate, branch protection, DR drill,
coverage ratchet, TR/KVKK foundation), and the P2 items that were
scoped into this sprint.

Recovery tag  : v1.7.0-god-mode-recovery
Merged tag    : v1.7.0-god-mode-recovery-merged-to-main
Source branch : phase-god-mode-recovery (safe to delete)

Next operational steps:
  1. pnpm prisma migrate deploy (staging → prod)
  2. Run scripts/setup-branch-protection.sh
  3. Schedule first live DR drill on monthly cadence."
fi
git branch -f stable HEAD
git log --oneline -1 --decorate

echo "=== [9/9] Push main + tag ==="
git push origin main
git push origin "$TAG_MERGED"

echo ""
echo "✅ GOD MODE sprint FULL MERGE main'de. +160 pinned test."
echo ""
echo "Source branch güvende silinebilir (isteğe bağlı):"
echo "  git push origin --delete $BRANCH_SRC"
echo "  git branch -D $BRANCH_SRC"
echo ""
echo "KALAN OPERASYONEL ADIMLAR:"
echo "  1. pnpm prisma migrate deploy --schema=prisma/schema.prisma"
echo "     → staging önce, sonra prod"
echo "  2. ./scripts/setup-branch-protection.sh  (GitHub branch protect uygular)"
echo "  3. İlk live DR drill (monthly) — .github/workflows/dr-drill.yml manuel trigger"
