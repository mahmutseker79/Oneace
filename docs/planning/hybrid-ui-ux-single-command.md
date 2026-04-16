# OneAce Hybrid UI/UX Refresh - Single Execution Command

Aşağıdaki tek komutu Codex/Claude benzeri bir coding agent'e vererek tüm UI/UX yenileme işini tek bir iş planı altında başlatabilirsin.

```text
/Users/bluefire/Documents/Claude/Projects/OneAce/oneace projesinde mevcut Next.js uygulamasını baştan yazmadan, mevcut mimariyi koruyarak hibrit operasyon + yönetim kullanıcıları için daha sade, daha anlaşılır ve daha görev odaklı bir UI/UX yenilemesi yap.

Amaç:
OneAce'i feature-first panel hissinden çıkarıp task-first, hızlı öğrenilen, mobil ve desktop'ta dengeli çalışan bir ürün deneyimine dönüştür.
Temel ilke: "OneAce önce ne yapılacağını göstermeli, sonra ayrıntıyı göstermeli."

Zorunlu hedefler:
1. Shell ve navigation yapısını sadeleştir.
2. Dashboard'ı Today-first hale getir.
3. Items deneyimini hazır görünümler ve daha kolay okunur tablo ile sadeleştir.
4. Scan ekranını focus-mode, tek görevli iş istasyonuna dönüştür.
5. Stock counts deneyimini süreç bazlı, yönlendirici ve aksiyon odaklı hale getir.
6. Ortak UI primitive'leri ile görsel tutarlılığı artır.
7. İlgili E2E testlerini güncelle ve doğrula.

Uygulama kuralları:
- Mevcut Next.js App Router yapısını koru.
- Mevcut veri modeli ve Prisma sorgu yaklaşımını mümkün olduğunca yeniden kullan.
- Gereksiz refactor yapma.
- Her büyük alanı küçük, mantıklı commit sınırlarıyla uygula.
- Yeni bileşenler küçük ve tek sorumluluklu olsun.
- Görsel dil daha sakin, daha net ve daha az kalabalık olsun.
- Mobil deneyimde menü keşfinden çok hızlı görev erişimi öncelikli olsun.
- Desktop deneyimde karar verme, tablo ve drill-down öncelikli olsun.
- Karmaşık alanlarda kullanıcıya sıradaki doğru aksiyonu görünür kıl.

Bilgi mimarisi hedefi:
Birinci seviye navigasyon şu 5 ana grup etrafında yeniden kurgulansın:
- Bugun
- Stok
- Operasyon
- Icgoruler
- Yonetim

Mobil hızlı erişim hedefi:
- Bugun
- Tara
- Sayim
- Stok
- Menu

Uygulama sırası:

FAZ 1 - Shell + Navigation
- `src/components/shell/sidebar.tsx`
- `src/components/shell/mobile-nav.tsx`
- `src/components/shell/header.tsx`
- `src/components/shell/app-shell-client.tsx`
- `src/app/(app)/layout.tsx`
- oluştur: `src/components/shell/primary-nav.tsx`
- oluştur: `src/components/shell/mobile-tab-bar.tsx`

Beklenen sonuç:
- Sidebar 5 ana grup etrafında sadeleşsin.
- Mobilde bottom tab bar eklensin.
- Header araması komut merkezi hissi versin.

FAZ 2 - Dashboard Today-first dönüşümü
- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/dashboard/loading.tsx`
- oluştur: `src/components/dashboard/today-hero.tsx`
- oluştur: `src/components/dashboard/priority-tasks-grid.tsx`
- oluştur: `src/components/dashboard/quick-actions-strip.tsx`
- oluştur: `src/components/dashboard/in-progress-panel.tsx`
- oluştur: `src/components/dashboard/exceptions-panel.tsx`
- oluştur: `src/components/dashboard/kpi-summary-row.tsx`

Beklenen sonuç:
- Üstte görevler ve hızlı aksiyonlar olsun.
- KPI ve grafikler ikinci seviyeye insin.
- En fazla 3 ana grafik kalsın.

FAZ 3 - Items sadeleştirme
- `src/app/(app)/items/page.tsx`
- `src/app/(app)/items/items-table.tsx`
- oluştur: `src/components/items/saved-view-tabs.tsx`
- oluştur: `src/components/items/items-toolbar.tsx`
- oluştur: `src/components/items/item-quick-preview-panel.tsx`

Beklenen sonuç:
- Hazır görünüm sekmeleri olsun: Tumu, Kritik Stok, Yeniden Siparis, Son Guncellenen.
- İlk tablo görünümü daha sade olsun.
- Hızlı önizleme/detay mantığı eklensin.

FAZ 4 - Scan focus mode
- `src/app/(app)/scan/page.tsx`
- `src/app/(app)/scan/scanner.tsx`
- `src/components/scanner/quick-add-sheet.tsx`
- oluştur: `src/components/scanner/scan-result-card.tsx`
- oluştur: `src/components/scanner/scan-action-cluster.tsx`
- oluştur: `src/components/scanner/recent-scans-list.tsx`

Beklenen sonuç:
- Tarama alanı ana odak olsun.
- Sonuç kartı ve ana aksiyonlar daha baskın olsun.
- Son taramalar paneli eklensin.
- Eşleşmeyen barkod akışı çözüm odaklı olsun.

FAZ 5 - Stock counts workflow-first deneyim
- `src/app/(app)/stock-counts/page.tsx`
- `src/app/(app)/stock-counts/[id]/page.tsx`
- oluştur: `src/components/stock-counts/counts-status-tabs.tsx`
- oluştur: `src/components/stock-counts/count-lifecycle-stepper.tsx`
- oluştur: `src/components/stock-counts/count-summary-cards.tsx`
- oluştur: `src/components/stock-counts/count-action-rail.tsx`

Beklenen sonuç:
- Liste ekranında durum sekmeleri olsun.
- Detay ekranında süreç çubuğu olsun: Planla > Ata > Say > Incele > Onayla.
- Kullanıcı her an hangi aşamada olduğunu ve sıradaki doğru aksiyonu görsün.

FAZ 6 - Shared UI + final polish
- oluştur: `src/components/ui/section-header.tsx`
- oluştur: `src/components/ui/status-badge.tsx`
- `src/app/globals.css`

Beklenen sonuç:
- Yeni ekranlar ortak ritim ve ortak statü dili kullansın.
- Genel spacing, surface, vurgu dengesi sakinleşsin.

TEST ve doğrulama zorunluluğu:
- ilgili yerlerde E2E testlerini güncelle:
  - `e2e/dashboard.spec.ts`
  - `e2e/items.spec.ts`
  - `e2e/scanner.spec.ts`
  - `e2e/stock-counts.spec.ts`
- finalde mutlaka çalıştır:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm test:e2e e2e/dashboard.spec.ts e2e/items.spec.ts e2e/scanner.spec.ts e2e/stock-counts.spec.ts`

Çalışma prensibi:
- Önce dosyaları incele.
- Sonra yukarıdaki faz sırasıyla uygula.
- Her faz sonunda kısa doğrulama yap.
- Mevcut kod kalıplarına uy.
- Kullanılmayan veya tekrar eden UI mantığı oluşursa küçük ortak bileşenlere ayır.
- Gereksiz yeni bağımlılık ekleme.
- İş bittiğinde değişen dosyaları ve yapılanları kısa ama somut özetle.

Referans plan dosyası:
`/Users/bluefire/Documents/Claude/Projects/OneAce/oneace/docs/superpowers/plans/2026-04-16-hybrid-ui-ux-implementation.md`

Bu işi baştan sona uygula; sadece plan çıkarma, gerçekten kodu düzenle, testleri çalıştır ve sonucu raporla.
```
