# Sortly — Figma-Ready Blueprint

**Companion document to** `sortly-teardown.md`.
**Purpose:** a designer or PM can rebuild every Sortly screen in Figma using only this file. Every page lists its layout, every field lists label/type/placeholder/validation, every button lists its action, every menu lists its items, every modal lists its copy.
**Scope:** web app on a Turkish Free-plan demo account at `https://app.sortly.com`, observed 2026-04-10 at 1512×827 viewport. Mobile not specced here.
**Reading order:**
- Part A — Design tokens
- Part B — Global chrome components
- Part C — Page-by-page blueprint (27 pages)
- Part D — Flows (sequential steps)
- Part E — Component library
- Part F — Modals library
- Part G — Empty states library
- Part H — Interaction patterns
- Part I — Recommended Figma file structure

---

# PART A — DESIGN TOKENS

## A.1 Colour tokens

| Token | Hex (observed) | Usage |
|---|---|---|
| `red/primary` | `#D24C52` | Left rail background, primary CTAs, focus ring |
| `red/primary-hover` | `#B9393F` (inferred) | Button hover |
| `red/paywall-accent` | `#D24C52` | Upsell modal headline & checkmarks |
| `neutral/0` | `#FFFFFF` | Page background, cards |
| `neutral/50` | `#F7F8FA` | Rail icon hover, table row stripe |
| `neutral/100` | `#EFF1F4` | Subtle dividers |
| `neutral/200` | `#DDE1E7` | Input borders, card borders |
| `neutral/400` | `#9AA0A6` | Placeholder text, muted labels |
| `neutral/600` | `#5F6368` | Secondary text |
| `neutral/900` | `#1F2328` | Primary text |
| `accent/green` | `#34A853` | "New" badges, success toasts |
| `accent/amber` | `#F5A524` | Low-stock alerts |
| `accent/danger` | `#D24C52` (shared with primary) | Destructive confirmations |
| `accent/teal-muted` | inferred | "New" pill backgrounds on workflow cards |

No dark mode ships. One primary colour. Brand reads as "photo-first with a red accent rail."

## A.2 Typography tokens

| Token | Family | Weight | Size | Line height | Usage |
|---|---|---|---|---|---|
| `display/h1` | Nunito / Poppins | 700 | 28 px | 36 | Page headline ("Dashboard", "Items") |
| `display/h2` | same | 700 | 22 px | 30 | Section title in cards |
| `display/h3` | same | 600 | 18 px | 26 | Workflow card title |
| `body/large` | same | 400 | 16 px | 24 | Item name, card body |
| `body/base` | same | 400 | 14 px | 22 | Form labels, body copy |
| `body/small` | same | 400 | 12 px | 18 | Helper, footer version |
| `label/uppercase` | same | 600 | 11 px | 16 | Field labels, tab labels (letter-spacing ~0.6) |
| `numeric/hero` | same | 700 | 32 px | 40 | Item quantity hero on detail |
| `numeric/medium` | same | 700 | 20 px | 28 | Price display, dashboard metric |
| `mono/code` | system mono | 400 | 12 px | 18 | SID, API keys |

## A.3 Spacing tokens (4 px grid)

| Token | Value | Usage |
|---|---|---|
| `space/1` | 4 px | Tight icon gaps |
| `space/2` | 8 px | Badge padding, inline icon gap |
| `space/3` | 12 px | Card inner padding bottom |
| `space/4` | 16 px | Standard gutter |
| `space/5` | 20 px | Section vertical rhythm |
| `space/6` | 24 px | Card padding, inline group gap |
| `space/8` | 32 px | Page section gap |
| `space/10` | 40 px | Dashboard hero padding |
| `space/12` | 48 px | Empty state illustration padding |
| `space/16` | 64 px | Page margin on very wide screens |

## A.4 Radius, elevation, border

| Token | Value |
|---|---|
| `radius/input` | 6 px |
| `radius/button` | 6 px |
| `radius/card` | 8 px |
| `radius/modal` | 12 px |
| `radius/pill` | 999 px |
| `border/default` | 1 px `neutral/200` |
| `border/focus` | 2 px `red/primary` |
| `shadow/card` | `0 1px 2px rgba(0,0,0,0.04)` |
| `shadow/modal` | `0 20px 40px rgba(0,0,0,0.16)` |
| `shadow/popover` | `0 8px 24px rgba(0,0,0,0.10)` |

## A.5 Layout grid

- **Viewport observed:** 1512 × 827, scale mismatch to 1485 screenshots.
- **Page shell:** 72 px left rail + 1 fr main + 360 px right Sage panel = roughly 1152 px of usable main content at full width.
- **Main content max-width:** ~1100 px centered, with side padding `space/8`.
- **Columns:** 12-col grid inside the main region, 24 px gutters, 16 px outer margin.

---

# PART B — GLOBAL CHROME COMPONENTS

## B.1 Left icon rail

**Dimensions:** 72 px wide, 100 vh tall, fixed position. Background `red/primary`. Foreground `neutral/0`.

**Structure (top to bottom):**
1. **Logo (top).** 48 × 48 clickable, routes to `/dashboard`. White wordmark on red.
2. **Primary nav group** — 7 icon+label items, vertical stack, each 60 × 72 (icon 24 px, label 10 px uppercase beneath):
   | Order | Icon | Label | Path | Badge |
   |---|---|---|---|---|
   | 1 | Home | Dashboard | `/dashboard` | — |
   | 2 | Folder | Items | `/items` | — |
   | 3 | Magnifier | Search | `/advanced-search` | — |
   | 4 | Tag | Tags | `/tags` | — |
   | 5 | Zap/Flow | Workflows | `/workflows` | `NEW` (green pill top-right of icon) |
   | 6 | Chart | Reports | `/reports` | — |
   | 7 | Flask | Labs | `/labs` | `BETA` (neutral pill) |
3. **Upgrade tile.** Gold/gradient CTA tile pinned near bottom. Routes to `/upgrade-plan`. ~60 × 64 with text "Upgrade Plan".
4. **Utility cluster (bottom):** 4 icon buttons at 40 × 40:
   - **Product News** — megaphone icon, opens Frill changelog popover. Badge shows unread count (observed: `10`).
   - **Help** — question-mark icon, opens help popover.
   - **Notifications** — bell icon, keyboard shortcut `Alt+T`.
   - **Settings** — gear icon, switches main region to Settings column.

**Active state:** icon and label in `neutral/0` with a 4 px left border accent in lighter red.
**Hover state:** background lifts to `rgba(255,255,255,0.08)`.
**Tooltip:** label is always visible underneath — no hover tooltip layer.

## B.2 Top-right Sage panel

**Dimensions:** ~360 px wide, full height, anchored to right edge of main region. Background `neutral/0`, border `border/default` on left.

**Structure:**
- **Header strip** (48 px): title "Sortly Sage", owl icon, collapse chevron.
- **Greeting block** ("Hi {FirstName}! I'm Sage, your Sortly assistant. Here are a few common questions I can answer.").
- **Seed prompts list** — 6 rows, each a clickable chip:
  1. How to add items?
  2. How to create Invoices?
  3. How to upgrade?
  4. How to print barcode labels?
  5. How to set up my inventory?
  6. How to import?
- **Chat transcript region** — scrollable, fills remaining height.
- **Input** — single-line text field with placeholder "Type your question here…" and a paper-plane send button.
- **Disclaimer strip** — "Sortly Sage can make mistakes. Please verify critical details." in `body/small neutral/400`.

**Collapsible.** An owl icon in the bottom-right of the main region toggles visibility. Default: open.

## B.3 Footer strip

**Position:** bottom of every page, 32 px tall.
**Content:** centred text `Version: v10.107.0-R216.0.0` in `body/small neutral/400`.

## B.4 Toast region

- **Anchor:** bottom-centre, 24 px above footer.
- **Width:** 360 px, `radius/modal`, `shadow/modal`.
- **Variants:** success (green left bar), danger (red left bar), info (neutral).
- **Auto-dismiss:** 4 s.

## B.5 Page-level 404

- Full-width card in the main region.
- Line-art illustration: "question mark on a box".
- Headline (`display/h2`): **"Oops! Something went wrong"**
- Sub (`body/base`): **"Page not found"**
- Primary button: `GO TO DASHBOARD` → `/dashboard`.
- Secondary link: `GO BACK` (history.back()).

---

# PART C — PAGE-BY-PAGE BLUEPRINT

Each section below lists: path, purpose, layout sketch, every field, every button, every menu, every interaction. Where a page was only partially observable (paid-gated), inferences are marked `[inferred]`.

## C.1 Dashboard — `/dashboard`

**Purpose:** welcome / first-run orientation / usage meter. No charts on Free.
**Layout:** 12-col grid. Left 9 cols = content, right 3 cols = Sage.

**Regions (top → bottom):**
1. **Greeting card** — `display/h1` "Good {morning|afternoon|evening}, {FirstName}" + sub "{today's date}". Padding `space/10`.
2. **Getting Started checklist card** — 4 checklist items:
   - [ ] **Add your first item** → opens Add Item modal
   - [ ] **Add a folder** → opens Add Folder modal
   - [ ] **Invite a teammate** → gated; triggers Upgrade modal
   - [ ] **Set up a label** → opens Create Labels modal
   Each row: circle check, title, one-line description, right-aligned arrow or CTA button.
3. **Usage meter card** — compact bar showing "X of 100 items used". Tooltip: "You're on the Free plan. Upgrade for more." A `View plans` link.
4. **Quick actions row** — 3 tiles: `Add Item`, `Add Folder`, `Import`. Each tile 200 × 120 with icon and label.
5. **Recent activity** `[inferred]` — rolling feed (may be empty on new accounts).

**No metric charts on Free tier.** This is a deliberate gap — real dashboards live in Reports (paid).

## C.2 Items browser — `/items`

**Purpose:** root of the folder/item tree.

**Top bar of the main region (left→right):**
- **Breadcrumbs:** `All Items` (dropdown arrow for folder tree jump)
- **Search All Items** — input with magnifier icon, placeholder `Search All Items`, clears on `Esc`.
- **View toggle** — segmented control: `Grid` | `List`. Default Grid.
- **Group Items** toggle — switch, label "Group Items". Off by default. When on, items with the same Sortly ID are rolled up.
- **Sort** dropdown — options: Name A-Z, Name Z-A, Recently Added, Recently Updated, Quantity High-Low, Quantity Low-High.
- **Primary button cluster (right):**
  - **Add Item** — primary red
  - **Add Folder** — secondary
  - **More** (overflow ⋯) — opens menu: `Bulk Import`, `History`, `Trash`, `Export`

**Grid layout:**
- **Folder card** — 240 × 220. Mosaic of 4 item thumbnails composited on the card face. Folder name at bottom-left, item count badge at top-right. Click → `/folder/{id}/content`.
- **Item card** — 240 × 280. Photo hero 240 × 180, text block 100 px. Text block: item name (bold, 16 px), quantity (20 px bold) + unit, price (14 px muted). A `NEW` corner badge for items added in the last 24h.

**Observed seed folders (demo):**
- Main Location (id 108282915)
- Storage Area (id 108282916)
- Truck (id 108282917)

**List mode:** table with columns — thumbnail (40 px), Name, Quantity, Unit, Price (TRY), Min Level, Tags, Updated, overflow.

**Empty state:** illustration of a cardboard box + headline "No items yet" + `body/base` "Add your first item or import from CSV." + primary button `Add Item` + secondary `Import`.

## C.3 Folder detail — `/folder/{id}/content`

Same layout as `/items` but with a breadcrumb trail and a **folder info bar** at the top:
- Folder name (editable inline)
- Count: `{n} items, {m} subfolders`
- Actions: `Edit Folder`, `Move Folder`, `Delete Folder`, `Export PDF`

## C.4 Item detail — `/item/{id}`

**Layout:** 2-column, 60/40 split.

### Left column (60%)
- **Photo carousel** — up to 8 photos, arrow nav, dot indicators at bottom. Full-bleed 640 × 480. Tap to zoom.
- **Quantity action row** directly below the photo:
  - `−` button (40 × 40, icon only)
  - Quantity numeric display (`numeric/hero`)
  - `+` button (40 × 40)
  - Unit label
- **Item name** as `display/h1` below the quantity row.
- **Action row (above the photo):** `Edit`, `Move`, `Export` (PDF item sheet), `Chart / Insights` (gated; triggers Ultra modal on Free), overflow menu (`Duplicate`, `Delete`, `Print Label`, `Share`, `History`).

### Right column (40%)
Field stack:
| Label | Value type | Notes |
|---|---|---|
| Sortly ID | Read-only text | Format `SOED8T0001`, auto-generated, editable |
| Price | Currency | Single price field on Free (no cost/sell split) |
| Min Level | Integer | Triggers low-stock alert when Qty ≤ Min |
| Barcode / QR code | Text + scan button | Opens webcam scanner |
| Notes | Long text | Multi-line |
| Tags | Chip list | Multi-select |
| Folder | Link | Click to jump to folder |
| {Custom field 1…N} | Dynamic | Rendered per type, Populated Fields by default |

### Activity timeline (bottom full-width)
- Reverse-chronological list.
- Each entry: avatar, "{User} {action} {field}: {old} → {new}", timestamp, relative (e.g. "2 hours ago").
- Examples: "Mahmut created this item", "Mahmut changed Quantity: 5 → 7", "Mahmut moved from Truck → Main Location".
- Filter dropdown: `All activity` | `Edits only` | `Moves only` | `Quantity only`.

## C.5 Item edit form — `/item/{id}/edit`

Single-column form, 640 px max width, centered. Sections separated by `space/8`.

### Fields (in order)

| # | Label | Type | Placeholder | Required | Validation | Notes |
|---|---|---|---|---|---|---|
| 1 | Name | Text | `Item name` | Yes | 1–190 chars | Bound to `display/h1` on detail |
| 2 | Photos | File upload (multi) | "Drag & drop or tap to upload" | No | max 8 files, jpg/png, 10 MB each | Mobile: camera-capture |
| 3 | Quantity | Number | `0` | Yes | ≥ 0, integer or decimal based on Unit | |
| 4 | Unit | Dropdown | `Select unit` | Yes | Company's unit list | Free plan has a limited subset |
| 5 | Price | Currency (TRY) | `0.00` | No | ≥ 0, 2 dp | Currency inherited from Company |
| 6 | Min Level | Number | `0` | No | ≥ 0 | Triggers low-stock alert |
| 7 | Tags | Multi-select chips | `Select tags` | No | — | Create new inline |
| 8 | Sortly ID (SID) | Text | auto | No | unique | Editable but auto-generated |
| 9 | Barcode / QR | Text + Scan button | `Enter or scan barcode` | No | — | Scan opens webcam |
| 10 | Notes | Textarea | `Add notes…` | No | ≤ 4000 chars | |
| 11 | Folder | Folder picker | `Choose folder` | Yes | one of company's folders | |
| 12 | Custom fields… | varies | per-type | per-type | per-type | Rendered at bottom |

### Buttons (bottom of form)
- `Save` — primary red
- `Save & Add Another` — secondary
- `Cancel` — text link
- `Delete` — destructive, bottom-right, triggers `Delete Item?` confirmation modal

## C.6 Add Item modal

Modal overlay, 640 × auto, `radius/modal`, `shadow/modal`.
**Header:** `display/h2` "Add Item", close X top-right.
**Body:** same fields as C.5 §Fields.
**Footer:** `Cancel` (text) · `Save & Add Another` (secondary) · `Save` (primary).

## C.7 Add Folder modal

- Fields: `Folder Name` (text, required), `Parent Folder` (folder picker, optional), `Cover Image` (file, optional).
- Buttons: `Cancel` · `Save`.

## C.8 Advanced Search — `/advanced-search`

**Layout:** 2-col, 320 px left filter panel + 1 fr results grid.

### Left filter panel (each filter collapsible)
1. **Folders** — multi-select tree with `All Folders` toggle.
2. **Name** — free-text, placeholder `Contains…`
3. **Quantity** — mode select (Min / Max / Exact) + two numerics + Unit dropdown (or `Any Units`).
4. **Min Level** — mode select (At or above / Below / Exact) + numeric.
5. **Price (TRY)** — Min / Max / Exact + two currency inputs. Currency label inherits company.
6. **Quantity Alerts** — toggle "Show items with active quantity alerts".
7. **Date Alerts** — date-type custom field picker + state select (`Overdue` / `Due Soon` / `Expired`).
8. **Tags** — multi-select chip.
9. **Sortly ID** — multi-select chip.
10. **Barcode / QR** — text input + scan button.
11. **Notes** — text contains.
12. **Custom filters** — dynamic, one row per custom field type.
13. **Summaries** — checkbox "Group items with the same Sortly ID".

Bottom of panel: `Clear All` (text link), `Save Search` (secondary — paid).

### Results grid (right)
- Header row: column chooser, sort, `Export CSV`, `Export PDF`.
- Rows: same columns as Items List mode.
- Pagination: `1 2 3 …`, default 25 per page.
- Row click → Item detail.

## C.9 Tags page — `/tags` and Tag detail — `/tags/{id}`

**Correction to an earlier draft:** this blueprint originally speculated that tags have a 12-colour swatch picker. That is **wrong**. Verified via the live Add Tag modal: a Sortly tag is just `{name}` — no colour, no icon, no description.

### C.9.a `/tags` empty list state

When the account has no tags: full-bleed line-art illustration, H2 *"No tags yet"* (approximate), one-sentence body, primary red `Add Tag` CTA centered. Matches the §B empty-state grammar.

### C.9.b `/tags` list (with tags)

- **Top bar:** page title `Tags` (H1), primary red `Add Tag` button top-right, search input (placeholder approximately `Search tags`).
- **Left rail list:** vertical list of tag rows, each row = tag name + small item-count chip, `▸` chevron on hover.
- **Main region:** on load, auto-routes to the first tag in the list — there is no standalone `/tags` landing after a tag is created. This is **the silent-redirect cluster pattern** from the teardown §17 applied to a non-paid surface.
- **No bulk action toolbar, no column sort, no multi-select.**

### C.9.c Tag detail `/tags/{id}`

- **H1:** the tag name, rendered **verbatim in lowercase** (not title-cased). This is a distinctive Sortly convention.
- **Body:** a grid of items that carry this tag, identical in layout to the `/items` grid (photo card + name + quantity).
- **Toolbar:** filters and sort inherited from `/items`.
- **Actions per tag (header row):** `Rename`, `Delete` (overflow menu). **There is no `Change colour` / `Change icon` — tags do not carry those fields.**
- **On delete:** current behaviour redirects to the **first tag in the list**, not back to `/tags`. This is abrupt — consider a toast + list-level return for the SC clone.

### C.9.d Add Tag modal (verified verbatim)

**Trigger:** `Add Tag` button from C.9.a or C.9.b.
**Backdrop:** **pink wash** — this is Sortly's create-modal convention (dark wash is reserved for upsell paywalls).
**Modal width:** ~480 px, centered.
**Layout:**

```
┌─────────────────────────────────────┐
│  Add Tag                         ✕  │
├─────────────────────────────────────┤
│                                     │
│  Name                               │
│  ┌─────────────────────────────┐    │
│  │                             │    │
│  └─────────────────────────────┘    │
│  Name is required                   │  ← red helper text, shown BEFORE the user types
│                                     │
├─────────────────────────────────────┤
│                  [Cancel]   [Save]  │
└─────────────────────────────────────┘
```

- **Fields:** single `Name` (text, required). No colour, no icon, no description, no parent picker, no auto-complete.
- **Validation anti-pattern:** `Name is required` error renders on modal mount, before the user has touched the field. SC should defer validation until first blur or submit.
- **CTAs:** `Cancel` (ghost), `Save` (primary red). Save is disabled until Name has ≥1 char.

**Net:** Sortly's tag is a string-only label. SC has an opportunity to ship richer tag metadata (colour, icon, description, parent/hierarchy) as a cheap differentiator — see §20.5 of the teardown.

## C.10 Workflows hub — `/workflows`

**Verified across a second traversal on 2026-04-10.** This section corrects the earlier table's ordering and badge placement.

**Layout:** H1 `Workflows` top-left, 3 equal-width cards in a row below, each 1 fr, gap `space/6`. `data-testid` attributes on each card are stable (`pick-lists-workflow`, `purchase-orders-workflow`, `stock-counts-workflow`) and should be used by automated UI tests.

| Position | Card title | Badge | data-testid | Click behaviour on Free |
|---|---|---|---|---|
| Left | **Pick Lists** | *(no badge)* | `pick-lists-workflow` | Opens **Pick Lists Ultra paywall** (C.12) |
| Middle | **Purchase Orders** | `NEW` green pill | `purchase-orders-workflow` | Opens **Purchase Orders Ultra paywall** (C.13) |
| Right | **Stock Counts** | `NEW` green pill | `stock-counts-workflow` | Opens **Stock Counts Ultra paywall** (C.11) |

**Correction to an earlier note:** Pick Lists does **not** carry a `NEW` badge. Purchase Orders and Stock Counts do. This is itself inconsistent — Pick Lists shipped at the same time as Purchase Orders in Sortly's v10.107.0 release train per the changelog, but the `NEW` pill was only applied to two of the three siblings. File this as evidence of the drift described in §20.1 of the teardown.

**Card spec (each):** ~360 × 240, card padding 24 px, line-art icon top-left (~48 × 48), H3 title below icon, 3-line description body copy below title, full card surface is clickable (no separate button).

**Verbatim description copy:**

- **Pick Lists:** *"Easily request items for pickup with Sortly's Pick Lists. Create a list, add items, and assign it to a user for review or pickup. Quantities update automatically after items are picked."*
- **Purchase Orders:** *"Simplify your procurement process by easily creating, managing, and tracking purchase orders. This is the hub for that."*
- **Stock Counts:** *"Count and verify your inventory with ease. Stock counts help you track accurate quantities and keep your records up to date."*

**Click model:** clicking any card opens a **Ultra paywall modal** (the user is on a Free account). The three modals are structurally related but **do not share a single template** — each has its own headline formula, left-panel treatment, bullet count, and CTA row. Full verbatim specs in C.11, C.12, C.13 below.

**Debounce note:** repeated clicks on the same card within ~5 s may silently no-op without re-opening the modal. During the walkthrough, dismissing the Purchase Orders modal with `Escape` then clicking Pick Lists landed a Pick Lists click *inside* the still-rendered PO modal — a state-leak bug. Force a full navigation (`location.href = '/workflows'`) between card tests. SC's own UpsellModal should always fully unmount on dismiss.

## C.11 Stock Counts Ultra paywall modal `[verified verbatim]`

**Trigger:** click Stock Counts card (`stock-counts-workflow`) on `/workflows`.
**Backdrop:** dark wash (upsell convention).
**Modal:** centered, ~720 × 480, split layout.

**Left panel:** line-art illustration of a clipboard / checklist. No video.

**Right panel copy (verbatim):**
- **Headline (red `display/h2`):** `Upgrade to Ultra: Keep Inventory Accurate & Clear`
- **Sub (`body/base`):** *"With Stock Counts, skip spreadsheets and be confident knowing every item is accounted for."*
- **Red-check bullet list (3 bullets):**
  - ✓ *"Complete stock counts without manual, disconnected counting methods."*
  - ✓ *"Get live status and progress updates that show who counted what and when."*
  - ✓ *"Flag and resolve discrepancies before they cause audit failures or stock issues."*
- **Cross-sell block (the "PLUS:" treatment — unique to this modal):**
  **PLUS:** *"Everything you need for smarter, faster inventory — advanced reports, barcode labels, Pick Lists, and Purchase Orders."*
- **CTA row (three CTAs):** `LEARN MORE` (link) · `TRY FOR FREE` (primary red button) · `No Thanks` (text link)

**Behaviours:** Close X top-right. `Esc` closes. Backdrop click closes. `LEARN MORE` opens `/upgrade-plan`. `TRY FOR FREE` opens the billing change-plan flow. `No Thanks` closes the modal and returns to `/workflows` with card state preserved.

**Why this is the most polished of the three:** three CTAs including `LEARN MORE` + `No Thanks` gives the user a soft exit path, the `PLUS:` cross-sell bundles every other paid feature into a single ask, and the copy leads with the conversion narrative (*"skip spreadsheets"*) rather than feature bullets. It reads like a paywall modal written by a growth marketer. Compare with C.12 and C.13, which clearly were not.

## C.12 Pick Lists Ultra paywall modal `[verified verbatim]`

**Trigger:** click Pick Lists card (`pick-lists-workflow`) on `/workflows`.
**Backdrop:** dark wash.
**Modal:** centered, ~720 × 480, split layout — **but the left panel is blank / no illustration** on this variant. This is the sparest of the three workflow modals.

**Right panel copy (verbatim):**
- **Headline (red `display/h2`):** `Upgrade to Ultra to unlock Pick Lists`
- **Sub:** *(single sub-line, exact copy in §35.4 of captures.md)*
- **Red-check bullet list (4 bullets, more than Stock Counts):**
  - ✓ Request items for pickup with a single click.
  - ✓ Assign pick lists to teammates for review or pickup.
  - ✓ Quantities update automatically after picking.
  - ✓ Track pick list status from request to completion.
  *(Exact wording verified in captures.md §35.4)*
- **No `PLUS:` cross-sell.**
- **CTA row (single CTA):** `TRY IT FREE FOR 14-DAYS` (primary red button only — no `LEARN MORE`, no `No Thanks` link)

**Behaviours:** Close X top-right. `Esc` closes. Backdrop click closes.

**Template drift flags:**
1. Headline template differs from C.11 (`unlock Pick Lists` vs `Keep Inventory Accurate & Clear`).
2. Left panel is blank instead of an illustration.
3. 4 bullets instead of 3.
4. Only one CTA instead of three — **no soft exit path** other than the close X.
5. No `PLUS:` cross-sell.

This modal reads like a developer shipped it with a TODO comment that never got filled in. It is the least polished of the three sibling modals on the same hub page.

## C.13 Purchase Orders Ultra paywall modal `[verified verbatim]`

**Trigger:** click Purchase Orders card (`purchase-orders-workflow`) on `/workflows`.
**Backdrop:** dark wash.
**Modal:** centered, ~720 × 480, split layout — **left panel is a YouTube embed** (product video), not a static illustration. This is the only one of the three that loads a third-party iframe.

**Right panel copy (verbatim):**
- **Headline (red `display/h2`):** `Purchase Orders are now available in Sortly Ultra Plan.`
  (Note: this is a **declarative sentence ending in a period**, not an imperative "Upgrade to…" — a third distinct headline template.)
- **Sub:** single sentence pitch, exact copy in §35.3 of captures.md.
- **Red-check bullet list (4 bullets):**
  - ✓ Create and send purchase orders to suppliers.
  - ✓ Track expected vs. received quantities.
  - ✓ Auto-update inventory on receive.
  - ✓ Manage procurement in one place.
  *(Exact wording verified in captures.md §35.3)*
- **No `PLUS:` cross-sell.**
- **CTA row (single CTA):** `TRY IT FREE FOR 14-DAYS` (primary red button only)

**Left panel — YouTube embed:**
- Aspect ratio 16:9.
- Loads `https://www.youtube.com/embed/{videoId}` in an iframe.
- **Implication:** tracking leak (YouTube cookies) and measurable latency cost on modal open. SC should **not** copy this — a static WebP or MP4 preview is cheaper and more private.

**Template drift flags:**
1. Headline template differs from both C.11 and C.13 — a declarative sentence, not an imperative.
2. Left panel is a YouTube embed instead of an illustration or blank.
3. Only one CTA.
4. No `PLUS:` cross-sell.

---

### C.11-C.13 summary table — template drift across three sibling modals

This table is the most important single artefact from the workflows traversal. It documents that three sibling paywalls on the **same hub page** do not share a template at the copy layer.

| Attribute | C.11 Stock Counts | C.12 Pick Lists | C.13 Purchase Orders |
|---|---|---|---|
| Headline template | `Upgrade to Ultra: {benefit}` | `Upgrade to Ultra to unlock {feature}` | `{Feature} are now available in Sortly Ultra Plan.` |
| Left panel | Illustration | Blank | YouTube embed |
| Bullet count | 3 | 4 | 4 |
| `PLUS:` cross-sell? | ✅ | ❌ | ❌ |
| CTA count | 3 (`LEARN MORE` · `TRY FOR FREE` · `No Thanks`) | 1 (`TRY IT FREE FOR 14-DAYS`) | 1 (`TRY IT FREE FOR 14-DAYS`) |
| Primary CTA copy | `TRY FOR FREE` | `TRY IT FREE FOR 14-DAYS` | `TRY IT FREE FOR 14-DAYS` |
| Soft exit (`No Thanks` or `LEARN MORE`) | ✅ | ❌ | ❌ |
| Third-party tracking on open | No | No | Yes (YouTube) |

**SC take:** enforce a single `UpsellModal` primitive with: fixed headline template (`Upgrade to {tier} to unlock {feature}`), fixed bullet count (3), fixed CTA row (always soft-exit + primary), fixed left panel (illustration only, no third-party embeds), optional `PLUS:` cross-sell slot. Sortly's drift is the anti-pattern to codify against.

### C.11b Stock Counts (paid product, behind the paywall) `[inferred]`

Stock Counts itself could not be reached on Free. Blueprint for the product *behind* the paywall is still inferred from marketing copy and the paywall bullets:
- **List page:** table of Stock Count sessions, columns `Name`, `Status` (Draft/In Progress/Completed), `Started by`, `Folder scope`, `Progress %`, `Variance count`, `Actions`.
- **Session detail:** header with progress bar, left column = "To count" (items in scope), right column = "Counted" (items with variance highlighted). Scan input fixed top.
- **End-of-count review:** variance list with Reason dropdown (`Miscount`, `Damaged`, `Lost`, `Found`, `Other`) and `Approve Adjustments` CTA.

### C.12b Pick Lists (paid product, behind the paywall) `[inferred]`

- **List page:** table of pick lists, columns `Name`, `Assignee`, `Status` (Draft/Assigned/In Progress/Completed), `Items`, `Created`, actions.
- **New Pick List modal:** name, assignee, items (search & add), quantities.
- **Pick flow:** checklist on mobile, scan to confirm, auto-decrement on completion.

### C.13b Purchase Orders (paid product, behind the paywall) `[inferred]`

- **List page:** columns `PO #`, `Supplier`, `Status` (Draft/Sent/Partially Received/Received/Closed), `Expected`, `Received`, `Total`, actions.
- **New PO form:** supplier picker, ship-to address, expected date, line items (item + qty + unit cost), notes, `Save Draft` / `Send`.
- **Receive flow:** scan-to-receive with partial receive, posts adjustments to inventory and activity history.

## C.14 Reports — `/reports`

**Layout:** left sidebar with 6 report tiles, right pane shows the selected report's form + results.

| # | Report | Purpose | Free? |
|---|---|---|---|
| 1 | Activity History | All user changes to items, folders, tags — audit trail | ✅ |
| 2 | Inventory Summary | Quantity, value, location at a glance | ❌ Ultra |
| 3 | Transactions | All inventory movements/updates/deletions | ❌ Ultra |
| 4 | Item Flow | Quantity fluctuations over time with flexible filters | ❌ Ultra |
| 5 | Move Summary | Folder-to-folder movements in a time frame | ❌ Ultra |
| 6 | User Activity Summary | Per-user action counts | ❌ Ultra |

**Common report form:** date range picker, folder scope, user scope, tag filter, `Run Report`, `Export CSV`, `Export PDF`, `Save Report` (paid), `Subscribe to Email` (Premium).

**Gated click behaviour:** clicking any gated report fires the Reports Ultra upgrade modal (same template as Stock Counts paywall).

## C.15 Labs — `/labs`

**Top bar:**
- `Stage` dropdown — options: `Alpha`, `Beta`, `Experimental`, `All`.
- `Status` dropdown — options: `Enabled`, `Disabled`, `All`.

**Feature list:** currently 1 entry:
- **Threads** — badge `ALPHA`, status `Disabled by default`.
  - Description: "Keep conversations threaded to your inventory."
  - Toggle: `Enable Threads`.
  - "Learn more" link.

## C.16 Sortly Sage panel

See §B.2. On every page.

## C.17 Upgrade Plan — `/upgrade-plan`

**Layout:** 4+1 columns (Free / Advanced / Ultra / Premium / Enterprise) as vertical cards in a row. A `Monthly` / `Yearly` billing toggle above the grid with a "Save 50%" badge on `Yearly`.

**Each card:**
- Plan name (H2)
- Price (numeric/hero) + `/mo` suffix
- Seat / item / CF caps listed with icons
- Feature checklist (✓) — 8–12 bullets per tier
- Primary CTA: `Start Free Trial` (for paid tiers) or `Current Plan` (for Free)

**Full feature ladder:** see §13 of the teardown or the **2. Pricing Tiers** sheet of the analysis xlsx.

Ultra card is tagged `★ Most Popular` with a red ribbon.

## C.18 Public 404

See §B.5. Triggered by any unknown path like `/preferences`, `/account-settings/preferences`, `/user-preferences`.

---

## C.19 Settings — `/user-profile`

**Layout:** Settings opens a full sub-nav list on the left (13 entries + 3 integration items) and the selected subpage in the main region.

### Settings sidebar (order observed)

| # | Label | Path | Notes |
|---|---|---|---|
| 1 | User Profile | `/user-profile` | |
| 2 | Preferences | `/user-preferences` | Tab state only — no direct URL |
| 3 | Company Details | `/company-details` | |
| 4 | Addresses | `/company-addresses` | |
| 5 | Plan & Billing | `/billing-info` | |
| 6 | User Access Control | (modal) | Gated |
| 7 | Custom Fields | `/manage-custom-attributes/node` | |
| 8 | Units of Measure | `/manage-units` | Gated — redirects to /user-profile |
| 9 | Manage Alerts | `/manage-alerts` | Gated — redirects to /user-profile |
| 10 | Bulk Import | `/import` | |
| 11 | Feature Controls | `/feature-controls` | Paid toggles |
| 12 | Create Labels | (modal) | |
| 13 | Public API (beta) | `/public-api` | Gated — redirects |
| 14 | Slack | `/integrations/slack` | Ultra |
| 15 | Microsoft Teams | `/integrations/teams` | Ultra |
| 16 | QuickBooks Online | `/integrations/quickbooks` | Premium |

### Page: User Profile
Three blocks, each a card.

**Block 1 — Personal Information**
| Field | Type | Placeholder | Required |
|---|---|---|---|
| First Name | Text | `First Name` | Yes |
| Last Name | Text | `Last Name` | Yes |
| Email | Email | `name@domain.com` | Yes |
| Phone Number | Tel | `+__` | No |
| Job Function | Dropdown | `Enter your Job Function` | No |
| Job Title | Dropdown | `Select your Job Title...` | No |

Footer button: `Save Changes` (primary red, right-aligned).

**Block 2 — Change Password**
| Field | Type | Required |
|---|---|---|
| Current Password | Password | Yes |
| New Password | Password | Yes |

Footer button: `Save Changes`.

**Block 3 — Linked Accounts**
Two rows:
- **Google** — status label ("Not Connected" or email), action button (`Link` or `Unlink`).
- **Apple ID** — status label (e.g. `7ky5j4b2d6@privaterelay.appleid.com`), action button (`Link` or `Unlink`).

No MFA/2FA toggle visible on Free.

## C.20 Settings — Preferences `[tab state only]`

Direct URLs all 404. Inferred contents: UI locale, default view mode, default sort, notifications opt-in.

## C.21 Settings — Company Details — `/company-details`

Fields (observed on a TR demo):
| Field | Type | Placeholder | Example value |
|---|---|---|---|
| Company Name | Text | `Company Name` | — |
| Industry | Dropdown | `Select industry` | — |
| Country | Dropdown | `Select country` | `Turkey` |
| Currency | Dropdown | `Select currency` | `TRY` (auto-inherited) |
| Timezone | Dropdown | `Select timezone` | `EST` (editable) |
| Date format | Dropdown | `Select date format` | `European (DD/MM/YYYY)` |
| Company Logo | File | `Upload logo` | — |

Footer: `Save Changes`.

## C.22 Settings — Addresses — `/company-addresses`

**Top bar:** search input (`Search addresses…`), `New Address` primary button.
**List:** cards, each showing Address name, Street, City/State/Zip, Country, `Edit`, `Delete`.
**New Address modal:** Name, Street 1, Street 2, City, State/Region, Postal Code, Country dropdown, `Is this your primary address?` checkbox.

## C.23 Settings — Plan & Billing — `/billing-info`

Sections:
- **Current Plan card** — plan name, price, renewal date, `Change Plan` button, `Cancel` link.
- **Usage card** — Items used / cap, Seats used / cap, CFs used / cap, each as a meter bar.
- **Payment Method card** — brand + last 4 digits + expiry + `Update`. *(Never auto-fill credit cards — see safety rules.)*
- **Billing History table** — Date, Description, Amount, Status, `Download Invoice`.

## C.24 Settings — Custom Fields — `/manage-custom-attributes/node`

**Top bar:**
- `Add Custom Field` primary red button (right-aligned)
- Usage meter: "0 of 1 custom field added. Upgrade to get more custom fields" (or similar, scales with plan)
- `Show on item page:` dropdown, options `Populated Fields` (default) | `All Fields`

**Empty state:** illustration + "You don't have any custom fields. Click Add Custom Field to get started!" + secondary link "How to Create Custom Fields?"

**List (when populated):** table with columns Name, Type, Used by (# items), Actions (`Edit`, `Delete`, drag handle for reorder).

**Create Custom Field flow:** see `Part D — Flows §D.1`.

## C.25 Settings — Units of Measure — `/manage-units` (gated)

Direct URL redirects to `/user-profile` on Free. Inferred spec:
- List of unit groups (Length, Weight, Volume, Count).
- Each unit row: Name, Symbol, Base factor, Actions.
- `Add Unit` primary button.

## C.26 Settings — Manage Alerts — `/manage-alerts` (gated)

Redirects to `/user-profile` on Free. Inferred spec:
- Two tabs: **Quantity Alerts** and **Date Alerts**.
- Quantity: list of rules, each with Folder scope, Min Level source, Recipients, `Active` toggle.
- Date: list of rules bound to date-type custom fields with "days before" threshold.

## C.27 Settings — Bulk Import — `/import`

**Wizard** — top stepper with 4 steps, active step in red.

**Step 1 — Import method**
- Two large cards: `Quick Import` (recommended for new users, CSV/XLSX into a single folder, "1 minute") and `Advanced Import` (Sortly template, multi-folder, multi-variant, imports folders themselves).
- Each card has an icon, a 2-line description and a `Choose` button.

**Step 2 — Upload file**
- Drag-drop zone, supports CSV/XLSX.
- Link: `Download template`.

**Step 3 — Map fields**
- Column-to-field mapping grid — left column shows uploaded headers, right column shows Sortly field picker, center shows "→" arrow.
- Validation: required fields must be mapped.

**Step 4 — Review**
- Preview table with first 10 rows as they'll be imported.
- Counter: "X items will be created, Y items will be updated".
- Primary CTA: `Import`.

## C.28 Settings — Feature Controls — `/feature-controls`

List of paid feature toggles, each a row:
- **Return to Origin** — toggle, description, `Ultra` badge.
- Additional toggles `[inferred]`.

## C.29 Settings — Create Labels (modal)

Modal opened from Settings sidebar. Inferred spec (full designer not opened during walk):
- Left pane: template picker (Avery 5160, Avery 5163, custom, 5–8 presets).
- Right pane: live preview with selected items rendered.
- Controls: item scope picker, quantity per item, barcode type dropdown (Code 128 default), `Include name`, `Include price`, `Include SID` checkboxes.
- Footer: `Cancel` · `Print` · `Download PDF`.

## C.30 Settings — Public API — `/public-api` (gated)

Redirects to `/user-profile` on Free. Inferred spec:
- List of API keys with name, prefix, created, last used, status, `Rotate`, `Revoke`.
- `Generate New Key` primary button.
- Docs link sidebar.
- Webhook subscriptions table (Enterprise only).

## C.31 Integrations — Slack — `/integrations/slack`

Marketing-style page with:
- Hero illustration of Slack logo + Sortly logo joined.
- Description paragraph.
- Feature checklist (5 events):
  - Create item
  - Update item
  - Move item
  - Delete item
  - Update quantity
- `Try it free for 14-Days` primary CTA.
- **Ultra** tier badge.
- Footer `Learn more` link to help doc.

**When connected (Ultra+):** the same page shows channel picker, event selector, test-send button, disconnect link.

## C.32 Integrations — Microsoft Teams — `/integrations/teams`

Identical layout to Slack. Same 5 events. **Ultra** tier.

## C.33 Integrations — QuickBooks Online — `/integrations/quickbooks`

Marketing page with:
- QBO logo + Sortly logo.
- 3 value props: "Sync QBO account", "Send POs to QBO", "Send invoices to QBO".
- `Try it free for 14-Days` CTA.
- **Premium** tier badge.

## C.34 Trash — `/trash` `[verified]`

Added in the second traversal pass (2026-04-10). Full ASCII layout in §33 of `sortly-captures.md`.

**Purpose:** holds soft-deleted folders and items. There is **no `Delete Forever` path** — items stay in Trash indefinitely until (presumably) a hidden retention policy purges them. This is a safety gap the SC clone should fill.

### C.34.a Layout

```
┌────────────────────────────────────────────────────────────────────┐
│ Trash                                                              │  ← H1, left-aligned
├────────────────────────────────────────────────────────────────────┤
│ [Sort by: Deleted Date ▾]   [🔍 Search]          [⚙ Filter icon]  │  ← toolbar
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐               │
│  │  📁     │  │  📁     │  │  📷     │  │  📷     │               │  ← card grid
│  │ Folder  │  │ Folder  │  │  Item   │  │  Item   │               │
│  │  Name   │  │  Name   │  │  Name   │  │  Name   │               │
│  │         │  │         │  │  qty    │  │  qty    │               │
│  │ 10/04/26│  │ 09/04/26│  │ 08/04/26│  │ 07/04/26│               │  ← Deleted at (DD/MM/YYYY)
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘               │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### C.34.b Toolbar

- **Sort By dropdown** — default `Deleted Date`. Observed options include `Name`, plus any other sort modes the dropdown exposes (not fully enumerated; clicking the dropdown only surfaced a minimal set during the walk).
- **Search input** — scoped to Trash contents, placeholder approximately `Search trash`.
- **Filter icon** — clicking it produced **no observed response** during the walk. Either dead code or a hidden panel. Document as a UX smell.

### C.34.c Card types and colour coding

- **Folder cards:** folder accent colour, folder glyph, item count chip in the corner (*"X items"*).
- **Item cards:** generic photo thumbnail (falls back to a placeholder if the item had no photo), quantity + unit line.
- **Both:** Deleted-at timestamp at the bottom, rendered in the account's date format (TR account showed DD/MM/YYYY — **locale is honoured at the data layer**).

### C.34.d Hover / selection behaviour

Hovering a card surfaces a single action: **`Restore`** (button or icon overlay on the card).

**Missing actions that should exist:**
- ❌ `Delete Forever` — not present
- ❌ `View details` — no way to inspect the deleted record's metadata without restoring first
- ❌ Multi-select checkbox — no bulk operations
- ❌ Bulk restore — items must be restored one at a time

### C.34.e Empty state

When the trash is empty, a line-art illustration + one-line message + no CTA (matches §B empty-state grammar).

### C.34.f SC clone directive

- Ship `Delete Forever` **and** `Restore` actions with a confirmation dialog on `Delete Forever` that surfaces the retention/audit implications.
- Ship multi-select + bulk restore + bulk delete.
- Ship a proper filter panel (or remove the filter icon if it has no function) — do not ship a dead affordance.
- Honour the user's date format setting (already implied by Sortly's behaviour, but verify SC does the same).

---

# PART D — FLOWS (SEQUENTIAL STEPS)

## D.1 Create Custom Field flow (2-step modal)

**Trigger:** `Add Custom Field` button on `/manage-custom-attributes/node`.

### Step 1 — Suggested Fields picker
- Modal title: "Add Custom Field"
- Plan gate notice at top: "You can add 1 custom field on the Free plan." with a `View plans` text link.
- Six preset template cards in a 3×2 grid, each 180 × 120:
  1. **Serial Number** → becomes `Small Text Box`
  2. **Model/Part Number** → becomes `Small Text Box`
  3. **Purchase Date** → becomes `Date`
  4. **Expiry Date** → becomes `Date`
  5. **Product Link** → becomes `Web Link`
  6. **Size** → becomes `Small Text Box`
- Each card: icon + title + 1-line description. Click = select template and advance.
- Bottom link: `+ Create your own field` → advances to the 12-type grid (Step 2 alt path).

### Step 2 — Choose Field Type grid
12 type cards, 3×4 grid:

| # | Type | Hint (shown on hover / selection) | Free? |
|---|---|---|---|
| 1 | Small Text Box | "(eg. Serial Number, Manufacturer Name, Customer ID, etc.)" — limit 190 | ✅ |
| 2 | Large Text Box | "(eg. Address, Status, Instructions, Notes, Details, etc.)" — limit 4000 | ✅ |
| 3 | Round Number | "numbers without decimals - eg. Quantity, Count, etc." | ✅ |
| 4 | Decimal Number | "numbers with decimals - eg. Cost, Selling price, Measurements…" | ✅ |
| 5 | Checkbox | "Yes or No status - eg. Damaged, Repaired, Lent, Sold, etc." | ✅ |
| 6 | Dropdown | "(Allows to select one option from a list)" — options limit 250 | ✅ |
| 7 | Date | "eg. Expiry Date, Purchase Date, etc." | ✅ |
| 8 | Scanner | "Scan and connect additional barcodes or QR codes" | ✅ |
| 9 | Phone Number | "eg. (123) 350 - 2345, +9144235423" | ✅ |
| 10 | Web Link | "eg. https://www.google.com" | ✅ |
| 11 | Email | "eg. mail@example.com" | ✅ |
| 12 | File Attachment | (clicking triggers Ultra upgrade modal) | ❌ Ultra |

Back link: `← Back to suggested fields`.

### Step 3 — Configure field
Once a type is selected, the modal becomes a configuration form:
- **Field name** (text, required)
- **Help text** (text, optional)
- **Required** (checkbox)
- **Show on item page by default** (checkbox)
- Type-specific options (e.g. Dropdown → list of options with `Add option`; Checkbox → default value toggle; Date → include time toggle)
- Footer: `Back` · `Save Field`

### Exception: File Attachment
Clicking the File Attachment tile **skips Step 3** and jumps straight to the Ultra upgrade modal — this is a hard paywall.

## D.2 Stock Counts Ultra paywall flow

**Trigger:** click Stock Counts card on `/workflows`.

**Modal opens with verbatim copy:**
- Headline (red, `display/h2`): **"Upgrade to Ultra: Keep Inventory Accurate & Clear"**
- Sub (`body/base`): *"With Stock Counts, skip spreadsheets and be confident knowing every item is accounted for."*
- Red-check bullet list (3 items):
  - ✓ Complete stock counts without manual, disconnected counting methods.
  - ✓ Get live status and progress updates that show who counted what and when.
  - ✓ Flag and resolve discrepancies before they cause audit failures or stock issues.
- Sub-headline: **PLUS:** Everything you need for smarter, faster inventory — advanced reports, barcode labels, Pick Lists, and Purchase Orders.
- CTAs row: `LEARN MORE` (link) · `TRY FOR FREE` (primary red) · `No Thanks` (text link)

**Debounce note:** repeated clicks on the same card within ~5 s may not re-open the modal. Account for this in the prototype by clearing state on card re-focus.

## D.3 Ultra paywall modal family (structural skeleton + 3 verified variants)

**Correction:** this blueprint originally claimed Sortly ships a single templated Ultra paywall modal used across every gated feature. A second traversal of `/workflows` verified that **three sibling workflow paywalls use three different headline templates, left panels, bullet counts, and CTA row shapes** — see C.11, C.12, C.13 and the drift table between them. The *structural skeleton* below is still shared; the *copy layer* is not.

**Shared skeleton (always):**
- 720 × 480 centered modal, `radius/modal`, `shadow/modal`, dark backdrop wash.
- Split layout: left panel (illustration / video / blank) at 40%, right panel (copy + CTA) at 60%.
- Red `display/h2` headline.
- Red-check bullet list in the right panel.
- At least one primary red CTA.
- Close X top-right.
- `Esc` closes. Backdrop click closes.

**Variant axis 1 — headline template:** observed `Upgrade to Ultra: {benefit}` (Stock Counts), `Upgrade to Ultra to unlock {feature}` (Pick Lists), `{Feature} are now available in Sortly Ultra Plan.` (Purchase Orders). Three different templates on sibling cards.

**Variant axis 2 — left panel:** illustration (Stock Counts), blank (Pick Lists), YouTube embed (Purchase Orders). Three different treatments.

**Variant axis 3 — bullet count:** 3 (Stock Counts), 4 (Pick Lists and Purchase Orders).

**Variant axis 4 — cross-sell block:** only Stock Counts has the `PLUS:` sub-bullet.

**Variant axis 5 — CTA row:** Stock Counts shows 3 CTAs (`LEARN MORE` · `TRY FOR FREE` · `No Thanks`); Pick Lists and Purchase Orders show only 1 (`TRY IT FREE FOR 14-DAYS`). Primary CTA copy drifts between `TRY FOR FREE` and `TRY IT FREE FOR 14-DAYS`.

**Other paywall applications observed:** File Attachment custom field, gated Reports. These were only sampled once each and fit the shared skeleton, but the copy-layer variants were not catalogued in depth. Assume similar drift across other feature teams.

**SC design directive:** build one `UpsellModal` primitive and **lock** the copy layer to a single canonical form: headline `Upgrade to {tier} to unlock {feature}`, fixed 3-bullet count, fixed CTA row (`LEARN MORE` · `START TRIAL` · `Not now`), illustration-only left panel, no third-party embeds. Every feature team must instance the primitive, not re-author it. Sortly's drift across C.11-C.13 is the example of what happens without this lock.

**Shared behaviours (all variants):**
- Close X top-right.
- `Esc` closes the modal.
- Backdrop click closes.
- `LEARN MORE` (when present) opens `/upgrade-plan` in a new tab.
- `TRY FOR FREE` / `TRY IT FREE FOR 14-DAYS` opens the Billing → Change Plan flow.

## D.4 Bulk Import flow

See §C.27. 4 steps. Allow `← Back` navigation between steps.

## D.5 Add Item flow

1. Trigger: `Add Item` button (Dashboard, Items, Folder detail, Item detail overflow).
2. Modal opens (§C.6).
3. Required fields: Name, Quantity, Unit, Folder.
4. On Save: toast "Item added" (success), modal closes, list refreshes.
5. On Save & Add Another: modal clears non-sticky fields, sticky fields (Folder, Unit, Tags) persist.

## D.6 Advanced Search "Save Search" flow (paid)

1. Build a query on `/advanced-search`.
2. Click `Save Search` — on Free, triggers generic Ultra paywall.
3. On paid: name the search, optional schedule for email delivery (Premium), `Save`.

## D.7 Quantity adjust flow (from item detail)

1. User taps `+` or `−` on item detail.
2. Local quantity updates optimistically.
3. If quantity drops below Min Level → inline toast "Below minimum level".
4. Activity entry posted: "Mahmut changed Quantity: 5 → 4".
5. If Slack/Teams integration enabled → webhook fires.

## D.8 Label print flow

1. From Items list: select items (multi-select checkbox), overflow → `Create Labels`.
2. Modal opens (§C.29).
3. Choose template, adjust settings, `Download PDF` or `Print`.

## D.9 404 bounce flow (paid-route probing)

1. User navigates to `/purchase-orders` directly on Free.
2. **No paywall.** Silent redirect to `/items`.
3. Pattern applies to: `/purchase-orders`, `/pick-lists`, `/units-of-measure`, `/manage-alerts`, `/public-api`.
4. Paywall only fires when user clicks the card from the **Workflows** or **Settings** sidebar surface.

## D.10 Sign-out flow `[inferred]`

1. Click user avatar (if shown in rail footer) or Settings gear → `Sign Out`.
2. Confirmation toast, redirect to `/login`.

---

# PART E — COMPONENT LIBRARY

## E.1 Buttons

| Variant | Use | Spec |
|---|---|---|
| `Button/Primary` | Main CTA per page | `red/primary` fill, white text, 40 h, `radius/button`, `label/uppercase` at 12 px with 0.4 tracking |
| `Button/Primary-Large` | Upsell CTA (`TRY FOR FREE`) | 48 h, `body/large` text |
| `Button/Secondary` | Supporting actions | `neutral/0` fill, `border/default`, `neutral/900` text, 40 h |
| `Button/Ghost` | Destructive cancel | transparent, `neutral/600` text, hover `neutral/50` fill |
| `Button/Link` | Inline actions (`Save Search`) | no border, `red/primary` text, underline on hover |
| `Button/Icon` | Rail items, overflow | 40 × 40, icon 24 × 24, `radius/button` |
| `Button/Destructive` | Delete | `accent/danger` text, outline on hover |

States: `default`, `hover`, `pressed`, `disabled` (opacity 0.4), `loading` (spinner replaces label).

## E.2 Inputs

- **Text input** — 40 h, 12 px horizontal padding, `border/default`, focus → `border/focus` + subtle shadow.
- **Textarea** — min 96 h, vertical resize.
- **Number input** — same as text with step arrows.
- **Password** — text input + show/hide icon.
- **Date picker** — input + calendar popover (single-month view).
- **File upload** — drag-drop zone with dashed border, OR inline button.
- **Dropdown** — custom (not native) with chevron icon right, popover list.
- **Multi-select chips** — chip on selection with × remove, input underneath for new.

Label sits above input in `label/uppercase`. Helper text below input in `body/small neutral/400`. Error text replaces helper in `accent/danger`.

## E.3 Cards

| Variant | Use |
|---|---|
| `Card/Folder` | Items browser folder tile (mosaic) |
| `Card/Item` | Items browser item tile (photo hero) |
| `Card/Workflow` | Workflows hub tiles |
| `Card/Report` | Reports sidebar tiles |
| `Card/Plan` | Upgrade Plan columns |
| `Card/Settings-Block` | Settings subpage sections |

All cards: `neutral/0` fill, `radius/card`, `shadow/card`, `border/default`.

## E.4 Badges

| Variant | Style |
|---|---|
| `Badge/New` | `accent/green` pill, white text, sparkle icon |
| `Badge/Beta` | neutral fill, `neutral/600` text |
| `Badge/Alpha` | neutral fill, italic |
| `Badge/Ultra` | `red/primary` outline, red text |
| `Badge/Premium` | gold outline, gold text |
| `Badge/Most Popular` | red ribbon on top of Upgrade card |

## E.5 Tables

- Header row: `label/uppercase`, `neutral/50` fill, sticky on scroll.
- Row hover: `neutral/50` fill.
- Sortable columns: chevron icon next to header on hover, solid when active.
- Row actions: overflow menu, visible on hover or always.
- Empty table state: row placeholder + illustration above.

## E.6 Tabs

- Horizontal tab bar, underline indicator in `red/primary`.
- Inactive: `neutral/600` label; active: `neutral/900` label + red underline.

## E.7 Toggles

- Switch: 40 × 24, off = `neutral/200` bg, on = `red/primary` bg, thumb is `neutral/0`.

## E.8 Progress bar

- 8 px height, `radius/pill`, `neutral/100` track, `red/primary` fill.

## E.9 Avatar

- Circle, 32 / 40 / 48 sizes. Letter fallback on `red/primary` fill.

## E.10 Skeleton loaders

- `neutral/100` base, shimmer gradient from `neutral/50` → `neutral/100` → `neutral/50` at 1.5 s.

---

# PART F — MODALS LIBRARY

| Modal | Size | Trigger | Key content | Notes |
|---|---|---|---|---|
| **Add Item** | 640 × auto | Add Item button anywhere | Full edit form | Sticky fields on "Save & Add Another" |
| **Add Folder** | 480 × auto | Add Folder button | Name + parent + cover | |
| **Create Custom Field** | 640 × auto | Add Custom Field on CF page | 2-step wizard (§D.1) | |
| **Ultra Upsell** | 720 × 480 | Any gated click | See §D.3 template | Used by Pick Lists, POs, Stock Counts, File Attachment, Reports |
| **Delete Confirmation** | 480 × 240 | Delete any entity | "Are you sure? This cannot be undone." + `Cancel` / `Delete` | `Delete` is destructive |
| **Move Item(s)** | 560 × 480 | Move action | Folder tree picker | |
| **Bulk actions confirm** | 480 × 200 | Bulk delete/move | "{n} items will be affected" | |
| **Invite Teammate** | 560 × 400 | Getting Started or Settings | Email list + Role picker | Gated on Free |
| **Create Labels** | 960 × 600 | Create Labels sidebar entry | Left = template picker, right = preview | |
| **Scan Barcode** | 480 × 480 | Scan button in Barcode field | Webcam frame + "Point camera at barcode" | Uses `getUserMedia` |
| **Session Timeout** | 400 × 200 | After idle | "You'll be signed out in {n}s" + `Stay signed in` | |

---

# PART G — EMPTY STATES LIBRARY

| Page | Illustration | Headline | Sub | Primary CTA |
|---|---|---|---|---|
| Items | cardboard box | No items yet | Add your first item or import from CSV. | Add Item |
| Folder | empty folder | This folder is empty | Add items or subfolders. | Add Item |
| Custom Fields | clipboard | You don't have any custom fields. | Click Add Custom Field to get started! | Add Custom Field |
| Tags | tag | No tags yet | Create a tag to categorise your items. | Add Tag |
| Advanced Search | magnifier | No results | Try broadening your filters. | Clear All |
| Reports (gated preview) | chart | Upgrade to Ultra for {Report Name} | — | TRY FOR FREE |
| Labs | flask | No features matching these filters | Change the Stage or Status filter. | Reset filters |
| Addresses | pin on map | No addresses yet | Add your first business address. | New Address |
| Billing History | receipt | No invoices yet | Invoices will appear after your first billing cycle. | — |
| 404 | question mark on box | Oops! Something went wrong | Page not found. | Go to Dashboard |

---

# PART H — INTERACTION PATTERNS

## H.1 Silent redirect on paid URL probe
Direct URL access to gated surfaces redirects to a safe page (`/user-profile` or `/items`) instead of showing a paywall. Paywalls only fire on intentional card clicks from discovery surfaces. This is a deliberate anti-frustration pattern — adopt the same in SC.

## H.2 Debounced modal re-opens
Repeated clicks on the same paywall card within ~5 s may not re-trigger the modal. Implement with a state flag cleared on navigation away.

## H.3 Grid/List parity
Every list view supports a Grid ↔ List toggle. Grid is the default and the brand. List is denser.

## H.4 Sticky form state
"Save & Add Another" in Add Item modal preserves Folder, Unit, and Tags but clears everything else. This is great UX for seeding inventory quickly.

## H.5 Inline vs modal editing
Folder rename = inline.
Item rename = modal (via edit form).
Custom field rename = inline from the list table.

## H.6 Optimistic updates
Quantity adjust is optimistic; rollback on API error with a toast.

## H.7 Keyboard shortcuts
- `Alt+T` opens Notifications.
- `Esc` closes modals and popovers.
- `/` focuses the top Search input (inferred; common web convention).

## H.8 Empty-state grammar
Every empty state = illustration + headline + 1-line hint + single primary CTA. Never two CTAs.

## H.9 Paywall modal grammar
Red headline + 1 sub + 3–5 red-check bullets + optional "PLUS" line + 3 CTAs (`LEARN MORE` / `TRY FOR FREE` / `No Thanks`). Copy always leads with the verb — "Keep", "Simplify", "Complete" — not with the feature name.

## H.10 Growth badges
`NEW` / `BETA` / `ALPHA` pills are used to draw attention to monetisation surfaces. They live on the nav rail (Workflows/Labs) and on cards (Pick Lists/POs). Treat them as a growth-marketing primitive, not decoration.

## H.11 Honesty signals
Version string in footer (`v10.107.0-R216.0.0`) and per-item activity history are low-cost trust builders. SC already has both.

---

# PART I — RECOMMENDED FIGMA FILE STRUCTURE

Pages to create in a Figma file called `Sortly Blueprint v1`:

1. **📐 Tokens** — colour swatches, type scale, spacing grid, radius, elevation
2. **🧱 Components — Buttons** — all variants × states, with Auto Layout
3. **🧱 Components — Inputs** — text, textarea, number, date, dropdown, multi-select
4. **🧱 Components — Cards** — folder, item, workflow, report, plan, settings block
5. **🧱 Components — Badges & Pills** — new, beta, alpha, ultra, premium, most popular
6. **🧱 Components — Tables** — header, row, sortable, empty, loading
7. **🧱 Components — Modals** — frame + library (§F)
8. **🧱 Components — Toasts** — success, danger, info
9. **🧱 Components — Empty States** — library (§G)
10. **🖼 Chrome** — left rail, Sage panel, footer, Settings sidebar
11. **🖼 Dashboard** — Free-plan variant
12. **🖼 Items browser** — Grid + List variants
13. **🖼 Folder detail** — folder info bar + grid
14. **🖼 Item detail** — 60/40 layout + activity timeline
15. **🖼 Item edit** — modal and full-page variants
16. **🖼 Advanced Search** — filter panel + results grid
17. **🖼 Tags page** — table
18. **🖼 Workflows hub** — 3 cards + paywall overlay states
19. **🖼 Stock Counts** — inferred list + session detail + review
20. **🖼 Pick Lists** — inferred list + new PL
21. **🖼 Purchase Orders** — inferred list + new PO + receive
22. **🖼 Reports** — 6-tile sidebar + active report form
23. **🖼 Labs** — filter bar + feature list
24. **🖼 Upgrade Plan** — 5-column pricing grid + billing toggle
25. **🖼 Settings — User Profile** — 3 blocks
26. **🖼 Settings — Company Details**
27. **🖼 Settings — Addresses**
28. **🖼 Settings — Plan & Billing**
29. **🖼 Settings — Custom Fields** — empty + populated + 2-step create flow
30. **🖼 Settings — Units of Measure** (inferred)
31. **🖼 Settings — Manage Alerts** (inferred)
32. **🖼 Settings — Bulk Import** — 4-step wizard
33. **🖼 Settings — Feature Controls**
34. **🖼 Settings — Create Labels** — modal designer
35. **🖼 Settings — Public API** (inferred)
36. **🖼 Integrations — Slack**
37. **🖼 Integrations — MS Teams**
38. **🖼 Integrations — QuickBooks**
39. **🖼 Sage panel** — open + collapsed + typing states
40. **🖼 Paywall modals** — all variants from §D.3
41. **🖼 404 page**
42. **🔀 Prototypes** — link screens per §Part D flows

### Naming conventions
- **Frames:** `{Page Number}. {Page Name}` (e.g. `C4. Item detail`).
- **Components:** `{Category}/{Name}/{State}` (e.g. `Button/Primary/Hover`).
- **Variables/Tokens:** use Figma Variables for colours, numbers, and strings so the whole file can reskin in seconds.

### Handoff tips
- Attach this markdown to the Figma file as a "Read me first" page or link.
- Tag every inferred screen with a `[INFERRED]` label at top so devs don't assume parity.
- Use Auto Layout everywhere — Sortly's real UI is extremely consistent once you have the tokens locked.

---

# APPENDIX — CROSS-REFERENCES

- **Full teardown & UX/UI brief:** `sortly-teardown.md`
- **Pricing tier matrix + Feature matrix + Roadmap + Dropdown values:** `OneAce-vs-Sortly-Analysis.xlsx`
- **Screenshots:** `sortly-screenshots/` folder (Stock Counts paywall, File Attachment paywall, /items, /preferences 404)
- **Sister competitor blueprint:** `inflow-inventory-teardown.md`

**Unresolved for a v2 pass** (see §18 of the teardown for the full list):
- User Access Control modal contents
- Units of Measure CRUD
- Manage Alerts UI
- Create Labels designer
- Public API documentation surface
- Notifications panel
- Activity History full view
- Trash restore flow
- Item detail Chart/Insights (gated)
- Move item interaction
- Export item sheet PDF
- Mobile app layouts (intentionally out of scope)
