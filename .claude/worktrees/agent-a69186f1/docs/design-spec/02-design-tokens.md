# Design Tokens

## What tokens are and aren't

Tokens are **semantic variables** — names like `status.stock.critical` rather
than `red-600`. They abstract the visual layer so we can re-theme later (brand
refresh, high-contrast mode, customer white-label) without editing every
component. Tokens are *not*:

- a color palette (palettes are the raw values tokens reference)
- a component (components consume tokens but add layout and behavior)
- a brand guideline document (brand colors are one token layer among many)

Every token in this file has a JSON equivalent in [`tokens.json`](./tokens.json)
that both `apps/web` (via a Tailwind v4 `@theme` generator) and `apps/mobile`
(via a NativeWind theme preset) consume. Nothing duplicates values between
platforms.

## Token layers

1. **Primitive** — raw values (`hsl(222 47 11)`, `0.5rem`, `250ms`). Never
   referenced by components.
2. **Semantic** — role-based names (`surface.default`, `text.primary`,
   `status.count.variance`). Always referenced by components.
3. **Component** — component-local overrides (`button.primary.bg`). Rare.
   Only used when a semantic token is inadequate.

## Color tokens

### Surfaces

| Token                | Light                     | Dark                         |
| -------------------- | ------------------------- | ---------------------------- |
| `surface.default`    | `hsl(0 0% 100%)`          | `hsl(222 47 4)`              |
| `surface.muted`      | `hsl(210 40 96)`          | `hsl(217 33 10)`             |
| `surface.raised`     | `hsl(0 0% 100%)`          | `hsl(222 47 7)`              |
| `surface.container`  | `hsl(210 40 98)`          | `hsl(222 47 6)`              |
| `surface.overlay`    | `hsl(222 47 11 / 0.6)`    | `hsl(0 0% 0 / 0.7)`          |

### Text

| Token                | Light                     | Dark                         |
| -------------------- | ------------------------- | ---------------------------- |
| `text.primary`       | `hsl(222 47 11)`          | `hsl(210 40 98)`             |
| `text.secondary`     | `hsl(215 16 47)`          | `hsl(215 20 65)`             |
| `text.muted`         | `hsl(215 16 58)`          | `hsl(215 20 55)`             |
| `text.on-primary`    | `hsl(210 40 98)`          | `hsl(222 47 11)`             |
| `text.destructive`   | `hsl(0 72 45)`            | `hsl(0 85 65)`               |

### Borders & rings

| Token                | Light                     | Dark                         |
| -------------------- | ------------------------- | ---------------------------- |
| `border.default`     | `hsl(214 32 91)`          | `hsl(217 33 18)`             |
| `border.subtle`      | `hsl(214 32 95)`          | `hsl(217 33 13)`             |
| `ring.focus`         | `hsl(222 84 5)`           | `hsl(210 40 90)`              |

### Action — brand

The product's brand color is near-black so it stays calm under stress and
reads as serious, not consumer-playful.

| Token                       | Light                     | Dark                         |
| --------------------------- | ------------------------- | ---------------------------- |
| `action.primary.bg`         | `hsl(222 47 11)`          | `hsl(210 40 98)`             |
| `action.primary.fg`         | `hsl(210 40 98)`          | `hsl(222 47 11)`             |
| `action.primary.hover`      | `hsl(222 47 20)`          | `hsl(210 40 90)`             |
| `action.destructive.bg`     | `hsl(0 72 45)`            | `hsl(0 85 50)`               |
| `action.destructive.fg`     | `hsl(0 0 100)`            | `hsl(0 0 100)`               |

### Status — stock

Stock level chips on list rows and card corners. Paired with an icon, never
color-alone.

| Token                     | Light                     | Dark                         |
| ------------------------- | ------------------------- | ---------------------------- |
| `status.stock.critical`   | `hsl(0 72 45)`            | `hsl(0 85 65)`               |
| `status.stock.low`        | `hsl(25 90 50)`           | `hsl(25 90 60)`              |
| `status.stock.normal`     | `hsl(142 70 36)`          | `hsl(142 60 55)`             |
| `status.stock.high`       | `hsl(199 89 48)`          | `hsl(199 80 60)`             |
| `status.stock.excess`     | `hsl(262 52 47)`          | `hsl(262 60 70)`              |

### Status — count lifecycle

Matches the `COUNT_STATES` enum in `packages/schema/src/enums.ts`.

| Token                         | Maps to `state` | Light                     | Dark                         |
| ----------------------------- | --------------- | ------------------------- | ---------------------------- |
| `status.count.open`           | `open`          | `hsl(217 91 60)`          | `hsl(217 91 65)`             |
| `status.count.in_progress`    | `in_progress`   | `hsl(38 92 50)`           | `hsl(38 92 60)`              |
| `status.count.completed`      | `completed`     | `hsl(142 70 36)`          | `hsl(142 60 55)`             |
| `status.count.cancelled`      | `cancelled`     | `hsl(215 16 58)`          | `hsl(215 20 45)`             |

### Status — variance classification

Matches `calculateVariances` return status from `@oneace/core/stockcount`.

| Token                             | Maps to `status`      | Light             | Dark               |
| --------------------------------- | --------------------- | ----------------- | ------------------ |
| `status.variance.match`           | `match`               | `hsl(142 70 36)`  | `hsl(142 60 55)`   |
| `status.variance.within_tolerance`| `within_tolerance`    | `hsl(199 89 48)`  | `hsl(199 80 60)`   |
| `status.variance.over`            | `over`                | `hsl(38 92 50)`   | `hsl(38 92 60)`    |
| `status.variance.under`           | `under`               | `hsl(0 72 45)`    | `hsl(0 85 65)`     |

### Status — sync / connectivity

| Token                     | Meaning                         | Light              | Dark               |
| ------------------------- | ------------------------------- | ------------------ | ------------------ |
| `status.sync.online`      | Connected, all queued synced     | `hsl(142 70 36)`   | `hsl(142 60 55)`   |
| `status.sync.offline`     | No network                       | `hsl(215 16 58)`   | `hsl(215 20 45)`   |
| `status.sync.syncing`     | Active background sync           | `hsl(199 89 48)`   | `hsl(199 80 60)`   |
| `status.sync.error`       | Sync failed                      | `hsl(0 72 45)`     | `hsl(0 85 65)`     |
| `status.sync.conflict`    | Conflict needs resolution        | `hsl(25 90 50)`    | `hsl(25 90 60)`    |

### Status — scanner

| Token                     | Meaning                | Light              | Dark               |
| ------------------------- | ---------------------- | ------------------ | ------------------ |
| `status.scan.ready`       | Viewfinder armed       | `hsl(217 91 60)`   | `hsl(217 91 65)`   |
| `status.scan.success`     | Code matched item      | `hsl(142 70 36)`   | `hsl(142 60 55)`   |
| `status.scan.error`       | Camera / decode fail   | `hsl(0 72 45)`     | `hsl(0 85 65)`     |
| `status.scan.not_found`   | Code OK, no item       | `hsl(38 92 50)`    | `hsl(38 92 60)`    |

## Typography

Inter family, variable weights 400/500/600/700. Numbers use tabular figures
everywhere they represent quantities.

| Token         | Size   | Line ht | Weight | Use                             |
| ------------- | ------ | ------- | ------ | ------------------------------- |
| `display`     | 32px   | 40px    | 600    | Page title, empty-state hero    |
| `headline`    | 24px   | 32px    | 600    | Card title, section heading     |
| `title`       | 18px   | 28px    | 600    | List item title, dialog title   |
| `body`        | 14px   | 20px    | 400    | Default prose                   |
| `body-strong` | 14px   | 20px    | 500    | Label on form row               |
| `label`       | 12px   | 16px    | 500    | Axis label, chip text           |
| `caption`     | 12px   | 16px    | 400    | Helper text, muted meta         |
| `numeric.lg`  | 28px   | 36px    | 600    | KPI tile value (tabular)        |
| `numeric.md`  | 18px   | 24px    | 600    | Table cell qty (tabular)        |
| `numeric.sm`  | 14px   | 20px    | 500    | Inline counted qty (tabular)    |
| `mono.sku`    | 12px   | 16px    | 500    | SKU, barcode, ID                |

## Spacing

Tailwind's 0.25rem (4px) base. Tokens in use:

- `space.0` = 0
- `space.1` = 4px
- `space.2` = 8px
- `space.3` = 12px
- `space.4` = 16px
- `space.6` = 24px
- `space.8` = 32px
- `space.10` = 40px
- `space.12` = 48px
- `space.16` = 64px

Rule: multiples of 4 only. No `space.5` (20px), no `space.7` (28px).

## Radius

- `radius.sm` = 4px
- `radius.md` = 6px
- `radius.lg` = 8px
- `radius.xl` = 12px
- `radius.full` = 9999px

Buttons `md`, cards `lg`, pills `full`, modal corners `lg`.

## Elevation (shadow)

Used sparingly. Most surfaces are flat.

- `shadow.sm` — table row hover, input focus
- `shadow.md` — popover, dropdown
- `shadow.lg` — dialog, bottom sheet (mobile)
- `shadow.xl` — command palette overlay

## Motion

Subtle by default. Never animate content that will change position during
user reading.

- `motion.duration.fast` = 150ms — button press, hover
- `motion.duration.default` = 200ms — dialog open, accordion
- `motion.duration.slow` = 300ms — page-level transitions
- `motion.ease.standard` = `cubic-bezier(0.2, 0, 0, 1)`
- `motion.ease.decelerate` = `cubic-bezier(0, 0, 0, 1)`

## Icon sizes

Lucide icon family. Always matches text baseline.

- `icon.xs` = 12px (beside `caption`)
- `icon.sm` = 14px (beside `body`)
- `icon.md` = 16px (default in buttons)
- `icon.lg` = 20px (toolbar)
- `icon.xl` = 24px (navigation)

## Touch targets

Minimum 44×44 pt on mobile. Applied to every interactive element via minimum
height on buttons and padding on list rows. Never violated.

## Accessibility notes

- All text/background pairings hit WCAG AA (4.5:1 for body, 3:1 for large).
- Focus ring is `ring.focus` at 2px solid. Never suppressed.
- `prefers-reduced-motion` disables all non-feedback transitions.
- `prefers-color-scheme` toggles between light and dark token sets.
