# Cin7 Core Göçü (Migration) — Türkçe Kılavuz

**Son güncellenme: 2026-04-17**

## API Anahtarı Oluşturma

### Adım 1: Cin7 Geliştirici Portalında Kayıt Olun

1. **Cin7 Web Sitesine** gidin: https://cin7.com
2. Hesabınızda **oturum açın**
3. **Ayarlar** (Settings) → **Entegrasyon** (Integration) → **API**

### Adım 2: Kimlik Bilgilerini Alın

1. **Hesap Kimliği** (Account ID):
   - Ayarlar → **Profil** → "Cin7 Account ID" öğesini kopyalayın
   - Örn: `12345`

2. **API Anahtarı** (Application Key):
   - Ayarlar → **Entegrasyon** → **API** → **Yeni Uygulama Ekle** (Add New Application)
   - Uygulama adı: "OneAce Migration"
   - **Perms**: İzinler seçin:
     - ✓ Products (Read)
     - ✓ Suppliers (Read)
     - ✓ Warehouses (Read)
     - ✓ Stock Levels (Read)
     - ✓ Purchase Orders (Read)
   - **Oluştur** (Create) tıklayın
   - **Application Key** (gizli anahtar) öğesini kopyalayın
   - Örn: `abc-def-ghi-jkl`

### Adım 3: OneAce'de API Yöntemi Seçin

1. OneAce → **Entegrasyonlar** (Integrations) → **Göç** (Migration) → **Cin7 Core**
2. **Hesap Kimliğini** (Account ID) yapıştırın
3. **Uygulama Anahtarını** (Application Key) yapıştırın
4. **Bağlantıyı Test Et** (Test Connection) tıklayın
5. Başarılıysa, devam edin

---

## Hız Sınırlaması

Cin7 API'nin hız sınırlaması: **60 istek / dakika** (10.000 ürüne kadar).

Büyük dışa aktarmalar zaman alabilir.

---

## Veri Kapsamı

Cin7'den hangi veriler içe aktarılır?

- ✓ Ürünler (Items)
- ✓ Tedarikçiler (Suppliers)
- ✓ Depolar (Warehouses)
- ✓ Stok Seviyeleri (Stock Levels)
- ✓ Satın Alma Siparişleri (Purchase Orders) — scope ayarına göre
- ✗ Özel Alanlar (Custom Fields) — TBD
- ✗ Ürün Resimleri (Product Photos) — TBD

---

# Cin7 Core Export Guide — English

**Last updated: 2026-04-17**

## Generate API Credentials

### Step 1: Access Cin7 Developer Portal

1. Go to **Cin7**: https://cin7.com
2. **Log in** to your account
3. **Settings** → **Integration** → **API**

### Step 2: Get Credentials

1. **Account ID**:
   - Settings → **Profile** → Copy "Cin7 Account ID"
   - Example: `12345`

2. **Application Key**:
   - Settings → **Integration** → **API** → **Add New Application**
   - App name: "OneAce Migration"
   - **Permissions**: Select:
     - ✓ Products (Read)
     - ✓ Suppliers (Read)
     - ✓ Warehouses (Read)
     - ✓ Stock Levels (Read)
     - ✓ Purchase Orders (Read)
   - Click **Create**
   - Copy **Application Key** (secret)
   - Example: `abc-def-ghi-jkl`

### Step 3: Use in OneAce

1. OneAce → **Integrations** → **Migration** → **Cin7 Core**
2. Paste **Account ID**
3. Paste **Application Key**
4. Click **Test Connection**
5. If success, proceed

---

## Rate Limit

Cin7 API rate limit: **60 requests / minute** (up to 10,000 items).

Large migrations may take several minutes.

---

## Data Scope

What data is imported from Cin7?

- ✓ Products (Items)
- ✓ Suppliers
- ✓ Warehouses
- ✓ Stock Levels
- ✓ Purchase Orders (conditional on scope)
- ✗ Custom Fields — TBD
- ✗ Product Photos — TBD

---

## File Layout

Source code for Cin7 adapter:
- `src/lib/migrations/cin7/adapter.ts` — Main adapter
- `src/lib/migrations/cin7/api-client.ts` — Cin7 API v2 client
- `src/lib/migrations/cin7/default-mappings.ts` — Field suggestions
