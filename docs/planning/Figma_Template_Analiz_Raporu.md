# Figma Template Analiz Raporu
## Salesforce-style Admin Template — Boş Sayfalar & Eksiklikler

**Tarih:** 10 Nisan 2026  
**Kaynak:** https://www.figma.com/make/ZMF5e1YJhO9K6eYU0bMUXE/Salesforce-style-Admin-Template  
**Not:** OneAce projesinde herhangi bir değişiklik yapılmamıştır.

---

## 1. GENEL YAPI

Template, Figma Make (AI-generated code) ile oluşturulmuş tek sayfalık bir React uygulaması. Tüm ekranlar tek bir `home` sayfası altında, client-side routing (switch/case) ile gösteriliyor. **Ayrı Figma sayfaları ("pages") etkinleştirilmemiş** — sadece "Enable pages" seçeneği mevcut.

### Dosya Yapısı
```
src/
├── app/
│   ├── components/
│   │   ├── figma/          (Figma UI bileşenleri)
│   │   ├── inventory/      (Envanter alt bileşenleri)
│   │   │   ├── InventoryDashboard.tsx
│   │   │   ├── InventoryListView.tsx
│   │   │   └── StockCountView.tsx
│   │   └── ui/             (Genel UI bileşenleri)
│   │
│   ├── AnalyticsView.tsx
│   ├── DashboardView.tsx
│   ├── DataGridView.tsx
│   ├── FormView.tsx
│   ├── Header.tsx
│   ├── Sidebar.tsx
│   └── App.tsx
├── imports/
└── styles/
    ├── fonts.css
    ├── index.css
    ├── tailwind.css
    └── theme.css
```

---

## 2. İÇERİĞİ OLAN SAYFALAR (7 adet)

Bu sayfaların her biri gerçek bir React component render ediyor:

| # | Route | Component | Açıklama |
|---|-------|-----------|----------|
| 1 | `dashboard` | `<DashboardView />` | KPI kartları (Revenue, Orders, Customers, Stock), Revenue Trend grafiği, Sales by Category pie chart |
| 2 | `customers` | `<DataGridView />` | Müşteri listesi tablosu (data grid) |
| 3 | `products` | `<FormView />` | Ürün formu görünümü |
| 4 | `inventory` | `<InventoryDashboard />` | Envanter dashboard'u |
| 5 | `inventory-list` | `<InventoryListView />` | Envanter listesi tablosu |
| 6 | `stock-count` | `<StockCountView />` | Stok sayım ekranı |
| 7 | `analytics` | `<AnalyticsView />` | Analitik/raporlama görünümü |

**Default route:** `dashboard` → `<DashboardView />`

---

## 3. BOŞ / PLACEHOLDER SAYFALAR (21 adet)

Aşağıdaki tüm route'lar aynı generic placeholder'ı gösteriyor:
```jsx
<div className="p-6">
  <h1>{currentView başlığı}</h1>
  <p>This section would contain {currentView}-specific content and functionality.</p>
</div>
```

### Inventory Alt Sayfaları (Boş)
| # | Route | Sidebar'da Görünümü | Eksik İçerik |
|---|-------|---------------------|--------------|
| 1 | `add-item` | Inventory → Add Item | Yeni ürün ekleme formu |
| 2 | `import` | Inventory → Import | CSV/Excel veri import ekranı |
| 3 | `export` | Inventory → Export | Veri export ekranı |
| 4 | `movements` | Inventory → Movements | Stok hareket geçmişi tablosu |

### Orders (Boş)
| # | Route | Sidebar'da Görünümü | Eksik İçerik |
|---|-------|---------------------|--------------|
| 5 | `orders` | Orders | Sipariş listesi, filtreleme, sipariş detay |

### Vendors (Boş)
| # | Route | Sidebar'da Görünümü | Eksik İçerik |
|---|-------|---------------------|--------------|
| 6 | `vendors` | Vendors | Tedarikçi listesi ve detay ekranı |

### Locations Alt Sayfaları (Hepsi Boş)
| # | Route | Sidebar'da Görünümü | Eksik İçerik |
|---|-------|---------------------|--------------|
| 7 | `locations` | Locations | Ana lokasyon yönetimi |
| 8 | `warehouses` | Locations → Warehouses | Depo listesi ve yönetimi |
| 9 | `shelfs` | Locations → Shelfs | Raf yönetimi |
| 10 | `bins` | Locations → Bins | Kutu/bölme yönetimi |

### Reports (Boş)
| # | Route | Sidebar'da Görünümü | Eksik İçerik |
|---|-------|---------------------|--------------|
| 11 | `reports` | Reports | Rapor oluşturma ve görüntüleme |

### Tools Alt Sayfaları (Hepsi Boş)
| # | Route | Sidebar'da Görünümü | Eksik İçerik |
|---|-------|---------------------|--------------|
| 12 | `tools` | Tools | Araç ana sayfası |
| 13 | `calendar` | Tools → Calendar | Takvim görünümü |
| 14 | `print-label` | Tools → Print Label | Etiket yazdırma ekranı |
| 15 | `scan-product` | Tools → Scan Product | Barkod/QR okuma ekranı |

### Settings Alt Sayfaları (Hepsi Boş)
| # | Route | Sidebar'da Görünümü | Eksik İçerik |
|---|-------|---------------------|--------------|
| 16 | `billing` | Settings → Billing | Faturalama ve abonelik yönetimi |
| 17 | `notifications` | Settings → Notifications | Bildirim ayarları |
| 18 | `messages` | Settings → Messages | Mesaj merkezi |
| 19 | `settings` | Settings | Genel ayarlar |
| 20 | `users` | Settings → Users | Kullanıcı yönetimi |
| 21 | `user-permissions` | Settings → User Permissions | Yetki ve rol yönetimi |

---

## 4. DASHBOARD SAYFA ANALİZİ (Mevcut Dolu Sayfa)

Dashboard sayfası en eksiksiz sayfa. İçerdiği elemanlar:

**Header bölümü:**
- Arama çubuğu ("Search customers, orders, products...")
- Bildirim ikonu (zil)
- Yardım ikonu
- Admin User avatarı

**KPI Kartları (4 adet):**
- Total Revenue: $67,231 (↑12.5% vs last month)
- Total Orders: 2,378 (↑8.2% vs last month)
- Active Customers: 1,429 (↓2.1% vs last month)
- Products in Stock: 847 (↓4.3% vs last month)

**Grafikler:**
- Revenue Trend: Line chart, son 6 ay (Jan–Jun)
- Sales by Category: Donut/pie chart (Electronics 35%, diğerleri)

**Dashboard'da eksikler:**
- Recent Activity / son işlemler bölümü yok
- Low Stock Alerts yok
- Quick Actions (hızlı işlem butonları) yok
- Grafikler sadece dummy data ile dolu

---

## 5. ÖZET SKOR TABLOSU

| Kategori | Toplam Sayfa | İçerikli | Boş/Placeholder | Tamamlanma |
|----------|-------------|----------|-----------------|------------|
| Dashboard | 1 | 1 | 0 | **100%** |
| Inventory | 6 | 3 | 3 | **50%** |
| Orders | 1 | 0 | 1 | **0%** |
| Vendors | 1 | 0 | 1 | **0%** |
| Locations | 4 | 0 | 4 | **0%** |
| Reports | 1 | 0 | 1 | **0%** |
| Tools | 4 | 0 | 4 | **0%** |
| Settings | 6 | 0 | 6 | **0%** |
| Diğer | 4 | 3 | 1 | **75%** |
| **TOPLAM** | **28** | **7** | **21** | **25%** |

---

## 6. FIGMA MAKE YAPISAL EKSİKLER

1. **Tek sayfa tasarımı:** Tüm ekranlar tek bir `home` sayfası altında. Figma "pages" özelliği etkinleştirilmemiş, bu da tasarım dosyasında sayfa bazlı navigasyon ve genel bakışı imkansız kılıyor.

2. **Prototype bağlantıları yok:** Sidebar menü öğeleri visual olarak mevcut ama Figma prototype interaction'ları kurulmamış — sadece code-level routing var.

3. **Responsive tasarım yok:** Sadece desktop görünümü mevcut. Tablet ve mobil breakpoint'ler tasarlanmamış.

4. **Design token/system eksik:** Renkler ve tipografi kod içinde tanımlı (tailwind + theme.css) ama Figma'da ayrı bir design system/style guide sayfası yok.

5. **Component library:** `figma/` ve `ui/` klasörlerinde bileşenler var ancak bunlar ayrı bir Figma component library olarak organize edilmemiş.

---

## 7. SİMPLYCOUNT İÇİN ÖNERİ ÖNCELİKLENDİRME

Template'in boş sayfalarını OneAce'un mevcut özellik haritasına göre önceliklendirme:

**Yüksek Öncelik (Zaten SC'de mevcut, template'e aktarılabilir):**
- `add-item` — SC'de ItemFormPage zaten var
- `movements` — SC'de MovementPage mevcut
- `orders` — SC'de SalesPage ve PurchasePage mevcut
- `vendors` — SC'de ContactPage (supplier) mevcut

**Orta Öncelik (SC'de kısmen mevcut):**
- `import` / `export` — SC'de CSV import/export altyapısı var
- `locations` / `warehouses` — SC'de LocationPage mevcut
- `reports` — SC'de ReportsPage mevcut
- `settings` — SC'de SettingsPage mevcut

**Düşük Öncelik (SC'de henüz yok veya farklı yapıda):**
- `shelfs` / `bins` — SC'de sub-location desteği yok
- `calendar` — SC'de takvim yok
- `print-label` — SC'de etiket yazdırma yok
- `scan-product` — SC'de barkod tarama yok
- `billing` — SaaS abonelik yönetimi, ayrı modül
- `user-permissions` — SC'de basit rol yapısı var
