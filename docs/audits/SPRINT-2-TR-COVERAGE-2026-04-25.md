# OneAce — Sprint 2: TR Locale Coverage Genişletme

**Tarih:** 2026-04-25
**Hedef:** `tr.ts` override coverage'ı 4/47 namespace (~9%) → 21/47 (~45%)
**Tag:** `v1.16.0-tr-coverage-pass-1`
**Önceki:** [Sprint 1 — UX/UI a11y pass](./UX-UI-AUDIT-AND-SPRINT-1-2026-04-25.md) (`v1.15.0-ux-a11y-pass-1`)

---

## 0. Bağlam

Sprint 1 audit'te tespit edildi ki `messages/tr.ts` sadece 4 namespace override ediyordu (app, common, permissions, notifications). Geri kalan 43 namespace `...en` spread'i ile İngilizce'ye fallback yapıyordu. TR kullanıcısı için ürün büyük oranda İngilizce'ydi.

Sprint 2 bu boşluğu kullanıcı görünür **chrome + onboarding + operations kalbi** ile kapadı. Geri kalan ~26 namespace (business: warehouses, suppliers, PO, transfers, sales-orders, kits, picks, settings, vs.) Sprint 3 backlog.

---

## 1. Yapılan Değişiklikler

### 1.1 PR #1 — TR chrome surface (12 namespace)

Her sayfada görünen "kabuk" bileşenleri — sidebar, header, banner'lar, page metadata, mail template'leri, empty states, search.

| Namespace | Türkçe öne çıkanlar |
|---|---|
| `nav` | "Dashboard" → "Pano", "Items" → "Ürünler", "Stock Counts" → "Stok Sayımları" |
| `header` | "Search items, suppliers…" → "Ürün, tedarikçi, lokasyon ara…", "Sign out" → "Çıkış yap" |
| `advancedFeature` | "Advanced feature" → "İleri seviye özellik" |
| `mail.invitation` | Davet emaili tamamen TR |
| `metadata` | Page title + SEO description TR |
| `pwa` | "Install app" → "Uygulamayı yükle", "A new version available" → "Yeni sürüm mevcut" |
| `offline` | "You're offline" → "Çevrimdışısınız", cache status mesajları |
| `emptyStates` | 15 empty-state copy ("No pick tasks" → "Toplama görevi yok" vb.) |
| `copyLabels` | Copy SKU/Barkod/Sipariş numarası/Tedarikçi kodu |
| `billing` | "Items / Locations / Members" labelleri |
| `organizations.create` | Form + error mesajları |
| `search` | Sonuç UI'ı tamamen TR ("Type to start searching" → "Aramaya başlamak için yazın") |

### 1.2 PR #2 — Onboarding + Dashboard (3 namespace)

Yeni kullanıcı yolculuğu — kayıt, ilk org oluşturma, kurulum yönlendiricisi, ana pano.

| Namespace | Kapsanan kısımlar |
|---|---|
| `auth` | brand panel + login + register + onboarding wizard (welcome, trust pills) |
| `setup` | 3-adım onboarding checklist + post-setup bridge cards (reorder, movement, reports, team) + low-stock banner + trust micro-stats |
| `dashboard` | KPI başlıkları + caption'lar + 4 chart başlığı + low-stock card + recent-activity card + quick actions (4 buton) |

### 1.3 PR #3 — Operations (2 namespace)

Günlük operasyon kalbi — items list/CRUD, scan flow.

| Namespace | Kapsanan kısımlar |
|---|---|
| `items` | List heading + empty/filtered state + form fields (10+ field) + reorderConfig batch editor + attachments + serials + filter chips |
| `scan` | Camera UI (start/stop, denied, unsupported) + manual entry + result card (found/not found) + quickAdd dialog |

### 1.4 PR #4 — Coverage regression guard

`src/lib/i18n/tr-coverage.test.ts` (152 satır) — Sprint 2'de eklenen 21 namespace'in tr.ts'te override edilmiş kalmasını garantiler.

Test düzeyleri:
- **Hard pin:** 21 namespace `it.each` ile tek tek doğrulanır.
- **Pattern guard:** Her override bloğunda `...en.<namespace>` fallback'inin var olduğu kontrol edilir (key drift'i yakalar).
- **Top-level spread guard:** `export const tr: Messages = { ...en, ... }` patterninin korunduğu pin'lenir — bu spread Sprint 3 backlog'undaki ~26 namespace için fallback sağlıyor.
- **Progress signal:** Coverage % konsola loglanır (informational soft check).

---

## 2. Etki

### 2.1 tr.ts dosya boyutu

| Sürüm | Satır | Override | Ratio |
|---|---:|---:|---:|
| Sprint 1 öncesi | 120 | 4 | ~9% |
| Sprint 2 sonrası | 787 | 21 | ~45% |
| Sprint 3 hedefi | ~1500 | 47 | 100% |

### 2.2 Kullanıcı görünür yüzeyler

**TR kullanıcı için artık Türkçe (Sprint 2 sonrası):**
- ✅ Sidebar + mobile drawer (her sayfa)
- ✅ Header (search placeholder, notifications, sign out)
- ✅ Page title + SEO metadata (her sayfa)
- ✅ Login + register + 2FA + invite kabul akışı
- ✅ Onboarding wizard + activation checklist
- ✅ Dashboard (KPI'lar + 4 chart + 2 detail card + quick actions)
- ✅ Items liste + CRUD + reorder config + attachments + serials
- ✅ Scan (camera UI + manual + result + quickAdd)
- ✅ Search (sonuç UI'ı)
- ✅ Empty states (15 farklı sayfa empty body)
- ✅ Davet emaili (subject + body + footer)

**Hala İngilizce (Sprint 3 backlog):**
- ❌ Stock counts list/detail/templates/reconcile
- ❌ Movements list + new + types (RECEIPT/ISSUE)
- ❌ Reports (18 rapor sayfası)
- ❌ Purchase orders + suppliers
- ❌ Transfers + warehouse-to-warehouse
- ❌ Sales orders + ship + receive
- ❌ Kits + picks + labels + bins + pallets
- ❌ Categories + departments
- ❌ Settings (general, security, privacy, billing, integrations, reason-codes)
- ❌ Users + invite-page + audit log
- ❌ Vehicles + countZones + serials/locations sub-pages

---

## 3. Sprint 3 Önerilen Plan

**Tema:** "TR business surface tamamla — operasyon detayı + ayarlar"
**Tahmini efor:** 1-2 hafta (sadece TR çevirisi). Eş zamanlı yapılabilir başka iş: PageHeader migration paketi, EmptyState coverage genişletme, axe-core CI.

### Önerilen PR sıralaması

| # | Namespace'ler | Tahmini satır |
|---|---|---:|
| Sprint 3 PR #1 | warehouses, bins, locations, categories, departments | ~250 |
| Sprint 3 PR #2 | movements, stockCounts, countZones, itemDetail, serials | ~400 |
| Sprint 3 PR #3 | suppliers, purchaseOrders, transfers, salesOrders, picks, kits | ~450 |
| Sprint 3 PR #4 | reports (18 sub-namespace) | ~270 |
| Sprint 3 PR #5 | settings (security, privacy, billing, integrations, reason-codes) + users + audit + invitePage + imageUpload + labels + pallets + vehicles + itemsImport | ~350 |
| Sprint 3 PR #6 | tr-coverage test güncellenir — 21 → 47 namespace |

Sprint 3 sonu: `v1.17.0-tr-full-coverage`. tr.ts ≈ 1500 satır.

---

## 4. Mahmut'un Mac'te Yapacağı

**Sprint 1 + Sprint 2 birlikte:**
1. `cleanup-oneace2.command` (oneace2/ silinir)
2. `apply-sprint-1.command` (UX/UI a11y pass-1, 6 PR + closure)
3. `apply-sprint-2.command` (TR coverage pass-1, 4 PR + closure)
4. `cd oneace && ./scripts/verify.sh deploy`

3 script ardı ardına çalıştırılırsa main 7 micro-tag + 2 kümülatif sprint tag taşır:
- `v1.14.4-aria-current` → `v1.14.9-dashboard-pageheader`
- `v1.15.0-ux-a11y-pass-1` (Sprint 1 closure)
- `v1.15.1-tr-chrome` → `v1.15.4-tr-coverage-test`
- `v1.16.0-tr-coverage-pass-1` (Sprint 2 closure)

Sonu: `oneace/` `main` HEAD = stable = origin'de senkron.

---

## 5. Test Çalıştırma

Sandbox FUSE git/test çalıştırmıyor. Mahmut Mac'te:

```bash
cd ~/Documents/Claude/Projects/OneAce/oneace
pnpm vitest run src/lib/i18n/tr-coverage.test.ts
pnpm vitest run src/lib/i18n/locale-parity.test.ts
pnpm vitest run src/components/shell/aria-current-nav.test.ts
pnpm vitest run src/components/touch-target.test.ts
pnpm vitest run src/app/no-hardcoded-loading-divs.test.ts
pnpm vitest run src/app/a11y-skip-link.test.ts
pnpm vitest run 'src/app/(marketing)/legal/kvkk-token-bypass.test.ts'
pnpm vitest run 'src/app/(app)/dashboard/dashboard-page-header.test.ts'
```

8 test dosyası, hepsi static-analysis (vitest readFileSync + regex). Çalışma süresi <5sn toplamda.
