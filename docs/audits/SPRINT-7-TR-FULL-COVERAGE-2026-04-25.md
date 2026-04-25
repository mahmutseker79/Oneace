# OneAce — Sprint 7: TR FULL COVERAGE (100%)

**Tarih:** 2026-04-25
**Hedef:** tr.ts coverage 32/47 → **48/48 namespace (100%)**.
**Tag:** `v1.18.0-tr-full-coverage` 🎯
**Önceki:** [Sprint 6](./SPRINT-6-TR-OPERATIONS-2026-04-25.md) (`v1.17.0`)

---

## 🎯 Tamamlandı: Türkçe full parite

OneAce'in **TÜM 48 top-level i18n namespace'i** artık TR override'lı. Bir Türk kullanıcı için ürün **native bir Türk SaaS** gibi davranır.

**tr.ts boyut yolu:**
- Sprint 1 öncesi: **120 satır** (4 namespace, ~9%)
- Sprint 2 sonu: **787 satır** (21 namespace, ~45%)
- Sprint 6 sonu: **1705 satır** (32 namespace, ~68%)
- **Sprint 7 sonu: 2861 satır (48/48 = 100%)** ✓

en.ts'e oran: **2861 / 2869 = %99.7** (8 satır fark sadece yorum farkı).

---

## 1. Eklenen 16 Namespace

### PR #1 — Settings + Security + Privacy (3 ns)

| Namespace | Kapsanan |
|---|---|
| `settings` | Org profile + locale + region + orgDefaults + transferOwnership consequences (4 madde) + dangerZone consequences (6 madde) |
| `security` | 2FA TOTP setup wizard 3 adım + backup codes + disable + regenerate + rate limit |
| `privacy` | Export data + delete account + KVKK uyumu uyarıları |

**Tag:** `v1.17.1-tr-settings-security`

### PR #2 — Admin (3 ns)

| Namespace | Kapsanan |
|---|---|
| `users` | Invite + invitations table + members table + roles + roleHelp + actions + errors (lastOwner, cannotRemoveSelf vb.) |
| `invitePage` | Davet kabul akışı (signed-in/wrong-account/ready, success, all error states) |
| `audit` | 165 audit action key (every domain mutation: org/member/PO/item/category/supplier/warehouse/stockCount/movement/bin/billing/migration/reason_code/sales_order/kit/pick/...) |

**Tag:** `v1.17.2-tr-admin`

### PR #3 — Inventory Detail (9 ns)

| Namespace | Kapsanan |
|---|---|
| `bins` | Raf CRUD + transfer dialog + print labels |
| `labels` | Etiket şablonları |
| `pallets` | Palet barkod CRUD + form helpers |
| `locations` | Lokasyon CRUD (ayrı namespace, warehouses ile farklı) |
| `serials` | Seri numarası status enums + CRUD |
| `countZones` | Sayım bölgesi formu + barkod üretme + delete confirm |
| `vehicles` | Araç filo yönetimi + sevkıyat ata/boşalt |
| `itemsImport` | CSV içe aktarım 4 adımlı wizard (upload, map, preview, done) |
| `imageUpload` | Dropzone + size/type uyarıları |

**Tag:** `v1.17.3-tr-inventory-detail`

### PR #4 — Reports (1 ns, 12 alt-namespace)

| Alt-namespace | Kapsanan |
|---|---|
| `lowStock` | Düşük stok raporu (önceden çevrilmemişti) |
| `stockValue` | Maliyet bazlı toplam stok değeri raporu |
| `supplierPerformance` | Tedarikçi KPI özeti, on-time rate, avg lead time |
| `binInventory` | Raf bazlı envanter |
| `movementHistory` | Hareket özet raporu + KPI'lar + summary by type |
| `scanActivity` | Tarama etkinliği |
| `abcAnalysis` | ABC sınıflandırma + Pareto + count frequency önerileri |
| `countComparison` | İki sayım arası sapma karşılaştırma |
| `varianceTrend` | Zaman içinde sapma eğilimi |
| `departmentVariance` | Departman/lokasyona göre sapma |
| `scheduledReportActions` | Pause/resume/delete dialog |

**Tag:** `v1.17.4-tr-reports`

### PR #5 — Coverage Test Hard Floor 32 → 48

`tr-coverage.test.ts` `REQUIRED_TR_NAMESPACES` 16 yeni namespace ile genişledi. `expect(overridden.size).toBeGreaterThanOrEqual(48)` — hard floor.

**Tag:** `v1.17.5-tr-coverage-test-48`

---

## 2. Closure Tag

`v1.18.0-tr-full-coverage` 🎯

```
v1.14.3-zero-backlog                              ← baseline
v1.15.0-ux-a11y-pass-1                            ← Sprint 1
v1.16.0-tr-coverage-pass-1                        ← Sprint 2 (21 ns)
v1.16.1-tr-coverage-pass-2-partial                ← Sprint 3 (23 ns)
v1.16.2-ux-state-pass-1-partial                   ← Sprint 4 partial
v1.16.3-storybook-pass-1-partial                  ← Sprint 5 partial
v1.17.0-tr-coverage-pass-3                        ← Sprint 6 (32 ns)
v1.18.0-tr-full-coverage                          ← Sprint 7 (48/48) 🎯
```

---

## 3. Mahmut'un Mac'te Yapacağı

Genişletilmiş zincir (8. adım):
```bash
cd ~/Documents/Claude/Projects/OneAce
./cleanup-oneace2.command
./apply-sprint-1.command
./apply-sprint-2.command
./apply-sprint-3.command
./apply-sprint-4.command
./apply-sprint-5.command
./apply-sprint-6.command
./apply-sprint-7.command            # 🎯 TR FULL COVERAGE

cd oneace
pnpm install --save-dev \
  @storybook/react@^8 @storybook/react-vite@^8 \
  @storybook/addon-essentials@^8 @storybook/addon-a11y@^8 \
  @storybook/test@^8 storybook@^8 vite@^5
pnpm storybook
./scripts/verify.sh deploy
```

---

## 4. Şimdi Hangi Sayfalar Türkçe?

**Tüm 141 page.tsx için TR locale aktif olduğunda Türkçe görünür:**

✅ Auth (login, register, invite, forgot-password)
✅ Onboarding (4-step wizard)
✅ Dashboard (KPI, chart, low-stock card, recent activity, quick actions)
✅ Items (list, CRUD, reorder-config, attachments, serials)
✅ Scan (camera, manual, result, quick-add)
✅ Search (results UI)
✅ Warehouses (list, CRUD, detail page with stock table)
✅ Categories (list, CRUD, rename dialog)
✅ Movements (list, CRUD, filter, transfer wizard)
✅ Stock counts (list, CRUD, detail, reconcile, rollback, variance)
✅ Suppliers (list, CRUD, detail KPI page)
✅ Purchase orders (list, CRUD, receive, putaway, cancel)
✅ Sales orders (list, CRUD, ship, allocate)
✅ Kits + Picks
✅ Bins + Locations + Serials + Labels + Pallets + Vehicles + CountZones
✅ Items import (4-step wizard)
✅ Settings (general, security, privacy, billing, integrations, reason-codes)
✅ Users (members + invitations + roles)
✅ Audit log (165 action types)
✅ Reports (18 alt-sayfa: low-stock, stock-value, supplier-performance, bin-inventory, movement-history, scan-activity, abc-analysis, count-comparison, variance-trend, department-variance, scheduled-reports, vb.)
✅ Mail (invitation email)
✅ Empty states (15 farklı)
✅ Page metadata (SEO)
✅ PWA banners + offline mode
✅ Marketing chrome (sidebar/header)

---

## 5. Sprint 7 Sonrası Backlog

Sprint 7 ile **TR full coverage** hedefine ulaşıldı. Sonraki öncelikler audit'in **diğer eksenlerinden** geliyor:

### Yüksek değer (Sprint 8+ önerileri)

1. **Storybook coverage genişletme** (Sprint 5'in PR #2): 24 primitive daha story (Badge, Alert, Card, KpiCard, EmptyState, PageHeader, Input, Label, Select, Textarea, Checkbox, Switch, Tabs, Dialog, Sheet, Popover, Tooltip, DropdownMenu, Avatar, Breadcrumb, Skeleton, Separator, Sonner, ScrollArea).
2. **Card varyant normalize 7→3** (Sprint 5 PR #3): KpiCard / ChartCard / WidgetCard / DataPanel / SectionShell / ReportSummaryCard → tek `<Card variant="...">` API.
3. **PageHeader migration paketi 2** (Sprint 4 PR #1 devamı): kalan 55 PageHeader-yoksun sayfa için aşamalı migration (5'er paketler).
4. **EmptyState coverage genişletme** (Sprint 4 PR #2): 29 → 50+ liste sayfası.
5. **axe-core CI smoke test** (Sprint 4 PR #3): @axe-core/playwright zaten kurulu, 5 kritik sayfa için a11y smoke.
6. **Tablet sidebar md:flex** (Sprint 4 PR #4): tablet portrait UX.
7. **Chromatic veya Playwright visual regression CI** (Sprint 5 PR #4).
8. **TR çeviri kalite review**: Native TR kullanıcı (Mahmut) review pass'i — bu sandbox çevirisi profesyonel review almadı. "Resmi" yayın öncesi geçilmesi öneriliyor.

### Düşük değer / kapsam dışı

- ICU MessageFormat geçişi (TR plural form yok ama Slav/Arap diller için)
- Performance pass (FCP, INP, bundle size)
- Marketing docs sayfaları audit + cleanup (P2-20 oneace2 audit'ten)

---

## 6. Test Çalıştırma (Mac'te)

```bash
cd ~/Documents/Claude/Projects/OneAce/oneace
pnpm vitest run \
  src/lib/i18n/tr-coverage.test.ts \
  src/lib/i18n/locale-parity.test.ts
```

`tr-coverage.test.ts` 48 namespace için tek tek `it.each` test + fallback regression guard + top-level `...en` spread guard çalıştırır. `expect(overridden.size).toBeGreaterThanOrEqual(48)` — bundan sonra eksik namespace = test failure.

---

## 7. Dikkat Çekici Çeviri Kararları

**Yaygın terimler (consistent across namespaces):**
- "Items" → "Ürünler"
- "Locations" → "Lokasyonlar" (warehouses anlamında)
- "Bins" → "Raflar"
- "Stock Counts" → "Stok Sayımları"
- "Movements" → "Hareketler"
- "Purchase Order (PO)" → "Satın Alma Siparişi"
- "Sales Order (SO)" → "Satış Siparişi"
- "Pick Tasks" → "Toplama Görevleri"
- "Kits & Bundles" → "Setler ve Paketler"
- "Reorder point" → "Yeniden sipariş eşiği"
- "On hand" → "Stokta"
- "Variance" → "Sapma"
- "Reconcile" → "Mutabakat"

**Kararsız/native review gerekli (Mahmut bakacak):**
- "Putaway" → "Yerleştirme" (alternatif: "Raflara yerleştirme")
- "Allocate" → "Tahsis et" (alternatif: "Ayır")
- "Backfill" / "Rollback" → "Geri alma"
- "Idempotency conflict" — teknik terim, çeviri yapıldı ama TR-native kullanıcı için anlamı belirsiz olabilir
- "Webhook" → İngilizce bırakıldı (Türkçe'de standart olmuş teknik terim)
- Audit action labels — UI'da kompakt görünmesi gerekir, bazıları uzadı (TR genleşme)

**Native review pass için Sprint 8'de:**
- Mahmut TR locale aktif olarak uygulamayı dolaşır
- Tutarsız/yapay TR string'leri işaretlerse → Sprint 8 PR ile düzeltme
- En önemli sayfalar: dashboard, items, stock-counts, reports, settings
