# OneAce — Sprint 3 + 4 + 5 İlerleme Raporu

**Tarih:** 2026-04-25
**Durum:** 3 sprint paralel başlatıldı, her birinin **ilk PR'ı** sandbox'ta uygulandı. Kalan PR'lar Sprint 6+ backlog.
**Önceki:** [Sprint 1](./UX-UI-AUDIT-AND-SPRINT-1-2026-04-25.md), [Sprint 2](./SPRINT-2-TR-COVERAGE-2026-04-25.md)

---

## 1. Sprint 3 — TR business surface (Tema A)

**Hedef:** Sprint 2'de yapılmayan ~26 namespace TR çevirisi.
**Bu seansta tamamlanan:** PR #1 (warehouses + categories).
**Kalan:** PR #2-4 (suppliers, PO, transfers, sales-orders, kits, picks, stockCounts, movements, reports, settings, users, audit, ...).

### 1.1 PR #1 — warehouses + categories

| Namespace | Kapsanan |
|---|---|
| `warehouses` | List + CRUD + detail page (per-location stock + recent movements) + default flag + address fields + 6 error mesajı |
| `categories` | List + CRUD + rename dialog + parent kategori |

**Tag:** `v1.16.1-tr-warehouses-categories`
**tr.ts coverage:** 21/47 → 23/47 (~49%)
**Apply:** `apply-sprint-3.command`

### 1.2 Sprint 3 backlog (Sprint 6+)

| Namespace | Tahmini satır |
|---|---:|
| `suppliers` | ~120 |
| `purchaseOrders` | ~190 |
| `transfers` | ~10 |
| `salesOrders` | ~40 |
| `kits` | ~25 |
| `picks` | ~25 |
| `stockCounts` | ~180 |
| `movements` | ~150 |
| `countZones` | ~55 |
| `itemDetail` | ~30 |
| `serials` | ~25 |
| `reports` (18 alt-namespace) | ~270 |
| `settings` (5 alt-page) | ~135 |
| `security` | ~40 |
| `users` | ~100 |
| `audit` | ~175 |
| `invitePage` | ~35 |
| `privacy` | ~25 |
| `imageUpload` | ~10 |
| `bins`, `labels`, `pallets` | ~80 |
| `vehicles` | ~50 |
| `locations`, `itemsImport` | ~85 |
| **Toplam tahmin** | **~1850 satır** |

Tek seans 1850 satır TR çevirisi mümkün ama agresif. Önerilen: 2 seansta tamamla, her seans 4-5 namespace.

---

## 2. Sprint 4 — UX state coverage (Tema B)

**Hedef:** PageHeader migration + EmptyState coverage + axe-core CI.
**Bu seansta tamamlanan:** PR #1 (search PageHeader migration).
**Kalan:** PR #2 (EmptyState coverage), PR #3 (axe-core CI).

### 2.1 PR #1 — search PageHeader migration

`src/app/(app)/search/page.tsx` inline `<SearchIcon /> + <h1>` + `<p>` bloğu kaldırılıp `<PageHeader title=... description=... />` kullanıldı.

**Pinned test:** `src/app/(app)/search/search-page-header.test.ts`
**Tag:** `v1.16.2-search-pageheader`
**PageHeader kullanım oranı:** 86/141 → 87/141
**Apply:** `apply-sprint-4.command`

### 2.2 Sprint 4 backlog

#### PR #2 — EmptyState coverage genişletme
Mevcut: 29 sayfa. Hedef: 50+. Önerilen migration sırası (her biri için EmptyState eklemek + lint test):
- vehicles list, picks/[id], kits/new (3 sayfa kolay kazanım)
- sales-orders/[id]/page.tsx (zaten EmptyState eklendi mi kontrol)
- purchase-orders/page.tsx (zaten var?)
- transfers/page.tsx (zaten var)
- suppliers/[id]/page.tsx (detail)

#### PR #3 — axe-core CI etkinleştir
`@axe-core/playwright` zaten devDependency'de. Yapılacak:
- `e2e/a11y/` klasörüne playwright a11y smoke test (5 sayfa: dashboard, items, scan, stock-counts/[id], reports)
- GitHub Actions workflow eklenip / mevcut e2e'ye dahil edilir
- Failure threshold: 0 critical issue (warnings tolere edilir)

#### PR #4 — Tablet sidebar (md:flex)
`sidebar.tsx` `lg:flex` → `md:flex`. Tablet portrait (768-1023) için sidebar açık. md grid breakpoint'i de düşür.

#### PR #5 — Mobile tab bar Movements eklenmiş 6. sekme
Eğer `mobile-tab-bar` benzeri bir komponent eklenecekse (oneace/'de yok şu an), 5 sekme yerine 6.

---

## 3. Sprint 5 — Storybook + visual regression (Tema C)

**Hedef:** Top 25 primitive Storybook story + Card varyant normalize + Chromatic veya Playwright snapshot CI.
**Bu seansta tamamlanan:** PR #1 (Storybook foundation + Button story).
**Kalan:** PR #2-5.

### 3.1 PR #1 — Storybook foundation

| Dosya | Amaç |
|---|---|
| `.storybook/main.ts` | Config (Vite framework, a11y addon, autodocs) |
| `.storybook/preview.ts` | globals.css load, light/dark toggle, 3 bg swatch |
| `src/components/ui/button.stories.tsx` | 13 Button story (variants, sizes, loading, icon, touch-target audit) |
| `package.json` | Yeni scripts: `storybook` + `build-storybook` |

**Tag:** `v1.16.3-storybook-foundation`
**Apply:** `apply-sprint-5.command`

**Bağımlılık yüklemesi (Mahmut Mac'te):**
```bash
pnpm install --save-dev \
  @storybook/react@^8 @storybook/react-vite@^8 \
  @storybook/addon-essentials@^8 @storybook/addon-a11y@^8 \
  @storybook/test@^8 storybook@^8 vite@^5
pnpm storybook   # http://localhost:6006
```

### 3.2 Sprint 5 backlog

#### PR #2 — 24 primitive daha story
Sıralı: Badge, Alert, Card, KpiCard, EmptyState, PageHeader, Input, Label, Select, Textarea, Checkbox, Switch, Tabs, Dialog, Sheet, Popover, Tooltip, DropdownMenu, Avatar, Breadcrumb, Skeleton, Separator, Sonner toast, ScrollArea.

#### PR #3 — Card varyant normalize (7 → 3)
Mevcut: `Card`, `KpiCard`, `ChartCard`, `WidgetCard`, `DataPanel`, `SectionShell`, `ReportSummaryCard` — 7 farklı kart pattern'i.

Önerilen: `<Card variant="default | metric | chart" />`. KpiCard / ChartCard yedekleri 1 sürüm boyu deprecation banner'ı ile kalır.

#### PR #4 — Chromatic veya Playwright snapshot CI
Storybook story'lerinin görsel regression'ını yakalamak için:
- Chromatic (paid, GitHub'a entegre, en kolay)
- Playwright `@playwright/test` ile screenshot karşılaştırma (free, kendi runner'ında)

#### PR #5 — Theme switcher production'da
Light/dark toggle (Storybook'ta var) production app shell'inde de — header dropdown veya settings.

---

## 4. Mahmut'un Mac'te Yapacağı (genişletilmiş 5 adım)

```bash
cd ~/Documents/Claude/Projects/OneAce

# 1. oneace2/ temizliği (önceki seans)
./cleanup-oneace2.command

# 2. Sprint 1 (UX/UI a11y pass-1, 6 PR)
./apply-sprint-1.command

# 3. Sprint 2 (TR coverage 4→21 namespace)
./apply-sprint-2.command

# 4. Sprint 3 PR #1 (TR warehouses + categories)
./apply-sprint-3.command

# 5. Sprint 4 PR #1 (search PageHeader)
./apply-sprint-4.command

# 6. Sprint 5 PR #1 (Storybook foundation)
./apply-sprint-5.command

# 7. Storybook bağımlılık yüklemesi
cd oneace
pnpm install --save-dev \
  @storybook/react@^8 @storybook/react-vite@^8 \
  @storybook/addon-essentials@^8 @storybook/addon-a11y@^8 \
  @storybook/test@^8 storybook@^8 vite@^5

# 8. Storybook çalıştır
pnpm storybook

# 9. Tüm sprintlerde eklenen testleri çalıştır
pnpm vitest run \
  src/components/shell/aria-current-nav.test.ts \
  src/components/touch-target.test.ts \
  src/app/no-hardcoded-loading-divs.test.ts \
  src/app/a11y-skip-link.test.ts \
  'src/app/(marketing)/legal/kvkk-token-bypass.test.ts' \
  'src/app/(app)/dashboard/dashboard-page-header.test.ts' \
  src/lib/i18n/tr-coverage.test.ts \
  src/lib/i18n/locale-parity.test.ts \
  'src/app/(app)/search/search-page-header.test.ts'

# 10. Verify
./scripts/verify.sh deploy
```

---

## 5. Tag Hiyerarşisi (Mahmut Mac scriptlerini sırayla çalıştırınca)

```
v1.14.3-zero-backlog                              ← Sprint öncesi baseline

v1.14.4-aria-current                              ← Sprint 1 PR #1
v1.14.5-touch-target                              ← Sprint 1 PR #2
v1.14.6-loading-skeleton                          ← Sprint 1 PR #4
v1.14.7-skip-link-i18n                            ← Sprint 1 PR #5
v1.14.8-kvkk-token                                ← Sprint 1 PR #6
v1.14.9-dashboard-pageheader                      ← Sprint 1 PR #7
v1.15.0-ux-a11y-pass-1                            ← Sprint 1 closure ✓

v1.15.1-tr-chrome                                 ← Sprint 2 PR #1
v1.15.2-tr-onboarding-dashboard                   ← Sprint 2 PR #2 (tag-only)
v1.15.3-tr-operations                             ← Sprint 2 PR #3 (tag-only)
v1.15.4-tr-coverage-test                          ← Sprint 2 PR #4
v1.16.0-tr-coverage-pass-1                        ← Sprint 2 closure ✓

v1.16.1-tr-warehouses-categories                  ← Sprint 3 PR #1
v1.16.1-tr-coverage-pass-2-partial                ← Sprint 3 partial closure

v1.16.2-search-pageheader                         ← Sprint 4 PR #1
v1.16.2-ux-state-pass-1-partial                   ← Sprint 4 partial closure

v1.16.3-storybook-foundation                      ← Sprint 5 PR #1
v1.16.3-storybook-pass-1-partial                  ← Sprint 5 partial closure
```

---

## 6. Bir Sonraki Seans

**Önerilen sıralama (en yüksek değer önce):**

1. **Sprint 3 backlog tamamla** — kalan 24 namespace TR çevirisi (~1850 satır). Hedef tag: `v1.17.0-tr-full-coverage`. **Kullanıcı tamamen Türkçe görür.**
2. **Sprint 5 PR #2** — 24 primitive Storybook story. Storybook çalışır halde olduğu için her primitive üzerinde a11y addon çalışır.
3. **Sprint 4 PR #2 + PR #3** — EmptyState coverage + axe-core CI smoke test.
4. **Sprint 5 PR #3** — Card varyant normalize. Storybook ile yan yana karşılaştırma kolaylığı sağlar.

**Tahmini efor:** 4-5 iş günü.
