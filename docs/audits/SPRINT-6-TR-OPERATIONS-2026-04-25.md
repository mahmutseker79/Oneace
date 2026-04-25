# OneAce — Sprint 6: TR Operations + Procurement + Fulfillment

**Tarih:** 2026-04-25
**Hedef:** tr.ts coverage 23/47 → 32/47 namespace (~49% → ~68%).
**Tag:** `v1.17.0-tr-coverage-pass-3`
**Önceki:** [Sprint 3+4+5](./SPRINT-3-4-5-PROGRESS-2026-04-25.md) (`v1.16.x`)

---

## 1. Eklenen 9 Namespace

| Kategori | Namespace | Tag |
|---|---|---|
| Operations big | `movements` (full: types, typeHelp, fields, filter, detail, transfers wizard, scan-driven matching) | `v1.16.4-tr-operations-big` |
| Operations big | `itemDetail` (overview, pricing, stock, description, all column labels) | "" |
| Operations big | `stockCounts` (methodologies, statusBadge, fields, errors, detail.* with cancel dialog, variance enums, reconcile flow, rollback, varianceDetail) | "" |
| Operations big | `transfers.receive` (kabul akışı) | "" |
| Procurement | `suppliers` (full: detail page with KPI tiles, recent POs, top items, mixed currency caveat) | `v1.16.5-tr-procurement` |
| Procurement | `purchaseOrders` (full: status badges, filter, fields, receive flow, putaway, errors, detail audit) | "" |
| Fulfillment | `kits` (CRUD + assemble/disassemble errors) | `v1.16.6-tr-fulfillment` |
| Fulfillment | `picks` (CRUD + generate/assign/start/complete/verify errors) | "" |
| Fulfillment | `salesOrders` (CRUD + idempotency + ship + cancel + cannot-ship/allocate guards) | "" |

**tr.ts boyutu:** 787 → **1705 satır** (+918 satır TR çevirisi).

---

## 2. tr-coverage.test.ts

`REQUIRED_TR_NAMESPACES` listesi 21 → **32** namespace'e genişletildi. Soft progress log artık hard threshold:
```ts
expect(overridden.size).toBeGreaterThanOrEqual(32);
```

Sprint 7'de yeni namespace eklendiğinde test güncellenmeli.

---

## 3. Sprint 7 Backlog (kalan 15 namespace)

Kalanlar daha az kullanılan/admin yüzeyleri:

| Kategori | Namespace |
|---|---|
| Analytics | `reports` (büyük — 18 alt-namespace) |
| Settings | `settings` (5 alt-page) + `security` + `privacy` + `billing` ek |
| Admin | `users` + `audit` + `invitePage` |
| Inventory detay | `bins` + `locations` (separate from warehouses) + `serials` + `itemDetail` (zaten yapıldı, bonus) |
| Operations detay | `countZones` + `vehicles` |
| Tools | `itemsImport` + `imageUpload` |
| Inventory tools | `labels` + `pallets` |

Tahmini: ~1700 satır TR ekleme. `reports` tek başına ~270 satır (büyük). `audit` ~175. `users` ~100. Bunları 2 PR'da bölmek mantıklı.

---

## 4. Mahmut'un Mac'te Yapacağı

Mevcut script zincirine ekleme:
```bash
./apply-sprint-6.command   # 9 namespace TR + v1.17.0-tr-coverage-pass-3
```

Sırasıyla tüm Sprintler:
1. `cleanup-oneace2.command`
2. `apply-sprint-1.command` → `v1.15.0-ux-a11y-pass-1`
3. `apply-sprint-2.command` → `v1.16.0-tr-coverage-pass-1` (21 ns)
4. `apply-sprint-3.command` → `v1.16.1-tr-coverage-pass-2-partial` (23 ns)
5. `apply-sprint-4.command` → `v1.16.2-ux-state-pass-1-partial`
6. `apply-sprint-5.command` → `v1.16.3-storybook-pass-1-partial`
7. **`apply-sprint-6.command`** → `v1.17.0-tr-coverage-pass-3` (32 ns)

---

## 5. Kullanıcı Görünüm Özeti

**TR kullanıcı için artık Türkçe (Sprint 6 sonrası):**
- Sidebar + mobile drawer + search header (chrome)
- Login + register + 2FA + invite + onboarding wizard
- Dashboard (KPI, chart, quick actions, low-stock card)
- Items list + CRUD + reorder config + serials + attachments
- **Stock counts list + CRUD + reconcile + rollback + variance detail** (Sprint 6 yeni)
- **Movements ledger + new + filter + transfer wizard** (Sprint 6 yeni)
- **Suppliers list + CRUD + detail page with KPIs** (Sprint 6 yeni)
- **Purchase orders list + CRUD + receive + putaway + cancel** (Sprint 6 yeni)
- **Sales orders list + CRUD + ship + allocate + cancel** (Sprint 6 yeni)
- **Kits + Picks list + CRUD** (Sprint 6 yeni)
- Scan (camera + manual + result + quickAdd)
- Categories + Warehouses + Item detail
- Search + empty states + davet emaili + page metadata + PWA

**Hala İngilizce (Sprint 7 backlog):**
- Reports (18 sub-page)
- Settings (5 sub-page) + security + privacy + billing detail
- Users + audit log + invite page
- Bins + locations sub-pages + serials sub-page
- Vehicles + countZones
- itemsImport + imageUpload + labels + pallets

Yani **OneAce'in günlük operasyon yüzü tamamen Türkçe.** Admin/raporlama yüzü hala İngilizce — Sprint 7 hedefi.
