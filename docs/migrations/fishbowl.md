# Fishbowl Göçü (Migration) — Türkçe Kılavuz

**Son güncellenme: 2026-04-17**

## Fishbowl'dan Dışa Aktarma

### Adım 1: Multi-CSV Dışa Aktarması

Fishbowl UI'da şu modüllerden sağ tıkla ve dışa aktarın:

1. **Ürünler Modülü** (Inventory / Items)
   - Sağ tıkla → **Dışa Aktar** (Export)
   - `Items.csv` ile kaydedin
   - Sütunlar: ItemID, ItemNumber (SKU), Description, UnitOfMeasure, CostPrice, SalePrice, ...

2. **Satıcılar Modülü** (Vendors / Suppliers)
   - Sağ tıkla → **Dışa Aktar**
   - `Vendors.csv` ile kaydedin
   - Sütunlar: VendorID, VendorName, Contact, Phone, Email, ...

3. **Depo Lokasyonları** (Warehouse / Bins)
   - Sağ tıkla → **Dışa Aktar**
   - `Locations.csv` ile kaydedin
   - Sütunlar: BinID, BinName, WarehouseID, ...

4. **Satın Alma Siparişleri** (Purchase Orders) — opsiyonel
   - Sağ tıkla → **Dışa Aktar**
   - `PurchaseOrders.csv` + `PurchaseOrderItems.csv` ile kaydedin

### Adım 2: Charset Uyarısı

Fishbowl genellikle **Windows-1252** (Latin-1) ile dışa aktarır.

OneAce otomatik olarak UTF-8'e dönüştürür, ancak özel karakterler garip görünebilir:
- "Café" → "Caf?" gibi görünebilir
- OneAce otomatik olarak düzeltir

Sorun varsa CSV dosyasını UTF-8'e el ile dönüştürün.

### Adım 3: ZIP Dosyası Oluşturun

```
fishbowl-export.zip
├── Items.csv
├── Vendors.csv
├── Locations.csv
├── PurchaseOrders.csv    (opsiyonel)
└── PurchaseOrderItems.csv (opsiyonel)
```

### Adım 4: OneAce'de İçe Aktarın

1. OneAce → **Entegrasyonlar** (Integrations) → **Göç** (Migration) → **Fishbowl**
2. **ZIP dosyasını yükleyin**
3. Adımları takip edin (alan eşlemesi, kapsam, doğrulama, başlat)

---

## Birim Yönetimi (UOM — Units of Measure)

### Fishbowl UOM Ağacı

Fishbowl, UOM ağacını destekler:
- Ana birim: `EA` (Each)
- Alt birimler: `CASE` = 12 EA, `PALLET` = 10 CASE, vb.

### OneAce'de UOM Yönetimi

OneAce şu anda **her ürün için tek bir birim** destekler.

Fishbowl'da ürün `CASE` ile satılıyorsa:
- Quantity = 50 CASE
- OneAce'de: Quantity = 50, Unit = "CASE"

**Uyumsuzluk Uyarısı**: Fishbowl'da bir ürün birden fazla UOM'da satılıyorsa, OneAce bunu uyarı olarak gösterir. Ana birimi seçin.

---

## Satın Alma Siparişi Durum Eşlemesi

Fishbowl PO durumları OneAce'e şu şekilde eşlenir:

| Fishbowl Durumu | OneAce PurchaseOrderStatus |
|-----------------|---------------------------|
| OPEN | PENDING |
| RECEIVED_PARTIAL | PARTIAL_RECEIVED |
| RECEIVED | RECEIVED |
| CLOSED | CLOSED |
| CANCELLED | CANCELLED |

---

# Fishbowl Export Guide — English

**Last updated: 2026-04-17**

## Export from Fishbowl

### Step 1: Multi-CSV Export

In Fishbowl UI, right-click each module and export:

1. **Inventory / Items**
   - Right-click → **Export**
   - Save as `Items.csv`
   - Columns: ItemID, ItemNumber (SKU), Description, UnitOfMeasure, CostPrice, SalePrice, ...

2. **Vendors / Suppliers**
   - Right-click → **Export**
   - Save as `Vendors.csv`
   - Columns: VendorID, VendorName, Contact, Phone, Email, ...

3. **Warehouse / Bins**
   - Right-click → **Export**
   - Save as `Locations.csv`
   - Columns: BinID, BinName, WarehouseID, ...

4. **Purchase Orders** (optional)
   - Right-click → **Export**
   - Save as `PurchaseOrders.csv` + `PurchaseOrderItems.csv`

### Step 2: Charset Warning

Fishbowl typically exports in **Windows-1252** (Latin-1) encoding.

OneAce auto-converts to UTF-8, but special characters may appear corrupted:
- "Café" → "Caf?"
- OneAce auto-repairs it

If issues persist, manually re-encode CSV to UTF-8.

### Step 3: Create ZIP

```
fishbowl-export.zip
├── Items.csv
├── Vendors.csv
├── Locations.csv
├── PurchaseOrders.csv    (optional)
└── PurchaseOrderItems.csv (optional)
```

### Step 4: Import into OneAce

1. OneAce → **Integrations** → **Migration** → **Fishbowl**
2. Upload **ZIP file**
3. Follow prompts (field mapping, scope, validation, start)

---

## Units of Measure (UOM)

### Fishbowl UOM Tree

Fishbowl supports UOM hierarchies:
- Base unit: `EA` (Each)
- Sub-units: `CASE` = 12 EA, `PALLET` = 10 CASE, etc.

### OneAce UOM Handling

OneAce currently supports **one unit per item**.

If a Fishbowl item is sold in `CASE`:
- Quantity = 50 CASE
- OneAce: Quantity = 50, Unit = "CASE"

**Mismatch Warning**: If a Fishbowl item has multiple UOMs, OneAce warns you. Choose the primary unit.

---

## Purchase Order Status Mapping

Fishbowl PO statuses map to OneAce:

| Fishbowl Status | OneAce PurchaseOrderStatus |
|-----------------|---------------------------|
| OPEN | PENDING |
| RECEIVED_PARTIAL | PARTIAL_RECEIVED |
| RECEIVED | RECEIVED |
| CLOSED | CLOSED |
| CANCELLED | CANCELLED |

---

## File Layout

Source code for Fishbowl adapter:
- `src/lib/migrations/fishbowl/adapter.ts` — Main adapter
- `src/lib/migrations/fishbowl/csv-parser.ts` — CSV parsing
- `src/lib/migrations/fishbowl/status-map.ts` — PO status mapping
- `src/lib/migrations/fishbowl/default-mappings.ts` — Field suggestions
