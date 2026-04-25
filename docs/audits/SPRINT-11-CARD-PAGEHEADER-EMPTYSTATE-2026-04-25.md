# Sprint 11 — Card kalan ad-hoc + hard-fail guard + PageHeader pack 5 + EmptyState pack 1

**Tarih:** 2026-04-25 (UX/UI audit Apr-25 follow-up)
**Bundle tag:** `v1.22.0-card-pageheader-emptystate-pass-5`
**Önceki HEAD:** `157cfb6` (Sprint 10 closure — `v1.21.0`)
**Yeni HEAD:** `1e1addd`

---

## PR #1 — Card kalan 7 ad-hoc + hard-fail guard

**Tag:** `v1.21.1-card-pack-2-guard`
**Commit:** `89e884d`

Sprint 10 PR #3 6 ad-hoc kullanımı `variant`'a çekmişti. Bu paket **kalan 7'yi** + raw severity className'e **hard-fail guard**.

| Dosya | Önce (className) | Sonra |
|---|---|---|
| `settings/general/settings-form.tsx:362` | `border-destructive/20 bg-destructive/5` | `variant="destructive"` |
| `settings/danger-zone-card.tsx:91` | `border-destructive/50 lg:col-span-2` | `variant="destructive" className="lg:col-span-2"` |
| `settings/transfer-ownership-card.tsx:140` | `border-warning/50 lg:col-span-2` | `variant="warning" className="lg:col-span-2"` |
| `migrations/new/page.tsx:434` | `border-destructive/50 bg-destructive/5` | `variant="destructive"` |
| `migrations/[id]/page.tsx:129` | `border-destructive/50` | `variant="destructive"` |
| `transfers/[id]/add-line/page.tsx:45` | `border-warning/20 bg-warning-light` | `variant="warning"` |
| `ui/upgrade-prompt.tsx:65` | `border-warning/60 bg-warning-light` | `variant="warning"` |

### Hard-fail guard

`sprint-11-card-variant-guard.test.ts` — yasaklı pattern:

```regex
/<Card[^>]*className="[^"]*\b(?:border-destructive|border-warning|bg-destructive\/\d+|bg-warning-light)\b[^"]*"/
```

Allow-list: `card.tsx` (CARD_VARIANTS map'i), `card.stories.tsx` (preview), test dosyaları.

**+ Sprint 10 audit doc** (push'a yetişmemişti) bu commit'e dahil edildi.

**Pinned tests:** `sprint-11-card-pack-2` (14 case = 7×2) + `sprint-11-card-variant-guard` (1 hard-fail case)

---

## PR #2 — PageHeader migration pack 5

**Tag:** `v1.21.2-pageheader-pack-5`
**Commit:** `2073df5`

PageHeader oranı **93 → 98/141 sayfa**. Migrate edilenler:

| Sayfa | Pattern |
|---|---|
| `suppliers/[id]/edit` | Form + custom back link (Button + Link `self-start` üstte kalıyor) |
| `departments/[id]` | Detail page, dynamic title (`{department.name}`) |
| `stock-counts/pending-approvals` | List page (Sprint 11 PR #3'te EmptyState de eklendi) |
| `stock-counts/compare` | Side-by-side görünüm |
| `stock-counts/templates/new` | Create form |

**Pinned test:** `sprint-11-pageheader-pack-5` (15 case = 5×3)

---

## PR #3 — EmptyState migration pack 1

**Tag:** `v1.21.3-emptystate-pack-1`
**Commit:** `1e1addd` (HEAD)

Önceki: 29 sayfa EmptyState kullanıyordu, ~30+ sayfa hâlâ manuel `<Card><CardContent><p text-center text-muted-foreground>No ...</p>` pattern'i kullanıyordu.

EmptyState surface **29 → 33** (+4 sayfa, pack 1):

| Sayfa | Icon | CTA |
|---|---|---|
| `stock-counts/pending-approvals` | `CheckCircle2` | yok |
| `stock-counts/templates` | `ListChecks` | "New Template" (capability'e bağlı) |
| `stock-counts/[id]/assignments` | `Users` | yok |
| `stock-counts/[id]/approval` | `FileSearch` | yok |

### Sprint 12+ pack 2 hedefi

`integrations/[slug]/*` panel'leri (sync-rules, webhook-events, sync-schedules, field-mapping) + `reports/*` "no data" durumları.

**Pinned test:** `sprint-11-empty-state-pack-1` (13 case = 4×3 migration + 1 threshold ≥33)

---

## Bundle özeti

```
1e1addd ui(emptystate): migration pack 1 — 4 sayfa (Sprint 11 PR #3)  [v1.21.3, v1.22.0 closure]
2073df5 ui(pageheader): migration pack 5 — 5 sayfa (Sprint 11 PR #2)  [v1.21.2]
89e884d ui(card): kalan 7 ad-hoc → variant + hard-fail guard (Sprint 11 PR #1)  [v1.21.1]
157cfb6 ui(card): variant prop normalize 7→3 (Sprint 10 PR #3)  (önceki HEAD)
```

**Closure tag:** `v1.22.0-card-pageheader-emptystate-pass-5` → 1e1addd
**Tüm tag'ler doğru commit'lerde** (`tag -f` POSIX-uyumlu, FUSE retag bug yok).

**Pinned test sayısı:** 4 yeni dosya, ~43 case
- `sprint-11-card-pack-2.test.ts` (14 case)
- `sprint-11-card-variant-guard.test.ts` (1 hard-fail case)
- `sprint-11-pageheader-pack-5.test.ts` (15 case)
- `sprint-11-empty-state-pack-1.test.ts` (13 case)

**Mac apply script:** `OneAce/apply-sprint-11.command` (POSIX, parallel array)

---

## Sprint 12+ backlog (güncel)

1. **EmptyState pack 2** — `integrations/[slug]/*` 4 panel + `reports/*` (~35-40+ coverage hedefi)
2. **PageHeader pack 6** — kalan 43/141 sayfa (~5 sayfa daha → 103/141)
3. **TR native review pass** (Mahmut manuel)
4. **Chromatic visual regression CI** (25 story snapshot baseline)
5. **Sidebar mobile + tablet usability tests** (Playwright)
