#!/usr/bin/env bash
# =============================================================
# OneAce Version Management Script
# Usage:
#   ./scripts/version.sh status     — show current version info
#   ./scripts/version.sh tag        — create a new version tag
#   ./scripts/version.sh backup     — snapshot current state to stable branch
#   ./scripts/version.sh restore    — restore from stable branch or a tag
#   ./scripts/version.sh list       — list all versions with dates
#   ./scripts/version.sh diff <tag> — show what changed since a tag
#   ./scripts/version.sh fix-index  — repair FUSE git index corruption
#   ./scripts/version.sh verify    — run full health check (calls verify.sh)
# =============================================================

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Auto-fix FUSE index on every invocation
git update-index --refresh >/dev/null 2>&1 || true

case "${1:-status}" in

# ─────────────────────────────────────────────
# STATUS — current version info
# ─────────────────────────────────────────────
status)
  echo -e "${BLUE}OneAce Version Status${NC}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  CURRENT_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "untagged")
  HEAD_SHORT=$(git rev-parse --short HEAD)
  BRANCH=$(git branch --show-current)
  COMMITS_SINCE=$(git log "${CURRENT_TAG}..HEAD" --oneline 2>/dev/null | wc -l | tr -d ' ')
  STABLE_AT=$(git rev-parse --short stable 2>/dev/null || echo "not set")
  REMOTE_AT=$(git rev-parse --short origin/main 2>/dev/null || echo "unknown")

  echo -e "  Branch:         ${GREEN}${BRANCH}${NC}"
  echo -e "  HEAD:           ${HEAD_SHORT}"
  echo -e "  Current tag:    ${GREEN}${CURRENT_TAG}${NC}"
  echo -e "  Commits since:  ${COMMITS_SINCE}"
  echo -e "  Stable branch:  ${STABLE_AT}"
  echo -e "  Remote (origin): ${REMOTE_AT}"

  if [ "$HEAD_SHORT" = "$REMOTE_AT" ]; then
    echo -e "  Push status:    ${GREEN}up to date${NC}"
  else
    AHEAD=$(git log origin/main..HEAD --oneline 2>/dev/null | wc -l | tr -d ' ')
    echo -e "  Push status:    ${YELLOW}${AHEAD} commits ahead${NC}"
  fi

  echo ""
  echo "  Files: $(find src -name '*.tsx' -o -name '*.ts' | wc -l | tr -d ' ') TS/TSX"
  echo "  Prisma: $(grep -c '^model ' prisma/schema.prisma) models, $(grep -c '^enum ' prisma/schema.prisma) enums"
  ;;

# ─────────────────────────────────────────────
# TAG — create a new version tag
# ─────────────────────────────────────────────
tag)
  CURRENT_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0")
  echo -e "${BLUE}Current version: ${CURRENT_TAG}${NC}"
  echo ""
  echo "Recent untagged commits:"
  git log "${CURRENT_TAG}..HEAD" --oneline 2>/dev/null | head -10
  UNTAGGED=$(git log "${CURRENT_TAG}..HEAD" --oneline 2>/dev/null | wc -l | tr -d ' ')
  echo "... (${UNTAGGED} total)"
  echo ""

  # Auto-suggest next version
  MAJOR=$(echo "$CURRENT_TAG" | sed 's/v//' | cut -d. -f1)
  MINOR=$(echo "$CURRENT_TAG" | sed 's/v//' | cut -d. -f2 | sed 's/-.*//')
  NEXT_MINOR=$((MINOR + 1))
  SUGGESTED="v${MAJOR}.${NEXT_MINOR}.0"

  read -p "New version tag [${SUGGESTED}]: " NEW_TAG
  NEW_TAG="${NEW_TAG:-$SUGGESTED}"

  read -p "Description: " DESC
  DESC="${DESC:-Release ${NEW_TAG}}"

  git tag -a "${NEW_TAG}" -m "${DESC}"
  echo -e "${GREEN}✓ Tagged ${NEW_TAG} at $(git rev-parse --short HEAD)${NC}"
  echo ""
  echo -e "${YELLOW}Push with: git push origin ${NEW_TAG}${NC}"
  ;;

# ─────────────────────────────────────────────
# BACKUP — snapshot to stable branch
# ─────────────────────────────────────────────
backup)
  OLD_STABLE=$(git rev-parse --short stable 2>/dev/null || echo "none")
  git branch -f stable HEAD
  NEW_STABLE=$(git rev-parse --short stable)
  echo -e "${GREEN}✓ Stable branch updated: ${OLD_STABLE} → ${NEW_STABLE}${NC}"
  echo -e "  Commit: $(git log --oneline -1 HEAD)"
  echo ""
  echo -e "${YELLOW}Push with: git push origin stable -f${NC}"
  ;;

# ─────────────────────────────────────────────
# RESTORE — rollback to stable or a tag
# ─────────────────────────────────────────────
restore)
  echo -e "${BLUE}Available restore points:${NC}"
  echo ""
  echo "  Branches:"
  echo -e "    ${GREEN}stable${NC}  → $(git log --oneline -1 stable 2>/dev/null || echo 'not available')"
  echo ""
  echo "  Recent tags:"
  git tag -l --sort=-version:refname | head -8 | while read tag; do
    echo -e "    ${GREEN}${tag}${NC}  → $(git log --oneline -1 "$tag")"
  done
  echo ""

  read -p "Restore to (branch/tag name): " TARGET
  if [ -z "$TARGET" ]; then
    echo "Cancelled."
    exit 0
  fi

  # Safety: create a backup tag before restoring
  BACKUP_TAG="backup-before-restore-$(date +%Y%m%d-%H%M%S)"
  git tag "$BACKUP_TAG" HEAD
  echo -e "${YELLOW}Safety backup created: ${BACKUP_TAG}${NC}"

  git reset --hard "$TARGET"
  echo -e "${GREEN}✓ Restored to ${TARGET}${NC}"
  echo -e "  Now at: $(git log --oneline -1 HEAD)"
  echo -e "  To undo: git reset --hard ${BACKUP_TAG}"
  ;;

# ─────────────────────────────────────────────
# LIST — all versions with dates
# ─────────────────────────────────────────────
list)
  echo -e "${BLUE}OneAce Version History${NC}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  git tag -l --sort=-version:refname | while read tag; do
    DATE=$(git log -1 --format='%ai' "$tag" 2>/dev/null | cut -d' ' -f1)
    COMMIT=$(git rev-parse --short "$tag" 2>/dev/null)
    MSG=$(git tag -n1 "$tag" 2>/dev/null | sed "s/^${tag}\s*//")
    echo -e "  ${GREEN}${tag}${NC}  ${DATE}  ${COMMIT}  ${MSG}"
  done
  ;;

# ─────────────────────────────────────────────
# DIFF — show changes since a tag
# ─────────────────────────────────────────────
diff)
  TAG="${2:-$(git describe --tags --abbrev=0 2>/dev/null)}"
  echo -e "${BLUE}Changes since ${TAG}:${NC}"
  echo ""
  echo "Commits:"
  git log "${TAG}..HEAD" --oneline
  echo ""
  echo "File stats:"
  git diff "${TAG}..HEAD" --stat | tail -5
  ;;

# ─────────────────────────────────────────────
# FIX-INDEX — repair FUSE corruption
# ─────────────────────────────────────────────
fix-index)
  rm -f .git/index
  git reset HEAD >/dev/null 2>&1
  echo -e "${GREEN}✓ Git index rebuilt${NC}"
  git status --short | wc -l | tr -d ' '
  echo "items in working tree"
  ;;

# ─────────────────────────────────────────────
# VERIFY — run full health check
# ─────────────────────────────────────────────
verify)
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  if [ -x "${SCRIPT_DIR}/verify.sh" ]; then
    exec "${SCRIPT_DIR}/verify.sh" "${2:-full}"
  else
    echo -e "${RED}verify.sh not found in ${SCRIPT_DIR}${NC}"
    exit 1
  fi
  ;;

# ─────────────────────────────────────────────
*)
  echo "Usage: $0 {status|tag|backup|restore|list|diff|fix-index|verify}"
  exit 1
  ;;
esac
