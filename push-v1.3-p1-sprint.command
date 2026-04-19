#!/bin/bash
# Push v1.3 P1 sprint — Phase-3.1 remediation (5 P1 bulgu kapandı).
#
# Ne gidiyor:
#   - phase-1-p0-remediations HEAD (HEAD = a4ba319 — F-09 commit'i)
#   - stable dalı a4ba319'a FF (her P1 sonrası lokal FF'lendi; remote senkron)
#   - v1.5.14 → v1.5.23 arası 10 tag. Bir öncekinden (v1.5.13) sonra origin'e
#     hiçbiri gitmedi — hepsini tek push'ta yolluyoruz.
#
# P1 sprint tag haritası (sırasıyla):
#   v1.5.19 — F-01 §5.45 webhook-health cron
#   v1.5.20 — F-04 §5.48 quota-health cron
#   v1.5.21 — F-07 §5.51 PLAN_LIMIT_HIT event
#   v1.5.22 — F-06 §5.50 prod-rollback runbook + ledger
#   v1.5.23 — F-09 §5.53 IntegrationTask durable queue + DLQ
#
# Pre-sprint backlog tag'leri (henüz push'lanmamış):
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

echo "=== 4/6 Tag push: v1.5.14 → v1.5.23 (10 tag) ==="
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
  v1.5.23-integration-task-dlq
do
  git push origin "$t"
done

echo "=== 5/6 Stable dalı FF → HEAD (a4ba319) ==="
# Lokal 'stable' zaten her P1 sonrası HEAD'e FF'lendi; remote'a basılıyor.
# force-with-lease güvenli: remote stable en son 3b7e761'de (v1.5.17) kalmıştı,
# bu ileri doğru bir FF.
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
echo "=== v1.3 P1 SPRINT — PUSHED ==="
echo ""
echo "Durum:"
echo "  * 5 P1 bulgu kapandı (F-01, F-04, F-06, F-07, F-09)"
echo "  * 10 tag origin'de (v1.5.14 .. v1.5.23)"
echo "  * stable = HEAD = a4ba319"
echo ""
echo "Sonraki adımlar:"
echo "  1. Vercel dashboard → Deployments → main için yeni build fire etti mi"
echo "     doğrula (webhook-health cron sessiz kalırsa F-01 alarmı geliyor)."
echo "  2. Kalan 5 P2 bulgu: F-02 (/api/health caller), F-03 (edge-safety class-"
echo "     generic), F-05 (dependabot burst pin), F-08 (rate-limit 429 PostHog),"
echo "     F-10 (2FA recovery rotation UI)."
echo "  3. F-09 adapter wiring follow-up: Shopify + QuickBooks pilot (her adapter"
echo "     tek dosya, catch'in içine await enqueue({...}) + throw). Audit §5.53"
echo "     staged rollout öneriyor — P1 kapsamının dışındaydı."
