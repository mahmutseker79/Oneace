# OneAce — 12 Haftalık MVP Yol Haritası

**Doküman sahibi:** Mahmut Şeker
**Oluşturulma:** 2026-04-11
**MVP hedef tarihi:** 2026-07-03 (12 hafta / ~84 gün)
**Mevcut kod tabanı:** https://github.com/mahmutseker79/oneace (Vite + React 18 + shadcn/ui, 4 commit, son commit 2026-04-10)
**Konumlanma:** Sortly ve inFlow Inventory'den daha basit, daha hızlı ve offline çalışan envanter SaaS'ı.

---

## 1. Yönetici Özeti

OneAce, KOBİ ve orta ölçekli işletmeler için envanter yönetim SaaS'ı. Rakiplerden (Sortly, inFlow) dört somut alanda ayrışıyor:

1. **Offline-first çoklu kullanıcı stok sayımı** — inFlow'un bile yarım bıraktığı, sahada paralel sayım + çakışma çözümü.
2. **Hızlı barkod/QR tarama UX'i** — Sortly seviyesi, tarayıcı-native, sürekli tarama modu + tek elle kullanım.
3. **Çok depo + bin seviyesi transferler** — inFlow'un karmaşık bıraktığı yerde 3 adımlık sihirbaz.
4. **Satın alma + tedarikçi yönetimi** — otomatik yeniden sipariş eşikleri, gelen mal ile auto-receipt.

12 haftada bu dört alanın hepsinde "rakipten iyi" seviyesine çıkmak agresif. Bu sebeple plan **haftalık sprintler**, **net scope**, ve **her sprintin doğrulanmış bir çıktı (demoable)** prensibi üzerine kurulu.

**En büyük mimari karar (ADR-001):** Mevcut Vite + React repo'suyu **Next.js 15 App Router'a port ediyoruz**. Tasarım katmanı (shadcn components, view'lar, theme.css, ikonlar) aynen korunuyor — "mevcut template yapısını bozmayacak" ilkesi burada *UI/UX* seviyesinde geçerli. Shell değişiyor, içerik değişmiyor.

---

## 2. ADR-001: Vite → Next.js 15 Port Kararı

**Bağlam**
- Mevcut GitHub repo'sunda 96+ `.tsx` dosyası, 48 shadcn/ui component'i, tema dosyaları ve view iskeletleri mevcut — bunlar Figma'dan Make/Anima ile export edilmiş, kaliteli ve tutarlı.
- Backend tercihi **Next.js API + Prisma + Postgres** oldu. Bu, mevcut Vite SPA üzerine ikinci bir Next.js servisi eklemek ya da her şeyi Next.js'e taşımak arasında bir seçim zorluyor.
- "Mevcut template yapısını bozmayacak şekilde" kullanıcı ilkesi — tasarım ve bileşen katmanı için geçerli, altyapı shell'i için değil.

**Karar**
Mevcut Vite reposunu **donduruyoruz** ("oneace-design-seed" olarak referans) ve paralelde yeni bir Next.js 15 App Router projesi başlatıyoruz. Tüm UI component'leri (ui/, atoms/, molecules/, view'lar), `styles/`, `theme.css`, `lucide-react` ikon kullanımı **birebir** port ediliyor.

**Neden Vite'tan Next.js'e geçiyoruz**
- Backend ve frontend tek kod tabanında: Next.js API routes + Prisma, ayrı servis yok.
- Server Components + streaming ile "Items" listesi gibi büyük tablo sayfalarında ilk ekran hızı 2-3x iyileşiyor.
- Vercel tek tık deploy, Neon ile aynı bölge.
- Next PWA plugin'i ile service worker hazır.
- shadcn/ui ve Tailwind 4 her iki ortamda aynı — port maliyeti düşük.

**Port'un taşıyacağı beklenen maliyet**
- **Sprint 0'da 5 iş günü** yeterli: `app/layout.tsx` + `app/page.tsx` iskelet, `components/` kopyala, import yolları düzelt (`figma:asset/*` gibi özel imleri temizle), `main.tsx` → `layout.tsx` bootstrapping, theme.css global import, next.config metadata.
- Mevcut `App.tsx`'teki client-side router → Next.js App Router dosya-tabanlı routing'e dönüşecek. Her view (`DashboardView`, `InventoryListView` vs.) bir route segment'i olacak.

**Sonuçlar**
- ✅ Kod tabanı tek, deploy tek, auth aynı yerde.
- ✅ Tasarım katmanı %100 korunuyor — figma tasarımlarının hiçbir pikseli bozulmuyor.
- ❌ Sprint 0'ın tamamı port işine gidiyor (özellik eklemiyoruz). Risk: geç kalırsak Sprint 1'e sarkar.
- ❌ Vite'ın hızlı HMR'ı yerine Next.js dev server (biraz daha yavaş ama yönetilebilir).

**Alternatifler (reddedildi)**
- **Vite SPA + ayrı Fastify API:** İki deploy hedefi, iki kod tabanı, CORS, auth senkronizasyonu. +1 hafta iş.
- **Remix:** Next.js kadar ekosistem yok, PWA ve shadcn kombini Next.js'te daha yerleşik.
- **Vite'ta kalıp Next.js API routes proxy:** Next.js'i sadece API için kullanmak mantıksız, SSR avantajını kaybederiz.

---

## 2b. ADR-002: Branch Strategy for the Port (decided 2026-04-11)

**Status:** Accepted. Executed in `oneace-next/GIT_WORKFLOW.md`.

**Context**
ADR-001 replaces the Vite shell with a Next.js 15 shell while preserving the
UI layer. That rewrite touches nearly every file in the repo and spans 12
weekly sprints. It is risky to run directly on `main` (breaks Vercel previews
for the old Figma template that Mahmut still references, and makes every
"save point" a push to production). It is equally risky to run the port as a
throwaway directory beside the repo (loses git history, breaks continuous
deployment on merge).

**Decision**
Use a **long-lived `next-port` integration branch** off `main`, tracked by a
**draft pull request** that stays open until MVP launch on 2026-07-03.

1. Tag the current `main` (Vite + Figma template) as `v0-figma-template`
   before any destructive work. This tag is the permanent reference for the
   visual source of truth.
2. Create `next-port` from `main` and drop the Next.js scaffold onto it in
   place of the Vite source (the port is a full shell replacement, not a
   sibling — see ADR-001).
3. Open the branch as a **draft PR against `main`**. The draft status stops
   accidental merges and signals "work in progress" to any collaborator.
4. Each sprint pushes commits to `next-port`. The draft PR updates
   automatically, Vercel builds preview deploys on every push, CI runs
   `pnpm typecheck && pnpm biome check .` on every push.
5. Tag each sprint boundary (`sprint-0-complete`, `sprint-1-complete`, etc.)
   so sprint-over-sprint diffs are one `git diff` away.
6. Merge `next-port` into `main` with `--no-ff` on 2026-07-03, tag `v1.0.0`,
   delete the branch.

**Why this over the alternatives**

| Option | Rejected because |
|---|---|
| **Keep working on `main` directly** | Every commit becomes a production push. Breaks the Figma reference for weeks. No isolated preview environment. |
| **Monorepo with `apps/web-vite` + `apps/web-next`** | Maintaining two builds for 12 weeks is pure tax. ADR-001 already decided Next.js replaces Vite. |
| **Delete the Vite repo, start a fresh one** | Loses git history, loses the v0 reference, loses the original Figma intent that the design-spec docs reference. |
| **Feature branches per sprint, merged to main weekly** | Weekly merges mean weekly reviews of a half-built app. The product is not shippable until Sprint 12 — pretending otherwise invites premature merges. |

**Consequences**
- ✅ `main` stays clean and continues to reflect the Figma template until launch day — any reviewer can check out `main` and still see what the original design intended.
- ✅ Vercel preview deployments for `next-port` give a shareable URL for every commit, which we need once beta testers get involved in Sprint 11.
- ✅ Sprint tags (`sprint-N-complete`) give retrospective tooling: `git diff sprint-2-complete sprint-4-complete -- src/app/(app)/items` shows exactly what changed in the Items feature over two sprints.
- ❌ The draft PR will be enormous at merge time (12 weeks of commits). Mitigation: merge as a merge commit, not a squash, so the sprint history survives on `main`.
- ❌ Merge conflicts from `main` are possible if any hotfix lands there. Unlikely — `main` is frozen to the Figma template — but the workflow doc covers the merge-from-main recipe.

**Runbook**
The exact sequence of commands lives in [`oneace-next/GIT_WORKFLOW.md`](oneace-next/GIT_WORKFLOW.md).
That file is authoritative; this section is the "why" and stays short.

> **Why the initial commits came from a runbook and not the sandbox:** the
> environment the Sprint 0 scaffold was built in couldn't finalize git writes
> (stuck index lock on the mounted filesystem). Mahmut runs the commands in
> `GIT_WORKFLOW.md` locally so the initial commits are signed with his own
> identity anyway — this is the correct long-term setup.

---

## 3. Teknoloji Yığını

| Katman | Seçim | Gerekçe |
|---|---|---|
| **Frontend shell** | Next.js 15 (App Router, RSC) | SSR + API routes, shadcn uyumlu, Vercel |
| **Dil** | TypeScript 5.5+ strict | Mevcut repo zaten TS |
| **UI kit** | shadcn/ui (mevcut 48 component'ten port) | Template'ten direkt geliyor |
| **Styling** | Tailwind CSS 4 + theme.css (port) | Mevcut tema korunuyor |
| **Icon** | `lucide-react` 0.487 + `@mui/icons-material` | package.json'da zaten var |
| **Chart** | `recharts` 2.15 | Analytics view'ları için mevcut |
| **Form** | `react-hook-form` + `zod` | package.json'da var |
| **Data fetching** | TanStack Query v5 (client) + RSC fetch (server) | Online/offline ikiz strateji |
| **Client state** | Zustand (UI state) + TanStack Query (server state) | Basit, düşük boilerplate |
| **ORM** | Prisma 5 | Postgres için endüstri standardı |
| **Veritabanı** | **Neon Postgres** (branch'leme özelliği dev için altın) | Serverless, Vercel'e bitişik |
| **Auth** | Better Auth (veya Auth.js v5) | Magic link + e-posta/şifre + RBAC |
| **Offline** | Dexie.js (IndexedDB wrapper) + `next-pwa` service worker | Stok sayım moat'ı için zorunlu |
| **Barkod tarama** | `BarcodeDetector API` (native, Chromium) + `@zxing/browser` fallback (Safari/iOS) | Dual strategy |
| **Validation** | Zod (client + server shared schemas) | Tek kaynak |
| **Deploy** | Vercel (app) + Neon (DB) + UploadThing/R2 (ürün görselleri) | En az bakım |
| **Error tracking** | Sentry | Erken uyarı |
| **Analitik** | PostHog (ürün telemetrisi) | Funnel ve retention |
| **Test** | Vitest (unit) + Playwright (e2e) + Storybook (UI katalog — opsiyonel) | |
| **CI/CD** | GitHub Actions → Vercel | Her PR preview deploy |

---

## 4. Veri Modeli (Prisma outline, MVP)

```prisma
// Tenant & kullanıcı
model Organization {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  plan        Plan     @default(FREE)
  createdAt   DateTime @default(now())
  warehouses  Warehouse[]
  items       Item[]
  memberships Membership[]
}

model User {
  id          String   @id @default(cuid())
  email       String   @unique
  name        String?
  memberships Membership[]
}

model Membership {
  id             String       @id @default(cuid())
  userId         String
  organizationId String
  role           Role         @default(MEMBER) // OWNER, ADMIN, MANAGER, MEMBER, VIEWER
  user           User         @relation(fields: [userId], references: [id])
  organization   Organization @relation(fields: [organizationId], references: [id])
  @@unique([userId, organizationId])
}

// Depo & bin
model Warehouse {
  id             String       @id @default(cuid())
  organizationId String
  name           String
  code           String       // kısa kod, transfer ekranlarında
  address        String?
  bins           Bin[]
  organization   Organization @relation(fields: [organizationId], references: [id])
  @@unique([organizationId, code])
}

model Bin {
  id          String    @id @default(cuid())
  warehouseId String
  code        String    // A-01-03
  label       String?
  warehouse   Warehouse @relation(fields: [warehouseId], references: [id])
  @@unique([warehouseId, code])
}

// Ürün & kategori
model Category {
  id             String   @id @default(cuid())
  organizationId String
  name           String
  parentId       String?
  parent         Category? @relation("CategoryTree", fields: [parentId], references: [id])
  children       Category[] @relation("CategoryTree")
  items          Item[]
}

model Item {
  id             String   @id @default(cuid())
  organizationId String
  sku            String
  name           String
  description    String?
  categoryId     String?
  unit           String   @default("adet") // adet, kg, litre...
  imageUrl       String?
  reorderPoint   Int?     // PO otomasyonu için
  reorderQty     Int?
  customFields   Json?    // esnek alanlar
  barcodes       Barcode[]
  stockLevels    StockLevel[]
  movements      StockMovement[]
  countLines     StockCountLine[]
  poLines        PurchaseOrderLine[]
  category       Category? @relation(fields: [categoryId], references: [id])
  organization   Organization @relation(fields: [organizationId], references: [id])
  @@unique([organizationId, sku])
  @@index([organizationId, name])
}

model Barcode {
  id     String @id @default(cuid())
  itemId String
  value  String
  type   String @default("EAN13") // EAN13, CODE128, QR, CUSTOM
  item   Item   @relation(fields: [itemId], references: [id])
  @@unique([value])
}

// Stok seviyeleri & hareketler
model StockLevel {
  id          String    @id @default(cuid())
  itemId      String
  warehouseId String
  binId       String?
  quantity    Decimal   @default(0)
  reserved    Decimal   @default(0) // PO / transfer rezervasyonu
  updatedAt   DateTime  @updatedAt
  item        Item      @relation(fields: [itemId], references: [id])
  warehouse   Warehouse @relation(fields: [warehouseId], references: [id])
  @@unique([itemId, warehouseId, binId])
  @@index([warehouseId])
}

model StockMovement {
  id             String           @id @default(cuid())
  organizationId String
  itemId         String
  type           MovementType     // RECEIPT, ISSUE, TRANSFER_OUT, TRANSFER_IN, ADJUSTMENT, COUNT
  quantity       Decimal
  fromWarehouseId String?
  toWarehouseId   String?
  reference      String?          // PO-123, COUNT-456 vs
  note           String?
  performedBy    String           // userId
  occurredAt     DateTime         @default(now())
  item           Item             @relation(fields: [itemId], references: [id])
  @@index([organizationId, occurredAt])
  @@index([itemId, occurredAt])
}

// Stok sayımı (offline-first moat)
model StockCount {
  id             String             @id @default(cuid())
  organizationId String
  warehouseId    String
  name           String             // "Nisan 2026 tam sayım"
  status         CountStatus        @default(DRAFT) // DRAFT, IN_PROGRESS, RECONCILING, CLOSED
  startedAt      DateTime?
  closedAt       DateTime?
  createdBy      String
  sessions       StockCountSession[]
  lines          StockCountLine[]
}

model StockCountSession {
  id           String           @id @default(cuid())
  countId      String
  userId       String
  deviceId     String           // client-generated, offline için kritik
  startedAt    DateTime         @default(now())
  lastSyncAt   DateTime?
  count        StockCount       @relation(fields: [countId], references: [id])
  lines        StockCountLine[]
}

model StockCountLine {
  id              String            @id @default(cuid())
  clientId        String            @unique // offline cihazda üretilen UUID
  countId         String
  sessionId       String
  itemId          String
  binId           String?
  countedQty      Decimal
  systemQtyAtScan Decimal?          // çakışma raporu için snapshot
  scannedAt       DateTime
  deviceTs        DateTime          // cihaz saati
  serverTs        DateTime          @default(now())
  conflictState   ConflictState     @default(OK) // OK, DUPLICATE, STALE, RESOLVED
  count           StockCount        @relation(fields: [countId], references: [id])
  session         StockCountSession @relation(fields: [sessionId], references: [id])
  item            Item              @relation(fields: [itemId], references: [id])
  @@index([countId, itemId])
}

// Satın alma
model Supplier {
  id             String   @id @default(cuid())
  organizationId String
  name           String
  email          String?
  phone          String?
  taxId          String?
  paymentTerms   String?  // "Net 30"
  orders         PurchaseOrder[]
}

model PurchaseOrder {
  id          String              @id @default(cuid())
  organizationId String
  number      String              // PO-2026-0001
  supplierId  String
  warehouseId String               // gelen mal için
  status      POStatus            @default(DRAFT) // DRAFT, SENT, PARTIAL, RECEIVED, CANCELLED
  orderDate   DateTime            @default(now())
  expectedAt  DateTime?
  total       Decimal?
  createdBy   String
  lines       PurchaseOrderLine[]
  supplier    Supplier            @relation(fields: [supplierId], references: [id])
  @@unique([organizationId, number])
}

model PurchaseOrderLine {
  id           String @id @default(cuid())
  orderId      String
  itemId       String
  orderedQty   Decimal
  receivedQty  Decimal @default(0)
  unitPrice    Decimal
  order        PurchaseOrder @relation(fields: [orderId], references: [id])
  item         Item          @relation(fields: [itemId], references: [id])
}

// Audit
model AuditLog {
  id             String   @id @default(cuid())
  organizationId String
  userId         String
  action         String   // "item.update", "stock.adjust"
  entityType     String
  entityId       String
  diff           Json?
  createdAt      DateTime @default(now())
  @@index([organizationId, createdAt])
}

enum Plan { FREE PRO BUSINESS }
enum Role { OWNER ADMIN MANAGER MEMBER VIEWER }
enum MovementType { RECEIPT ISSUE TRANSFER_OUT TRANSFER_IN ADJUSTMENT COUNT }
enum CountStatus { DRAFT IN_PROGRESS RECONCILING CLOSED }
enum ConflictState { OK DUPLICATE STALE RESOLVED }
enum POStatus { DRAFT SENT PARTIAL RECEIVED CANCELLED }
```

**Kritik tasarım notları:**
- `StockCountLine.clientId` = offline-first için can damarı. Cihazda üretilen UUID, sunucuya geldiğinde `@@unique` ile idempotent.
- `StockLevel` için `@@unique([itemId, warehouseId, binId])` → tek ürün + depo + bin = tek satır, race condition'lar transaction ile çözülür.
- Tüm ürün miktarları `Decimal` (kg, litre gibi ondalık birimler için). Int kullanmak sonradan migration zorlar.
- `Item.customFields Json` → kullanıcıya "özel alan ekle" özgürlüğü, inFlow'un yapmadığı esneklik.
- `AuditLog` day 1'den zorunlu — hem compliance hem de debug için.

---

## 5. Rekabet Teşhisi: Sortly vs inFlow vs OneAce

| Alan | Sortly | inFlow | **OneAce (hedef)** |
|---|---|---|---|
| **Barkod tarama hızı** | ⭐⭐⭐⭐ (sürekli mod var) | ⭐⭐ (tek tek) | ⭐⭐⭐⭐⭐ (native API + ses+titreşim + auto +1) |
| **Offline çalışma** | ⭐⭐ (sınırlı) | ⭐⭐ (mobil var, çakışma zayıf) | ⭐⭐⭐⭐⭐ (çoklu kullanıcı, çakışma raporu) |
| **Multi-warehouse** | ⭐ (Pro'da ekstra) | ⭐⭐⭐ (var ama karmaşık) | ⭐⭐⭐⭐ (3 adımlık sihirbaz, in-transit) |
| **PO / Tedarikçi** | ❌ (yok) | ⭐⭐⭐ (var, UX eski) | ⭐⭐⭐⭐ (auto-reorder + receipt flow) |
| **Özel alanlar** | ⭐⭐⭐⭐ (ana güç) | ⭐⭐ | ⭐⭐⭐⭐ (Json schema) |
| **Görsel envanter** | ⭐⭐⭐⭐⭐ (ana güç) | ⭐ | ⭐⭐⭐ (MVP'de yeterli) |
| **Fiyat (KOBİ)** | Yüksek (tier atlamak pahalı) | Orta | **Düşük tier stratejisi** |
| **Türkçe desteği** | ❌ | Kısmen | ⭐⭐⭐⭐⭐ (doğal Türkçe UX) |
| **Basit onboarding** | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ (5 dakikada ilk ürün) |

**OneAce pozisyon sloganı:** "Sortly'nin basitliği + inFlow'un gücü — tek uygulamada, Türkçe, çevrimdışı çalışır."

---

## 6. 12 Haftalık Sprint Planı

Her sprint **1 hafta** (Pazartesi-Cuma + hafta sonu buffer). Her sprintin sonunda **deployable artifact** + **demo video** çıkar.

### Sprint 0 — Kurulum & Port (Hafta 1: 14-20 Nisan)
**Hedef:** Next.js iskelet ayakta, mevcut shadcn/ui ve view'lar portlanmış, auth + DB bağlı, ilk deploy Vercel'de canlı.

Teslimatlar:
- `apps/web` (veya root) Next.js 15 App Router kurulumu
- `components/ui/*` kopyala (48 dosya) + `components/atoms|molecules` port
- `styles/theme.css` global import
- `prisma/schema.prisma` ilk sürüm + `prisma migrate dev`
- Neon Postgres bağlantısı (dev + prod branch)
- Better Auth kurulumu, `/login` + `/register` çalışıyor
- `app/(app)/dashboard/page.tsx` — mevcut `DashboardView` port
- Vercel deploy, ilk preview URL
- GitHub Actions CI (lint + typecheck + prisma validate)

**Done criteria:** Giriş yap → dashboard'u gör → logout. Tüm tipler yeşil, build yeşil.

---

### Sprint 1 — Data Model + CRUD I (Hafta 2: 21-27 Nisan)
**Hedef:** Organization, Warehouse, Category, Item temel CRUD'ı. Mevcut `InventoryListView`, `AddItemView`, `CategoriesView`, `WarehousesView` port edilip gerçek verilere bağlanıyor.

Teslimatlar:
- `app/(app)/warehouses/*` route'ları, CRUD
- `app/(app)/categories/*` route'ları, ağaç yapısı
- `app/(app)/items/page.tsx` + `app/(app)/items/new/page.tsx` + `app/(app)/items/[id]/page.tsx`
- Server actions (Next.js 15) ile form submitleri
- Zod şemalar shared (`packages/schemas` veya `src/schemas`)
- Basit pagination + server-side search (Postgres `ILIKE` + `pg_trgm` ileride)
- Organization multi-tenancy: her sorguda `organizationId` middleware

**Done criteria:** Yeni kullanıcı → depo oluştur → kategori → ürün ekle → listede gör.

---

### Sprint 2 — Stock Levels + Barkod Altyapısı (Hafta 3: 28 Nisan-4 Mayıs)
**Hedef:** Her ürün için depo başı stok seviyesi, manuel adjustment, barkod ekleme/atama.

Teslimatlar:
- `StockLevel` CRUD + `StockMovement` log
- `app/(app)/items/[id]/stock/page.tsx` — "bu ürün hangi depoda kaç adet"
- Barkod CRUD (1 ürüne N barkod) + duplicate kontrol
- `lib/scanner/barcode-detector.ts` — BarcodeDetector API wrapper + zxing fallback
- `components/scanner/LiveScanner.tsx` — component wrapper (Sprint 3'te UX'i cilalanacak)
- Movement listesi sayfası (audit için)

**Done criteria:** Ürüne barkod ekle, manuel adjustment yap, movement log'da gör.

---

### Sprint 3 — Barkod UX Moat (Hafta 4: 5-11 Mayıs)
**Hedef:** **İlk moat teslimatı.** Sortly seviyesi barkod tarama deneyimi.

Teslimatlar:
- `/scan` sayfası (PWA tam ekran) — mevcut `ScannerView` port + iyileştirme
- Sürekli tarama modu: her tarama otomatik +1, duplicate 2 saniye cooldown
- Ses + titreşim feedback (başarı/başarısız için farklı ton)
- "Bilinmeyen barkod" → hızlı yeni ürün oluşturma bottom sheet
- Tarama geçmişi (son 20) offline cache
- Tek elle kullanım için large buttons (thumb zone)
- Hedef: 15 fps stabil tarama, 80ms altı feedback

**Done criteria:** Telefon tarayıcısında 30 ürünü 90 saniyenin altında tarayabiliyor musun? Evet → done.

---

### Sprint 4 — Stock Movements + Basit Transfer (Hafta 5: 12-18 Mayıs)
**Hedef:** Depolar arası ürün transferi, in-transit durum.

Teslimatlar:
- `app/(app)/movements/transfer/new/page.tsx` — 3 adımlık wizard (kaynak → ürünler → hedef)
- Transfer sırasında `StockLevel` atomik update (Prisma `$transaction`)
- In-transit virtual depo (sistem oluşturur)
- `MovementsView` port + transfer filtresi
- Adjustment reason code'ları (kırık, sayım farkı, iade, kayıp)

**Done criteria:** Depo A'dan Depo B'ye 10 adet X ürünü transfer et, her iki depodaki stok doğru güncellendi.

---

### Sprint 5 — Offline Stok Sayımı v1 (Hafta 6: 19-25 Mayıs)
**Hedef:** **İkinci moat teslimatı.** Offline çoklu kullanıcı stok sayımı.

Teslimatlar:
- Dexie.js schema: `pendingCountLines`, `cachedItems`, `syncQueue`
- `next-pwa` service worker + network-first stratejisi
- `app/(app)/counts/new/page.tsx` — yeni sayım başlat, katılımcıları seç
- `app/(app)/counts/[id]/scan/page.tsx` — sayım modu scanner (ScannerView + sayım state'i)
- Offline kayıt → Dexie → online olunca background sync
- Sunucuda `clientId` unique constraint ile idempotent insert
- **Çakışma stratejisi v1**: son-yazan-kazanır + çakışma raporu (`conflictState`)
- Yönetici için "çakışma dashboard'u": aynı ürünü 2 kişi farklı miktar saymışsa manuel karar

**Done criteria:** 2 telefonda offline mod → ikisi de aynı deponun ürünlerini saysın → ikisi de online olsun → tüm sayımlar tek ekranda görünsün, çakışmalar işaretlensin.

---

### Sprint 6 — Multi-Warehouse + Bin Level (Hafta 7: 26 Mayıs-1 Haziran)
**Hedef:** **Üçüncü moat teslimatı.** Bin seviyesi stok, transferlerde bin desteği.

Teslimatlar:
- Bin CRUD + depo detayında bin ızgarası
- `StockLevel.binId` kullanımı → ürünler bin'e atanabiliyor
- Bin transfer (depo içi hareket)
- Bin sayımı (Sprint 5 sayımına bin filtresi)
- `WarehousesView` port + bin hiyerarşi UI'ı
- Barkod etiketli bin'ler (PDF basılabilir)

**Done criteria:** A-01-03 bin'ine 5 adet ürün koy, tara, doğru bin'de görünüyor.

---

### Sprint 7 — Satın Alma + Tedarikçi (Hafta 8: 2-8 Haziran)
**Hedef:** **Dördüncü moat teslimatı.** PO + tedarikçi + gelen mal + auto-reorder.

Teslimatlar:
- `app/(app)/suppliers/*` CRUD
- `app/(app)/purchase-orders/*` PO oluşturma + satır ekleme + ürün seçici
- PO durum makinesi: DRAFT → SENT → PARTIAL → RECEIVED
- PO PDF export (jsPDF + Türkçe desteği)
- Gelen mal ekranı (`/purchase-orders/[id]/receive`) → otomatik `StockMovement` (RECEIPT)
- Auto-reorder: `Item.reorderPoint` tetiklenince dashboard uyarısı + tek tıkla PO taslağı
- E-posta gönderimi (Resend + React Email) — PO'yu tedarikçiye gönder

**Done criteria:** Tedarikçi ekle → PO oluştur → PDF indir → gelen mal gir → stok arttı → auto-reorder eşiği altında ürün varsa dashboard uyarısı göster.

---

### Sprint 8 — Raporlama & Dashboard (Hafta 9: 9-15 Haziran)
**Hedef:** Yöneticinin "ne oluyor" sorusuna 10 saniyede cevap.

Teslimatlar:
- Mevcut `DashboardView` ve `AnalyticsView` port + gerçek veriye bağlama
- KPI kartları: toplam değer, düşük stok sayısı, haftalık hareket, en çok hareket eden 10 ürün
- `recharts` ile stok trend grafikleri (30/90 günlük)
- `ReportsView` port: sayım raporu, hareket raporu, PO raporu
- Excel export (`xlsx` paketi ya da server-side streaming)
- PDF export (sayım raporu için kritik)

**Done criteria:** 3 saniyede dashboard yüklensin. 3 rapor Excel'e aktarılabilsin.

---

### Sprint 9 — Rol, İzin, Audit (Hafta 10: 16-22 Haziran)
**Hedef:** Takım kullanımı güvenli.

Teslimatlar:
- Mevcut `UsersView` + `PermissionGates` port
- Rol tabanlı middleware: sadece MANAGER+ adjustment yapabilir, VIEWER sadece okuyabilir
- Kullanıcı davet sistemi (e-posta ile, Better Auth)
- `AuditLog` her mutation'da otomatik (Prisma middleware)
- Audit log görüntüleyici (`/settings/audit`)
- 2FA (TOTP) opsiyonel
- GDPR: "verilerimi indir" + "hesabımı sil" akışları

**Done criteria:** Yeni kullanıcı davet et → rol ata → izinsiz işlem denesin → reddedilsin. Audit log'da tüm denemeler görünsün.

---

### Sprint 10 — PWA Cilası + Performans (Hafta 11: 23-29 Haziran)
**Hedef:** Kullanıcı "bu uygulama hızlı" desin.

Teslimatlar:
- Lighthouse audit → hedef: Performance 90+, PWA 100, A11y 95+
- Route-based code splitting kontrolü
- Image optimizations (`next/image`, UploadThing optimizasyonu)
- IndexedDB cache stratejisi revize (Dexie query'leri)
- Service worker: offline fallback sayfası, güncelleme bildirimi
- PWA install prompt + ikon + splash (mevcut tasarımdan üret)
- Mobil touch target audit (44px minimum)
- Boş durum (empty state) ekranları + ilk kullanıcı rehberi

**Done criteria:** iPhone Safari'de PWA olarak kurulabiliyor, offline açılıyor, Lighthouse skorları hedefe ulaştı.

---

### Sprint 11 — Test + Beta + Bug Bash (Hafta 12: 30 Haziran-2 Temmuz)
**Hedef:** Ürün launch'a hazır.

Teslimatlar:
- Playwright e2e testleri: 10 kritik akış (signup → warehouse → item → count → report)
- Vitest unit coverage: kritik lib'ler (stok hesaplama, conflict resolution, barcode parser) %80+
- 5 beta kullanıcı daveti (gerçek KOBİ) → onboarding feedback
- Hata log'ları Sentry'ye bağlı, ilk hafta sıcak izleme
- Rate limit + brute force koruması (Upstash Redis)
- `engineering:deploy-checklist` skill'iyle pre-launch checklist
- Yedekleme stratejisi: Neon point-in-time restore + günlük export

**Done criteria:** 5 beta kullanıcıdan 3'ü en az 1 tam sayım yapmış, kritik bug yok, Sentry error rate < 1%.

---

### Sprint 12 — Launch (3 Temmuz — deadline günü)
**Hedef:** Ürünü duyur.

Teslimatlar:
- Landing page (marketing skill ile içerik)
- Fiyatlama sayfası (3 tier: FREE, PRO, BUSINESS)
- Stripe entegrasyonu (sadece abonelik; ileride)
- Dokümantasyon sitesi (Nextra veya basit /docs)
- SEO: sitemap, robots.txt, og:image
- Launch duyurusu: LinkedIn, Product Hunt teaser, Türkiye'deki KOBİ forumları
- İlk 10 müşteriye "ücretsiz kurulum desteği" kampanyası

---

## 7. Moat Özellik Spec'leri (detay)

### 7.1 Offline Çoklu-Kullanıcı Stok Sayımı

**Problem:** Bir depoda 5 kişi aynı anda sayım yapıyor. İnternet kopuk. Herkes kendi bölümünü sayıyor. Online olunca her şey doğru birleşmeli.

**Çözüm katmanları:**
1. **Client-side ID üretimi:** Her `StockCountLine` için `clientId = ulid()` (cihazda). Sunucu `@@unique(clientId)` ile idempotent.
2. **Dexie queue:** Offline sayımlar `pendingCountLines` tablosunda, `syncStatus: 'pending' | 'synced' | 'conflict'`.
3. **Background sync:** Service worker `sync` event + fallback polling (5 saniye). Network dönünce batch POST (`/api/counts/[id]/sync`, 100'er satır).
4. **Çakışma türleri:**
   - **DUPLICATE:** Aynı `clientId` daha önce gelmiş → no-op.
   - **STALE:** `deviceTs`, sunucudaki son closing event'inden önce → uyarı, "sayım kapandı".
   - **DIVERGENT:** Aynı ürün + bin 2 kullanıcıdan farklı miktar → her ikisini sakla, yöneticiye "çakışma raporu"nda göster. Çözüm: yönetici bir tanesini seçer (`conflictState = RESOLVED`).
5. **UI için çakışma dashboard'u:** `/counts/[id]/conflicts` — her satırda iki/üç cihazın verdiği sayılar yan yana + "kabul et" tıklaması.
6. **Sayım kapanışı:** Yönetici "sayım bitti" dediğinde tüm çakışmalar çözülmek zorunda → toplu `StockMovement (type=COUNT)` oluşur, stok seviyeleri güncellenir, audit'e yazılır.

**Neden inFlow'dan daha iyi:** inFlow tek kullanıcı odaklı, çakışma stratejisi "son gönderen kazanır" — sahada çok sayıcı olduğunda veri kaybı riski var. OneAce tüm sayımları saklayıp görünür çakışma çözümü sunuyor.

---

### 7.2 Hızlı Barkod Tarama UX

**Hedef metrikler:**
- Tarama-to-feedback: **<100 ms**
- Sürekli mod FPS: **15+**
- 30 ürün sayma süresi: **<90 saniye** (Sortly'de 120+)
- Tek elle kullanılabilir: %100

**Teknik yaklaşım:**
- `BarcodeDetector` API (Chromium/Android) ana yol → 10-15x daha hızlı çünkü native
- `@zxing/browser` fallback (Safari/iOS) → biraz daha yavaş ama çalışıyor
- `lib/scanner/index.ts` tek interface ile her ikisini soyutlar

**UX detayları:**
- Tarayıcı tam ekran (PWA standalone mode), kamera ortada geniş görüş alanı
- Alt kısımda büyük sayı kartı: "+1 eklendi: Mavi Mouse • stok: 47"
- Ses: başarı `beep_high.mp3` (80ms), hata `beep_low.mp3` (200ms), duplicate `beep_soft.mp3`
- `navigator.vibrate([50])` başarıda, `[100, 50, 100]` hatada
- Duplicate cooldown: aynı barkod 2 saniye içinde yeniden okunursa yok sayılır (kart kırmızı yanıp söner)
- "Bilinmeyen barkod" modal'ı → 2 alan (isim + miktar), "Oluştur ve say" butonu, <5 saniyede kapanıyor
- Tarama geçmişi sağ üstte rozet: son 20 tarama, dokunarak "geri al"
- Başparmak bölgesinde: pause/resume, close, flash toggle

**Sortly'yi nasıl geçeriz:** Sortly native app. Biz PWA'yız. Ama BarcodeDetector API native'e çok yakın. Sortly'de her tarama için "ekle" dokunuşu gerekiyor; biz otomatik +1. Bu tek karar 30 ürünlük sayımda 60+ dokunuş tasarrufu.

---

### 7.3 Çok Depo + Transfer Sihirbazı

**Mevcut inFlow problemi:** 5 ekranlı transfer formu, kullanıcı kayboluyor.

**OneAce 3 adımlı:**
1. **Kaynak depo + ürünler:** Sol sütun depolar listesi, sağda barkod tarama veya arama → çoklu seçim
2. **Hedef depo + miktarlar:** Her ürün için ayrı miktar (varsayılan: tümü), bin hedefi opsiyonel
3. **Onay + yollamak:** Özet kartı, tek butonla onay, in-transit'e düşüyor

Transfer **in-transit** durumunda iken:
- Kaynak stokunda `reserved` olarak görünür, satılamaz
- Hedef depoda "beklenen" olarak rozet
- Alıcı "teslim alındı" dediğinde `TRANSFER_IN` hareket oluşur, hedef stok artar
- 7 gün teslim alınmazsa yöneticiye uyarı

---

### 7.4 PO + Auto-Reorder

**Otomatik sipariş akışı:**
1. `Item.reorderPoint` belirlenir (örn: 10). Altına düşen ürünler dashboard'da rozet.
2. Yönetici "eksik ürünleri topla" → her ürün için önceki tedarikçiye göre gruplanmış PO taslakları
3. Tek tıkla onay → e-posta tedarikçiye gitti (Resend + React Email şablonu)
4. Tedarikçi e-posta'ya cevap verince manuel "gelen mal" ekranı (ya da Sprint 7 sonrası QR code ile self-service)
5. Gelen mal girişi → otomatik `StockMovement (RECEIPT)` + `PO.receivedQty` güncellenir
6. `receivedQty === orderedQty` olunca PO → `RECEIVED` durumu

**Bir özellik inFlow'un hiç yapmadığı:** **Fiyat geçmişi** — her ürün için son 10 PO fiyatı görünür, yöneticiye pazarlık gücü.

---

## 8. Risk Registry

| # | Risk | Olasılık | Etki | Azaltma |
|---|---|---|---|---|
| R1 | Vite → Next.js port'u Sprint 0'da bitmezse | Orta | Yüksek | Sprint 0 scope'unu **sadece** port + auth ile sınırla. Feature eklemeyi Sprint 1'e ertele. |
| R2 | Offline çakışma stratejisi kenar durumlarda yanlış | Orta | Çok Yüksek | Sprint 5 e2e testlerinde 2 cihaz simülasyonu, Playwright multi-context |
| R3 | BarcodeDetector iOS Safari'de yok | Yüksek | Orta | zxing-js fallback Sprint 2'de hazır, iOS device test zorunlu |
| R4 | 4 moat alanı aynı anda agresif → scope creep | Yüksek | Yüksek | Her sprintin **sadece bir** moat dokunması, diğerleri "parça" |
| R5 | Neon connection limit (serverless) | Düşük | Orta | Prisma Data Proxy veya `connection_limit=1` + pgBouncer |
| R6 | Beta kullanıcı bulunamazsa | Orta | Yüksek | Sprint 8'de ağ çalışması başlasın, Türkiye KOBİ LinkedIn grupları |
| R7 | Stripe entegrasyonu deadline'ı yer | Orta | Düşük | MVP'de opsiyonel, launch sonrası 1-2 hafta buffer |
| R8 | Vercel serverless timeout (10s default) | Düşük | Orta | Ağır işleri (bulk sync, rapor export) background job'a al (Inngest/Trigger.dev) |
| R9 | Mahmut tek geliştirici → hastalık/kesinti | Orta | Yüksek | Haftalık buffer günü (Pazar), sprintler %80 kapasite planlanmış |
| R10 | Tasarım vs geliştirme arasında çatışma | Düşük | Orta | Mevcut repo zaten tasarlanmış, "ADR-001" disiplini ile yeni kararlar belgelensin |

---

## 9. Başarı Kriterleri (MVP Definition of Done)

**Ürün kriterleri:**
- [ ] Yeni kullanıcı 5 dakikada kayıt → ilk depo → ilk 3 ürün → ilk sayım başlat
- [ ] 30 ürünlük offline sayım telefonda 90 saniyenin altında
- [ ] 2 cihazda paralel sayım → sunucuda doğru birleşiyor
- [ ] Depo A → Depo B transfer 3 adımda tamamlanıyor
- [ ] PO oluştur → PDF → tedarikçiye e-posta → gelen mal → stok güncelleniyor
- [ ] Dashboard 3 saniyede yükleniyor (Lighthouse test)

**Teknik kriterleri:**
- [ ] TypeScript strict mode, 0 `any` (test dışında)
- [ ] Prisma migration chain clean, rollback denenmiş
- [ ] Playwright e2e suite yeşil (10+ kritik akış)
- [ ] Lighthouse Performance ≥90, PWA 100, A11y ≥95
- [ ] Sentry error rate <1% son 48 saat
- [ ] Vercel deploy otomasyonu, preview per PR

**İş kriterleri:**
- [ ] En az 5 beta kullanıcı 1 tam sayım yapmış
- [ ] Landing + pricing + docs canlı
- [ ] "Ücretsiz kurulum desteği" CTA aktif
- [ ] Türkçe i18n tam

---

## 10. Bu Hafta Başlanacak: Sprint 0 Detaylı Görev Listesi

**Pazartesi (14 Nisan)**
1. Yeni Next.js 15 projesini oluştur: `pnpm create next-app oneace-app --typescript --tailwind --app --src-dir`
2. GitHub'da yeni repo veya mevcut oneace repo'suna `app/` branch'i
3. Neon Postgres hesap + `oneace-dev` projesi
4. `.env` şablonu: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`
5. Prisma init + ilk migration (sadece `User`, `Organization`, `Membership`)

**Salı (15 Nisan)**
6. Better Auth kurulumu (e-posta/şifre + magic link)
7. `/login`, `/register` sayfaları — mevcut `LoginView`, `RegisterView` port
8. Middleware: kimlik kontrolü + organization scope
9. shadcn/ui init: `npx shadcn@latest init` → tema mevcut `theme.css`'ten

**Çarşamba (16 Nisan)**
10. Mevcut repo'dan `src/app/components/ui/` → yeni repo'ya kopyala (48 dosya)
11. Import yollarını düzelt (`@/components/ui/...`)
12. `styles/theme.css`, `styles/fonts.css` port + `app/layout.tsx`'te global import
13. `figma:asset/*` gibi özel import'ları temizle veya gerçek dosyalara bağla

**Perşembe (17 Nisan)**
14. Layout shell: mevcut `Sidebar`, `Header`, `BottomNavigation` port
15. `app/(app)/layout.tsx` → app shell
16. `app/(app)/dashboard/page.tsx` → mevcut `DashboardView` port (şimdilik statik data)
17. Route navigation denemesi

**Cuma (18 Nisan)**
18. Vercel projesi bağla → ilk deploy
19. GitHub Actions: lint + typecheck + prisma validate
20. `README.md` güncellenir: kurulum, .env, dev
21. Hafta sonu: iOS Safari + Chrome mobile smoke test

**Cuma end-of-day demo:** "Kayıt ol → giriş → dashboard" akışı canlı URL'de çalışıyor.

---

## 11. Kullanılacak Skill'ler ve Nerede

| Skill | Nerede |
|---|---|
| `engineering:architecture` | ADR-001 ve sonraki ADR'ler için (data model v2, offline sync v2) |
| `engineering:system-design` | Offline sync mimarisi (Sprint 5), bin hiyerarşisi (Sprint 6) |
| `engineering:code-review` | Her PR öncesi, özellikle auth ve stok mutation kodları |
| `engineering:testing-strategy` | Sprint 11 öncesi test planı |
| `engineering:deploy-checklist` | Launch öncesi (Sprint 12) |
| `product-management:write-spec` | Her moat özelliği için detaylı PRD (Sprint 3, 5, 6, 7) |
| `product-management:sprint-planning` | Her sprint öncesi pazartesi 30 dakikalık kick-off |
| `design:design-critique` | Sprint sonu build'lerde UX geri bildirim |
| `design:accessibility-review` | Sprint 10'da A11y audit |
| `marketing:seo-audit` + `marketing:campaign-plan` | Sprint 12 launch öncesi |
| `marketing:draft-content` | Landing + fiyatlama + docs |
| `data:build-dashboard` | Sprint 8 analytics |
| `xlsx` | Rapor export özellikleri (Sprint 8) |
| `docx` / `pdf` | PO PDF şablonu + sayım raporu PDF |

---

## 12. Açık Kararlar (ilerleyen haftalarda netleşecek)

1. **Fiyatlama tier'ları** (Sprint 8-9): FREE kaç ürün? PRO nedir? BUSINESS?
2. **i18n stratejisi:** next-intl mi react-i18next mi? İlk dil Türkçe, ikinci İngilizce.
3. **Ürün görselleri depolama:** UploadThing mı Cloudflare R2 mı? Maliyet karşılaştırması Sprint 1 sonunda.
4. **Stripe mi Iyzico mu?** Türkiye ödemelerinde Iyzico + Stripe ikili desteği düşünülebilir.
5. **Mobil native app?** Post-MVP. Kullanıcı talebi gelirse Expo ile yeniden değerlendirilir.

---

**Son söz:** 12 hafta sıkı ama ulaşılabilir. Her sprintin sonunda **çalışan bir şey** ve **demo** olması kritik. Scope'u koru, moat'ları sırayla hallet, beta kullanıcıyı erken çağır.

Deadline: **2026-07-03**.
