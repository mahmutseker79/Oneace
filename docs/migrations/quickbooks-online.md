# QuickBooks Online Göçü (Migration) — Bilingual Guide

**Son güncellenme: 2026-04-17**

---

## QuickBooks Online'dan Veri Taşıma — Türkçe

OneAce, QuickBooks Online'dan tek seferlik veri taşımını destekler. Bu rehber adım adım nasıl yapılacağını açıklar.

### Hangi Veriler Taşınır?

- ✓ Ürünler (Items) — hizmet ve ürün türleri
- ✓ Tedarikçiler (Vendors)
- ✓ Satın Alma Siparişleri (Purchase Orders) — geçmiş veya açık
- ✓ Ürün Ekleri (Attachments) — fotoğraflar ve dosyalar
- ⚠ Kısmen desteklenen: Sub-item derinliği (1 seviye)
- ✗ Hizmet Ürünleri (Service Items) — taşınmaz
- ✗ Hesap Kalıpları (Account Settings) — kapsam dışı

### Bağlantı Seçenekleri

OneAce'de QB Online'a bağlanmanın **iki yöntemi** vardır:

#### 1. Mevcut Bağlantıyı Kullan (Hızlı)

Eğer **Entegrasyonlar** → **Muhasebe** kategorisinde zaten QuickBooks Online entegrasyonunuz varsa, göçü başlatırken aynı kimlik bilgilerini yeniden kullanabilirsiniz:

1. Göç sihirbazında **"QuickBooks Online (Göç)"** seçin
2. **"Mevcut Bağlantıyı Kullan"** seçeneğine tıklayın
3. Sihirbaz kimlik bilgisi sorulmadan devam eder

#### 2. Yeni Kimlik Bilgileri Yapıştır (Farklı Hesap)

Yeni bir QB Online hesabından veri taşımak için:

1. Göç sihirbazında **"QuickBooks Online (Göç)"** seçin
2. **"Farklı Bir QB Hesapçası Kullan"** seçeneğini tıklayın
3. Aşağıdaki bilgileri yapıştırın:
   - **Access Token** (OAuth erişim jetonu)
   - **Refresh Token** (yenileme jetonu)
   - **Realm ID** (QB Online veri tabanı kimliği)
   - **Client ID** (isteğe bağlı; hızlı yenileme için)
   - **Client Secret** (isteğe bağlı)
4. **Test Bağlantısı** tıklayın
5. Başarılıysa, devam edin

### API Kimlik Bilgilerini Alma (QuickBooks Online Developer Portal)

1. **QuickBooks Developer Portal**'a gidin: https://developer.intuit.com/
2. Hesabınızda **oturum açın**
3. **My Apps** → Mevcut uygulamayı seçin veya yeni oluşturun ("OneAce Migration")
4. **Keys & OAuth** seçeneğine tıklayın
5. Aşağıdaki değerleri kopyalayın:
   - **Client ID** (OAuth 2.0)
   - **Client Secret** (OAuth 2.0)
6. Realm ID'yi almak için:
   - **Get Realm/Organization ID** bölümünde user scope ile bir test isteği yapın
   - Yanıt JSON'ında `realmId` alanını bulun

### İleri Bağlantı: Access Token Alma (Postman veya cURL)

Eğer `Client ID` ve `Client Secret`'ınız varsa:

```bash
curl -X POST https://quickbooks.api.intuit.com/oauth2/tokens/oauth2 \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=YOUR_AUTH_CODE" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET"
```

Yanıt `access_token`, `refresh_token`, ve `x_refresh_token_expires_in` içerir.

---

## Sihirbaz Adımları

### Adım 1: Kaynak Seçimi
- **"QuickBooks Online (Göç)"** kartını seçin
- Devam et

### Adım 2: Bağlantı
- Mevcut kullanın veya yeni kimlik bilgileri yapıştırın
- Test et, başarılı olmuşsa devam

### Adım 3: Kapsam Seçenekleri
- **Ürünler**: dahil et / hariç tut
- **Tedarikçiler**: dahil et / hariç tut
- **Satın Alma Siparişleri**: 
  - `SKIP` — boş bırak
  - `OPEN_ONLY` — sadece açık olanları
  - `ALL` — tüm geçmiş dahil
- **Ekleri**: fotoğraf ve dosyaları taşı
- **Özel Alanlar**: Notlar ve kısmi veri (TBD)

### Adım 4: Ön İzleme
- OneAce tarafından bulunacak ürünler, tedarikçiler ve PO'lar listelenir
- Sorunlar varsa (ör. eksik SKU), uyarı gösterilir

### Adım 5: Başla
- **"Taşımayı Başlat"** tıklayın
- İlerleme gerçek zamanlı olarak gösterilir
- Tamamlandıktan sonra, **"Geçmişi Gör"** linkine tıklayarak sonuçları inceleyin

---

## QBO'ya Özgü Notlar

### Hız Sınırlaması
QB Online API'nin hız sınırı: **500 istek/dakika** (realm başına).

Büyük kataloglar (10.000+ ürün) taşınmak **15-30 dakika** sürebilir.

### Sub-Item Derinliği

QB Online hiyerarşik ürünleri (bundled items / assembly) destekler ama OneAce tarafından taşınan veriler şu anda **1 seviye derinlik** ile sınırlıdır:

- Parent item taşınır
- Sub-itemler bağımsız ürünler olarak eklenir
- Hiyerarşik ilişki kaybedilir (TBD gelecek versiyonda)

### Sentez Ambarlama

QB Online'ın **On Hand** inventory koşulunu (physical count) taşımak için, OneAce bir sentez ambarı (\_synthetic warehouse) oluşturur:

- Adı: `QB_Online_Inventory`
- Birincil konum: `On Hand`
- Veriler bu ambarın "On Hand" konumuna yerleştirilir

### Servis Ürünleri

QB Online'da "Hizmet" olarak işaretlenen ürünler **taşınmaz**. Neden:
- Stok takibi yoktur
- Ambar konumları uygulanmaz
- OneAce Inventory yönetimine uygunsuzdur

Hizmet bilgilerini manuel olarak taşımalısınız.

### Ek URL'lerinin Geçerliliği

QB Online, belirtim dosyalarına ait URL'leri **15 dakika** boyunca geçerli tutar. Göç sırasında, OneAce ekleri Vercel Blob'a yükler. 15 dakikalık pencereden sonra, hala indirilmemiş bir ek başarısız olursa, uyarı kaydedilir; göç devam eder.

### Token Yenileme

Access token'ınızın süresi dolmuşsa, OneAce **otomatik olarak refresh token kullanarak yenile yapmaya çalışır**. Sorun yaşanırsa:

1. Developer Portal'da yeni bir token talebinde bulunun
2. Yeni tokenları OneAce'ye yapıştırın
3. Taşımayı yeniden deneyin

---

## Hata Giderme

### "Realm ID Geçersiz"
- Realm ID'nin doğruluğunu kontrol edin
- Her QB Online hesabının kendine ait bir realm ID'si vardır
- Developer Portal'ın **Get Realm/Organization ID** alanını kullanın

### "500 - Hız Sınırı Aşıldı"
- Taşımayı duraklatın
- 1-2 dakika bekleyin
- Yeniden deneyin

### "İlişkilendirme URL'si Taşımsı Başarısız"
- Bu uyarıdır; göç devam eder
- Fotoğraflar manuel olarak yüklenmeli olabilir

---

## Ayrıca Bkz.

- `docs/migrations/quickbooks-desktop.md` — QuickBooks Desktop IIF dışa aktarımı
- `docs/migrations/README.md` — Genel göç mimarisi ve 9 fazlı işlem hattı
- `src/lib/migrations/quickbooks-online/` — Adapter kaynak kodu (API entegrasyonu)

---

---

## Migrating Data from QuickBooks Online — English

OneAce supports one-time data imports from QuickBooks Online. This guide provides step-by-step instructions.

### What Data Migrates?

- ✓ Items — products and service item types
- ✓ Vendors (Suppliers)
- ✓ Purchase Orders — historical and open
- ✓ Item Attachments — photos and documents
- ⚠ Partial support: Sub-item depth (1 level only)
- ✗ Service Items — not migrated
- ✗ Account Settings — out of scope

### Connection Methods

You have **two ways** to connect to QB Online in OneAce:

#### 1. Reuse Existing Connection (Fast)

If you already have a QuickBooks Online integration in **Integrations** → **Accounting**, you can reuse it for migration:

1. Select **"QuickBooks Online (Migration)"** in the migration wizard
2. Click **"Use my existing connection"**
3. The wizard continues without asking for credentials again

#### 2. Paste New Credentials (Different Account)

To migrate from a different QB Online account:

1. Select **"QuickBooks Online (Migration)"** in the migration wizard
2. Click **"Paste credentials for a different QBO account"**
3. Paste these fields:
   - **Access Token** (OAuth access token)
   - **Refresh Token** (OAuth refresh token)
   - **Realm ID** (QB Online database ID)
   - **Client ID** (optional; required for token refresh)
   - **Client Secret** (optional)
4. Click **"Test Connection"**
5. If successful, proceed

### Getting API Credentials (QuickBooks Developer Portal)

1. Go to **QuickBooks Developer Portal**: https://developer.intuit.com/
2. **Sign in** to your account
3. **My Apps** → Select your app or create one ("OneAce Migration")
4. Click **Keys & OAuth**
5. Copy these values:
   - **Client ID** (OAuth 2.0)
   - **Client Secret** (OAuth 2.0)
6. To get Realm ID:
   - In the **Get Realm/Organization ID** section, make a test request with user scope
   - Find `realmId` in the response JSON

### Advanced: Obtaining an Access Token (Postman or cURL)

If you have `Client ID` and `Client Secret`:

```bash
curl -X POST https://quickbooks.api.intuit.com/oauth2/tokens/oauth2 \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=YOUR_AUTH_CODE" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET"
```

The response includes `access_token`, `refresh_token`, and `x_refresh_token_expires_in`.

---

## Wizard Steps

### Step 1: Source Selection
- Select **"QuickBooks Online (Migration)"** card
- Proceed

### Step 2: Connect
- Reuse existing or paste new credentials
- Test, then proceed if successful

### Step 3: Scope Options
- **Items**: include / exclude
- **Vendors**: include / exclude
- **Purchase Orders**:
  - `SKIP` — don't import
  - `OPEN_ONLY` — only open POs
  - `ALL` — all historical
- **Attachments**: migrate photos and documents
- **Custom Fields**: notes and partial data (TBD)

### Step 4: Preview
- OneAce lists the items, vendors, and POs it will import
- Warnings appear if there are issues (e.g., missing SKUs)

### Step 5: Start
- Click **"Start Migration"**
- Progress displays in real-time
- After completion, click **"View History"** to review results

---

## QB Online Gotchas

### Rate Limiting
QB Online API limit: **500 requests/minute** (per realm).

Large catalogs (10,000+ items) may take **15–30 minutes** to migrate.

### Sub-Item Hierarchy

QB Online supports hierarchical items (bundles/assemblies), but OneAce's current migration is limited to **1 level of depth**:

- Parent item is migrated
- Sub-items become independent items
- Hierarchical relationships are lost (TBD in a future version)

### Synthetic Warehouse

To import QB Online's physical inventory (**On Hand** quantity), OneAce creates a synthetic warehouse:

- Name: `QB_Online_Inventory`
- Primary location: `On Hand`
- Data is placed in this warehouse's "On Hand" location

### Service Items

Items marked as "Service" in QB Online are **not migrated** because:
- No inventory tracking
- No warehouse locations
- Not applicable to OneAce Inventory

Migrate service info manually if needed.

### Attachment URL Expiry

QB Online keeps attachment URLs valid for **15 minutes**. During migration, OneAce uploads attachments to Vercel Blob. If an attachment cannot be downloaded within that window, a warning is logged; migration continues.

### Token Refresh

If your access token expires, OneAce **automatically attempts refresh using the refresh token**. If issues occur:

1. Request a new token from Developer Portal
2. Paste new tokens into OneAce
3. Retry the migration

---

## Troubleshooting

### "Realm ID Invalid"
- Verify the Realm ID spelling
- Each QB Online account has a unique Realm ID
- Use the Developer Portal's **Get Realm/Organization ID** field

### "500 - Rate Limit Exceeded"
- Pause the migration
- Wait 1–2 minutes
- Retry

### "Attachment URL Download Failed"
- This is a warning; migration continues
- Photos may need to be uploaded manually

---

## See Also

- `docs/migrations/quickbooks-desktop.md` — QuickBooks Desktop IIF export
- `docs/migrations/README.md` — General migration architecture and 9-phase pipeline
- `src/lib/migrations/quickbooks-online/` — Adapter source code (API integration)
