# SOS Inventory Göçü (Migration) — Türkçe Kılavuz

**Son güncellenme: 2026-04-17**

## OAuth Kurulumu

SOS Inventory, QuickBooks hesabıyla entegre olur. OneAce, OAuth aracılığıyla kimlik doğrulaması yaparak verilerinize erişir.

### Adım 1: OAuth Uygulamasını Kaydedin

TBD — SOS Inventory geliştirici portalı ayrıntıları pending.

### Adım 2: Token Yapıştırın veya OAuth İzni Verin

1. OneAce → **Entegrasyonlar** (Integrations) → **Göç** (Migration) → **SOS Inventory**
2. **OAuth Aracılığıyla Bağlan** (Connect via OAuth) düğmesine tıklayın
3. SOS Inventory hesabınızda oturum açın
4. OneAce'e izin verin
5. Otomatik olarak OneAce'e yönlendirileceksiniz

Alternatif: Eğer zaten bir token varsa, **Manuel Token Yapıştır** (Paste Token) seçin.

---

## QuickBooks Örtüşmesi Uyarısı

Eğer OneAce hesabınız **zaten QuickBooks entegrasyonuna** sahipse:

- SOS Inventory ve QuickBooks her ikisi de aynı SKU'ları kullanabilir
- Çakışma varsa, OneAce **çakışma algılaması** (conflict detection) uyarır
- Hangi verinin kaynağı olduğunu seçmeniz gerekebilir

Sorunu çözmek için operasyon ekibine başvurun.

---

## Veri Kapsamı

SOS Inventory'den hangi veriler içe aktarılır?

- ✓ Ürünler (Items)
- ✓ Tedarikçiler (Suppliers)
- ✓ Depolar (Warehouses)
- ✓ Stok Seviyeleri (Stock Levels)
- ✓ Satın Alma Siparişleri (Purchase Orders) — scope ayarına göre
- ✗ Özel Alanlar (Custom Fields) — TBD
- ✗ Ürün Resimleri (Product Photos) — TBD

---

# SOS Inventory Export Guide — English

**Last updated: 2026-04-17**

## OAuth Setup

SOS Inventory connects via QuickBooks. OneAce authenticates via OAuth to access your data.

### Step 1: Register OAuth Application

TBD — SOS Inventory developer portal details pending.

### Step 2: Authorize or Paste Token

1. OneAce → **Integrations** → **Migration** → **SOS Inventory**
2. Click **Connect via OAuth**
3. Log in to your SOS Inventory / QuickBooks account
4. Authorize OneAce
5. Automatically redirected back to OneAce

Alternative: If you already have a token, select **Paste Token** manually.

---

## QuickBooks Overlap Warning

If your OneAce account **already has QuickBooks integration**:

- Both SOS Inventory and QuickBooks use the same SKUs
- If conflicts exist, OneAce **detects them** and warns
- You may need to choose which source is authoritative

Contact operations if conflicts occur.

---

## Data Scope

What data is imported from SOS Inventory?

- ✓ Products (Items)
- ✓ Suppliers
- ✓ Warehouses
- ✓ Stock Levels
- ✓ Purchase Orders (conditional on scope)
- ✗ Custom Fields — TBD
- ✗ Product Photos — TBD

---

## File Layout

Source code for SOS Inventory adapter:
- `src/lib/migrations/sos-inventory/adapter.ts` — Main adapter
- `src/lib/migrations/sos-inventory/api-client.ts` — SOS + QuickBooks API client
- `src/lib/migrations/sos-inventory/default-mappings.ts` — Field suggestions
