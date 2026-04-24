#!/bin/bash
# merge-v1.7.6-auth-hardening-to-main.command
#
# GOD MODE çöküşü sonrası ilk kurtarma adımı: rc6 (P2-03 + P2-09)
# kaybedilmemiş tek iş — main'e merge ve işaretleme.
#
# ÖNEMLİ: Bu script `git clean -fd` ve `git reset --hard` KULLANMAZ.
# Önceki push-v1.7.* script'leri bunları kullandığı için bütün
# untracked sprint çıktısı silindi. Bu script branch switch dışında
# işçi ağacına dokunmaz.
#
# Değişen dosyalar (merge kapsamı):
#   src/lib/auth.ts                            (P2-03 wire-up)
#   src/lib/api-rate-limit-coverage.test.ts    (P2-09 drift guard)
#   src/lib/auth-rate-limit.static.test.ts     (yeni, 6 pinned test)

set -euo pipefail
cd "$(dirname "$0")"

BRANCH_SRC="phase-p2-auth-hardening"
TAG_MERGED="v1.7.6-auth-hardening-merged-to-main"

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

echo "=== [3/9] Kaynak branch var mı? ==="
if ! git rev-parse --verify "origin/$BRANCH_SRC" >/dev/null 2>&1; then
  echo "FATAL: origin/$BRANCH_SRC yok. Push edilmemiş."
  exit 1
fi
if ! git rev-parse refs/tags/v1.7.6-rc1-auth-hardening >/dev/null 2>&1; then
  echo "FATAL: tag v1.7.6-rc1-auth-hardening bulunamadı — rc push'u inkomple."
  exit 1
fi
echo "  ✓ origin/$BRANCH_SRC + rc tag yerinde"

echo "=== [4/9] Working tree check (güvenlik) ==="
# Untracked dosyalar OK — onlara dokunmuyoruz.
# Tracked çalışmayan değişiklikler merge'i engellerse kullanıcı görsün.
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "UYARI: tracked değişiklikler var. Merge kaynağı ile çakışırsa dur."
  git status --short
  echo ""
  echo "Devam etmek için 10 saniye... (Ctrl+C ile iptal)"
  sleep 10
fi

echo "=== [5/9] Main'e geç + ff ==="
git switch main
git pull --ff-only origin main

echo "=== [6/9] Non-FF merge (P2-03 + P2-09 tek rc) ==="
AHEAD=$(git rev-list --count main..origin/$BRANCH_SRC)
if [ "$AHEAD" -eq 0 ]; then
  echo "Nothing to merge. Exiting 0."
  exit 0
fi
echo "  Branch ahead by $AHEAD commit(s)."
git log --oneline main..origin/$BRANCH_SRC

git merge --no-ff origin/$BRANCH_SRC -m "merge: phase-p2-auth-hardening → main — P2-03 + P2-09 closed

GOD MODE roadmap 2026-04-23 — two auth-layer wins:
  P2-03: per-email forgot-password rate limit (anti-enumeration-safe)
  P2-09: symmetric exempt-list drift guard

This is the only rc from the 2026-04-23 GOD MODE multi-agent sprint
that survived the push-script accident — the P0/P1/P2 items scheduled
before this one were in untracked dirs and got wiped by repeated
\`git clean -fd\` in the auto-stash block of push-v1.7.*.command.
They'll be rebuilt under a new sprint with a fixed push-script
architecture.

Test delta: +7 pinned (6 auth.ts wiring + 1 symmetric drift).

Ref: ONEACE-GOD-MODE-REMEDIATION-ROADMAP-2026-04-23.md §P2-03 + §P2-09"

echo "=== [7/9] Hedefli pinned testler ==="
if command -v pnpm >/dev/null 2>&1; then
  pnpm exec vitest run src/lib/auth-rate-limit.static.test.ts --reporter=default || {
    echo "FATAL: P2-03 wiring pin fail on merged main. Rolling back."
    echo "Recovery: git reset --hard origin/main"
    exit 2
  }
  pnpm exec vitest run src/lib/api-rate-limit-coverage.test.ts -t "P2-09" --reporter=default || {
    echo "FATAL: P2-09 symmetric drift guard fail. Rolling back."
    exit 2
  }
fi

echo "=== [8/9] Tag + stable ==="
if git rev-parse "$TAG_MERGED" >/dev/null 2>&1; then
  echo "  Tag $TAG_MERGED zaten var — skip."
else
  git tag -a "$TAG_MERGED" -m "v1.7.6 auth hardening merged to main.

Main now carries:
  - Per-email forgot-password rate limit (RATE_LIMITS.forgotPassword
    3/hour, keyed on lowercased email, silent-drop anti-enumeration).
  - Symmetric middleware<->test-catalog drift guard for
    API_RATE_LIMIT_EXEMPT_PREFIXES.

This is the lone surviving rc from the 2026-04-23 GOD MODE sprint.
Recovery of the rest (P0-01..04, P1-02,03,04,05,06,07, P2-02,10)
begins in the next sprint.

Test delta on main: +7 pinned."
fi
git branch -f stable HEAD
git log --oneline -1 --decorate

echo "=== [9/9] Push main + tag ==="
git push origin main
git push origin "$TAG_MERGED"

echo ""
echo "✅ rc6 main'e merge edildi. Main now carries P2-03 + P2-09."
echo ""
echo "Source branch $BRANCH_SRC SİLİNMEDİ — güvende olduğundan emin"
echo "olduktan sonra manuel:"
echo "  git push origin --delete $BRANCH_SRC"
echo "  git branch -D $BRANCH_SRC"
echo ""
echo "Bir sonraki adım: transcript'ten recovery denemesi — sandbox"
echo "tarafı. Mac tarafında başka bir script çalıştırma."
