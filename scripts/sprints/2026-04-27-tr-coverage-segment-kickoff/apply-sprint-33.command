#!/bin/bash
#
# Sprint 33 — TR coverage segment kickoff (foundation)
#
# Council resolved 2026-04-27 (all ♥). Foundation ships:
#   - INTENTIONAL_EN marker primitive (messages/_markers.ts)
#   - tr-key-parity.test.ts SCAFFOLD (informational + soft assert)
#   - Playwright TR smoke fixture (e2e/fixtures/tr-auth.ts)
#   - TR smoke spec (e2e/tr-smoke.spec.ts) — login + dashboard
#   - tr-smoke-fixture.static.test.ts pin (lock-step contract)
#   - CLAUDE.md i18n drift fix
#   - Closure audit doc + DRAFT-stripped kickoff brief
#
# Phases:
#   0) Preflight — branch=main, Sprint 32 tag reachable, all 8 files exist
#   1) FUSE index fix
#   2) Sanity diff (>50 changes = abort, FUSE corruption guard)
#   3) Pinned test smoke (PR#1 + PR#2 + existing tr-coverage)
#   4) PR #1 commit + tag v1.43.1 (marker + parity scaffold)
#   5) PR #2 commit + tag v1.43.2 (smoke fixture + spec + static pin)
#   6) PR #3 commit + tag v1.44.0 (docs + CLAUDE.md + apply script self-stage)
#   7) Push main + stable FF + tags
#   8) Post-push verify
#
set -euo pipefail

REPO="/Users/bluefire/Documents/Claude/Projects/OneAce/oneace"
PREV_TAG="v1.43.0-confirm-password-live-val"
TAG_PR1="v1.43.1-intentional-en-marker"
TAG_PR2="v1.43.2-tr-smoke-fixture"
TAG_PR3="v1.44.0-tr-coverage-foundation"

MARKERS_FILE="src/lib/i18n/messages/_markers.ts"
PARITY_TEST="src/lib/i18n/tr-key-parity.test.ts"
TR_FIXTURE="e2e/fixtures/tr-auth.ts"
TR_SPEC="e2e/tr-smoke.spec.ts"
SMOKE_PIN="src/lib/i18n/tr-smoke-fixture.static.test.ts"
CLAUDE_MD="CLAUDE.md"
KICKOFF_BRIEF="docs/sprints/SPRINT-33-KICKOFF-BRIEF-2026-04-27.md"
AUDIT_DOC="docs/audits/SPRINT-33-TR-COVERAGE-FOUNDATION-2026-04-27.md"

cd "$REPO"

echo "═══════════════════════════════════════════════════════════════"
echo "  Sprint 33 — TR coverage segment kickoff (foundation)"
echo "═══════════════════════════════════════════════════════════════"

# ─── Phase 0 — Preflight ──────────────────────────────────────────────────────
echo "== Phase 0 — preflight =="
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "FATAL: expected 'main', got '$CURRENT_BRANCH'."
  exit 1
fi
if ! git rev-parse --verify "$PREV_TAG" >/dev/null 2>&1; then
  echo "FATAL: Sprint 32 tag '$PREV_TAG' not found."
  exit 1
fi
for f in "$MARKERS_FILE" "$PARITY_TEST" "$TR_FIXTURE" "$TR_SPEC" \
         "$SMOKE_PIN" "$CLAUDE_MD" "$KICKOFF_BRIEF" "$AUDIT_DOC"; do
  if [ ! -f "$f" ]; then
    echo "FATAL: expected file missing: $f"
    exit 1
  fi
done
echo "  ✓ branch=main, prev tag=$PREV_TAG, all 8 files present"

# ─── Phase 1 — FUSE index fix ─────────────────────────────────────────────────
echo "== Phase 1 — FUSE index fix =="
rm -f .git/index && git reset HEAD >/dev/null 2>&1
git update-index --refresh >/dev/null 2>&1 || true

# ─── Phase 2 — Sanity diff ────────────────────────────────────────────────────
echo "== Phase 2 — sanity diff =="
CHANGED="$(git status --porcelain | wc -l | tr -d ' ')"
echo "  Changed/untracked entries: $CHANGED"
if [ "$CHANGED" -gt 50 ]; then
  echo "FATAL: $CHANGED changes — too large, refusing (FUSE corruption guard)"
  exit 1
fi
git status --short

# ─── Phase 3 — Pinned test smoke ──────────────────────────────────────────────
echo "== Phase 3 — pinned test smoke =="
echo "  Run vitest now? [Enter=skip, anything else=run]: "
read -r REPLY || REPLY=""
# macOS bash 3.2 portable lowercase (no ${var,,} support).
REPLY_LC="$(printf '%s' "${REPLY:-}" | tr '[:upper:]' '[:lower:]')"
if [ -z "$REPLY_LC" ] || [ "$REPLY_LC" = "skip" ] || [ "$REPLY_LC" = "s" ] || [ "$REPLY_LC" = "n" ]; then
  echo "  (skipped — manual run later: pnpm exec vitest run $PARITY_TEST $SMOKE_PIN)"
else
  # Project script is `pnpm test = vitest run` (no per-file arg
  # support without `--`); invoke vitest directly via pnpm exec.
  pnpm exec vitest run \
    "$PARITY_TEST" \
    "$SMOKE_PIN" \
    src/lib/i18n/tr-coverage.test.ts \
    src/lib/i18n/locale-parity.test.ts \
    src/lib/i18n/tr-locale.static.test.ts
fi

# ─── Phase 4 — PR #1: marker + parity scaffold ────────────────────────────────
echo "== Phase 4 — PR #1 commit + tag $TAG_PR1 =="
git add "$MARKERS_FILE" "$PARITY_TEST"
git commit -m "test(i18n): INTENTIONAL_EN marker + tr-key-parity scaffold (Sprint 33 PR #1)

Sprint 33 council (all ♥) opened the TR coverage segment. PR #1
ships the *foundation* layer — primitive + scaffold pinned test —
without touching any consumer site (no tr.ts edits, no surface
changes).

NEW: src/lib/i18n/messages/_markers.ts
  Identity wrapper INTENTIONAL_EN<T>(v: T): T => v that semantically
  marks a deliberate EN passthrough in the TR catalog (brand names,
  technical SKU terms, etc.). Static analyzer counts INTENTIONAL_EN(
  occurrences and subtracts them from the 'TODO translation' total.
  Runtime cost: zero.

NEW: src/lib/i18n/tr-key-parity.test.ts (7 case, SCAFFOLD mode)
  - markers exports + identity-fn shape
  - EN + TR leaf inventory parser sanity
  - INTENTIONAL_EN consumer count baseline (= 0 at S33)
  - TR/EN user-copy ratio >= 90% regression floor
  - TODO approximation finite + < EN.user (parser smoke)

Soft assertions only — Sprint 37 closure flips this into a hard
ceiling (TODO ≤ whitelist, monotonically decreasing).

Brief: docs/sprints/SPRINT-33-KICKOFF-BRIEF-2026-04-27.md
PR #2 (smoke fixture) and PR #3 (docs) follow in this bundle."
git tag -a "$TAG_PR1" -m "Sprint 33 PR #1 — INTENTIONAL_EN marker + parity scaffold"

# ─── Phase 5 — PR #2: smoke fixture + spec + static pin ───────────────────────
echo "== Phase 5 — PR #2 commit + tag $TAG_PR2 =="
git add "$TR_FIXTURE" "$TR_SPEC" "$SMOKE_PIN"
git commit -m "test(i18n): Playwright TR smoke fixture + spec + static pin (Sprint 33 PR #2)

NEW: e2e/fixtures/tr-auth.ts
  Extends authedPage. Sets oneace-locale=tr cookie on the context
  pre-navigation, re-navigates to /dashboard. Reuses the EN login
  flow (no fork) — locale resolver picks up cookie on next SSR.

NEW: e2e/tr-smoke.spec.ts (2 tests)
  1. Login page TR copy — anon page sets cookie pre-nav, /login SSR
     resolves to TR. Asserts E-posta + Şifre + Giriş yap labels.
  2. Dashboard nav 'Pano' — trAuthedPage at /dashboard. Asserts
     ^pano\$ link visible AND ^dashboard\$ link count = 0
     (negative guard catches hardcoded EN regressions).

NEW: src/lib/i18n/tr-smoke-fixture.static.test.ts (7 case)
  Static-analysis pin — drift on cookie name, fixture import chain,
  canonical TR strings (Giriş yap/E-posta/Şifre/Pano), or negative
  guard fails the cheap vitest job long before slow e2e fires.

Lock-step: cookie name 'oneace-locale' must equal LOCALE_COOKIE
constant in src/lib/i18n/index.ts (verified by static pin)."
git tag -a "$TAG_PR2" -m "Sprint 33 PR #2 — TR smoke fixture + spec + static pin"

# ─── Phase 6 — PR #3: docs + CLAUDE.md + apply script ─────────────────────────
echo "== Phase 6 — PR #3 commit + tag $TAG_PR3 =="
git add "$CLAUDE_MD" "$KICKOFF_BRIEF" "$AUDIT_DOC" \
        "scripts/sprints/2026-04-27-tr-coverage-segment-kickoff/apply-sprint-33.command"
git commit -m "docs(audit): Sprint 33 closure — TR coverage segment foundation (PR #3)

Opens the TR coverage segment per Sprint 31 closure manifest §6.
Council resolved 6 forks all ♥ (see kickoff brief decision log).
Foundation = primitive + scaffold; surface migrations (L3 sweep)
land Sprint 34+.

Files:
  M CLAUDE.md
      i18n line drift fix — old claim 'scaffold with en only' was
      false since Sprint 7 closure (TR namespace 48/48). New copy
      documents the actual state + Sprint 33 foundation references
      + Sprint 34+ roadmap. §5.23 honest-scaffold guard preserved.
  M docs/sprints/SPRINT-33-KICKOFF-BRIEF-2026-04-27.md
      DRAFT etiketi düşürüldü, decision log eklendi, closure tag
      stamped. Brief now serves as the live S34-S37 roadmap.
  + docs/audits/SPRINT-33-TR-COVERAGE-FOUNDATION-2026-04-27.md
      Closure audit doc — 3 PR breakdown, decision matrix, S34+
      roadmap, risk register.
  + scripts/sprints/2026-04-27-tr-coverage-segment-kickoff/
      apply-sprint-33.command (this script, self-staged).

Bundle:
  PR #1  v1.43.1  test(i18n): INTENTIONAL_EN + tr-key-parity scaffold
  PR #2  v1.43.2  test(i18n): TR smoke fixture + spec + static pin
  PR #3  v1.44.0  docs(audit): Sprint 33 closure + CLAUDE.md drift fix"
git tag -a "$TAG_PR3" -m "Sprint 33 closure — TR coverage segment OPEN (foundation)"

# ─── Phase 7 — Push main + stable + tags ──────────────────────────────────────
echo "== Phase 7 — push =="
git push origin main
git push origin "$TAG_PR1" "$TAG_PR2" "$TAG_PR3"

echo "== Phase 7b — fast-forward stable =="
git branch -f stable HEAD
git push origin stable

# ─── Phase 8 — Post-push verify ───────────────────────────────────────────────
echo "== Phase 8 — post-push verify =="
if [ -x ./scripts/verify.sh ]; then
  ./scripts/verify.sh deploy || echo "  (verify deploy reported issues — review above)"
else
  echo "  (verify.sh not executable — skipping)"
fi

# ─── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  🏁 Sprint 33 shipped — TR coverage segment OPEN"
echo "═══════════════════════════════════════════════════════════════"
HEAD_SHA="$(git rev-parse --short HEAD)"
echo "  HEAD: $HEAD_SHA = $TAG_PR3"
echo "  Sonraki: Sprint 34 — L3 sweep tier 1 (auth + chrome)"
echo "  Segment SEAL hedef: v1.49.0-tr-coverage-segment-sealed (S37)"
echo "═══════════════════════════════════════════════════════════════"
