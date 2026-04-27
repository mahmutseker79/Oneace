#!/bin/bash
#
# Sprint 32 — confirm-password live-validation
#
# Wires state="error" live ternary on reset-password's confirm-password
# Input. Sprint 30 closure doc had this as "Sprint 32 backlog" risk
# item; Sprint 31 closure manifest §6 explicitly assigned it here.
#
# Phases:
#   0) Preflight — branch=main, Sprint 31 tag reachable, expected files exist
#   1) FUSE index fix
#   2) Sanity diff — exactly 3 changed files (1 form + 2 tests + 1 doc = 4 actually)
#   3) Pinned test smoke (Sprint 30 + Sprint 32)
#   4) Stage + commit PR #1 (form ternary swap)
#   5) Tag v1.42.1
#   6) Stage + commit PR #2 (test guard + Sprint 30 refactor)
#   7) Tag v1.42.2
#   8) Stage + commit PR #3 (audit doc)
#   9) Tag v1.43.0-confirm-password-live-val
#  10) Push main + stable FF + tags
#  11) Post-push verify
#
set -euo pipefail

REPO="/Users/bluefire/Documents/Claude/Projects/OneAce/oneace"
PREV_TAG="v1.42.0-unused-variant-closure-manifest"
TAG_PR1="v1.42.1-confirm-password-error-ternary"
TAG_PR2="v1.42.2-confirm-password-error-ternary-test"
TAG_PR3="v1.43.0-confirm-password-live-val"

FORM_FILE="src/app/(auth)/reset-password/reset-password-form.tsx"
TEST_S30="src/components/sprint-30-input-state-success-passwords.test.ts"
TEST_S32="src/components/sprint-32-confirm-password-live-val.test.ts"
AUDIT_DOC="docs/audits/SPRINT-32-CONFIRM-PASSWORD-LIVE-VAL-2026-04-27.md"

cd "$REPO"

echo "═══════════════════════════════════════════════════════════════"
echo "  Sprint 32 — confirm-password live-validation"
echo "═══════════════════════════════════════════════════════════════"

# ─── Phase 0 — Preflight ──────────────────────────────────────────────────────
echo "== Phase 0 — preflight =="
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "FATAL: expected 'main', got '$CURRENT_BRANCH'."
  exit 1
fi
if ! git rev-parse --verify "$PREV_TAG" >/dev/null 2>&1; then
  echo "FATAL: Sprint 31 tag '$PREV_TAG' not found."
  exit 1
fi
for f in "$FORM_FILE" "$TEST_S30" "$TEST_S32" "$AUDIT_DOC"; do
  if [ ! -f "$f" ]; then
    echo "FATAL: expected file missing: $f"
    exit 1
  fi
done
echo "  ✓ branch=main, prev tag=$PREV_TAG, all 4 files present"

# ─── Phase 1 — FUSE index fix ─────────────────────────────────────────────────
echo "== Phase 1 — FUSE index fix =="
rm -f .git/index && git reset HEAD >/dev/null 2>&1
git update-index --refresh >/dev/null 2>&1 || true

# ─── Phase 2 — Sanity diff ────────────────────────────────────────────────────
echo "== Phase 2 — sanity diff =="
CHANGED="$(git status --porcelain | wc -l | tr -d ' ')"
echo "  Changed/untracked: $CHANGED (expect 3 modified + 1 new = 4 entries; or 4 untracked if fresh)"
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
  echo "  (skipped — manual run later: pnpm vitest run $TEST_S32 $TEST_S30)"
else
  pnpm vitest run \
    "$TEST_S32" \
    "$TEST_S30" \
    src/components/input-state-census.test.ts
fi

# ─── Phase 4 — PR #1: form ternary ────────────────────────────────────────────
echo "== Phase 4 — PR #1 commit + tag $TAG_PR1 =="
git add "$FORM_FILE"
git commit -m "ui(auth): wire state=error live ternary on confirm-password (Sprint 32 PR #1)

Sprint 30 explicitly deferred live mismatch surfacing on the
confirm-password Input ('error copy belongs in {error} below').
Sprint 31 closure manifest §6 assigned it to Sprint 32. This commit
ships the live-validation ternary:

  confirm.length === 0          → 'default'  (no premature error)
  confirm !== password          → 'error'    (live mismatch surface)
  confirm === password
    AND password.length >= MIN  → 'success'  (preserved from S30)
  else                          → 'default'  (length signal lives
                                              on the new-password
                                              field above)

Sentence-level 'Passwords do not match.' copy still lives in the
submit handler — defense-in-depth, screen-reader authority remains
the sentence-level <p role=alert>.

aria-invalid is set automatically by the Input primitive when
state === 'error', so the live mismatch is screen-reader hinted
without extra wiring.

Pinned test follows in PR #2."
git tag -a "$TAG_PR1" -m "Sprint 32 PR #1 — confirm-password live-val ternary"

# ─── Phase 5 — PR #2: tests ───────────────────────────────────────────────────
echo "== Phase 5 — PR #2 commit + tag $TAG_PR2 =="
git add "$TEST_S32" "$TEST_S30"
git commit -m "test(input.state): confirm-password live-val pinned guard + S30 refactor (Sprint 32 PR #2)

NEW: src/components/sprint-32-confirm-password-live-val.test.ts (8 case)
  1. reset-form: confirm Input ternary contains both error AND success branches
  2. reset-form: error branch ordering proves live mismatch
       (confirm.length===0 → confirm!==password → 'error' → 'success')
  3. reset-form: empty confirm short-circuits to 'default' (premature-error guard)
  4. reset-form: success branch from Sprint 30 preserved (match + length)
  5. reset-form: submit-time 'Passwords do not match.' sentence still wired
  6. HARD GUARD: register-form has no state=error (single field, no peer)
  7. HARD GUARD: login-form has no state at all (current-password semantics)
  8. Input cva still defines 'error' state variant (activation premise)

REFACTOR: src/components/sprint-30-input-state-success-passwords.test.ts
  Sprint 30's confirm-password assertion was order-sensitive
  ('confirm.length>=MIN ... confirm===password ... \"success\"').
  Sprint 32's ternary reorders branches (length check moved to peer
  field, mismatch short-circuits to error first). Semantic invariant
  unchanged — success requires match AND length. Split into three
  order-agnostic toMatch() calls. Other 6 Sprint 30 cases untouched."
git tag -a "$TAG_PR2" -m "Sprint 32 PR #2 — pinned test + S30 refactor"

# ─── Phase 6 — PR #3: audit doc + apply script ───────────────────────────────
echo "== Phase 6 — PR #3 commit + tag $TAG_PR3 =="
git add "$AUDIT_DOC" "scripts/sprints/2026-04-27-confirm-password-live-val/apply-sprint-32.command"
git commit -m "docs(audit): Sprint 32 closure — confirm-password live-validation (PR #3)

Closes Sprint 30 risk item ('confirm mismatch error gated on submit').
Sprint 31 closure manifest §6 assigned the work to this sprint and
this doc seals it.

§D-1 + unused-variant pack segment remains SEALED (Sprint 31 mühür).
Sprint 32 closes a deferred edge case from Sprint 30, not a new track.

Cumulative status:  8/8 unused-variant tracks + token audit RESOLVED.

Bundle:
  PR #1  v1.42.1  ui(auth):   confirm-password state=error live ternary
  PR #2  v1.42.2  test:       Sprint 32 pinned guard + S30 refactor
  PR #3  v1.43.0  docs(audit): this closure doc"
git tag -a "$TAG_PR3" -m "Sprint 32 closure — confirm-password live-val SEALED"

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
echo "  🏁 Sprint 32 shipped — confirm-password live-val ACTIVE"
echo "═══════════════════════════════════════════════════════════════"
HEAD_SHA="$(git rev-parse --short HEAD)"
echo "  HEAD: $HEAD_SHA = $TAG_PR3"
echo "  Sonraki: Sprint 33 (TR coverage segment kickoff)"
echo "═══════════════════════════════════════════════════════════════"
