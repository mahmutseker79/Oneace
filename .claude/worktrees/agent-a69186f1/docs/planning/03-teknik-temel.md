# Teknik Temel — Karar Kaydı, Repo İskeleti ve Sprint 0

**Proje kod adı:** (henüz yok — `OneAce 2` değil, yeni marka)
**Tarih:** 2026-04-10
**Durum:** Onaylandı (stack kilitli)
**Sahibi:** Mahmut Şeker

---

## 0 — Yönetici Özeti

Ürün: inFlow detayını Sortly basitliğiyle birleştiren, mobil + web hibrit envanter SaaS. MVP 12 haftada, SMB'ye ölçeklenen.

Stack (kilitli): **Next.js 15 + Expo SDK 52 + Turborepo + tRPC + Drizzle + Supabase Postgres + WatermelonDB + shadcn/ui + NativeWind.**

Bu döküman üç şey yapar: (1) stack kararını gerekçeleriyle donar, (2) monorepo iskeletini tarif eder, (3) Sprint 0 (bootstrap) görev listesini verir.

---

## 1 — ADR-001: Platform Stack Kararı

### Bağlam

- Ürün: Sortly basitliğinde, inFlow detayında hibrit envanter SaaS.
- Kritik kanallar: web dashboard (SMB, masaüstü, 10k+ SKU tablo) + mobil uygulama (saha, barkod tarama, offline).
- Dil: Day 1 TR/EN/DE/ES/FR/AR (RTL dahil).
- Ekip: solo dev (Mahmut) + AI eş-programcı (Claude).
- Ufuk: 3-5 yıl.
- Önceki deneyim: Flutter/Riverpod/Hive (OneAce, 754 test).

### Değerlendirilen Alternatifler

| # | Alternatif | Ağırlıklı Skor /10 |
|---|---|---|
| A | **Next.js 15 + Expo SDK 52 (React/TS monorepo)** | **8.75** |
| B | Flutter (web + mobil, OneAce devamı) | 7.75 |
| C | PWA-only (Next.js + Service Worker) | 7.85 |
| D | SvelteKit + Capacitor | 6.95 |

Detaylı skor tablosu ve kriter ağırlıkları için: bkz. konuşma karar özeti (2026-04-10).

### Karar

**Alternatif A seçildi: Next.js 15 App Router + Expo SDK 52 + Turborepo monorepo.**

### Gerekçe (üç temel direk)

1. **Web dashboard savaş alanı.** inFlow'u geçme hedefimiz SMB masaüstünde geçer. React/Tailwind/shadcn ekosistemi 10k+ satır tablo, SSR, klavye kısayolları ve B2B görsel dilinde Flutter Web'den 2 nesil önde.
2. **Paylaşılan çekirdek.** `packages/core` altında pure TypeScript iş kuralları (append-only ledger, snapshot stock count, vergi, FX) → web, mobil ve API aynı fonksiyonu çağırır. tRPC + Zod ile uçtan uca tip güvenliği.
3. **AI-native geliştirme hızı.** Cursor/Claude + shadcn/v0 olgun tooling → solo dev için %30-40 velocity artışı.

### Kabul Edilen Kayıplar (trade-off)

- **3-4 hafta ramp-up** (Next.js App Router + Expo + tRPC öğrenme).
- **%20-30 UI kod çarpanı** (web ve mobil ekranlar ayrı kodlanır, sadece iş kuralı paylaşılır).
- **Flutter muscle memory kaybı** — OneAce'tan iş kuralları ve test case'leri taşınacak, UI kodu taşınmayacak.

### Geri Dönülemez mi?

Hayır. Kararın %80'i (paylaşılan `packages/core`) geri dönülebilir — core TypeScript kütüphanesini başka bir framework'e bağlamak mümkün. UI seçimi (Next.js + Expo) ilk 8 haftada revize edilebilir.

### İzlenecek Metrikler

- Sprint 0 sonunda: "Hello world" web + mobil ekranları aynı tRPC endpoint'e bağlı, tek komutla build alınıyor.
- Sprint 3 sonunda: ilk CRUD (Item) hem web hem mobilde çalışıyor, iş kuralı `packages/core`'da.
- Sprint 6 sonunda: 10k kayıt tablo scroll'u web'de 60 fps, mobil offline arama < 50ms.

---

## 2 — Stack Bileşen Detayları

### Web (apps/web)

| Katman | Seçim | Neden |
|---|---|---|
| Framework | **Next.js 15 (App Router, RSC)** | SSR, SEO, edge runtime, olgun routing |
| UI kütüphanesi | **shadcn/ui + Radix primitives** | Kopyala-yapıştır bileşenler, tam kontrol, marka özelleştirme kolay |
| Styling | **Tailwind CSS v4** | Hızlı iterasyon, tutarlı spacing/renk |
| State (client) | **Zustand** (UI state) + **TanStack Query** (server state via tRPC) | Redux overkill, Zustand minimal, TanStack cache olgun |
| Form | **react-hook-form + zod resolver** | Zod şemaları backend ile paylaşılır |
| Tablo | **TanStack Table v8** | Virtualized 100k+ satır, sıralama/filtreleme/grup |
| Grafik | **Recharts** (v1) → **Visx** (v2 ileri) | Recharts hızlı başlangıç |
| i18n | **next-intl** | App Router native, RTL destekli, server-side |
| Auth | **Supabase Auth** (başlangıç) → **Clerk** opsiyonu | Mağazacı/sahadaki çalışan rolleri için basit başlangıç |

### Mobil (apps/mobile)

| Katman | Seçim | Neden |
|---|---|---|
| Framework | **Expo SDK 52 + Expo Router v4** | Dosya-tabanlı routing, OTA updates, EAS Build |
| Styling | **NativeWind v4** | Tailwind sentaksı mobile — web ile zihinsel tutarlılık |
| State | **Zustand + TanStack Query** | Web ile birebir aynı pattern |
| Barkod | **expo-camera** + **expo-barcode-scanner** → ihtiyaçta **react-native-vision-camera + MLKit** | Expo ile başla, hız gerekince native'e geç |
| Offline DB | **WatermelonDB** | 10k+ kayıt, senkronize edilebilir, reactive queries |
| Senk | **PowerSync** veya custom (ledger pull/push) | MVP'de basit "son güncelleme" pull, V1'de PowerSync |
| Forms | **react-hook-form + zod** | Web ile aynı |
| i18n | **expo-localization + i18next** | RTL destekli |

### Backend / API (apps/api veya apps/web içinde Route Handler)

| Katman | Seçim | Neden |
|---|---|---|
| Runtime | **Next.js Route Handlers (Node)** → ihtiyaçta **ayrı Hono/Fastify servisi** | Başlangıçta Next içinde yeter, scale olunca ayrılır |
| RPC | **tRPC v11** | Uçtan uca tip güvenliği, Zod validation |
| ORM | **Drizzle ORM** | SQL-first, tip üretimi, migration'lar dürüst |
| DB | **Supabase Postgres** | RLS, realtime, storage, auth hepsi bir arada |
| Object storage | **Supabase Storage** | Ürün fotoğrafları, barkod görselleri |
| Queue / jobs | **Inngest** (başlangıç) → **BullMQ** | Cron, webhooks, email, background sync |
| Search | Postgres `tsvector` → **Meilisearch/Typesense** | 50k SKU üstünde tam metin arama |
| Observability | **Sentry** + **Axiom** logs | Solo dev için yeterli |
| Email | **Resend** + **React Email** | Transactional email, template'ler |
| Payments | **Stripe Billing** | Seat + tier pricing, usage metered |

### DevOps / Tooling

| Araç | Seçim |
|---|---|
| Monorepo | **Turborepo** (Vercel stack'ine en yakın) |
| Paket yöneticisi | **pnpm** (workspace-first) |
| Linter | **Biome** (ESLint + Prettier yerine — hızlı) |
| Typecheck | **TypeScript 5.7 strict** |
| Test | **Vitest** (unit) + **Playwright** (web e2e) + **Maestro** (mobil e2e) |
| CI | **GitHub Actions** + **Turborepo Remote Cache (Vercel)** |
| Web hosting | **Vercel** |
| Mobil dağıtım | **EAS Build + EAS Submit** |
| DB migrations | **Drizzle Kit** |

### Paket Versiyonları (Sprint 0 hedef)

```
next          ^15.1.0
react         ^19.0.0
expo          ~52.0.0
typescript    ^5.7.0
turbo         ^2.3.0
pnpm          ^9.15.0
trpc          ^11.0.0
drizzle-orm   ^0.38.0
drizzle-kit   ^0.30.0
zod           ^3.24.0
tailwindcss   ^4.0.0
nativewind    ^4.1.0
```

---

## 3 — Monorepo İskeleti

```
new-project/                    (repo root, git init burada)
├── .github/
│   └── workflows/
│       ├── ci.yml              # typecheck + test + build tüm workspace
│       └── deploy-web.yml      # Vercel auto-deploy
├── apps/
│   ├── web/                    # Next.js 15 App Router
│   │   ├── app/
│   │   │   ├── (marketing)/    # Public landing, pricing, docs
│   │   │   ├── (auth)/         # Sign-in, sign-up, reset
│   │   │   ├── (app)/          # Authenticated app (dashboard)
│   │   │   │   ├── items/
│   │   │   │   ├── counts/
│   │   │   │   ├── orders/
│   │   │   │   ├── reports/
│   │   │   │   └── settings/
│   │   │   └── api/
│   │   │       └── trpc/[trpc]/route.ts
│   │   ├── components/
│   │   │   ├── ui/             # shadcn/ui copies
│   │   │   └── features/       # Item table, count wizard, etc.
│   │   ├── lib/
│   │   ├── messages/           # next-intl JSON (tr, en, de, es, fr, ar)
│   │   ├── next.config.mjs
│   │   ├── tailwind.config.ts
│   │   └── package.json
│   └── mobile/                 # Expo SDK 52 + Expo Router
│       ├── app/
│       │   ├── (auth)/
│       │   ├── (tabs)/
│       │   │   ├── scan/       # Barkod tarama
│       │   │   ├── items/
│       │   │   ├── counts/
│       │   │   └── more/
│       │   └── _layout.tsx
│       ├── components/
│       ├── lib/
│       ├── locales/
│       ├── app.json
│       ├── eas.json
│       └── package.json
├── packages/
│   ├── core/                   # Pure TS iş kuralları (framework-agnostic)
│   │   ├── src/
│   │   │   ├── ledger/         # Append-only movement ledger
│   │   │   ├── stockcount/     # Snapshot-based variance engine
│   │   │   ├── pricing/        # Tier/seat/usage calculations
│   │   │   ├── tax/            # VAT, US state+fed tax
│   │   │   ├── fx/             # Currency conversion
│   │   │   └── index.ts
│   │   ├── tests/
│   │   └── package.json
│   ├── api/                    # tRPC router definitions
│   │   ├── src/
│   │   │   ├── routers/
│   │   │   │   ├── items.ts
│   │   │   │   ├── counts.ts
│   │   │   │   ├── orders.ts
│   │   │   │   └── _app.ts
│   │   │   ├── trpc.ts         # Context, middleware
│   │   │   └── index.ts
│   │   └── package.json
│   ├── db/                     # Drizzle schema + migrations
│   │   ├── src/
│   │   │   ├── schema/
│   │   │   │   ├── items.ts
│   │   │   │   ├── movements.ts
│   │   │   │   ├── counts.ts
│   │   │   │   ├── orders.ts
│   │   │   │   └── index.ts
│   │   │   ├── client.ts       # Drizzle client factory
│   │   │   └── seed.ts
│   │   ├── drizzle.config.ts
│   │   ├── migrations/
│   │   └── package.json
│   ├── ui-web/                 # Paylaşılan web bileşenleri (shadcn ötesi)
│   │   └── package.json
│   ├── ui-mobile/              # Paylaşılan RN bileşenleri
│   │   └── package.json
│   ├── i18n/                   # Ortak çeviri kaynakları, locale utilities
│   │   ├── locales/
│   │   │   ├── tr/
│   │   │   ├── en/
│   │   │   ├── de/
│   │   │   ├── es/
│   │   │   ├── fr/
│   │   │   └── ar/
│   │   └── package.json
│   ├── config-eslint/          # Biome/Lint shared config (eğer kullanılırsa)
│   └── config-typescript/      # tsconfig bases
│       ├── base.json
│       ├── nextjs.json
│       ├── expo.json
│       └── package.json
├── scripts/
│   ├── db-reset.ts
│   └── check-versions.ts
├── .env.example
├── .gitignore
├── .nvmrc                      # Node 22 LTS
├── biome.json
├── package.json                # Root workspace
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.json
└── README.md
```

### Çekirdek dosya içerikleri

**`pnpm-workspace.yaml`**
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

**`turbo.json` (v2)**
```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env", "tsconfig.json"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "db:migrate": {
      "cache": false
    }
  }
}
```

**`package.json` (root)**
```json
{
  "name": "new-project",
  "private": true,
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "biome check .",
    "format": "biome format --write .",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "db:migrate": "turbo run db:migrate --filter=@app/db"
  },
  "devDependencies": {
    "turbo": "^2.3.0",
    "typescript": "^5.7.0",
    "@biomejs/biome": "^1.9.4"
  },
  "engines": {
    "node": ">=22.0.0",
    "pnpm": ">=9.15.0"
  }
}
```

**`packages/config-typescript/base.json`**
```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true
  }
}
```

---

## 4 — Sprint 0: Bootstrap (1 hafta — 40 saat)

**Hedef:** "Web + mobil uygulamalar aynı tRPC endpoint'inden `hello` cevabı alıyor; tek komutla her şey build oluyor; CI yeşil."

### Gün 1: Repo + Temel Scaffolding (8 saat)
- [ ] `pnpm create turbo@latest new-project --pm pnpm` ile scaffold
- [ ] `git init` + ilk commit
- [ ] `packages/config-typescript/` base tsconfig
- [ ] `biome.json` lint config
- [ ] Root `package.json` scripts (build, dev, lint, typecheck, test)
- [ ] `.gitignore`, `.nvmrc`, `.env.example`
- [ ] `README.md` kısa açıklama

**Checkpoint:** `pnpm install && pnpm turbo run typecheck` temiz geçer.

### Gün 2: Web App Scaffolding (8 saat)
- [ ] `apps/web` → Next.js 15 + Tailwind v4 + shadcn/ui init
- [ ] Route groups: `(marketing)`, `(auth)`, `(app)`
- [ ] `next-intl` kurulum + 6 dil için placeholder locale dosyaları
- [ ] `components/ui/` → shadcn init (button, card, input, dialog, table)
- [ ] Landing page placeholder (`(marketing)/page.tsx`)

**Checkpoint:** `pnpm dev --filter=web` → localhost:3000'de landing sayfası açılıyor, dil değiştirici çalışıyor.

### Gün 3: packages/core + packages/db + packages/api (8 saat)
- [ ] `packages/core` → TypeScript pure lib, Vitest kurulu, ilk `ledger.ts` skeleton + 1 test
- [ ] `packages/db` → Drizzle + Supabase client, ilk `items` schema, `drizzle-kit generate` migration
- [ ] `packages/api` → tRPC router `hello.query()` ve `items.list.query()` placeholder
- [ ] Supabase Cloud hesabı aç, yeni proje, env'leri `.env.local`'a yaz

**Checkpoint:** `pnpm --filter=@app/db db:migrate` çalışır, Supabase'de `items` tablosu oluşur. `packages/core` testleri yeşil.

### Gün 4: Web ↔ API Bağlantısı (8 saat)
- [ ] `apps/web/app/api/trpc/[trpc]/route.ts` → tRPC handler
- [ ] `apps/web/lib/trpc-client.ts` → TanStack Query + tRPC client
- [ ] `(app)/items/page.tsx` → `trpc.items.list.useQuery()` ile tablo
- [ ] Supabase Auth Sign-in/Sign-up sayfaları (`(auth)`)
- [ ] Middleware: korumalı rota `(app)`

**Checkpoint:** Web'de `/sign-in` → e-mail ile giriş → `/items` boş tablo gözüküyor (verileri API'den çekiyor).

### Gün 5: Mobile App Scaffolding (8 saat)
- [ ] `apps/mobile` → `npx create-expo-app@latest --template` (Expo Router v4)
- [ ] NativeWind v4 kurulum + Tailwind config paylaşımı
- [ ] `(auth)` + `(tabs)` route groups
- [ ] `lib/trpc-client.ts` → web ile aynı tRPC client pattern
- [ ] `(tabs)/items` → mobile'da aynı `trpc.items.list` çağrısı, FlatList render

**Checkpoint:** `pnpm dev --filter=mobile` → Expo Go'da mobil app açılır, login → items listesi (web ile aynı veri).

### Gün 6: CI + Environment + Sentry (4 saat)
- [ ] `.github/workflows/ci.yml` → `pnpm install && pnpm turbo run typecheck lint test build`
- [ ] Turborepo Remote Cache (Vercel) bağlantısı
- [ ] Sentry projesi → web + api
- [ ] Vercel bağlantısı → `apps/web` auto-deploy preview

**Checkpoint:** GitHub'a push → CI yeşil, Vercel preview URL açılır.

### Gün 7: Temizlik + Dokümantasyon (4 saat)
- [ ] `README.md` detaylı kurulum kılavuzu (node version, pnpm, env, supabase)
- [ ] `docs/architecture.md` monorepo overview
- [ ] `docs/getting-started.md` yeni dev için 10 dakikalık setup
- [ ] Sprint 0 retro: neyi yanlış planladık, Sprint 1'e ne taşınır

**Sprint 0 Kabul Kriterleri (Definition of Done):**
1. `pnpm install` tek komutla tüm workspace'i kurar
2. `pnpm dev` web + mobil eşzamanlı başlar
3. Web'de login → `/items` sayfası tRPC çağrısından veri çeker
4. Mobilde login → `/items` sekmesi aynı veriyi gösterir
5. CI yeşil, Vercel preview canlı
6. `packages/core` ilk testi geçer
7. 6 dilde "Merhaba/Hello/Hallo/Hola/Bonjour/مرحبا" UI'da çalışır (string dahi olsa)

---

## 5 — Sprint 1-11 Yüksek Seviye Takvim

| Sprint | Hafta | Hedef |
|---|---|---|
| 0 | 1 | Bootstrap (bu doküman) |
| 1 | 2-3 | Item CRUD + kategori ağacı + özel alanlar + fotoğraf upload |
| 2 | 4-5 | Stok ledger (append-only) + movement kayıtları + türetilmiş stoklar |
| 3 | 6-7 | Mobil barkod tarama + offline WatermelonDB + senk |
| 4 | 8-9 | Stok sayımı v1 (cycle + spot + double-blind) + snapshot variance |
| 5 | 10-11 | Satış siparişi + satın alma siparişi + basit PDF |
| 6 | 12 | Rapor motoru v1 + Excel export + 10 hazır rapor |
| — | — | **MVP LAUNCH (12. hafta sonu)** |
| 7-8 | 13-16 | Entegrasyonlar v1: Shopify + QuickBooks + Webhooks |
| 9-10 | 17-20 | Çok-lokasyon + transfer + düşük stok alarmı |
| 11 | 21-22 | V1 sürümü + ilk ödeyen müşteri hedefi |

---

## 6 — Riskler ve Azaltma

| Risk | Olasılık | Etki | Azaltma |
|---|---|---|---|
| Ramp-up beklenenden uzun sürer | Orta | Orta | Sprint 0'ı 1 yerine 1.5 hafta planla; yeterse erken bitir |
| Expo SDK 52 bug'ı | Düşük | Orta | SDK 51'e düşüş planı hazır tut |
| Supabase RLS karmaşıklığı | Orta | Yüksek | Sprint 1'de ilk RLS policy'leri yaz, test et |
| WatermelonDB senk bug'ları | Orta | Yüksek | V1'e ertele, MVP'de basit "refresh pull" ile başla |
| i18n RTL (Arapça) edge case | Düşük | Orta | next-intl ve NativeWind RTL'i Sprint 0'da 1 ekranda test et |
| Mahmut burnout | Orta | Yüksek | Haftada 5 gün, günde max 8 saat, sprint sonu retro |

---

## 7 — Karar Günlüğü (canlı tut)

| Tarih | Karar | Alternatif | Sonuç |
|---|---|---|---|
| 2026-04-10 | Stack: Next.js + Expo + Turborepo | Flutter devam | Kilitli |
| 2026-04-10 | OneAce retire edilecek | Paralel sürdür | Retire |
| 2026-04-10 | Auth: Supabase Auth başlangıç | Clerk | Supabase (maliyet) |
| 2026-04-10 | ORM: Drizzle | Prisma | Drizzle (SQL kontrolü) |
| 2026-04-10 | Lint/format: Biome | ESLint+Prettier | Biome (hız) |
| _bundan sonrası sprint'lerde doldurulacak_ | | | |

---

## 8 — Sonraki Adımlar (Mahmut için)

1. **Bugün (2026-04-10):** Bu dökümanı oku, 24 saat üzerinde düşün. Değişiklik/itiraz varsa işaretle.
2. **2026-04-11 (Cumartesi):** Onaylarsan `new-project` repo'yu GitHub'da aç (private), Sprint 0 Gün 1'e başla.
3. **2026-04-17 (Cuma):** Sprint 0 bitişi + retro + Sprint 1 kickoff.
4. **2026-07-03 (12. hafta):** MVP launch hedefi.

---

**Not:** Bu doküman canlı — her sprint sonunda güncellenir. İlk gerçek kod ilişkisine girdiğinde (Sprint 0 Gün 2'de) bazı seçimler küçük revizyonlar alabilir; o revizyonlar bu dokümanda "Karar Günlüğü" tablosuna işlenir.
