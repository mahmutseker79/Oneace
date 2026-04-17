# Sortly Göçü (Migration) — Türkçe Kılavuz

**Son güncellenme: 2026-04-17**

## Sortly'den Dışa Aktarma Nasıl Yapılır?

1. **Sortly uygulamasında** oturum açın (https://sortly.com).
2. **Ayarlar** (Settings) → **Veri** (Data) → **Dışa Aktar** (Export) seçin.
3. **ZIP dosyası** indirin. Bu dosya şunları içerir:
   - `items.csv` — Tüm ürünlerin ayrıntıları (ad, SKU, fiyat, vs.)
   - `images/` — Ürün fotoğrafları (dosya adı `{itemId}_photo.jpg` formatında)

## ZIP Dosyasında Neler Var?

| Dosya/Klasör | Açıklama |
|--------------|----------|
| `items.csv` | Ürün tablosu (gerekli) |
| `images/` | Ürün fotoğrafları (opsiyonel) |

## items.csv Sütunları

Sortly'nin standart CSV şunları içerir:

| Sütun | Zorunlu mu? | OneAce Karşılığı | Örnek |
|-------|-------------|------------------|--------|
| **Name** | Evet | `Item.name` | "Ölçü Kabı - 500ml" |
| **SKU** | Evet | `Item.sku` | "MK-500ML-BLU" |
| **Quantity** | Hayır | `StockLevel.quantity` | "45" |
| **Folder** | Hayır | `Item.categoryExternalId` (klasör adı) | "Mutfak Gereçleri" |
| **Folder Path** | Hayır | `Item.categoryExternalId` (tam yol) | "Ev / Mutfak Gereçleri" |
| **Price** | Hayır | `Item.salePrice` | "29.99" |
| **Minimum Level** | Hayır | `Item.reorderPoint` | "10" |
| **Notes** | Hayır | `Item.description` | "Plastik, BPA-free" |
| **Tags** | Hayır | Özel alanlar | "new", "sale" |
| **Photos** | Hayır | `RawAttachment.sourceRef` (boru çizgisiyle ayrılmış) | "item_1.jpg\|item_2.jpg" |
| **Field: {customName}** | Hayır | Özel alan (user-defined) | "Renk", "Üretici", vb. |

### Özel Alan Sütunları

Sortly'de tanımladığınız özel alanlar `Field: ` önekiyle CSV'ye eklenir. Örnek:
- **Renk** sütunu → CSV'de `Field: Renk`
- **Üretici** sütunu → CSV'de `Field: Üretici`

OneAce bu sütunları otomatik olarak tespit eder ve eşler.

## Yaygın Sorunlar ve Çözümleri

| Sorun | Çözüm |
|-------|-------|
| ZIP dosyasında fotoğraflar yok | Dışa aktarmadan önce Sortly'de fotoğraf eklenmiş olduğundan emin olun. |
| "Field: Renk" sütunu tanınmıyor | OneAce, `Field:` önekli sütunları özel alan olarak tanır. Sütun başlığını kontrol edin. |
| Bazı SKU'lar eksik | OneAce, boş SKU'lu satırları içe aktaramaz. CSV'yi inceleyip eksik SKU'ları doldurun. |
| Klasör hiyerarşisi korunmuyor | OneAce, "Folder Path" veya "Folder" sütununu kullanarak kategorileri oluşturur. İç içe klasörleri "/" ile ayrın. |

## OneAce'de İçe Aktarma Adımları

### Adım 1: Dosya Yükleme

1. OneAce uygulamasında **Entegrasyonlar** (Integrations) veya **Başlangıç** (Onboarding) → **Göç** (Migration) seçin.
2. **Sortly**'yi seçin.
3. **ZIP dosyasını seçin** veya sürükleyip bırakın.
4. OneAce, ZIP dosyasını işlemeye başlar.

### Adım 2: Dosya Algılama

OneAce, ZIP'in içindeki dosyaları tarar:
- ✓ `items.csv` bulundu → Başarı
- ✓ `images/` klasörü bulundu → Fotoğraflar da içe aktarılacak
- ⚠ Eksik dosya → Uyarı (işlem devam eder)

### Adım 3: Alan Eşlemesi İncelemesi

Sortly sütunlarını OneAce alanlarına eşlemek için bir form gösterilir:

```
Sortly Sütunu          →  OneAce Alanı          [Oneri Güveni]
─────────────────────────────────────────────────────
"Name"                 →  Item.name              [✓ 1.0]
"SKU"                  →  Item.sku               [✓ 1.0]
"Price"                →  Item.salePrice         [✓ 0.9]
"Field: Renk"          →  CustomField.color      [◐ 0.6]
"Field: Üretici"       →  CustomField.brand      [◐ 0.5] — manuellement
```

İhtiyaç duyarsa alanları düzenleyin veya **Devam** (Next) düğmesine tıklayın.

### Adım 4: Göç Kapsamı

Bir form size soracak:

- **Satın Alma Siparişleri**: Sortly satın alma siparişleri de varsa, bunlar hakkında ne yapmak istersiniz?
  - [ ] Hepsini ekle (ALL)
  - [ ] Son 12 ayı ekle (LAST_12_MONTHS) — *varsayılan*
  - [ ] Açık olanları ekle (OPEN_ONLY)
  - [ ] Ekleme (SKIP)

- **Özel Alanlar**: Sortly'deki özel alanları da içe aktarmak ister misiniz?
  - [x] Evet (varsayılan)

- **Fotoğraflar**: ZIP'teki fotoğrafları yüklemek ister misiniz?
  - [x] Evet (varsayılan)

**Devam** (Next) düğmesine tıklayın.

### Adım 5: Doğrulama

OneAce şunları kontrol eder:
- ✓ Tüm SKU'lar benzersiz mi?
- ✓ Gerekli alanlar doldurulmuş mu?
- ✓ Kategori döngüsü var mı?
- ✓ Fotoğraf URL'leri erişilebilir mi?

Herhangi bir **HATA** varsa, düzeltmeniz gerekir (CSV'yi yeniden yükleyin).
Herhangi bir **UYARI** varsa, devam edebilirsiniz.

**Göçü Başlat** (Start Migration) düğmesine tıklayın.

### Adım 6: İçe Aktarma Sürüyor

OneAce, 9 aşama boyunca ilerler:

```
1. Kategoriler        [████████░░] 80%
2. Tedarikçiler      [██████████] 100%
3. Depolar           [██████████] 100%
4. Lokasyonlar       [██░░░░░░░░] 20%
...
```

Bu süreci kapatmayın — tamamlanana kadar beklemeyin.

### Adım 7: Doğrulama ve Düzeltme

İçe aktarma bittiğinde, OneAce'de yeni ürünlerinizi görün:
- **Envanter** (Inventory) → **Ürünler** (Items) → Sortly ürünleri listelendiğini doğrulayın
- **Depolar** (Warehouses) → Stok seviyelerini doğrulayın
- **Entegrasyonlar** (Integrations) → **Göç Geçmişi** (Migration History) → Detayları görün

Herhangi bir sorun varsa, **Geri Al** (Rollback) düğmesini tıklayarak tüm içe aktarılan veriler silinir.

---

# Sortly Export Guide — English

**Last updated: 2026-04-17**

## How to Export from Sortly

1. **Log in** to Sortly (https://sortly.com).
2. Navigate to **Settings** → **Data** → **Export**.
3. Download the **ZIP file**, which contains:
   - `items.csv` — All product details (name, SKU, price, etc.)
   - `images/` — Product photos (named `{itemId}_photo.jpg`)

## What's in the ZIP?

| File / Folder | Purpose |
|---------------|---------|
| `items.csv` | Product table (required) |
| `images/` | Product photos (optional) |

## items.csv Columns

Sortly's standard export includes:

| Column | Required? | Maps to | Example |
|--------|-----------|---------|---------|
| **Name** | Yes | `Item.name` | "500ml Measuring Cup" |
| **SKU** | Yes | `Item.sku` | "MK-500ML-BLU" |
| **Quantity** | No | `StockLevel.quantity` | "45" |
| **Folder** | No | `Item.categoryExternalId` (folder name) | "Kitchen Supplies" |
| **Folder Path** | No | `Item.categoryExternalId` (full path) | "Home / Kitchen Supplies" |
| **Price** | No | `Item.salePrice` | "29.99" |
| **Minimum Level** | No | `Item.reorderPoint` | "10" |
| **Notes** | No | `Item.description` | "Plastic, BPA-free" |
| **Tags** | No | Custom fields | "new", "sale" |
| **Photos** | No | `RawAttachment.sourceRef` (pipe-separated) | "item_1.jpg\|item_2.jpg" |
| **Field: {customName}** | No | Custom field (user-defined) | "Color", "Manufacturer", etc. |

### Custom Field Columns

Custom fields you've defined in Sortly appear in the CSV with a `Field: ` prefix. Example:
- Sortly field **Color** → CSV column `Field: Color`
- Sortly field **Manufacturer** → CSV column `Field: Manufacturer`

OneAce auto-detects and maps these.

## Common Issues

| Problem | Solution |
|---------|----------|
| Photos missing in ZIP | Ensure photos were added in Sortly before export. |
| "Field: Color" column not recognized | OneAce recognizes columns prefixed with `Field:`. Check header spelling. |
| Some SKUs missing | OneAce requires a SKU for every item. Review the CSV and fill in missing SKUs. |
| Folder hierarchy not preserved | Use "Folder Path" or ensure folders are separated by "/". |

## OneAce Import Steps

### Step 1: Upload

1. In OneAce, go to **Integrations** or **Onboarding** → **Migration**.
2. Select **Sortly**.
3. Choose or drag-drop your **ZIP file**.
4. OneAce begins parsing the ZIP.

### Step 2: File Detection

OneAce scans the ZIP:
- ✓ `items.csv` found → Success
- ✓ `images/` folder found → Photos will be imported
- ⚠ Missing file → Warning (process continues)

### Step 3: Field Mapping Review

A form will appear mapping Sortly columns to OneAce fields:

```
Sortly Column          →  OneAce Field           [Confidence]
─────────────────────────────────────────────────────
"Name"                 →  Item.name              [✓ 1.0]
"SKU"                  →  Item.sku               [✓ 1.0]
"Price"                →  Item.salePrice         [✓ 0.9]
"Field: Color"         →  CustomField.color      [◐ 0.6]
"Field: Manufacturer"  →  CustomField.brand      [◐ 0.5] — manually
```

Edit mappings if needed, then click **Next**.

### Step 4: Scope Configuration

A form asks:

- **Purchase Orders**: If Sortly has POs, which should we import?
  - [ ] All (ALL)
  - [ ] Last 12 months (LAST_12_MONTHS) — *default*
  - [ ] Open only (OPEN_ONLY)
  - [ ] Skip (SKIP)

- **Custom Fields**: Import custom fields?
  - [x] Yes (default)

- **Photos**: Import photos from the ZIP?
  - [x] Yes (default)

Click **Next**.

### Step 5: Validation

OneAce checks:
- ✓ All SKUs unique?
- ✓ Required fields filled?
- ✓ Category cycles?
- ✓ Photo URLs reachable?

If **ERRORS** occur, fix them (re-upload the CSV).
If only **WARNINGS**, you can proceed.

Click **Start Migration**.

### Step 6: Import Running

OneAce progresses through 9 phases:

```
1. Categories        [████████░░] 80%
2. Suppliers         [██████████] 100%
3. Warehouses        [██████████] 100%
4. Locations         [██░░░░░░░░] 20%
...
```

Don't close this window — wait for completion.

### Step 7: Verify & Fix

Once done, check OneAce:
- **Inventory** → **Items** → Sortly items should appear
- **Warehouses** → Verify stock levels
- **Integrations** → **Migration History** → View details

If needed, click **Rollback** to delete all imported data.

---

## File Layout

Source code for Sortly adapter:
- `src/lib/migrations/sortly/adapter.ts` — Main adapter entry
- `src/lib/migrations/sortly/csv-parser.ts` — CSV parsing logic
- `src/lib/migrations/sortly/default-mappings.ts` — Field mapping suggestions
