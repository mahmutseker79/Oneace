# inFlow Göçü (Migration) — Türkçe Kılavuz

**Son güncellenme: 2026-04-17**

## İki Yöntem: CSV veya REST API

inFlow iki şekilde OneAce'e aktarılabilir:

| Yöntem | Dosyalar | Doğrudan Güncelleme | Kurulum |
|--------|---------|-------------------|--------|
| **CSV Export** | Çoklu CSV (Products, Vendors, Stock Levels, POs) | Hayır — tek seferlik | Manuel dışa aktarma |
| **REST API** | Yok (kimlik bilgileri sadece) | Evet — gerçek zamanlı senkronizasyon | API anahtarı gerekir |

### CSV Yöntemi Hangileri İçin Uygun?

- Eski inFlow kuruluşu (self-hosted, API yok)
- Bir kerelik veri aktarımı isteyenler

### API Yöntemi Hangileri İçin Uygun?

- inFlow Cloud
- Devam eden senkronizasyon isteyenler (ileriki sprintler)

---

## Yöntem 1: CSV Dışa Aktarma

### Adım 1: CSV Dosyalarını Dışa Aktarın

inFlow'da şu raporları dışa aktarın:

1. **Ürünler (Products)**
   - Menü: Reports → Products
   - CSV indirin: `Products.csv`
   - Sütunlar: ProductID, ProductName, SKU, ReorderLevel, ReorderQty, UnitCost, SalePrice, DefaultUOM, Description, ...

2. **Tedarikçiler (Vendors)**
   - Menü: Reports → Vendors
   - CSV indirin: `Vendors.csv`
   - Sütunlar: VendorID, VendorName, Contact, Email, Phone, Address, ...

3. **Stok Seviyeleri (Stock Levels)**
   - Menü: Reports → Stock Levels by Location
   - CSV indirin: `StockLevels.csv`
   - Sütunlar: ProductID, WarehouseCode, LocationCode, OnHandQty, ...

4. **Satın Alma Siparişleri (Purchase Orders)** — opsiyonel
   - Menü: Reports → Purchase Orders
   - CSV indirin: `PurchaseOrders.csv` + `PurchaseOrderItems.csv`

### Adım 2: ZIP Dosyası Oluşturun

Bu CSV dosyalarını bir klasöre koyun ve ZIP dosyasına sıkıştırın:

```
inflow-export.zip
├── Products.csv
├── Vendors.csv
├── StockLevels.csv
├── PurchaseOrders.csv          (opsiyonel)
└── PurchaseOrderItems.csv       (opsiyonel)
```

### Adım 3: OneAce'de İçe Aktarın

1. OneAce → **Entegrasyonlar** (Integrations) → **Göç** (Migration) → **inFlow**
2. **CSV Yöntemi** (CSV Method) seçin
3. **ZIP dosyasını yükleyin**
4. Adımları takip edin (alan eşlemesi, kapsam, doğrulama, başlat)

---

## Yöntem 2: REST API

### Ön Koşullar

- inFlow Cloud hesabı (self-hosted inFlow API'ye sahip değil)
- inFlow API anahtarı

### Adım 1: API Anahtarı Oluşturun

1. **inFlow Cloud'da** oturum açın
2. **Ayarlar** (Settings) → **Entegrasyon** (Integration) → **API**
3. **Yeni İçeriği Ekle** (Add New) tıklayın
4. Uygulama adı yazın (örn: "OneAce Migration")
5. **API Anahtarı** (API Key) öğesini kopyalayın
6. **Hesap Kimliği** (Account ID) öğesini kopyalayın

### Adım 2: OneAce'de API Yöntemi Seçin

1. OneAce → **Entegrasyonlar** (Integrations) → **Göç** (Migration) → **inFlow**
2. **REST API Yöntemi** (REST API Method) seçin
3. **API Anahtarını** ve **Hesap Kimliğini** yapıştırın
4. **Bağlantıyı Test Et** (Test Connection) tıklayın
5. Başarılıysa, adımları takip edin

### Hız Sınırlaması

inFlow API'nin hız sınırlaması: **60 istek / dakika**.

Büyük dışa aktarmalar (>10.000 ürün) biraz zaman alabilir.

---

# inFlow Export Guide — English

**Last updated: 2026-04-17**

## Two Methods: CSV or REST API

You can migrate from inFlow in two ways:

| Method | Files | Real-Time Sync | Setup |
|--------|-------|---|--------|
| **CSV Export** | Multiple CSVs (Products, Vendors, Stock, POs) | No — one-time | Manual export |
| **REST API** | None (credentials only) | Yes — real-time (future sprints) | API key required |

### When to Use CSV?

- Legacy inFlow (self-hosted, no API)
- One-time data migration

### When to Use REST API?

- inFlow Cloud
- Ongoing synchronization (future)

---

## Method 1: CSV Export

### Step 1: Export Reports as CSV

In inFlow, export the following reports:

1. **Products**
   - Menu: Reports → Products
   - Export as CSV: `Products.csv`
   - Columns: ProductID, ProductName, SKU, ReorderLevel, ReorderQty, UnitCost, SalePrice, DefaultUOM, Description, ...

2. **Vendors**
   - Menu: Reports → Vendors
   - Export as CSV: `Vendors.csv`
   - Columns: VendorID, VendorName, Contact, Email, Phone, Address, ...

3. **Stock Levels by Location**
   - Menu: Reports → Stock Levels by Location
   - Export as CSV: `StockLevels.csv`
   - Columns: ProductID, WarehouseCode, LocationCode, OnHandQty, ...

4. **Purchase Orders** (optional)
   - Menu: Reports → Purchase Orders
   - Export: `PurchaseOrders.csv` + `PurchaseOrderItems.csv`

### Step 2: Create ZIP File

Place all CSVs in a folder and zip:

```
inflow-export.zip
├── Products.csv
├── Vendors.csv
├── StockLevels.csv
├── PurchaseOrders.csv          (optional)
└── PurchaseOrderItems.csv       (optional)
```

### Step 3: Import into OneAce

1. OneAce → **Integrations** → **Migration** → **inFlow**
2. Select **CSV Method**
3. Upload **ZIP file**
4. Follow prompts (field mapping, scope, validation, start)

---

## Method 2: REST API

### Prerequisites

- inFlow Cloud account (self-hosted inFlow has no API)
- inFlow API Key

### Step 1: Generate API Key

1. **Log in** to inFlow Cloud
2. **Settings** → **Integration** → **API**
3. Click **Add New**
4. Enter app name (e.g., "OneAce Migration")
5. Copy **API Key**
6. Copy **Account ID**

### Step 2: Use API Method in OneAce

1. OneAce → **Integrations** → **Migration** → **inFlow**
2. Select **REST API Method**
3. Paste **API Key** and **Account ID**
4. Click **Test Connection**
5. If success, follow prompts

### Rate Limit

inFlow API rate limit: **60 requests / minute**.

Large exports (>10,000 items) may take several minutes.

---

## File Layout

Source code for inFlow adapter:
- `src/lib/migrations/inflow/adapter.ts` — Main adapter (CSV/API dispatcher)
- `src/lib/migrations/inflow/parser.ts` — CSV parsing
- `src/lib/migrations/inflow/api-client.ts` — inFlow API client
- `src/lib/migrations/inflow/default-mappings.ts` — Field suggestions
