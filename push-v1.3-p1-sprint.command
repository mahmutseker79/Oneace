#!/bin/bash
# Push v1.3 P1 sprint + Phase-3.2 B-1/B-2 adapter wiring.
#
# Ne gidiyor:
#   - phase-1-p0-remediations HEAD = 0465329 (F-09 B-2 QuickBooks
#     dispatch wiring). Branch kuyruğu: a4ba319 → 27c983a →
#     fa6f6bf (B-1 Shopify) → 552908a → 0465329 (B-2 QB).
#   - stable dalı 0465329'a FF. (Her P1 + B-1 + B-2 sonrası lokal
#     FF'lendi.)
#   - v1.5.14 → v1.5.25 arası 12 tag. Helper idempotent — v1.5.24'e
#     kadar zaten origin'de olanlar "Everything up-to-date" geçer.
#
# P1 sprint tag haritası:
#   v1.5.19 — F-01 §5.45 webhook-health cron
#   v1.5.20 — F-04 §5.48 quota-health cron
#   v1.5.21 — F-07 §5.51 PLAN_LIMIT_HIT event
#   v1.5.22 — F-06 §5.50 prod-rollback runbook + ledger
#   v1.5.23 — F-09 §5.53 IntegrationTask durable queue + DLQ
#
# Phase-3.2 adapter wiring:
#   v1.5.24 — F-09 B-1 Shopify dispatch registry + pilot (ADR-005)
#   v1.5.25 — F-09 B-2 QuickBooks dispatch wiring (14 ERP kinds,
#             AUTH_QB_TOKEN_EXPIRED refresh heuristic)
#
# Pre-sprint backlog tag'leri (çoğu bir önceki push'la origin'de):
#   v1.5.14 skills-council-gate-security
#   v1.5.15 tsc-fix-migration-unchecked-index
#   v1.5.16 main-merge-prod
#   v1.5.17 vercel-dependabot-gate
#   v1.5.18 audit-v1.3-dossier-opened
#
# Mac'te çalıştır: `bash push-v1.3-p1-sprint.command`
# (veya chmod +x sonrası çift tıkla).
cd ~/Documents/Claude/Projects/OneAce/oneace || exit 1
exec > ~/Documents/Claude/Projects/OneAce/oneace/push-v1.3-p1-sprint.log 2>&1
set -x

echo "=== 1/6 FUSE git index fix ==="
rm -f .git/index && git reset HEAD

echo "=== 2/6 Mevcut branch + status + HEAD ==="
git status --short
git rev-parse --abbrev-ref HEAD
git log -6 --oneline

echo "=== 3/6 Branch push: phase-1-p0-remediations → origin ==="
git push origin phase-1-p0-remediations

echo "=== 4/6 Tag push: v1.5.14 → v1.5.25 (12 tag, idempotent) ==="
for t in \
  v1.5.14-skills-council-gate-security \
  v1.5.15-tsc-fix-migration-unchecked-index \
  v1.5.16-main-merge-prod \
  v1.5.17-vercel-dependabot-gate \
  v1.5.18-audit-v1.3-dossier-opened \
  v1.5.19-webhook-health-cron \
  v1.5.20-quota-health-cron \
  v1.5.21-plan-limit-hit-event \
  v1.5.22-prod-rollback-runbook \
  v1.5.23-integration-task-dlq \
  v1.5.24-f09-shopify-wiring \
  v1.5.25-f09-quickbooks-wiring
do
  git push origin "$t"
done

echo "=== 5/6 Stable dalı FF → HEAD (0465329) ==="
# Lokal 'stable' zaten her P1 + B-1 + B-2 sonrası HEAD'e FF'lendi;
# remote'a basılıyor. force-with-lease güvenli: önceki push'ta
# stable remote'da fa6f6bf'ye çıkmıştı, bu ileri doğru 2 commit'lik
# bir FF (helper bump + B-2).
git push origin stable --force-with-lease

echo "=== 6/6 Post-push verify ==="
# Vercel production health probe. Webhook + quota sorunu çözüldüyse 200 gelmeli.
curl -sS -o /dev/null -w "oneace-next-local prod HTTP=%{http_code} | time=%{time_total}s\n" \
  https://oneace-next-local.vercel.app/api/health

# verify.sh deploy modu — 7-fazlı health check (git / remote sync / file
# integrity / design tokens / prisma / vercel / tests). FUSE takılmazsa
# birkaç saniye sürer.
if [ -x ./scripts/verify.sh ]; then
  ./scripts/verify.sh deploy || echo "verify.sh deploy non-zero — manuel incele"
fi

echo ""
echo "=== v1.3 P1 SPRINT + B-1 SHOPIFY + B-2 QUICKBOOKS — PUSHED ==="
echo ""
echo "Durum:"
echo "  * 5 P1 bulgu kapandı (F-01, F-04, F-06, F-07, F-09)"
echo "  * F-09 B-1 Shopify pilot adapter wired (v1.5.24)"
echo "  * F-09 B-2 QuickBooks wired — 14 ERP entity kind (v1.5.25)"
echo "  * 12 tag origin'de (v1.5.14 .. v1.5.25)"
echo "  * stable = HEAD = 0465329"
echo ""
echo "Sonraki adımlar:"
echo "  1. Vercel dashboard → Deployments → main için yeni build fire etti mi"
echo "     doğrula. QB webhook kaldırımı: /api/integrations/quickbooks/webhooks"
echo "     artık IntegrationTask sıra açıyor, 30 dakikalık cron drain edecek."
echo "  2. A-quick paket: F-05 (dependabot burst pin), F-02 (/api/health"
echo "     caller), F-08 (rate-limit 429 PostHog)."
echo "  3. F-03 edge-safety class-generic + F-10 2FA recovery rotation UI."
echo "  4. 13 adapter daha kaldı: amazon, bigcommerce, magento, odoo, wix,"
echo "     woocommerce, xero, zoho, vb. — her biri ADR-005 canonical register.ts"
echo "     pattern'iyle tek PR/tag."
