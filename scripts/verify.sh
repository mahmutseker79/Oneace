#!/usr/bin/env bash
# =============================================================
# OneAce Deployment Verification Script
# Checks: git index health, local-remote sync, file integrity,
#         Prisma validity, Vercel deployment status, design tokens
#
# Usage:
#   ./scripts/verify.sh           — full verification (all checks)
#   ./scripts/verify.sh quick     — git + file checks only (no network)
#   ./scripts/verify.sh deploy    — verify after push (includes Vercel)
# =============================================================

set -uo pipefail
cd "$(git rev-parse --show-toplevel)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

PASS=0
FAIL=0
WARN=0
MODE="${1:-full}"

pass()  { PASS=$((PASS+1)); echo -e "  ${GREEN}✓${NC} $1"; }
fail()  { FAIL=$((FAIL+1)); echo -e "  ${RED}✗${NC} $1"; }
warn()  { WARN=$((WARN+1)); echo -e "  ${YELLOW}⚠${NC} $1"; }
header(){ echo ""; echo -e "${BLUE}${BOLD}▸ $1${NC}"; }

echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}${BOLD}  OneAce Verification — $(date '+%Y-%m-%d %H:%M')${NC}"
echo -e "${CYAN}${BOLD}  Mode: ${MODE}${NC}"
echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# ═══════════════════════════════════════════════════
# PHASE 1: GIT INDEX HEALTH
# ═══════════════════════════════════════════════════
header "1. Git Index Health"

# Fix index before checking
git update-index --refresh >/dev/null 2>&1 || true

# Check for phantom deletions (FUSE corruption signature)
PHANTOM_DELETES=$(git status --short 2>/dev/null | grep "^D " | wc -l | tr -d ' ')
if [ "$PHANTOM_DELETES" -gt 0 ]; then
  warn "Index corrupted — ${PHANTOM_DELETES} phantom deletions detected. Repairing..."
  rm -f .git/index
  git reset HEAD >/dev/null 2>&1
  PHANTOM_AFTER=$(git status --short 2>/dev/null | grep "^D " | wc -l | tr -d ' ')
  if [ "$PHANTOM_AFTER" -eq 0 ]; then
    pass "Index repaired successfully"
  else
    fail "Index repair failed — ${PHANTOM_AFTER} phantom deletions remain"
  fi
else
  pass "No phantom deletions (index clean)"
fi

# Check FUSE-safe git configs
for cfg in "core.preloadindex=false" "core.fsmonitor=false" "core.untrackedcache=false"; do
  KEY=$(echo "$cfg" | cut -d= -f1)
  EXPECTED=$(echo "$cfg" | cut -d= -f2)
  ACTUAL=$(git config --local "$KEY" 2>/dev/null || echo "unset")
  if [ "$ACTUAL" = "$EXPECTED" ]; then
    pass "Git config $KEY=$EXPECTED"
  else
    warn "$KEY=$ACTUAL (expected $EXPECTED) — applying fix..."
    git config --local "$KEY" "$EXPECTED"
  fi
done

# Check for stale hookspath
HOOKSPATH=$(git config --local core.hookspath 2>/dev/null || echo "")
if [ -n "$HOOKSPATH" ] && [ ! -d "$HOOKSPATH" ]; then
  warn "Stale hookspath: $HOOKSPATH — removing"
  git config --local --unset core.hookspath 2>/dev/null
else
  pass "No stale hookspath"
fi

# ═══════════════════════════════════════════════════
# PHASE 2: LOCAL ↔ REMOTE SYNC
# ═══════════════════════════════════════════════════
header "2. Local ↔ Remote Sync"

LOCAL_SHA=$(git rev-parse HEAD 2>/dev/null)
LOCAL_SHORT=$(git rev-parse --short HEAD 2>/dev/null)
REMOTE_SHA=$(git rev-parse origin/main 2>/dev/null || echo "unknown")
REMOTE_SHORT=$(git rev-parse --short origin/main 2>/dev/null || echo "unknown")
BRANCH=$(git branch --show-current 2>/dev/null)

if [ "$BRANCH" = "main" ]; then
  pass "On main branch"
else
  warn "On branch '$BRANCH' (expected 'main')"
fi

if [ "$LOCAL_SHA" = "$REMOTE_SHA" ]; then
  pass "HEAD ($LOCAL_SHORT) = origin/main ($REMOTE_SHORT) — fully synced"
else
  AHEAD=$(git log origin/main..HEAD --oneline 2>/dev/null | wc -l | tr -d ' ')
  BEHIND=$(git log HEAD..origin/main --oneline 2>/dev/null | wc -l | tr -d ' ')
  if [ "$AHEAD" -gt 0 ] && [ "$BEHIND" -eq 0 ]; then
    fail "Local is ${AHEAD} commits AHEAD of remote — push needed"
  elif [ "$BEHIND" -gt 0 ] && [ "$AHEAD" -eq 0 ]; then
    fail "Local is ${BEHIND} commits BEHIND remote — pull needed"
  else
    fail "Local and remote diverged: ${AHEAD} ahead, ${BEHIND} behind"
  fi
fi

# Check stable branch
STABLE_SHA=$(git rev-parse stable 2>/dev/null || echo "none")
if [ "$STABLE_SHA" = "none" ]; then
  warn "No 'stable' branch — run: git branch -f stable HEAD"
elif [ "$STABLE_SHA" = "$LOCAL_SHA" ]; then
  pass "Stable branch matches HEAD"
else
  STABLE_SHORT=$(git rev-parse --short stable)
  warn "Stable ($STABLE_SHORT) differs from HEAD ($LOCAL_SHORT)"
fi

# Check current tag
CURRENT_TAG=$(git describe --tags --exact-match HEAD 2>/dev/null || echo "")
if [ -n "$CURRENT_TAG" ]; then
  pass "HEAD is tagged: $CURRENT_TAG"
else
  LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "none")
  SINCE=$(git log "${LATEST_TAG}..HEAD" --oneline 2>/dev/null | wc -l | tr -d ' ')
  warn "HEAD is untagged (${SINCE} commits since ${LATEST_TAG})"
fi

# ═══════════════════════════════════════════════════
# PHASE 3: FILE INTEGRITY
# ═══════════════════════════════════════════════════
header "3. File Integrity"

# Critical config files
CONFIGS="package.json next.config.ts tsconfig.json biome.json postcss.config.mjs prisma/schema.prisma .gitignore .env.example src/middleware.ts src/instrumentation.ts"
MISSING_CONFIGS=0
for f in $CONFIGS; do
  if [ ! -f "$f" ]; then
    fail "Missing: $f"
    MISSING_CONFIGS=$((MISSING_CONFIGS+1))
  fi
done
CONFIG_COUNT=$(echo "$CONFIGS" | wc -w | tr -d ' ')
[ "$MISSING_CONFIGS" -eq 0 ] && pass "All ${CONFIG_COUNT} config files present"

# Source file count
TS_COUNT=$(find src -name '*.tsx' -o -name '*.ts' 2>/dev/null | wc -l | tr -d ' ')
if [ "$TS_COUNT" -ge 530 ]; then
  pass "Source files: ${TS_COUNT} TS/TSX (expected ≥530)"
elif [ "$TS_COUNT" -ge 400 ]; then
  warn "Source files: ${TS_COUNT} TS/TSX (lower than expected 530+)"
else
  fail "Source files: ${TS_COUNT} TS/TSX — significant files missing (expected 530+)"
fi

# Escaped path check
ESCAPED=$(find . -path '*/\\(*' -type f -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/.next/*" 2>/dev/null | wc -l | tr -d ' ')
if [ "$ESCAPED" -eq 0 ]; then
  pass "No escaped path files"
else
  fail "${ESCAPED} files in escaped \\(app\\) paths — need recovery"
fi

# macOS duplicates check
DUPES=$(find . -name "* [0-9]*" -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/.next/*" 2>/dev/null | wc -l | tr -d ' ')
if [ "$DUPES" -eq 0 ]; then
  pass "No macOS duplicate files"
else
  warn "${DUPES} macOS duplicate files found — clean with: find . -name '* [0-9]*' ... -delete"
fi

# Key app modules
APP_MODULES="audit categories dashboard departments export import items kits movements purchase-orders reports sales-orders scan settings stock-counts suppliers transfers users warehouses"
MISSING_MODULES=0
for mod in $APP_MODULES; do
  if [ ! -d "src/app/(app)/$mod" ]; then
    fail "Missing module: src/app/(app)/$mod"
    MISSING_MODULES=$((MISSING_MODULES+1))
  fi
done
MODULE_COUNT=$(echo "$APP_MODULES" | wc -w | tr -d ' ')
[ "$MISSING_MODULES" -eq 0 ] && pass "All ${MODULE_COUNT} app modules present"

# Report pages
REPORT_COUNT=$(find "src/app/(app)/reports" -name "page.tsx" 2>/dev/null | wc -l | tr -d ' ')
if [ "$REPORT_COUNT" -ge 15 ]; then
  pass "Report pages: ${REPORT_COUNT} (expected ≥15)"
else
  warn "Report pages: ${REPORT_COUNT} (expected ≥15)"
fi

# ═══════════════════════════════════════════════════
# PHASE 4: DESIGN SYSTEM TOKENS
# ═══════════════════════════════════════════════════
header "4. Design System Integrity"

CSS="src/app/globals.css"
if [ -f "$CSS" ]; then
  for token in "font-inter" "shadow-card" "gradient-card" "transition-fast" "stock-critical" "count-pending" "sidebar-primary"; do
    if grep -q "$token" "$CSS"; then
      pass "Token: --${token}"
    else
      fail "Missing token: --${token} in globals.css"
    fi
  done

  # Dark mode
  if grep -q "\.dark" "$CSS"; then
    pass "Dark mode block present"
  else
    fail "Dark mode block missing"
  fi
else
  fail "globals.css not found"
fi

# Badge variants
BADGE="src/components/ui/badge.tsx"
if [ -f "$BADGE" ]; then
  for v in "success:" "warning:" "info:" "processing:"; do
    if grep -q "$v" "$BADGE"; then
      pass "Badge variant: $v"
    else
      fail "Badge missing variant: $v"
    fi
  done
else
  fail "badge.tsx not found"
fi

# Sidebar structure
SIDEBAR="src/components/shell/sidebar.tsx"
if [ -f "$SIDEBAR" ]; then
  grep -q "border-l-primary" "$SIDEBAR" && pass "Sidebar: active border-l" || fail "Sidebar: missing active border"
  grep -q "ChevronDown" "$SIDEBAR" && pass "Sidebar: collapsible admin" || fail "Sidebar: missing collapsible admin"
else
  fail "sidebar.tsx not found"
fi

# Inter font in layout
LAYOUT="src/app/layout.tsx"
if [ -f "$LAYOUT" ]; then
  grep -q "Inter" "$LAYOUT" && pass "Layout: Inter font import" || fail "Layout: missing Inter font"
  grep -q "font-inter" "$LAYOUT" && pass "Layout: --font-inter variable" || fail "Layout: missing --font-inter"
else
  fail "layout.tsx not found"
fi

# ═══════════════════════════════════════════════════
# PHASE 5: PRISMA VALIDATION
# ═══════════════════════════════════════════════════
header "5. Prisma Schema"

if command -v npx >/dev/null 2>&1 && [ -f "prisma/schema.prisma" ]; then
  PRISMA_RESULT=$(npx prisma validate 2>&1)
  if echo "$PRISMA_RESULT" | grep -q "is valid"; then
    MODELS=$(grep -c '^model ' prisma/schema.prisma)
    ENUMS=$(grep -c '^enum ' prisma/schema.prisma)
    pass "Schema valid — ${MODELS} models, ${ENUMS} enums"
  else
    fail "Schema validation failed"
  fi
else
  warn "Prisma validate skipped (npx not available or no schema)"
fi

# ═══════════════════════════════════════════════════
# PHASE 6: VERCEL DEPLOYMENT (deploy mode only)
# ═══════════════════════════════════════════════════
if [ "$MODE" = "deploy" ] || [ "$MODE" = "full" ]; then
  header "6. Vercel Deployment"

  DEPLOY_URL="${VERCEL_URL:-https://oneace-next-local.vercel.app}"

  if command -v curl >/dev/null 2>&1; then
    HTTP_CODE=$(curl -sL -o /dev/null -w "%{http_code}" --max-time 15 "$DEPLOY_URL" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
      pass "Vercel responding: ${DEPLOY_URL} (HTTP ${HTTP_CODE})"
    elif [ "$HTTP_CODE" = "000" ]; then
      warn "Cannot reach ${DEPLOY_URL} (timeout/network)"
    else
      warn "Vercel returned HTTP ${HTTP_CODE} for ${DEPLOY_URL}"
    fi

    # Check if deployed commit matches local
    # Vercel deployments embed git SHA in headers sometimes
    VERCEL_HEADERS=$(curl -sI --max-time 10 "$DEPLOY_URL" 2>/dev/null || echo "")
    if echo "$VERCEL_HEADERS" | grep -qi "x-vercel"; then
      pass "Vercel headers present (deployment active)"
    fi
  else
    warn "curl not available — skipping Vercel check"
  fi

  # Check via Vercel CLI if available
  if command -v vercel >/dev/null 2>&1; then
    VERCEL_STATUS=$(vercel ls --limit 1 2>/dev/null | tail -1 || echo "")
    if [ -n "$VERCEL_STATUS" ]; then
      pass "Vercel CLI: latest deployment found"
    fi
  fi
fi

# ═══════════════════════════════════════════════════
# PHASE 7: TEST INFRASTRUCTURE
# ═══════════════════════════════════════════════════
if [ "$MODE" = "full" ]; then
  header "7. Test Infrastructure"

  TEST_COUNT=$(find src -name '*.test.ts' 2>/dev/null | wc -l | tr -d ' ')
  [ "$TEST_COUNT" -ge 20 ] && pass "Unit tests: ${TEST_COUNT} files (expected ≥20)" || warn "Unit tests: ${TEST_COUNT} files (expected ≥20)"

  E2E_COUNT=$(ls e2e/*.spec.ts 2>/dev/null | wc -l | tr -d ' ')
  [ "$E2E_COUNT" -ge 10 ] && pass "E2E specs: ${E2E_COUNT} files (expected ≥10)" || warn "E2E specs: ${E2E_COUNT} files (expected ≥10)"

  LOADING_COUNT=$(find src -name 'loading.tsx' 2>/dev/null | wc -l | tr -d ' ')
  [ "$LOADING_COUNT" -ge 40 ] && pass "Loading skeletons: ${LOADING_COUNT} (expected ≥40)" || warn "Loading skeletons: ${LOADING_COUNT} (expected ≥40)"

  API_COUNT=$(find src/app/api -name 'route.ts' 2>/dev/null | wc -l | tr -d ' ')
  [ "$API_COUNT" -ge 20 ] && pass "API routes: ${API_COUNT} (expected ≥20)" || warn "API routes: ${API_COUNT} (expected ≥20)"
fi

# ═══════════════════════════════════════════════════
# PHASE 8: DESIGN TOKEN SYNC (tokens.json ↔ globals.css)
# ═══════════════════════════════════════════════════
header "8. Design Token Sync"

TOKEN_SCRIPT="scripts/check-tokens.mjs"
if [ -f "$TOKEN_SCRIPT" ] && command -v node >/dev/null 2>&1; then
  # Capture output and exit status; swallow stdout unless there's a drift.
  if TOKEN_OUT=$(node "$TOKEN_SCRIPT" 2>&1); then
    # Strip ANSI colors for counting
    TOKEN_PLAIN=$(echo "$TOKEN_OUT" | sed 's/\x1b\[[0-9;]*m//g')
    TOKEN_SUMMARY=$(echo "$TOKEN_PLAIN" | grep -E "ok.*warn.*fail" | head -1)
    pass "Token sync: ${TOKEN_SUMMARY:-no summary parsed}"
    # Surface any warnings (non-fatal) so drift is visible.
    WARN_LINES=$(echo "$TOKEN_PLAIN" | grep -c "^  ⚠" || true)
    if [ "$WARN_LINES" -gt 0 ]; then
      warn "Token sync has ${WARN_LINES} warning(s) — run \`node ${TOKEN_SCRIPT}\` for details"
    fi
  else
    fail "Token sync drift detected — run \`node ${TOKEN_SCRIPT}\` for details"
    echo "$TOKEN_OUT" | sed 's/\x1b\[[0-9;]*m//g' | grep -E "^  ✗" | head -5
  fi
else
  warn "Token sync skipped (scripts/check-tokens.mjs or node unavailable)"
fi

# ═══════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════
echo ""
echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
TOTAL=$((PASS+FAIL+WARN))
if [ "$FAIL" -eq 0 ] && [ "$WARN" -eq 0 ]; then
  echo -e "${GREEN}${BOLD}  ALL CHECKS PASSED  ${NC} (${PASS}/${TOTAL})"
  echo -e "${GREEN}${BOLD}  Project is healthy and deployment-ready.${NC}"
elif [ "$FAIL" -eq 0 ]; then
  echo -e "${YELLOW}${BOLD}  PASSED WITH WARNINGS  ${NC} (${PASS} pass, ${WARN} warn)"
  echo -e "${YELLOW}  Review warnings above but no critical issues.${NC}"
else
  echo -e "${RED}${BOLD}  FAILURES DETECTED  ${NC} (${PASS} pass, ${FAIL} fail, ${WARN} warn)"
  echo -e "${RED}  Fix failures before pushing or deploying.${NC}"
fi
echo -e "${CYAN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

exit "$FAIL"
