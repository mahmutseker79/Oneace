#!/usr/bin/env bash
# scripts/setup-branch-protection.sh
#
# GOD MODE roadmap 2026-04-23 — P1-05 main branch protection.
#
# Idempotent. Configures branch protection on `main` (and, by
# default, `stable`) via the GitHub REST API. Re-runnable safely —
# the API PUT replaces the config atomically.
#
# Requirements:
#   - `gh` CLI installed and authenticated (`gh auth login`).
#   - The authenticated account must be an admin of the repo.
#
# What the rule enforces:
#   - Required status checks (matching the job names in ci.yml):
#       Lint · Typecheck
#       Vitest
#       Prisma Validate
#       Prisma Migrations (scratch Postgres)
#   - Status checks must pass on a FRESH commit (strict = true).
#   - 1 required reviewer.
#   - Linear history (no merge bubbles from forks).
#   - No force-push, no deletion.
#
# To relax the rule for an emergency hotfix, run:
#     gh api -X DELETE repos/{owner}/{repo}/branches/main/protection
# Then re-run this script after the hotfix lands.

set -euo pipefail

REPO_OWNER="${REPO_OWNER:-mahmutseker79}"
REPO_NAME="${REPO_NAME:-Oneace}"
BRANCHES=("${BRANCHES:-main stable}")

if ! command -v gh >/dev/null 2>&1; then
  echo "FATAL: gh CLI not installed. See https://cli.github.com/."
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "FATAL: gh not authenticated. Run \`gh auth login\` first."
  exit 1
fi

# Required-status-checks contexts. MUST match the `name:` field of
# each job in .github/workflows/ci.yml. When adding a new required
# job, update BOTH this list AND the ci.yml job name in lockstep.
read -r -d '' REQUIRED_CHECKS <<'JSON' || true
[
  "Lint · Typecheck",
  "Vitest",
  "Prisma Validate",
  "Prisma Migrations (scratch Postgres)"
]
JSON

apply_protection () {
  local branch="$1"
  echo ""
  echo "=== Protecting $REPO_OWNER/$REPO_NAME @ $branch ==="

  # `gh api -X PUT` atomically replaces the protection config. Null
  # values intentionally disable optional subsystems (we don't use
  # GitHub's bypass allowances or dismissal restrictions).
  local body
  body=$(cat <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": $(echo "$REQUIRED_CHECKS")
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": true
}
EOF
)

  echo "$body" | gh api \
    -X PUT \
    -H "Accept: application/vnd.github+json" \
    "repos/$REPO_OWNER/$REPO_NAME/branches/$branch/protection" \
    --input -

  echo "✓ $branch protected."
}

# shellcheck disable=SC2206
BRANCH_ARRAY=( ${BRANCHES[*]} )
for b in "${BRANCH_ARRAY[@]}"; do
  apply_protection "$b"
done

echo ""
echo "✅ Branch protection applied to: ${BRANCH_ARRAY[*]}"
echo ""
echo "Verify with:"
echo "  gh api repos/$REPO_OWNER/$REPO_NAME/branches/main/protection | jq ."
