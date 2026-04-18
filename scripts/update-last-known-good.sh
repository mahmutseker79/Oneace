#!/usr/bin/env bash
# Audit v1.3 §5.50 F-06 — last-known-good ledger updater.
#
# What it does:
#   Walks `git tag` for the latest semver release tag, reads HEAD commit
#   short SHA, and writes both into docs/runbooks/.last-known-good.json.
#   Appends the previous record to `history[]` so the ledger carries
#   a rolling audit trail — incident response can walk back one, two,
#   three releases when the latest is broken.
#
# When to run:
#   - Manually after every verified prod promote (`./scripts/update-last-known-good.sh [dpl_id]`)
#   - Automatically as a post-tag safety net via a local git hook.
#
# Why not a pre-commit hook that just runs on every commit?
#   The ledger only advances when we have a *verified* deployment ID from
#   Vercel — a commit on main does NOT mean it shipped. A pre-commit run
#   that updates on every commit would overwrite the last-known-good with
#   an unverified SHA, which is exactly the failure mode the runbook is
#   trying to prevent. So this script is opt-in after promote, not
#   automatic on every commit.
#
# Usage:
#   scripts/update-last-known-good.sh                      # rolls latest tag/HEAD; deploymentId stays previous
#   scripts/update-last-known-good.sh dpl_abcd1234efgh     # also updates deploymentId
#   scripts/update-last-known-good.sh --dry-run            # print what would change, don't write
#
# Exit codes:
#   0 — ledger updated (or no change needed)
#   1 — prerequisites missing (jq not found, ledger missing, not in repo)
#   2 — bad arguments

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$REPO_ROOT" ]]; then
  echo "error: not inside a git repo" >&2
  exit 1
fi

LEDGER="$REPO_ROOT/docs/runbooks/.last-known-good.json"
if [[ ! -f "$LEDGER" ]]; then
  echo "error: ledger missing at $LEDGER" >&2
  echo "hint: create it via the audit v1.3 §5.50 F-06 seed commit." >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "error: jq is required (brew install jq / apt install jq)" >&2
  exit 1
fi

DRY_RUN=0
NEW_DPL=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    dpl_*)     NEW_DPL="$1"; shift ;;
    -*)
      echo "error: unknown flag $1" >&2
      exit 2
      ;;
    *)
      echo "error: unknown arg $1 (expected dpl_... id or --dry-run)" >&2
      exit 2
      ;;
  esac
done

# Latest semver-ish tag. Falls back to v0.0.0 if no tags, which marks the
# ledger as "unverified" — runbook reader will notice and rebuild from
# scratch rather than trust a stale record.
LATEST_TAG="$(git tag --list --sort=-v:refname | head -1)"
LATEST_TAG="${LATEST_TAG:-v0.0.0}"

HEAD_SHORT="$(git rev-parse --short HEAD)"
NOW_ISO="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

# Current record, before we mutate.
CUR_TAG="$(jq -r '.tag // "unknown"' "$LEDGER")"
CUR_COMMIT="$(jq -r '.commit // "unknown"' "$LEDGER")"
CUR_DPL="$(jq -r '.vercelDeploymentId // ""' "$LEDGER")"

# If nothing has changed AND we were not given a new deploymentId,
# exit quietly — the ledger is already current.
if [[ "$CUR_TAG" == "$LATEST_TAG" && "$CUR_COMMIT" == "$HEAD_SHORT" && -z "$NEW_DPL" ]]; then
  echo "ledger already current at $LATEST_TAG / $HEAD_SHORT — no change"
  exit 0
fi

# Carry forward the previous deploymentId if the caller did not pass a
# new one. The common case is a documentation-only roll where the
# shipped deployment is still the same.
EFFECTIVE_DPL="${NEW_DPL:-$CUR_DPL}"

if [[ $DRY_RUN -eq 1 ]]; then
  echo "dry-run — would update:"
  echo "  tag               $CUR_TAG → $LATEST_TAG"
  echo "  commit            $CUR_COMMIT → $HEAD_SHORT"
  echo "  deploymentId      $CUR_DPL → $EFFECTIVE_DPL"
  echo "  verifiedAt        → $NOW_ISO"
  exit 0
fi

# Append the prior record to history[], cap at last 20 so the ledger
# doesn't grow unbounded over the years.
TMP="$(mktemp)"
jq \
  --arg tag "$LATEST_TAG" \
  --arg commit "$HEAD_SHORT" \
  --arg dpl "$EFFECTIVE_DPL" \
  --arg now "$NOW_ISO" \
  --arg user "${USER:-unknown}" \
  '
  # Promote the current record into history[0].
  .history = ([{
      tag: .tag,
      commit: .commit,
      vercelDeploymentId: .vercelDeploymentId,
      verifiedAt: .verifiedAt,
      notes: (.notes // "")
    }] + (.history // []) | .[:20])
  |
  # Replace the top-level record.
  .tag = $tag
  | .commit = $commit
  | .vercelDeploymentId = $dpl
  | .verifiedAt = $now
  | .verifiedBy = $user
  | .notes = "Rolled by scripts/update-last-known-good.sh"
  ' "$LEDGER" > "$TMP"

mv "$TMP" "$LEDGER"
echo "ledger updated:"
echo "  tag               $LATEST_TAG"
echo "  commit            $HEAD_SHORT"
echo "  deploymentId      $EFFECTIVE_DPL"
echo "  verifiedAt        $NOW_ISO"
echo ""
echo "next step: git add $LEDGER && git commit -m \"chore: bump last-known-good to $LATEST_TAG\""
