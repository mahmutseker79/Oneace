# QuickBooks Desktop IIF Göçü — Bilingual Guide

**Son güncellenme: 2026-04-17**

---

## QuickBooks Desktop'tan Veri Taşıma — Türkçe

OneAce, QuickBooks Desktop'tan **IIF dosyası (Interchange File Format)** yoluyla veri taşımayı destekler. Bu rehber QBD'dan dışa aktarma ve OneAce'ye içe aktarma işlemini açıklar.

### Hangi Veriler Taşınır?

IIF dosya yapısına bağlı olarak:

- ✓ Ürünler (INVITEM blokları) — mal, depolanan mallar
- ✓ Tedarikçiler (VEND blokları)
- ✓ Satın Alma Siparişleri (TRNS/SPL blokları) — hızlı PO taşıması
- ✓ Özel Alanlar (CUSTFLD blokları) — kullanıcı tanımlı alanlar (seçim olarak)
- ✗ Hizmet Ürünleri — IIF'de desteklenmiyor
- ✗ Özel Profitler — taşınmaz

### QBD'dan IIF Dosyası Dışa Aktarma

#### Adım 1: QuickBooks Desktop'u Açın

1. QuickBooks Desktop uygulamasını açın
2. İçe aktarmak istediğiniz şirket dosyasını seçin (File → Open Company)

#### Adım 2: Lists'i İIF Olarak Dışa Aktarın

1. **File** menüsüne tıklayın
2. **Utilities** → **Export** → **Lists to IIF Files** seçin
3. Dışa aktarılacak veri seçin:
   - ☐ Chart of Accounts
   - ☑ Items (Ürünler) — **işaretleyin**
   - ☑ Vendors (Tedarikçiler) — **işaretleyin**
   - ☐ Customers
   - ☐ Classes
4. **Export** tıklayın
5. Dosya adını girin (ör: `inventory_export.iif`)
6. Kaydet

#### Adım 3: Hareket Verilerini (Transactions) Dışa Aktarın [İsteğe Bağlı]

Satın Alma Siparişlerini taşımak için:

1. **File** → **Utilities** → **Export** → **Transactions to IIF Files**
2. Tarih aralığı seçin (ör: "Last 12 Months")
3. Hareket türü seçin: **Purchase Orders**
4. Export tıklayın
5. Dosya adını girin (ör: `po_export.iif`)

---

## IIF Dosyasını OneAce'ye Yükleme

### Adım 1: OneAce Göç Sihirbazını Başlat

1. OneAce'de **Entegrasyonlar** → **Rakipten Göç / Migration** bölümünde **QuickBooks Desktop (Göç)** kartını seçin
2. Veya doğrudan **Göçler** (Migrations) → **Yeni Göç Başlat** → **QuickBooks Desktop** seçin

### Adım 2: IIF Dosyasını Yükle

1. **"Dosya Yükle"** (Upload File) alanına tıklayın
2. Bilgisayarınızdan `.iif` dosyasını seçin
3. (İsteğe bağlı) Hareket (transactions) IIF'i de ekleyin
4. **"Dosya Yüklendi"** (File Uploaded) durumunu görün

### Adım 3: Kapsam Seçenekleri

- **Ürünleri Ekle**: dahil et / hariç tut
- **Tedarikçileri Ekle**: dahil et / hariç tut
- **Satın Alma Siparişleri**: 
  - `SKIP` — boş bırak
  - `OPEN_ONLY` — sadece açık PO'lar
  - `ALL` — tüm geçmiş
- **Özel Alanları Ekle** (Custom Fields): Dışa aktarılan CUSTFLD blokları kullanılır
- **Ekler**: OneAce'de uygulanamaz (IIF'de desteklenmiyor)

### Adım 4: Eşleme ve Ön İzleme

- OneAce, QBD'daki alan isimlerini OneAce şemasına otomatik eşler
- Sorunlar (ör. geçersiz tarihler, eksik SKU'lar) uyarı olarak listelenir
- **"Başla"** tıklayın

### Adım 5: Taşıma Tamamlanma

- İlerleme gerçek zamanlı görüntülenir (9 faza kadar)
- Tamamlandıktan sonra **"Geçmişi Gör"** tıklayarak sonuçları inceleyin

---

## QBD'ya Özgü Notlar

### Karakter Kodlaması (Charset)

QuickBooks Desktop'un **Windows-1252** karakter kodlaması (Western European) kullanır. OneAce otomatik olarak UTF-8'e dönüştürür:

- Özel karakterler (ö, ü, ş, vb.) doğru şekilde çevrilir
- Kimse tarafından tanınmayan karakterler `?` olarak işaretlenir

Sorun yaşanırsa, QBD'daki veriyi ASCII (A-Z, 0-9, boşluk) olarak temizleyin.

### Ad-Kimliği Kararlılığı

IIF dosyasında, ürünler ve tedarikçiler **ad** tarafından tanımlanır (INVITEM NAME, VEND NAME). Bu kritiktir:

- `Name` değeri değişirse, OneAce bunu **farklı bir kayıt** olarak görür
- Göç sırasında veya sonrasında QBD'da adı değiştirmeyin
- Referential integrity, ürün-tedarikçi bağlantılarını çözer

### QBXML Desteği (Secondaire)

Bazı QBD kurulumları **Web Connector** aracılığıyla **QBXML** biçiminde veri döndürebilir. OneAce şu anda:

- IIF'e temel destek: ✓
- QBXML'e kısmi destek: ⚠ Stubbed (hazırlanmış)
- Tam QBXML: TBD (gelecek versiyon)

IIF yöntemi **daha güvenilir**. Tavsiye: IIF kullanın.

### Sıfır Stok ve Olumsuz Miktarlar

QBD, "On Hand" stok seviyelerine izin verir:

- `0` (stok yok) — taşınır
- Negatif (ör: `-5`) — taşınır ama uyarı olarak işaretlenir

Yüksek olumsuz miktarlar (ör: `-1000`) taşıma öncesinde QBD'da düzeltilmeli.

### Tarih Alanları

IIF'deki tarihler **MM/DD/YYYY** biçimdedir. OneAce otomatik olarak ISO 8601'e (YYYY-MM-DD) dönüştürür:

- `02/14/2024` → `2024-02-14`
- Geçersiz tarihler (ör: `02/30/2024`) **uyarı** olarak işaretlenir; satır atlanır

### Hizmet Ürünleri

QBD'daki "Service" türü ürünler IIF'de `InvItem` türü olarak dışa aktarılmaz. Çünkü:
- OneAce Inventory'de stok takibi gerekir
- Hizmetlerin ambar konumları yoktur

Hizmetleri manuel olarak ekleyin veya OneAce'de PO'lar olarak kaydı yapın.

### Özel Alanlar (CUSTFLD)

QBD'daki özel alanlar (user-defined fields):

- İIF'de `CUSTFLD` blokları olarak taşınabilir
- OneAce otomatik olarak `CustomFieldDefinition` + değerler oluşturur
- Tür çıkarımı: `Text`, `Number`, `Date` (IIF'de TBD)

---

## Hata Giderme

### "IIF Dosyası Geçersiz"
- Dosyanın `.iif` uzantısı olduğundan emin olun (`.iif` değil `_export.txt`)
- QBD 2020 veya daha yeni sürümünden dışa aktar
- Kodlamanın Windows-1252 olduğundan emin olun

### "Ad Çift"
- QBD'da ürün veya tedarikçi adı çift mi?
- OneAce tarafından bir hata bildirilirse, QBD'daki adı benzersiz yapın

### "Tarih Alanı Geçersiz"
- İIF'deki tarihi kontrol edin (MM/DD/YYYY biçim)
- Geçersiz tarihler (ör: 2/30/2024) atlanır

### "Eşleme Başarısız"
- IIF yapısının OneAce şemasıyla uyumlu olduğundan emin olun
- Göç günlüğünde ayrıntılı hata mesajı görüntüleyin

---

## Ayrıca Bkz.

- `docs/migrations/quickbooks-online.md` — QuickBooks Online OAuth taşıması
- `docs/migrations/README.md` — Genel göç mimarisi ve 9 fazlı işlem hattı
- `src/lib/migrations/quickbooks-desktop/` — Adapter kaynak kodu (IIF ayrıştırıcı)

---

---

## Migrating Data from QuickBooks Desktop — English

OneAce supports one-time imports from QuickBooks Desktop using **IIF files (Interchange File Format)**. This guide covers exporting from QBD and importing into OneAce.

### What Data Migrates?

Depending on the IIF file structure:

- ✓ Items (INVITEM blocks) — goods, inventory items
- ✓ Vendors (VEND blocks)
- ✓ Purchase Orders (TRNS/SPL blocks) — fast PO migration
- ✓ Custom Fields (CUSTFLD blocks) — user-defined fields (optional)
- ✗ Service Items — not supported in IIF
- ✗ Custom Profits — not migrated

### Exporting IIF File from QBD

#### Step 1: Open QuickBooks Desktop

1. Launch the QuickBooks Desktop application
2. Select the company file you want to export (File → Open Company)

#### Step 2: Export Lists as IIF

1. Click the **File** menu
2. Select **Utilities** → **Export** → **Lists to IIF Files**
3. Choose the data to export:
   - ☐ Chart of Accounts
   - ☑ Items — **check this**
   - ☑ Vendors — **check this**
   - ☐ Customers
   - ☐ Classes
4. Click **Export**
5. Enter a filename (e.g., `inventory_export.iif`)
6. Save

#### Step 3: Export Transactions (Optional)

To migrate Purchase Orders:

1. **File** → **Utilities** → **Export** → **Transactions to IIF Files**
2. Select a date range (e.g., "Last 12 Months")
3. Choose transaction type: **Purchase Orders**
4. Click Export
5. Enter a filename (e.g., `po_export.iif`)

---

## Uploading IIF File to OneAce

### Step 1: Start the Migration Wizard

1. In OneAce, go to **Integrations** → **Rakipten Göç / Migration** and select the **QuickBooks Desktop (Migration)** card
2. Or directly: **Migrations** (Göçler) → **Start New Migration** → **QuickBooks Desktop**

### Step 2: Upload IIF File

1. Click **"Upload File"** field
2. Select the `.iif` file from your computer
3. (Optional) Add a transactions IIF file as well
4. See **"File Uploaded"** status

### Step 3: Scope Options

- **Include Items**: include / exclude
- **Include Vendors**: include / exclude
- **Purchase Orders**:
  - `SKIP` — don't import
  - `OPEN_ONLY` — open POs only
  - `ALL` — all historical
- **Include Custom Fields**: Use exported CUSTFLD blocks
- **Attachments**: Not applicable (not supported in IIF)

### Step 4: Mapping & Preview

- OneAce automatically maps QBD field names to OneAce schema
- Issues (e.g., invalid dates, missing SKUs) are listed as warnings
- Click **"Start"**

### Step 5: Migration Completes

- Progress displays in real-time (up to 9 phases)
- After completion, click **"View History"** to review results

---

## QBD Gotchas

### Character Encoding (Charset)

QuickBooks Desktop uses **Windows-1252** encoding (Western European). OneAce automatically converts to UTF-8:

- Special characters (ö, ü, ş, etc.) are correctly translated
- Unrecognized characters are marked as `?`

If issues occur, clean QBD data to ASCII (A-Z, 0-9, space).

### Name-as-ID Stability

In IIF files, items and vendors are identified by **name** (INVITEM NAME, VEND NAME). This is critical:

- If the `Name` value changes, OneAce sees it as a **different record**
- Never rename in QBD during or after migration
- Referential integrity resolves product-vendor links

### QBXML Support (Secondary)

Some QBD setups can return data via **Web Connector** in **QBXML** format. OneAce currently:

- IIF support: ✓ Full
- QBXML support: ⚠ Stubbed
- Full QBXML: TBD (future version)

IIF method is **more reliable**. Recommendation: Use IIF.

### Zero and Negative Stock

QBD allows "On Hand" stock levels to be:

- `0` (no stock) — migrates
- Negative (e.g., `-5`) — migrates but marked as warning

High negative quantities (e.g., `-1000`) should be corrected in QBD before migration.

### Date Fields

Dates in IIF are in **MM/DD/YYYY** format. OneAce automatically converts to ISO 8601 (YYYY-MM-DD):

- `02/14/2024` → `2024-02-14`
- Invalid dates (e.g., `02/30/2024`) are marked as warning; row skipped

### Service Items

Service-type items in QBD are not exported as `InvItem` in IIF because:
- OneAce Inventory requires stock tracking
- Services don't have warehouse locations

Add services manually or record POs in OneAce.

### Custom Fields (CUSTFLD)

User-defined fields in QBD:

- Can migrate as `CUSTFLD` blocks in IIF
- OneAce automatically creates `CustomFieldDefinition` + values
- Type inference: `Text`, `Number`, `Date` (TBD in IIF)

---

## Troubleshooting

### "IIF File Invalid"
- Ensure file has `.iif` extension (not `_export.txt`)
- Export from QB 2020 or newer
- Ensure encoding is Windows-1252

### "Name Duplicate"
- Does the IIF have duplicate product or vendor names?
- If OneAce reports an error, make the name unique in QBD

### "Date Field Invalid"
- Check date in IIF (MM/DD/YYYY format)
- Invalid dates (e.g., 2/30/2024) are skipped

### "Mapping Failed"
- Verify IIF structure is compatible with OneAce schema
- View detailed error message in migration log

---

## See Also

- `docs/migrations/quickbooks-online.md` — QuickBooks Online OAuth migration
- `docs/migrations/README.md` — General migration architecture and 9-phase pipeline
- `src/lib/migrations/quickbooks-desktop/` — Adapter source code (IIF parser)
