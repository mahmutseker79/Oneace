#!/bin/bash
# ──────────────────────────────────────────────────────────────────
# OneAce Faz 3a — Netlify shadow bootstrap
#
# Purpose: create oneace-next-local.netlify.app, import Vercel env,
# set platform flags, build+deploy production (no DNS flip, no
# webhook swap), then smoke.
#
# Idempotent: re-running skips already-completed steps.
# Stops early on missing prereqs (CLI not installed, not logged in)
# with a clear "do X, re-run script" message.
#
# Assumes current branch = netlify-poc, commit = 11c7e50 (v1.5.32).
# ──────────────────────────────────────────────────────────────────

set -uo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

SITE_NAME="oneace-next-local"
NETLIFY_URL="https://${SITE_NAME}.netlify.app"
ENV_SNAPSHOT="$REPO_DIR/.env.vercel.snapshot"
DEPLOY_LOG="/tmp/oneace-faz3a-deploy.log"

log()  { printf "\n\033[1;34m==> %s\033[0m\n" "$*"; }
ok()   { printf "\033[1;32m[ok]\033[0m %s\n"   "$*"; }
warn() { printf "\033[1;33m[warn]\033[0m %s\n" "$*"; }
err()  { printf "\033[1;31m[err]\033[0m %s\n"  "$*" >&2; }
die()  { err  "$*"; exit 1; }

# ─────────────────────────────────────────────────────────────────
# Phase 0 — prereqs
# ─────────────────────────────────────────────────────────────────
log "OneAce Faz 3a — Netlify shadow bootstrap"
echo    "repo:        $REPO_DIR"
echo    "site target: $SITE_NAME"
echo    "deploy URL:  $NETLIFY_URL"

BRANCH=$(git branch --show-current 2>/dev/null || echo "")
if [ "$BRANCH" != "netlify-poc" ]; then
  die "branch='$BRANCH' — expected 'netlify-poc'.  Run: git checkout netlify-poc"
fi
ok "git branch = netlify-poc"

for cli in netlify vercel jq curl; do
  command -v "$cli" >/dev/null 2>&1 || {
    case "$cli" in
      netlify) die "netlify CLI missing. Install: npm i -g netlify-cli, then re-run." ;;
      vercel)  die "vercel CLI missing. Install: npm i -g vercel, then re-run." ;;
      jq)      die "jq missing. Install: brew install jq, then re-run." ;;
      curl)    die "curl missing — unexpected on macOS." ;;
    esac
  }
done
ok "CLIs present: netlify vercel jq curl"

# Netlify auth
if ! netlify status 2>&1 | grep -qi "logged in\|email"; then
  die "Not logged in to Netlify. Run: netlify login  (opens browser), then re-run this script."
fi
ok "netlify: logged in"

# Vercel auth
if ! vercel whoami >/dev/null 2>&1; then
  die "Not logged in to Vercel. Run: vercel login  (opens browser), then re-run this script."
fi
ok "vercel:  logged in as $(vercel whoami 2>/dev/null)"

# ─────────────────────────────────────────────────────────────────
# Phase 1 — create or link Netlify site
# ─────────────────────────────────────────────────────────────────
log "Phase 1 — Netlify site (create or link)"

LINKED_SITE=$(netlify status 2>&1 | awk -F': ' '/Site name/ {print $2; exit}' | tr -d ' ')

if [ "$LINKED_SITE" = "$SITE_NAME" ]; then
  ok "repo already linked to site '$SITE_NAME'"
elif [ -n "$LINKED_SITE" ] && [ "$LINKED_SITE" != "$SITE_NAME" ]; then
  die "repo is linked to a DIFFERENT site: '$LINKED_SITE'. Unlink first: netlify unlink"
else
  # Not linked — check if site exists on the account
  if netlify sites:list --json 2>/dev/null | jq -e ".[] | select(.name==\"$SITE_NAME\")" >/dev/null; then
    log "site '$SITE_NAME' exists on account — linking repo"
    netlify link --name "$SITE_NAME" || die "netlify link failed"
  else
    log "creating netlify site '$SITE_NAME'"
    netlify sites:create --name "$SITE_NAME" || die "netlify sites:create failed (name taken on another account?)"
    netlify link --name "$SITE_NAME" || die "netlify link failed"
  fi
  ok "site '$SITE_NAME' created/linked"
fi

# ─────────────────────────────────────────────────────────────────
# Phase 2 — env vars
# ─────────────────────────────────────────────────────────────────
log "Phase 2 — env vars"

# Require the repo to be linked to a Vercel project for env pull.
if [ ! -f ".vercel/project.json" ]; then
  die "Vercel project not linked in this repo (.vercel/project.json missing).
       Run: vercel link     (select the oneace-next-local project), then re-run this script."
fi

if [ -f "$ENV_SNAPSHOT" ]; then
  warn "$ENV_SNAPSHOT already exists — reusing. Delete it to re-pull from Vercel."
else
  log "pulling Vercel production env → $ENV_SNAPSHOT"
  vercel env pull "$ENV_SNAPSHOT" --environment=production --yes 2>&1 | tail -3 \
    || die "vercel env pull failed"
  ok "pulled $(wc -l < "$ENV_SNAPSHOT" | tr -d ' ') lines"
fi

log "importing env to Netlify (replace existing keys)"
netlify env:import "$ENV_SNAPSHOT" --replace-existing 2>&1 | tail -10 \
  || die "netlify env:import failed"
ok "env imported"

log "setting platform-specific flags"
netlify env:set HOSTING_PLATFORM netlify   >/dev/null
netlify env:set NETLIFY true               >/dev/null
netlify env:set BETTER_AUTH_URL "$NETLIFY_URL" >/dev/null
ok "HOSTING_PLATFORM=netlify, NETLIFY=true, BETTER_AUTH_URL=$NETLIFY_URL"

# ─────────────────────────────────────────────────────────────────
# Phase 3 — deploy (shadow — no DNS flip)
# ─────────────────────────────────────────────────────────────────
log "Phase 3 — production build + deploy (SHADOW mode, Vercel still primary)"
if netlify deploy --build --prod 2>&1 | tee "$DEPLOY_LOG" | tail -40; then
  ok "deploy finished — log: $DEPLOY_LOG"
else
  err "deploy failed — tail of log:"
  tail -30 "$DEPLOY_LOG" >&2
  die "fix build errors, then re-run"
fi

# ─────────────────────────────────────────────────────────────────
# Phase 4 — smoke
# ─────────────────────────────────────────────────────────────────
log "Phase 4 — smoke"

# Parse CRON_SECRET out of the snapshot for cron endpoint checks.
CRON_SECRET=$(grep -E '^CRON_SECRET=' "$ENV_SNAPSHOT" | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")

# /api/health — no auth
HEALTH_BODY=$(mktemp)
HEALTH_CODE=$(curl -sS -o "$HEALTH_BODY" -w "%{http_code}" "$NETLIFY_URL/api/health" || echo "000")
if [ "$HEALTH_CODE" = "200" ]; then
  ok "/api/health → 200"
  jq '{commit, checks}' "$HEALTH_BODY" 2>/dev/null || head -c 400 "$HEALTH_BODY"
else
  warn "/api/health → $HEALTH_CODE"
  head -c 400 "$HEALTH_BODY"
  echo
fi
rm -f "$HEALTH_BODY"

if [ -z "$CRON_SECRET" ]; then
  warn "CRON_SECRET not found in snapshot — skipping cron endpoints"
else
  for ep in platform-webhook-health platform-quota-health; do
    BODY=$(mktemp)
    CODE=$(curl -sS -o "$BODY" -w "%{http_code}" \
      -H "Authorization: Bearer $CRON_SECRET" \
      "$NETLIFY_URL/api/cron/$ep" || echo "000")
    if [ "$CODE" = "200" ]; then
      ok "/api/cron/$ep → 200"
      jq '{tag, platform, status, count, ceiling, unit, reason}' "$BODY" 2>/dev/null || head -c 400 "$BODY"
    else
      warn "/api/cron/$ep → $CODE"
      head -c 400 "$BODY"
      echo
    fi
    rm -f "$BODY"
  done
fi

# ─────────────────────────────────────────────────────────────────
# Cleanup
# ─────────────────────────────────────────────────────────────────
log "Cleanup — removing env snapshot (secrets on disk)"
if [ -f "$ENV_SNAPSHOT" ]; then
  rm -f "$ENV_SNAPSHOT"
  ok "removed $ENV_SNAPSHOT"
fi

# ─────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────
log "Faz 3a shadow bootstrap complete"
cat <<EOF

  site:       $SITE_NAME
  url:        $NETLIFY_URL
  mode:       shadow  (Vercel af3b04d still primary, no DNS flip yet)

Next — 24h observation window:
  1. Pick ONE test tenant in your Shopify admin.
     Change its webhook URL to:
       $NETLIFY_URL/api/integrations/shopify/webhooks
  2. Create a test order on that tenant.
  3. Confirm DB row lands in IntegrationTask (or the relevant queue table).
  4. Watch Netlify Function logs for errors:
       netlify functions:log cron-platform-quota-health --live
  5. If 24h clean → Faz 3b (DNS flip + batch webhook swap).
     If any red flags → leave Netlify as-is; Vercel stays primary, zero rollback needed.

EOF
