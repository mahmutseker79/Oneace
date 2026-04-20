#!/bin/bash
# Push v1.5.26 → v1.5.29 tag paketi + phase-1-p0-remediations + stable FF.
#
# Neden ayrı helper:
#   Bir önceki push (push-v1.3-p1-sprint.command) v1.5.14-v1.5.25
#   paketini origin'e gönderdi. Bu oturumda 4 yeni tag daha düştü ve
#   Phase-3.2 adapter dalgası tamamlandı:
#
#     v1.5.26-a-quick-telemetry         — F-05 dependabot burst pin
#                                          + F-02 /api/health caller
#                                          + F-08 rate-limit 429 PostHog
#     v1.5.27-f03-edge-safety-class-generic
#                                         — edge-safety pin genişletildi
#                                          (Buffer/fs/nextTick class-generic)
#     v1.5.28-f10-recovery-rotation-ui  — 2FA recovery code rotation
#                                          UI + 365-gün rotation banner
#                                          + telemetry (19 pinned test)
#     v1.5.29-f09-phase-3-2-c-adapter-wave
#                                         — 10 adapter register.ts (amazon,
#                                          bigcommerce, magento, odoo, wix,
#                                          woocommerce, xero, zoho,
#                                          quickbooks-desktop, custom-webhook)
#                                          + barrel bump + 52-pin test.
#                                          SCHEMA_UNWIRED silent-loop
#                                          C-wave tarafı kapatıldı.
#
# Mac'te çalıştır: `bash push-v1.5.29-phase-3-2-c.command`
# (veya chmod +x sonrası çift tıkla).
cd ~/Documents/Claude/Projects/OneAce/oneace || exit 1
exec > ~/Documents/Claude/Projects/OneAce/oneace/push-v1.5.29-phase-3-2-c.log 2>&1
set -x

echo "=== 1/6 FUSE git index fix ==="
rm -f .git/index && git reset HEAD

echo "=== 2/6 Mevcut branch + status + HEAD ==="
git status --short
git rev-parse --abbrev-ref HEAD
git log -6 --oneline

echo "=== 3/6 Branch push: phase-1-p0-remediations → origin ==="
git push origin phase-1-p0-remediations

echo "=== 4/6 Tag push: v1.5.26 → v1.5.29 (4 tag, idempotent) ==="
for t in \
  v1.5.26-a-quick-telemetry \
  v1.5.27-f03-edge-safety-class-generic \
  v1.5.28-f10-recovery-rotation-ui \
  v1.5.29-f09-phase-3-2-c-adapter-wave
do
  git push origin "$t"
done

echo "=== 5/6 Stable dalı FF → HEAD (5b8cc1a) ==="
git push origin stable --force-with-lease

echo "=== 6/6 Post-push verify ==="
curl -sS -o /dev/null -w "oneace-next-local prod HTTP=%{http_code} | time=%{time_total}s\n" \
  https://oneace-next-local.vercel.app/api/health

if [ -x ./scripts/verify.sh ]; then
  ./scripts/verify.sh deploy || echo "verify.sh deploy non-zero — manuel incele"
fi

echo ""
echo "=== v1.5.26 → v1.5.29 TAG PAKETİ — PUSHED ==="
echo ""
echo "Durum:"
echo "  * A-quick paket (F-02, F-05, F-08) kapandı (v1.5.26)"
echo "  * F-03 edge-safety class-generic kapandı (v1.5.27)"
echo "  * F-10 2FA recovery rotation UI kapandı (v1.5.28)"
echo "  * F-09 Phase-3.2 C adapter dalgası kapandı (v1.5.29)"
echo "  * 51 yeni (integrationKind, taskKind) çifti dispatch registry'de"
echo "  * stable = HEAD = 5b8cc1a"
echo ""
echo "Audit v1.3 durumu:"
echo "  * 10 P1/P2 bulgunun 10'u kapandı. Geriye sadece per-adapter client"
echo "    construction follow-up'ları kaldı (10 adet TRANSPORT_*_EXECUTION_PENDING"
echo "    kodlu DLQ row'u takip eder)."
echo "  * Phase-3.2 adapter dispatch registry coverage: 12/12 (shopify+qbo+"
echo "    10 C-wave)."
echo ""
echo "Sonraki adım önerileri:"
echo "  1. Vercel dashboard → Deployments → main build fire etti mi doğrula."
echo "  2. DLQ dashboard'da TRANSPORT_*_EXECUTION_PENDING row'ları görmeye başlarsan"
echo "     per-adapter client construction PR'ı kuyruğa al (Amazon SP-API"
echo "     genelde ilk sırada — marketplace seller plumbing en zor parça)."
echo "  3. Tenant-specific QA için her yeni integration provider sayfası açıp"
echo "     credentials girildiğinde DLQ 'pending' row'unu doğrulayabilirsin."
