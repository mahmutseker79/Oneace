# Sprint 13 — Card info migration + EmptyState pack 3 + PageHeader pack 7

**Tarih:** 2026-04-25 (UX/UI audit Apr-25 follow-up)
**Bundle tag:** `v1.24.0-card-info-emptystate-pageheader-pass-7`
**Önceki HEAD:** `e543b76` (Sprint 12 closure — `v1.23.0`)
**Yeni HEAD:** `f2ea283`
**+ Sprint 12 PR #2 hotfix:** `movements/transfers/new` ikinci branch h1 (PR #3 commit'inde bundle)

---

## PR #1 — Card info variant migration + guard widening

**Tag:** `v1.23.1-card-info-migration`
**Commit:** `8275c2c`

Sprint 12 PR #3 Card primitive'e `info` variant eklemişti. Bu PR onu üretimde kullanır.

### Migrate

| Dosya | Önce | Sonra |
|---|---|---|
| `reports/serial-traceability/page.tsx:162` | `<Card className="bg-info-light border-info">` | `<Card variant="info">` |

### Hard-fail guard widening

`sprint-13-card-info-migration.test.ts` Sprint 11 Card severity guard'ını genişletti:

```regex
/<Card[^>]*className="[^"]*\b(?:border-info|bg-info-light|bg-info\/\d+)\b[^"]*"/
```

Artık Card primitive 5 variant'la korunur (Sprint 11 destructive/warning + Sprint 13 info).

**Pinned test:** `sprint-13-card-info-migration.test.ts` (3 case)

---

## PR #2 — EmptyState migration pack 3

**Tag:** `v1.23.2-emptystate-pack-3`
**Commit:** `d15a8c3`

EmptyState surface **33 → 40** (Sprint 12 +4 panel + bu pack +3 sayfa).

| Sayfa | Icon | Bare? |
|---|---|---|
| `kits/[id]/page.tsx` | `Package` | ✅ (Card içinde) |
| `integrations/[slug]/page.tsx` | `RefreshCw` (sync history) | ❌ (standalone) |
| `reports/scan-activity/scan-activity-client.tsx` | `ScanLine` | ❌ (standalone) |

**Pinned test:** `sprint-13-empty-state-pack-3.test.ts` (10 case = 3×3 + threshold ≥38)

---

## PR #3 — PageHeader migration pack 7 (4 surface) + Sprint 12 hotfix

**Tag:** `v1.23.3-pageheader-pack-7`
**Commit:** `f2ea283` (HEAD)

PageHeader page-level oranı **103 → 106/141**. Migrate edilen surface'ler:

| Surface | Pattern |
|---|---|
| `transfers/new/page.tsx` | Card+CardTitle → PageHeader (with `backHref`) + form Card |
| `transfers/[id]/add-line/page.tsx` | Card+CardTitle → PageHeader + form Card |
| `sales-orders/[id]/ship/page.tsx` | h1 client → PageHeader |
| `vehicles/vehicle-form.tsx` | h1 (component) → PageHeader; vehicles/new + /[id] iki sayfaya etki eder |

### Sprint 12 PR #2 hotfix bundle dahil

`movements/transfers/new/page.tsx` ikinci branch'taki h1 kalıntı (replace_all indent farkı, Sprint 12 push'unda Mahmut'un Mac'inde test fail vermişti) bu commit'te düzeltildi. Sprint 12 hotfix script'ini AYRICA çalıştırmaya gerek yok — Sprint 13 bundle ediyor.

**+ Sprint 12 audit doc** include edildi.

**Pinned test:** `sprint-13-pageheader-pack-7.test.ts` (12 case = 4×3)

---

## Bundle özeti

```
f2ea283 ui(pageheader): migration pack 7 — 4 surface + Sprint 12 hotfix (Sprint 13 PR #3)  [v1.23.3, v1.24.0 closure]
d15a8c3 ui(emptystate): migration pack 3 — 3 sayfa (Sprint 13 PR #2)  [v1.23.2]
8275c2c ui(card): info variant migration + guard widening (Sprint 13 PR #1)  [v1.23.1]
e543b76 ui(card): info variant (5th) + Storybook story (Sprint 12 PR #3)  (önceki HEAD)
```

**Closure tag:** `v1.24.0-card-info-emptystate-pageheader-pass-7` → f2ea283
**Tüm tag'ler doğru commit'lerde.**

**Pinned test sayısı:** 3 yeni dosya, ~25 case
- `sprint-13-card-info-migration.test.ts` (3 case)
- `sprint-13-empty-state-pack-3.test.ts` (10 case)
- `sprint-13-pageheader-pack-7.test.ts` (12 case)

**Mac apply script:** `OneAce/apply-sprint-13.command` (POSIX, parallel array)

---

## Sprint 14+ backlog (güncel)

1. **EmptyState pack 4** — 5+ daha sayfa (40→45+) — özellikle reports/* tableleri
2. **PageHeader pack 8** — kalan ~35 sayfa (108/141 hedef bir sonraki pack)
3. **TR native review pass** (Mahmut manuel)
4. **Chromatic visual regression CI** (25 story snapshot baseline)
5. **Card variant'ları için Storybook accessibility addon kontrastı** (a11y addon zaten kurulu, story başına kontrol)
