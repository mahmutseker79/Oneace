# OneAce — Figma Execution Plan

Bu döküman `docs/design-spec/` klasöründeki design spec'i Figma'ya dönüştürme
planıdır. Her faz bağımsız bir teslimat — bir faz bitmeden bir sonrakine
geçme.

---

## Figma dosya yapısı

Tek Figma dosyası: **"OneAce — Design System & Screens"**

Sayfalar (Pages) sırası:

| # | Sayfa adı            | Ne var                                   | Hazır mı?  |
|---|----------------------|------------------------------------------|------------|
| 1 | `_Cover`             | Dosya kapağı, versiyon, tarih            | Hemen yap  |
| 2 | `Tokens`             | Renk swatches, tipografi örnekleri       | Faz 1      |
| 3 | `Components / Web`   | Tüm web component'leri                   | Faz 2      |
| 4 | `Components / Mobile`| Tüm mobile component'leri                | Faz 2      |
| 5 | `Web — MVP Screens`  | Dashboard, Items, Movements, Counts...   | Faz 3      |
| 6 | `Mobile — MVP`       | Bottom nav, Scan, Count entry...         | Faz 4      |
| 7 | `Flows & Annotations`| Kullanıcı akışları + geliştirici notları | Faz 5      |
| 8 | `Archive`            | Reddedilen alternatifleri sakla          | Her zaman  |

---

## Faz 1 — Design Tokens (Figma Variables)

**Hedef:** `tokens.json` + `02-design-tokens.md` tamamen Figma Variables
paneline girilmiş olsun. Hiçbir renk veya spacing değeri hard-code
girilmeyecek.

### 1.1 Renk koleksiyonu: `oneace/light`

`tokens.json` içindeki tüm `light.*` değerleri:

| Variable adı                | Hex             | Grup                   |
|-----------------------------|-----------------|------------------------|
| `surface/page`              | `#FAFAFA`       | surface                |
| `surface/card`              | `#FFFFFF`       | surface                |
| `surface/overlay`           | `#F3F4F6`       | surface                |
| `surface/sunken`            | `#F0F0F0`       | surface                |
| `text/primary`              | `#111827`       | text                   |
| `text/secondary`            | `#6B7280`       | text                   |
| `text/muted`                | `#9CA3AF`       | text                   |
| `text/disabled`             | `#D1D5DB`       | text                   |
| `text/inverse`              | `#FFFFFF`       | text                   |
| `border/default`            | `#E5E7EB`       | border                 |
| `border/strong`             | `#9CA3AF`       | border                 |
| `border/focus`              | `#3B82F6`       | border                 |
| `action/primary`            | `#2563EB`       | action                 |
| `action/primary_hover`      | `#1D4ED8`       | action                 |
| `action/primary_text`       | `#FFFFFF`       | action                 |
| `action/secondary`          | `#F3F4F6`       | action                 |
| `action/secondary_hover`    | `#E5E7EB`       | action                 |
| `action/destructive`        | `#EF4444`       | action                 |
| `action/destructive_hover`  | `#DC2626`       | action                 |
| `status_stock/critical`     | `#B91C1C`       | status.stock           |
| `status_stock/low`          | `#D97706`       | status.stock           |
| `status_stock/normal`       | `#16A34A`       | status.stock           |
| `status_stock/high`         | `#2563EB`       | status.stock           |
| `status_stock/excess`       | `#7C3AED`       | status.stock           |
| `status_count/open`         | `#2563EB`       | status.count           |
| `status_count/in_progress`  | `#D97706`       | status.count           |
| `status_count/completed`    | `#16A34A`       | status.count           |
| `status_count/cancelled`    | `#6B7280`       | status.count           |
| `status_variance/matched`   | `#16A34A`       | status.variance        |
| `status_variance/within`    | `#2563EB`       | status.variance        |
| `status_variance/over`      | `#7C3AED`       | status.variance        |
| `status_variance/under`     | `#EF4444`       | status.variance        |
| `status_sync/online`        | `#16A34A`       | status.sync            |
| `status_sync/syncing`       | `#2563EB`       | status.sync            |
| `status_sync/offline`       | `#6B7280`       | status.sync            |
| `status_sync/error`         | `#EF4444`       | status.sync            |
| `status_sync/conflict`      | `#D97706`       | status.sync            |

### 1.2 Renk koleksiyonu: `oneace/dark`

Aynı variable adları, `tokens.json` dark.* değerleri. Her ikisini aynı
mode (light/dark) içine koy — Figma "Color variables with modes" özelliği.

### 1.3 Spacing koleksiyonu

| Variable adı | Value  |
|--------------|--------|
| `space/1`    | 4      |
| `space/2`    | 8      |
| `space/3`    | 12     |
| `space/4`    | 16     |
| `space/5`    | 20     |
| `space/6`    | 24     |
| `space/8`    | 32     |
| `space/10`   | 40     |
| `space/12`   | 48     |
| `space/16`   | 64     |

### 1.4 Tipografi styles

Her birini **Text Style** olarak kaydet, adlandırma: `scale/weight` (ör.
`body/regular`).

| Style adı           | Font       | Size | Weight | Line height | Letter sp |
|---------------------|------------|------|--------|-------------|-----------|
| `display/bold`      | Inter      | 32   | 700    | 40          | –0.5      |
| `headline/semibold` | Inter      | 24   | 600    | 32          | –0.3      |
| `title-lg/semibold` | Inter      | 20   | 600    | 28          | –0.2      |
| `title/semibold`    | Inter      | 18   | 600    | 24          | –0.2      |
| `body/regular`      | Inter      | 14   | 400    | 20          | 0         |
| `body/medium`       | Inter      | 14   | 500    | 20          | 0         |
| `label/semibold`    | Inter      | 12   | 600    | 16          | +0.2      |
| `caption/regular`   | Inter      | 11   | 400    | 16          | +0.1      |
| `numeric/semibold`  | Inter      | 14   | 600    | 20          | 0         |
| `mono_sku/regular`  | JetBrains  | 12   | 400    | 16          | 0         |

### Faz 1 teslim kriteri

- Figma Variables panelinde tüm satırlar dolu.
- Herhangi bir canvas'a Rectangle koyunca Fill olarak token seçilebiliyor.
- Dark mode toggle çalışıyor (Figma "Set mode" prototype action ile test et).

---

## Faz 2 — Component Library

Kaynak: `03-component-library.md`. Her component bir Figma Component Set
(variants). Atom'lar bitmeden molecule'e geçme.

### 2.1 Atoms (web)

| Component    | Variants / Props                                 | Notlar                              |
|--------------|--------------------------------------------------|-------------------------------------|
| **Button**   | intent×(primary/secondary/ghost/destructive), size×(sm/md/lg), state×(default/hover/pressed/disabled/loading) | Icon-left, icon-right slot          |
| **Badge**    | variant×(solid/subtle), color×(blue/amber/green/red/purple/gray) | StateBadge için renk token'ı kullan |
| **Input**    | state×(default/focused/error/disabled), size×(sm/md) | Left-icon slot                      |
| **Checkbox** | state×(unchecked/checked/indeterminate/disabled)  | —                                   |
| **Select**   | state×(default/focused/disabled)                 | Native dropdown'dan component yap   |
| **Switch**   | checked×(true/false), disabled                   | —                                   |
| **Avatar**   | size×(sm/md/lg), initials vs image               | —                                   |
| **Icon**     | Wrapper component — Lucide icon name prop        | 16/20/24px size variants            |
| **Spinner**  | size×(sm/md/lg)                                  | —                                   |
| **Tooltip**  | position×(top/bottom/left/right)                 | —                                   |

### 2.2 Atoms (mobile)

| Component       | Variants                                      |
|-----------------|-----------------------------------------------|
| **TouchButton** | Same intent variants, min 44pt touch target   |
| **TabItem**     | active×(true/false), icon+label layout        |
| **ScanReticle** | state×(idle/scanning/success/error)           |
| **HapticBadge** | Same as web Badge                             |

### 2.3 Molecules (web)

| Component       | Alt componentler                              | Açıklama                            |
|-----------------|-----------------------------------------------|-------------------------------------|
| **StateBadge**  | Badge + text                                  | COUNT_STATES için                   |
| **VarianceBadge**| Badge + signed number                        | matched/within/over/under           |
| **EmptyState**  | Icon + headline + sub + CTA                   | `05-onboarding` inventory           |
| **TableRow**    | Checkbox + cells + action menu trigger        | Dense / comfortable variant         |
| **SummaryTile** | Label + big number + trend chip               | Reconcile sayfası 6-tile grid       |
| **CountCard**   | Count name + state badge + methodology + meta | List page'deki kart                 |
| **SyncDot**     | status×(online/syncing/offline/error/conflict)| Sidebar footer + top bar            |
| **SearchInput** | Input + clear button + Cmd+K hint             | Global search trigger               |

### 2.4 Organisms (web)

| Component       | Neler içeriyor                                |
|-----------------|-----------------------------------------------|
| **Sidebar**     | Logo + nav items (role-aware visibility göster) + SyncDot + collapse btn |
| **TopBar**      | Logo/org + SearchInput + sync + user menu     |
| **DataTable**   | Header row + body rows + empty state + pagination |
| **PermissionDenied** | Icon + headline + sub + "Back to home"   |
| **ScanResultFrame** | Status color + icon + primary + secondary + actions (5 states) |

### Faz 2 teslim kriteri

- Her component **Auto Layout** kullanıyor (no fixed-position frames).
- Color/typography tamamen token referansı — sıfır hard-coded değer.
- Tüm interactive states var (hover, pressed, disabled en az).
- Component description alanında hangi React komponenti karşılık geldiği yazılı.

---

## Faz 3 — Web MVP Screens

Ekranlar sırası: önce BUILT (var olan), sonra MVP (yapılacak).

### 3.1 Shell

Önce shell'i yap, ekranlar içine otursun.

```
Desktop shell (1440px):  [Sidebar 240px] + [Main content area]
Tablet shell (1024px):   [Sidebar 56px rail] + [Main content area]
Mobile shell (390px):    [Bottom tab bar] + [Main content area]
```

Her shell için bir **master frame** oluştur. İçine Figma Component olarak
sidebar ve top bar koy — ekranlar bu frame'in içinde değişir.

### 3.2 BUILT ekranlar (var olan, belgelemek için)

Her ekran için: **1440px** (desktop) + **390px** (mobile/responsive) frame.

| Sayfa              | Route                 | Durumu   |
|--------------------|-----------------------|----------|
| Items list         | `/items`              | BUILT    |
| Locations list     | `/locations`          | BUILT    |
| Movements list     | `/movements`          | BUILT    |
| Stock counts list  | `/stock-counts`       | BUILT    |
| Count new          | `/stock-counts/new`   | BUILT    |
| Count detail       | `/stock-counts/[id]`  | BUILT    |
| Count reconcile    | `/stock-counts/[id]/reconcile` | BUILT |

**Bu ekranlar için Figma'da ne yapmalı:**
Var olan kodu referans alarak Figma'ya dokümante et — gelecekteki
geliştirici için "böyle görünüyor" referansı. Pixel-perfect olması
şart değil, layout + spacing + renk doğru olsun.

### 3.3 MVP ekranlar (tasarlanacak)

Her biri için: Default state + Empty state + Error state.

| # | Sayfa                  | Route                      | Kritik özellik                          |
|---|------------------------|----------------------------|-----------------------------------------|
| 1 | Item create            | `/items/new`               | SKU, name, unit, barcode, initial-stock |
| 2 | Item detail            | `/items/[id]`              | On-hand by location + recent movements  |
| 3 | Item edit              | `/items/[id]/edit`         | Same form, populated                    |
| 4 | CSV import             | `/items/import`            | Upload → column-map → preview → result  |
| 5 | Location create        | `/locations/new`           | Name, code, kind, parent                |
| 6 | Location detail        | `/locations/[id]`          | Stock by item card                      |
| 7 | Manual adjustment      | `/movements/new`           | Item + location + qty + reason          |
| 8 | Admin — Members        | `/admin/members`           | Member list + invite modal              |
| 9 | Admin — Audit log      | `/admin/audit`             | Timestamped log rows                    |
| 10| Reports — Stock on hand| `/reports/stock`           | Table + export                          |
| 11| Reports — Variance     | `/reports/variance`        | History table + row click               |
| 12| Reports — Movements    | `/reports/movements`       | Grouped by day/type                     |
| 13| Onboarding — Org create| `/onboarding/org`          | Org name + default warehouse auto-msg   |
| 14| Invite accept          | `/invite/[token]`          | Minimal — just accept/decline           |
| 15| Permission denied      | (overlay)                  | Lock icon + human message + back CTA    |

### 3.4 Modals

Ayrı component olarak kur, ekranlara overlay olarak bağla:

- Invite member modal
- Cancel count dialog (+ reason input)
- Delete confirm dialog (destructive)
- Org switcher dropdown

### Faz 3 teslim kriteri

- Her ekran 1440px desktop frame'de var.
- En az 3 state: Default, Empty, Error.
- Tüm renkler token referansı.
- Prototype connections: list → detail, form → success/error.

---

## Faz 4 — Mobile MVP Screens

Tüm frame'ler **390×844** (iPhone 14 base). Ayrıca tablet-portrait
**820×1180** için kritik ekranlar.

### 4.1 Shell — Bottom Tab Bar

```
[Home] [Items] [●SCAN●] [Counts] [Menu]
```

Scan butonu 64pt yükseltilmiş, farklı renk (action/primary).

### 4.2 Ekranlar

| # | Ekran                  | Platform tab | Kritik                                   |
|---|------------------------|--------------|------------------------------------------|
| 1 | Home                   | Home         | Activation tips card + active counts     |
| 2 | Items list             | Items        | Search + pull-to-refresh                 |
| 3 | Item detail            | Items (push) | Read-only — on-hand by location          |
| 4 | Scan — idle            | Scan         | Viewfinder + reticle + torch btn         |
| 5 | Scan — success         | Scan         | Green frame + item name + qty input sheet|
| 6 | Scan — not found       | Scan         | Amber frame + scanned code               |
| 7 | Scan — error           | Scan         | Red frame + enter manually CTA           |
| 8 | Count entry — list     | Counts       | Active counts assigned + tap to open     |
| 9 | Count entry — detail   | Counts       | Scan btn + entry log + add entry         |
| 10| Menu drawer            | Menu         | Movements, Locations, Settings, Sign out |
| 11| Camera permission ask  | Scan         | Pre-prompt before OS dialog              |
| 12| Offline state          | (any)        | Sync indicator + offline banner          |

### 4.3 Gestures & interactions (annotation)

`Flows & Annotations` sayfasında bir flow diagram:

- Scan tab tap → camera izin → idle state → scan → result sheet → add entry
- Counts tab → count list → tap count → count detail → scan → entry added
- Menu → Movements list

Prototype arrow + annotation notu ile yeterli. Animasyon tanımına gerek yok.

### Faz 4 teslim kriteri

- Tüm ekranlar 390px frame'de.
- Bottom tab bar active state doğru ekranda.
- Scan reticle ve result frame'leri 5 state'in hepsi var.

---

## Faz 5 — Flows & Annotations

Son faz — geliştirici handoff için.

### 5.1 User flows

Her kritik flow için bir flow frame:

1. **Onboarding flow** — Sign up → org create → empty items → add item
2. **Stock count flow** — New count → item picker → open count → scan entry → reconcile
3. **Invite flow** — Admin invites → invitee receives email → accepts → lands on role page
4. **Mobile scan flow** — Open app → scan tab → scan → count entry

### 5.2 Redline annotations

Geliştirici handoff için: spacing, breakpoint, component prop değerleri.
Figma Dev Mode'da otomatik çıkıyor ama kritik ölçüleri manuel annotation
ile işaretle (özellikle sidebar genişlikleri, touch target min 44pt).

### 5.3 Handoff notes

Her ekran frame'ine `description` alanında yaz:
- İlgili spec dosyası (ör. `06-stock-counting.md`)
- Permission key'ler (ör. `stockcount.reconcile`)
- BUILT / MVP status
- Varsa dikkat edilecek edge case

---

## Paralel iş bölümü

Sen Figma template'i hazırlarken bu alanlar paralel yürüyebilir:

| Figma (sen)                        | Kod (ben)                                     |
|------------------------------------|-----------------------------------------------|
| Faz 1 tokens setup                 | `packages/design-tokens` paketi + Tailwind    |
| Faz 2 component library            | shadcn primitive'lerin eklenmesi              |
| Faz 3 MVP ekranlar                 | `apps/web` yeni route'ların kodu             |
| Faz 4 mobile ekranlar              | `apps/mobile` Expo Router yapısı             |
| Faz 5 flows                        | API + tRPC endpoint'leri tamamlanması        |

---

## Naming convention

Figma içinde tutarlı naming kritik — component naming auto-complete'te
görünür.

| Kategori       | Format                      | Örnek                         |
|----------------|-----------------------------|-------------------------------|
| Component      | PascalCase                  | `StateBadge`, `DataTable`     |
| Variant prop   | camelCase                   | `intent`, `isDisabled`        |
| Variant value  | kebab-case                  | `primary`, `in-progress`      |
| Frame (screen) | Route-based                 | `web/items/list`              |
| Layer (genel)  | kebab-case                  | `card-body`, `action-row`     |
| Color token    | `domain/name`               | `action/primary`              |
| Text token     | `scale/weight`              | `body/regular`                |

---

## Figma dosya versiyonlama

- **MVP v0.1** — Sadece Tokens + Atoms.
- **MVP v0.2** — Molecules + Organisms.
- **MVP v0.3** — Web screens (BUILT belgelenmiş).
- **MVP v1.0** — Tüm MVP ekranlar + flows. Bu versiyon code freeze'den 2
  hafta önce hazır olmalı (≈ 2026-06-19).

Her milestone'da Figma "Version history" ile kaydet: `v0.1 — Tokens complete`.

---

## Önemli kurallar

1. **Sıfır hard-coded renk.** Tek istisna: `#000000` ve `#FFFFFF` değerleri
   Figma'nın kendi interface'inde — canvas'a koyduğun her şey token.
2. **Component kullan, detach etme.** Bir component'i detach edip
   override yapmak yerine variant ekle.
3. **Auto Layout'u kırma.** Absolute positioning sadece overlay (modal,
   tooltip, dropdown) için.
4. **Mobile frame'e desktop içerik koyma.** Her screen tek platform için.
5. **Archive sayfası çöp kutusu değil.** Sadece "neden reddedildi"
   notunu taşıyan alternatifleri koy.
