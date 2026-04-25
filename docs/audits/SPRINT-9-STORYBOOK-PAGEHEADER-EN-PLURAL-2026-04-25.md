# Sprint 9 — Storybook + PageHeader pack 3 + EN plural fix-up

**Tarih:** 2026-04-25 (UX/UI audit Apr-25 follow-up)
**Bundle tag:** `v1.20.0-storybook-pageheader-en-plural-pass-3`
**Önceki HEAD:** `4f2dcb0` (`v1.19.0-ux-a11y-bundle-2`)
**Yeni HEAD:** `8c2a3c3`

---

## PR #1 — 14 primitive Storybook stories

**Tag:** `v1.19.1-storybook-pack-2`
**Commit:** `de69498`

Storybook coverage 11 → **25** primitive story. Eklenen:

| Primitive | File | Story sayısı |
|---|---|---|
| Select | `select.stories.tsx` | 3 (Default, WithGroups, Disabled) |
| Label | `label.stories.tsx` | 3 (Default, WithInput, RequiredMark) |
| Textarea | `textarea.stories.tsx` | 3 (Default, WithLabel, Disabled) |
| Checkbox | `checkbox.stories.tsx` | 4 (Default, WithLabel, Checked, Disabled) |
| Switch | `switch.stories.tsx` | 3 (Default, Controlled, Disabled) |
| Dialog | `dialog.stories.tsx` | 3 (Basic, Form, Destructive) |
| Sheet | `sheet.stories.tsx` | 3 (Right, Left, Bottom) |
| Popover | `popover.stories.tsx` | 2 (Basic, Form) |
| DropdownMenu | `dropdown-menu.stories.tsx` | 2 (Basic, Checkboxes) |
| Avatar | `avatar.stories.tsx` | 3 (Default, FallbackOnly, Group) |
| Breadcrumb | `breadcrumb.stories.tsx` | 2 (TwoLevel, FourLevel) |
| Separator | `separator.stories.tsx` | 2 (Horizontal, Vertical) |
| Toaster (Sonner) | `sonner.stories.tsx` | 3 (Success, Error, Promise) |
| ScrollArea | `scroll-area.stories.tsx` | 2 (VerticalList, Compact) |

Tüm story'ler:
- TR string'lerle örneklenmiş (tutarlı locale)
- `tags: ["autodocs"]` autodocs aktif
- Component description'da semantic token / a11y kontrastı pin'lenmiş

**Pinned test:** `src/components/sprint-9-storybook-coverage.test.ts`
- 25 zorunlu story dosyası enumerate edildi
- Stat threshold ≥ 25 (Sprint 5: 1 + Sprint 8: 10 + Sprint 9: 14)

---

## PR #2 — PageHeader migration pack 3

**Tag:** `v1.19.3-pageheader-pack-3`
**Commit:** `8c2a3c3` (HEAD)

PageHeader oranı **83 → 88/141 sayfa**. Migrate edilenler:

| Sayfa | Önce | Sonra |
|---|---|---|
| `sales-orders/new/page.tsx` | `<h1 className="text-3xl font-bold">Create Sales Order</h1>` | `<PageHeader title="Create Sales Order" />` |
| `items/import/page.tsx` | `<h1 className="text-2xl font-semibold">{t.itemsImport.heading}</h1>` + paragraf | `<PageHeader title={t.itemsImport.heading} description={t.itemsImport.subtitle} />` |
| `vehicles/page.tsx` | manuel `flex justify-between` + h1 + Link | `<PageHeader title=... description=... actions={canManage ? <Link ... /> : undefined} />` |
| `stock-counts/templates/page.tsx` | manuel justify-between + h1 + Plus button | `<PageHeader title="Count Templates" description=... actions={canCreate ? ... : undefined} />` |
| `help/page.tsx` | h1 + inline Badge | `<PageHeader title="Help" badge={<Badge variant="secondary">v1.5</Badge>} description=... />` |

**Help page özelliği:** `PageHeader.badge` prop'u Sprint 1 PR #7'de eklenmişti — bu paket onu üretimde ilk kullanım.

**Pinned test:** `src/components/sprint-9-pageheader-pack-3.test.ts`
- 5 sayfa × 3 assertion (import + render + no-old-h1)

---

## PR #3 — EN plural fix-up (informational → hard fail)

**Tag:** `v1.19.2-en-plural-helper`
**Commit:** `22eca05`

Sprint 8 PR #2'de informational guard 7 dosyada inline `count === 1 ? "" : "s"` pattern bulmuştu.

### Yeni helper

`src/lib/i18n/plural.ts`:

```typescript
pluralizeEn(count, singular, plural?)        // "12 items" / "1 item"
pluralWordEn(count, singular, plural?)        // "items" / "item" (count yok)
formatCount(locale, count, { singular, plural?, tr? })  // locale-aware
```

### Migrate edilen 6 sayfa/komponent

| Dosya | Önce | Sonra |
|---|---|---|
| `transfers/page.tsx:106` | `${transfers.length} transfer${... !== 1 ? "s" : ""}` | `pluralizeEn(transfers.length, "transfer")` |
| `items/items-table.tsx:98` | `{count} item{count !== 1 ? "s" : ""} selected` | `{pluralizeEn(count, "item")} selected` |
| `items/page.tsx:492` | `{displayedItems.length} result{... !== 1 ? "s" : ""}` | `{displayedItems.length} {pluralWordEn(..., "result")}` |
| `items/page.tsx:540` | `${totalItems.toLocaleString()} item${... !== 1 ? "s" : ""}` | `${totalItems.toLocaleString()} ${pluralWordEn(totalItems, "item")}` |
| `stock-counts/[id]/variance-detail/page.tsx:200` | `across ${warehouses.length} warehouse${... === 1 ? "" : "s"}` | `across ${pluralizeEn(warehouses.length, "warehouse")}` |
| `reports/low-stock/page.tsx:212` | `({group.items.length} item{... !== 1 ? "s" : ""})` | `({pluralizeEn(group.items.length, "item")})` |
| `reports/stock-by-status/page.tsx:241` | `{summary.itemCount} item{... !== 1 ? "s" : ""}` | `{pluralizeEn(summary.itemCount, "item")}` |

### Allow-list (intentional EN plural)

`no-en-plural-template.test.ts` allow-list'i güncellendi:
- `src/lib/i18n/messages/en.ts` — EN-only catalog (function form), plural fork EN'de doğru
- `src/lib/i18n/plural.ts` — helper'ın kendisi (pattern'i yorumda gösteriyor)

### Test: informational → **hard fail**

```diff
-describe("PR #2 §B-plural — EN plural template guard (informational)", ...
-    expect(offenders.length).toBeGreaterThanOrEqual(0); // always-true, log için
+describe("PR #3 §B-plural — EN plural template guard (Sprint 9: hard fail)", ...
+    expect(offenders).toEqual([]);
```

**Pinned test (yeni):** `src/lib/i18n/plural.test.ts` — 12 case (pluralizeEn ×5, pluralWordEn ×2, formatCount ×3)

---

## Bundle özeti

```
8c2a3c3 ui(pageheader): migration pack 3 — 5 sayfa (Sprint 9 PR #2)  [v1.19.3]
22eca05 i18n(plural): app/ inline EN plural fork → pluralizeEn helper (Sprint 9 PR #3)  [v1.19.2]
de69498 build(storybook): 14 primitive story (Sprint 9 PR #1)  [v1.19.1]
4f2dcb0 ux+a11y bundle: Sprint 1 + Sprint 8 polish  [v1.19.0]  (önceki HEAD)
```

**Closure tag:** `v1.20.0-storybook-pageheader-en-plural-pass-3` → 8c2a3c3

**Pinned test sayısı:** 4 yeni dosya, ~30 case
- `sprint-9-storybook-coverage.test.ts` (2 case)
- `sprint-9-pageheader-pack-3.test.ts` (15 case = 5×3)
- `plural.test.ts` (12 case)
- `no-en-plural-template.test.ts` (1 case, hard fail)

**Mac apply script:** `OneAce/apply-sprint-9.command`
- FUSE clean → tag retag (4 tag) → push main + tags + stable → verify deploy → vitest run

---

## Sprint 10+ backlog (kalan)

1. **Card variant normalize 7→3** — şu an sadece `metric` variant var ama 7 farklı className kombinasyonu in-use
2. **EmptyState 29 → 50+ coverage** — tablo/liste sayfalarında manuel "no data" şekilleri
3. **TR native review pass** — Mahmut TR locale aktif gez, tutarsız çeviri varsa düzelt
4. **Tablet sidebar md:flex** — şu an sadece desktop sm: ve mobile
5. **Chromatic visual regression CI** — Storybook 25 story için snapshot baseline
6. **Kalan 53/141 PageHeader-yoksun sayfa** — tahmini 10 paket × 5 sayfa (Sprint 10..19)
