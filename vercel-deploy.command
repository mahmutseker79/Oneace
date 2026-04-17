#!/bin/bash
# OneAce — Vercel CLI ile doğrudan production deploy
# Bu scripti çift tıklayarak veya Terminal'de çalıştırın

cd ~/Documents/Claude/Projects/OneAce/oneace || exit 1

echo "=== OneAce Vercel Deploy ==="
echo ""

# 1. Git index fix (FUSE)
echo "1/4 Git index düzeltiliyor..."
rm -f .git/index && git reset HEAD 2>/dev/null
echo "   ✓ Git index temiz"

# 2. Mevcut durumu göster
echo ""
echo "2/4 Mevcut durum:"
echo "   Branch: $(git branch --show-current)"
echo "   Commit: $(git log --oneline -1)"
echo "   Tag:    $(git tag --sort=-creatordate | head -1)"
echo ""

# 3. Vercel CLI kontrolü
echo "3/4 Vercel CLI kontrol ediliyor..."
if ! command -v vercel &>/dev/null; then
    echo "   ⚠ Vercel CLI bulunamadı. Kuruluyor..."
    npm install -g vercel
    echo "   ✓ Vercel CLI kuruldu"
else
    echo "   ✓ Vercel CLI mevcut: $(vercel --version 2>/dev/null)"
fi

# 4. Production deploy
echo ""
echo "4/4 Production deploy başlatılıyor..."
echo "   (İlk seferde giriş yapmanız istenebilir)"
echo ""
vercel --prod --yes

echo ""
echo "=== Deploy tamamlandı ==="
echo "   Site: https://oneace-next-local.vercel.app"
