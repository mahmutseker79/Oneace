# Sprint 10 — Tablet sidebar + PageHeader pack 4 + Card variant normalize

**Tarih:** 2026-04-25 (UX/UI audit Apr-25 follow-up)
**Bundle tag:** `v1.21.0-tablet-pageheader-card-pass-4`
**Önceki HEAD:** `c8905b3` (Sprint 9 closure — `v1.20.0`)
**Yeni HEAD:** `157cfb6`

---

## PR #1 — Tablet sidebar md:flex

**Tag:** `v1.20.1-tablet-sidebar`
**Commit:** `ced8fe8`

Önceki: sidebar `lg:flex` (≥1024px) ile mobile arasında **768-1024 (iPad portrait/landscape) sidebar görünmüyordu** — kullanıcı sürekli hamburger menü açmak zorundaydı.

3 dosya:

| Dosya | Önce | Sonra |
|---|---|---|
| `sidebar.tsx:160` | `hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0` | `hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0` |
| `header.tsx:110` | `lg:hidden` (hamburger) | `md:hidden` |
| `(app)/layout.tsx:99` | `lg:pl-64` | `md:pl-64` |

**Pinned test:** `src/components/sprint-10-tablet-sidebar.test.ts` (4 case)

---

## PR #2 — PageHeader migration pack 4

**Tag:** `v1.20.2-pageheader-pack-4`
**Commit:** `ef301f9`

PageHeader oranı **88 → 93/141 sayfa**. Migrate edilenler:

| Sayfa | Pattern |
|---|---|
| `departments/new/page.tsx` | Basit form, h3xl heading |
| `items/reorder-config/page.tsx` | Form + custom back link (Button + Link kalıyor üstte, `self-start`) |
| `inventory/status-change/page.tsx` | Form + `backHref="/items"` (PageHeader built-in) |
| `organizations/new/page.tsx` | `badge={<Building2 ... />}` ile icon |
| `labels/designer/page.tsx` | Form + `backHref="/labels"` + dynamic title (isEdit) |

**Pinned test:** `src/components/sprint-10-pageheader-pack-4.test.ts` (5 sayfa × 3 assertion = 15 case)

---

## PR #3 — Card variant normalize 7→3

**Tag:** `v1.20.3-card-variants`
**Commit:** `157cfb6` (HEAD)

Önceki Card primitive variant prop'u yoktu — tüm styling ad-hoc className kombinasyonlarıyla yapılıyordu (7+ farklı pattern).

### Yeni API

```typescript
// src/components/ui/card.tsx
const CARD_VARIANTS = {
  default: "",
  interactive: "hover:bg-muted/50 cursor-pointer transition-colors",
  warning: "border-warning/50 bg-warning-light",
  destructive: "border-destructive/50 bg-destructive/5",
} as const;

export type CardVariant = keyof typeof CARD_VARIANTS;
// <Card variant="warning">...</Card>
// <Card data-variant="warning">  // emit edilen DOM attribute
```

### Migrate edilen 6 ad-hoc kullanım

| Önce (className) | Sonra (variant) | Sayfa |
|---|---|---|
| `hover:bg-muted/50 cursor-pointer transition-colors` | `interactive` | `departments/page.tsx` |
| `hover:bg-muted/50 cursor-pointer transition-colors` | `interactive` | `stock-counts/pending-approvals/page.tsx` |
| `hover:bg-muted/50 cursor-pointer transition-colors` | `interactive` | `stock-counts/templates/page.tsx` |
| `border-warning bg-warning-light` | `warning` | `transfers/new/page.tsx` |
| `border-warning bg-warning-light` | `warning` | `transfers/[id]/receive/page.tsx` |
| `border-destructive` | `destructive` | `settings/privacy/page.tsx` |

### Storybook

3 yeni story: `Interactive`, `Warning`, `Destructive` (`card.stories.tsx` 4 → 7 story).

### Sprint 11+ backlog

Kalan ~10 ad-hoc kullanım `border-warning/50`, `border-destructive/50`, `border-destructive/20 bg-destructive/5` da variant'a çekilecek + raw className **hard-fail guard** yazılacak.

**Pinned test:** `src/components/sprint-10-card-variants.test.ts` (10 case = 4 primitive + 6 migration)

---

## Bundle özeti

```
157cfb6 ui(card): variant prop normalize 7→3 (Sprint 10 PR #3)  [v1.20.3, v1.21.0 closure]
ef301f9 ui(pageheader): migration pack 4 — 5 sayfa (Sprint 10 PR #2)  [v1.20.2]
ced8fe8 ui(shell): tablet sidebar — lg: → md: (Sprint 10 PR #1)  [v1.20.1]
c8905b3 docs(audit): Sprint 9 audit doc  (önceki HEAD)
```

**Closure tag:** `v1.21.0-tablet-pageheader-card-pass-4` → 157cfb6

**Pinned test sayısı:** 3 yeni dosya, ~29 case
- `sprint-10-tablet-sidebar.test.ts` (4 case)
- `sprint-10-pageheader-pack-4.test.ts` (15 case = 5×3)
- `sprint-10-card-variants.test.ts` (10 case)

**Mac apply script:** `OneAce/apply-sprint-10.command`
- POSIX-uyumlu (parallel array — bash 3.x'te de çalışır)
- 8 adım: FUSE clean → index refresh → status → commit kontrol → tag durumu → push main → push 4 tag + stable → verify deploy + vitest

---

## Sprint 11+ backlog (güncel)

1. **Kalan ~10 ad-hoc Card className** — variant'a çevir + raw guard hard-fail
2. **EmptyState 29 → 50+ coverage**
3. **TR native review pass** (Mahmut manuel)
4. **Chromatic visual regression CI** (25 story snapshot baseline)
5. **Kalan 48/141 PageHeader-yoksun sayfa** — pack 5+ (~10 paket)
