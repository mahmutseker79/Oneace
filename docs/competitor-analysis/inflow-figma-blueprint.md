# inFlow Inventory — Figma-Ready Blueprint

**Companion document to** `inflow-inventory-teardown.md` and `inflow-captures.md`.
**Purpose:** a designer or PM can rebuild every inFlow Inventory screen in Figma using only this file. Every page lists its layout, every field lists label/type/placeholder/validation, every button lists its action, every menu lists its items, every modal lists its copy.
**Scope:** web app on a Turkish trial account at `https://app.inflowinventory.com`, walkthrough conducted 2026-04-08 through 2026-04-10.
**Status:** POPULATED from live walkthrough. Verified against `inflow-captures.md` Parts I and II.

**Reading order:**
- Part A — Design tokens
- Part B — Global chrome components
- Part C — Page-by-page blueprint
- Part D — Flows (sequential steps)
- Part E — Component library
- Part F — Modals library
- Part G — Empty states library
- Part H — Interaction patterns
- Part I — Recommended Figma file structure

---

# PART A — DESIGN TOKENS

All values inferred from live DOM inspection and screenshot sampling. Use these as Figma **Style** / **Variable** entries at the top of the file so every downstream screen references them by name.

## A.1 Color palette

| Token                | Hex         | Usage                                                                         |
|----------------------|-------------|-------------------------------------------------------------------------------|
| `brand.navy.900`     | `#232D4B`   | Left sidebar rail background (dominant brand color)                           |
| `brand.navy.800`     | `#2E3A5C`   | Sidebar hover state, selected pill in subtab row                              |
| `brand.yellow.500`   | `#F9C23C`   | Primary CTA fill (Subscribe now, Save, +New, Start counting, Subscribe)       |
| `brand.yellow.200`   | `#FFF1C8`   | "MOST POPULAR" tier card background tint                                      |
| `accent.orange.500`  | `#C84A1E`   | Sample-mode banner background (top + bottom)                                  |
| `accent.orange.050`  | `#FCEFE8`   | Sample-mode icon backgrounds inside cards                                     |
| `text.primary`       | `#1A1F36`   | H1–H4 body text                                                               |
| `text.secondary`     | `#5A6379`   | Subtitles, helper text, table column headers                                  |
| `text.tertiary`      | `#8B95AB`   | Placeholders, disabled labels                                                 |
| `text.onBrand`       | `#FFFFFF`   | Text on navy sidebar                                                          |
| `border.subtle`      | `#E6E8EE`   | Card borders, row separators                                                  |
| `border.strong`      | `#C8CCD6`   | Input border, dropdown border                                                 |
| `surface.page`       | `#F2F3F5`   | Page background (light gray)                                                  |
| `surface.card`       | `#FFFFFF`   | Card background                                                               |
| `surface.overlay`    | `rgba(20,24,38,0.55)` | Modal backdrop                                                      |
| `status.success`     | `#1F9D55`   | Completed, positive delta                                                     |
| `status.warning`     | `#D97706`   | Partially received, In progress                                               |
| `status.danger`      | `#C53030`   | Negative delta, deactivated badge                                             |
| `status.neutral`     | `#6B7280`   | Draft status                                                                  |

## A.2 Typography

| Token            | Family              | Weight | Size | Line height | Usage                        |
|------------------|---------------------|--------|------|-------------|------------------------------|
| `font.display`   | Manrope (fallback: Inter, -apple-system) | 700 | 32 px | 40 px | Hero: "Inventory and order control…" |
| `font.h1`        | Manrope             | 700    | 24 px | 32 px     | Page titles ("Options (Sample)") |
| `font.h2`        | Manrope             | 600    | 20 px | 28 px     | Card titles ("Locations", "Variants") |
| `font.h3`        | Manrope             | 600    | 16 px | 24 px     | Modal titles, sidebar flyout group names |
| `font.bodyLg`    | Inter               | 400    | 16 px | 24 px     | Primary body copy            |
| `font.body`      | Inter               | 400    | 14 px | 20 px     | Table rows, field labels      |
| `font.caption`   | Inter               | 400    | 12 px | 16 px     | Helper text, column headers   |
| `font.buttonLg`  | Manrope             | 600    | 15 px | 20 px     | Primary CTAs                 |
| `font.mono`      | SF Mono / Menlo     | 400    | 13 px | 18 px     | Document numbers (SO-000025) |

## A.3 Spacing scale

| Token  | Value |
|--------|-------|
| `sp.0` | 0 px  |
| `sp.1` | 4 px  |
| `sp.2` | 8 px  |
| `sp.3` | 12 px |
| `sp.4` | 16 px |
| `sp.5` | 20 px |
| `sp.6` | 24 px |
| `sp.7` | 32 px |
| `sp.8` | 40 px |
| `sp.9` | 48 px |
| `sp.10`| 64 px |

## A.4 Radii

| Token     | Value  | Usage                                 |
|-----------|--------|---------------------------------------|
| `rad.xs`  | 4 px   | Tag pills, inline badges              |
| `rad.sm`  | 6 px   | Form inputs, small buttons            |
| `rad.md`  | 8 px   | Cards, primary buttons                |
| `rad.lg`  | 12 px  | Modal containers, tier cards          |
| `rad.full`| 999 px | Pill buttons (Subscribe now, 14 days left) |

## A.5 Shadows

| Token        | Value                                                   | Usage              |
|--------------|---------------------------------------------------------|--------------------|
| `shadow.card`| `0 1px 2px rgba(20,24,38,0.06), 0 1px 3px rgba(20,24,38,0.10)` | Cards, dropdown menus |
| `shadow.modal`| `0 10px 32px rgba(20,24,38,0.18)`                     | Modals, popovers    |
| `shadow.flyout`| `0 6px 16px rgba(20,24,38,0.14)`                     | Sidebar flyout panels |

## A.6 Motion

| Token          | Value                   | Usage                    |
|----------------|-------------------------|--------------------------|
| `ease.standard`| `cubic-bezier(.4,0,.2,1)` | Generic transitions      |
| `ease.decel`   | `cubic-bezier(0,0,.2,1)`  | Enter animations (modals, flyouts) |
| `ease.accel`   | `cubic-bezier(.4,0,1,1)`  | Exit animations           |
| `dur.short`    | 150 ms                  | Hover, focus              |
| `dur.medium`   | 220 ms                  | Flyout enter, modal open  |
| `dur.long`     | 320 ms                  | Page transitions          |

## A.7 Breakpoints

inFlow is a desktop-first SaaS. Observed breakpoints:

| Token  | Min width | Notes                                        |
|--------|-----------|----------------------------------------------|
| `bp.sm`| 640 px    | Mobile web (read-only fallback)              |
| `bp.md`| 1024 px   | Narrow desktop — content compresses          |
| `bp.lg`| 1280 px   | Default desktop layout                       |
| `bp.xl`| 1512 px   | Confirmed testing viewport; sidebar stays at 64 px; content ~1448 px wide |

---

# PART B — GLOBAL CHROME COMPONENTS

Components that appear on every authenticated page.

## B.1 Left sidebar rail (`Sidebar`)

- **Fixed width:** 64 px
- **Fixed position:** `left: 0; top: 0; bottom: 0`
- **Background:** `brand.navy.900`
- **Vertical stack:** two sections separated by `flex: 1` spacer.

**Top section (icon order):**
1. inFlow brand icon (Evernote-style book spine)
2. `+` yellow square — "Create new" flyout
3. `$` circle — "Sales" flyout (Sales orders, Sales quotes, Customers, Showroom)
4. Cube — "Products" flyout (Product list, Categories, Adjustments, **Stock counts**, Stock transfers, Locations)
5. Clipboard with check — "Purchasing" flyout (POs, PQs, Vendors)
6. Bar chart — "Reports" (direct nav, no flyout)

**Bottom section (icon order):**
1. Storefront — "Showroom" (B2B portal config)
2. 4-square + — "Integrations" (app marketplace)
3. Gear — "Options" (settings)

**Each icon:**
- 40 × 40 px clickable area, centered in the 64 px rail
- Inactive: icon color `text.onBrand` @ 80% opacity
- Hover: icon @ 100% opacity + `brand.navy.800` background fill behind icon
- Active (route match): icon @ 100% + subtle yellow accent dot top-right

**Flyout panel (on hover):**
- Slides right from the sidebar, width 200 px
- Background `surface.card`, `shadow.flyout`, `rad.md`
- Row height 40 px, left-aligned text (`font.body`)
- Group header row: `font.h3` in `text.primary`
- Dismiss: `pointerleave` or click outside

## B.2 Top chrome bar (`TopBar`)

Appears across the top of the content area (not the sidebar).

- **Height:** 56 px
- **Left side:** page title text (e.g., "Options (Sample)", "Products (Sample)") in `font.h1`
- **Right side, in order (right-aligned):**
  1. 🚀 "Get started" link (`text.secondary`, icon left)
  2. Pill: "14 days left" — `brand.yellow.200` background, `text.primary`, `rad.full`, 12 px horizontal padding
  3. Pill: "Subscribe now ✨" — `brand.yellow.500` background, `text.primary`, `rad.full`, 16 px horizontal padding
  4. "?" help icon — 32 × 32 round button
  5. User avatar — 32 × 32 circle, initials "MS" on a brand navy background, `text.onBrand`

## B.3 Sample-mode banner (`SampleBanner`)

Appears top AND bottom of every page while in sample mode.

- **Height:** 48 px
- **Width:** full content width
- **Background:** `accent.orange.500`
- **Text:** "🎵 You're viewing sample data. When you're ready, [try inFlow with your own data](#)."
- **Copy color:** `text.onBrand`
- **Link:** underlined, same color as text
- **Icon:** musical note glyph (stylistic, not semantic)

## B.4 Help widget (`HelpBubble`)

- **Position:** fixed bottom-right, 24 px from each edge
- **Size:** 60 × 60 px circle
- **Background:** `brand.yellow.500` with speech-bubble icon
- **Behavior:** click opens Intercom-like chat widget (not captured in detail)

---

# PART C — PAGE-BY-PAGE BLUEPRINT

## C.0 Onboarding shell — `/initial-questions?step=*`

(Populated in earlier captures — the onboarding uses its own chrome without the authenticated sidebar. Not critical for competitive rebuild; see `inflow-captures.md` Part I for details.)

## C.1 Products list — `/products`

**Layout:** page title + filter bar + data grid + right-side detail rail (opens when a row is selected).

- **Title:** "Products (Sample)"
- **Top-right CTAs:** `+ New product` (yellow), `Import` (outline), `Export` (outline)
- **Filter bar:** Search box (left, flex-grow), Category dropdown, Location dropdown, Status dropdown, More filters button, Columns button
- **Table columns (default):** checkbox | Product name | SKU | Category | On hand | Available | Reorder point | Location | Actions (⋮)
- **Row click:** opens the Product Detail page (replace route) OR, if holding modifier, opens in side rail
- **Pagination:** bottom bar with "Page X of Y", rows-per-page selector [10, 25, 50, 100]
- **Empty state:** illustration + "No products yet" + "+ Add your first product" (see Part G)

## C.2 Product detail — `/products/{id}` *(fully captured in `inflow-captures.md` Parts 1–4.14)*

Refer to that file for the full screenshot-level spec. Summary:

- **Header row:** product name, SKU, status pill, Actions menu
- **Left rail (sticky):** pricing & cost widget, quantity widget, vendor widget
- **Main panel:** tabs — Details | Pricing & Cost | Vendors | Orders | Movement history
- **Right rail:** photo gallery, attachments, custom fields (10-slot)

## C.3 Stock counts list — `/stock-counts`

- **Title:** "Stock counts (Sample)"
- **Top-right CTA:** `+ New stock count` (yellow)
- **Filter bar:** Search, Status, Location, Date range, More filters
- **Columns:** # (SC-xxx) | Count name | Status | Location | Sheets (n/m) | Created
- **Status pill colors:** Open = `status.neutral`; In progress = `status.warning`; Completed = `status.success`
- **Row click:** → Stock count detail (C.4)
- **Empty state:** "No stock counts yet — Start counting to catch shrinkage before it costs you."

## C.4 Stock count detail — `/stock-counts/{id}`

- **Header:** back chevron | count # | count name | status pill | Actions menu (right-aligned)
- **Metadata grid (2 columns):**
  - Left: Location, Counted by, Snapshot taken
  - Right: Created, Completed, Adjustments posted
- **Sheets section:**
  - Heading "Sheets" with `+ Add sheet` button
  - Table: # | Sheet name | Location | State | Products (count)
  - State column uses the three state pills (Open / In progress / Completed)
  - Row click → Sheet detail (C.5)

## C.5 Stock count sheet detail — `/stock-counts/{countId}/sheets/{sheetId}`

- **Header:** back | sheet name | state pill | state transition CTAs
  - If state = Open: `Start counting` button (yellow)
  - If state = In progress: `Complete and adjust` button (yellow)
  - If state = Completed: no transition button, only "View adjustments" link
- **Action bar below header:** `+ ADD products` button | `📷 SCAN` button
- **Line item table:** Product | Sublocation (conditional — only if location has sublocations enabled) | Expected | Counted (editable) | Δ (auto)
- **Empty state** (no products added yet): "Add products or scan items to begin counting."

## C.6 Sales orders list — `/sales-orders`

- **Title:** "Sales orders (Sample)"
- **Top-right CTAs:** `+ New sales order` (yellow), secondary `+ New sales quote` dropdown
- **Filter bar:** Search, Customer, Status, Date range, Location, More filters
- **Columns:** # (SO-xxx) | Customer | Status | Order date | Total | Balance | Location | Assigned to
- **Status pills:** Draft (neutral) → Confirmed (blue) → Picked (purple) → Shipped (orange) → Invoiced (amber) → Paid (green)

## C.7 Sales order detail — `/sales-orders/{id}`

- **Header row:** back | SO-xxx (mono) | customer (link) | location (link) | status pill | Actions menu
- **Metadata row:** order date, due date, assigned rep, payment term
- **Tabs:** Order | Documents | Payments | History
- **Line item table (Order tab):** # | Item | Qty | Unit | Price | Subtotal + `+ Add line` button below
- **Right rail (totals):** Subtotal, Discount, Tax (1), Total, Paid, Balance
- **Footer buttons:** Email, Print, Save (yellow)

## C.8 Purchase orders list — `/purchase-orders`

Mirrors C.6 but for POs:
- **Columns:** # (PO-xxx) | Vendor | Status | Order date | Expected date | Total | Location
- **Status pills:** Draft → Issued → Partially received → Received → Closed

## C.9 Purchase order detail — `/purchase-orders/{id}`

- Same general structure as C.7 with these differences:
- **Metadata row adds:** Expected date, Received date (if applicable)
- **Line item table adds Expected + Received columns** (partial-receive support)
- **Right rail totals adds TWO tax lines:**
  - Subtotal
  - Discount
  - **State Tax** (editable %)
  - **Gov't Tax** (editable %)
  - Extra costs (freight/duty, manually entered)
  - Total

## C.10 Reports home — `/reports`

- **Title:** "Reports (Sample)"
- **Layout:** 3-column grid of report family cards
- **Each card:** icon + family name + count badge (top-right) + truncated sub-report list (4 items shown, "…" if more)
- **Families (7, 49 sub-reports total):** Sales (10) | Purchasing (8) | Inventory (11) | Manufacturing (6) | Financial (5) | B2B (4) | Admin/Audit (5)
- **Card click:** → Report family detail page (not spec'd separately — a list of sub-reports with Run buttons)

## C.11 Options — tab shell — `/options/{subtab}`

- **Title:** "Options (Sample)"
- **Subtab bar** (horizontal, centered above content):
  ```
  Global  Inventory  Orders  Integrations  Showroom  Stockroom  Account  Team  Personal
  ```
  - Each tab has an icon + label
  - Active tab: yellow pill fill (`brand.yellow.500`) with white icon + `text.primary` label
  - Inactive: transparent, `text.secondary`, hover → `border.subtle` background
- **Content area** (below subtab bar): 2-column grid of setting cards (left = primary configs, right = customization / design-related)

## C.12 Options subtabs — see Part C.11 layout, populated per subtab

- **C.12.1 Global:** Company details (full-width top) | Preferences col (Currency, Dimensions, Costing, Close transactions) | Customization col (Custom fields, Transaction numbers, Rename fields)
- **C.12.2 Inventory:** Left (Locations, Product categories, Adjustment reasons, Picking options, Variants, Units of measure) | Right (Labels + Create, Barcode types)
- **C.12.3 Orders:** Left (Pricing schemes, Taxing schemes, Payment terms, Payment methods, Carriers) | Right (Documents, Email Designer, Shipping, inFlow Pay)
- **C.12.4 Account:** Trial banner + tier grid + feature matrix (see C.13)

## C.13 Paywall — `/options/account`

- **Top banner (navy background, white text):** member count, trial expiry, trial day N of 14, current trial, Switch to inFlow Manufacturing link
- **Hero section:** H1 "Inventory and order control without spreadsheets" + 3 icon/caption columns (Track, Buy/sell, Design labels)
- **Billing toggle:** Annual (Save 20%) | Monthly — pill segmented control
- **Tier cards (3 side-by-side, 300 px wide each):**
  - Entrepreneur — 129 USD/mo — `surface.card`
  - **Small Business — 349 USD/mo — `brand.yellow.200` background + "MOST POPULAR" ribbon top**
  - Mid Size — 699 USD/mo — `surface.card`
  - Each card has: ✦ icon, plan name, "Starts at", price (mono 48 px), "billed annually", `Subscribe now` button
- **Enterprise band (below 3-up):** full-width card with left (contact sales copy + CTA) and right (key specs: unlimited locations, onboarding package required $499, serial numbers/premium database/SSO, Smart Scanner sold separately)
- **Feature matrix table:** 4 columns (feature name | Entrepreneur | Small Business | Mid Size), rows for Team members, Sales orders/yr, Integrations, Inventory locations, User access rights, API, Showroom, SSO, Support, followed by PLAN ADD-ONS section with per-tier toggle rows
- **ONBOARDING section** (bottom): "Set yourself up for success" hero + Personalized onboarding card

---

# PART D — FLOWS (SEQUENTIAL STEPS)

## D.1 Stock count flow (happy path)

```
/stock-counts
     │  click [+ New stock count]
     ▼
modal / wizard: pick location(s), name, date
     │  click Save
     ▼
/stock-counts/{newId}  (parent created, status = Open, no sheets)
     │  click [+ Add sheet]
     ▼
side drawer: pick sublocation scope, name sheet
     │  click Save
     ▼
sheet row appears, state = Open
     │  click sheet row
     ▼
/stock-counts/{id}/sheets/{sid}  (empty line items)
     │  click [+ ADD products]  OR  [📷 SCAN]
     ▼
products populated, Expected column frozen from snapshot
     │  click [Start counting]
     ▼
state = In progress, Counted column becomes editable
     │  user enters counts manually or scans
     ▼
click [Complete and adjust]
     ▼
confirmation modal: shows net Δ that will post as movement entries
     │  click Confirm
     ▼
state = Completed; parent count rollup updates
     ▼
if all sheets Completed → parent status = Completed, adjustments posted
```

## D.2 Purchase order → receive flow

```
/purchase-orders
     │  click [+ New purchase order]
     ▼
draft PO editor, status = Draft
     │  fill vendor, items, dual tax rates, expected date, Save
     ▼
draft persisted with PO-xxxxxx number
     │  click Actions > Issue
     ▼
status = Issued, PDF document generated in Documents tab
     │  (later, goods arrive)
     ▼
click Actions > Receive items
     ▼
receiving drawer: Received column pre-filled with Expected
     │  user adjusts if partial
     ▼
click Confirm
     ▼
movement ledger entries posted (positive qty)
     │  if Received < Expected → status = Partially received
     │  else → status = Received
     ▼
subsequent partial receive brings status to Received, then Closed
```

## D.3 Sample-mode delete → paywall bump

```
any list page (products, SOs, POs, ...)
     │  select row, click Actions > Delete
     ▼
tooltip/dialog: "Deleting is disabled in sample mode. [Subscribe now]"
     ▼
click [Subscribe now]
     ▼
/options/account  (paywall surface)
```

## D.4 Variants flow (adding a new option)

```
/options/inventory
     │  click Variants card
     ▼
Variants modal (lists existing options)
     │  click [+ Add another option]
     ▼
inline row appended at bottom: text field for option name
     │  type "Material", press Enter
     ▼
new row renders with empty value tag area
     │  click [→] to expand
     ▼
inline value editor (same pattern as Custom fields §4.14.2):
   drag handles + text inputs + delete icons per value
     │  add values "Aluminum", "Steel", "Plastic"
     ▼
click Save
     ▼
modal closes, new option available to products via the Variants picker
     │  (now reachable from Product Detail > Variants section)
```

---

# PART E — COMPONENT LIBRARY

Atoms and molecules to define as Figma components (with variants).

## E.1 Buttons

| Name             | Variants                           | Tokens                              |
|------------------|------------------------------------|-------------------------------------|
| `Button/Primary` | default, hover, pressed, disabled, loading | fill `brand.yellow.500`, text `text.primary`, `rad.md`, `font.buttonLg`, height 40 px |
| `Button/Outline` | default, hover, disabled            | border `border.strong`, bg transparent, text `text.primary` |
| `Button/Ghost`   | default, hover                      | no border, text `text.secondary`, hover bg `border.subtle` |
| `Button/Danger`  | default, hover                      | fill `status.danger`, text white |
| `Button/Icon`    | sm (32), md (40), lg (48)           | square, `rad.sm`, icon centered |

## E.2 Inputs

| Name                | Variants                                    |
|---------------------|---------------------------------------------|
| `Input/Text`        | default, focus, error, disabled, with prefix, with suffix |
| `Input/Number`      | same + stepper arrows                        |
| `Input/Date`        | default, focus, with picker open             |
| `Input/Dropdown`    | default, open (with menu), multi-select, disabled |
| `Input/SearchBar`   | default (with 🔍 prefix), clearable           |
| `Input/Toggle`      | off, on, disabled                             |
| `Input/Radio`       | unchecked, checked, disabled                  |
| `Input/Checkbox`    | unchecked, checked, indeterminate             |

## E.3 Pills / Tags

| Name               | Variants (by color intent)                          |
|--------------------|-----------------------------------------------------|
| `Pill/Status`      | neutral, info, success, warning, danger, brand     |
| `Pill/CountBadge`  | default (sits in card top-right with number)        |
| `Tag/OptionValue`  | default, removable (with ×), disabled               |

## E.4 Cards

| Name                   | Variants                               |
|------------------------|----------------------------------------|
| `Card/SettingRow`      | default, hover, disabled (sample mode lock) |
| `Card/ReportFamily`    | default, hover, with count badge       |
| `Card/PricingTier`     | default, most-popular (ribbon), enterprise (wide) |
| `Card/MetricWidget`    | default, with trend arrow, loading skeleton |

## E.5 Tables

| Name                | Variants                                         |
|---------------------|--------------------------------------------------|
| `Table/Header`      | default, sortable (asc, desc, none)              |
| `Table/Row`         | default, hover, selected, disabled               |
| `Table/Cell`        | text, number (right-aligned), pill, actions (⋮) |
| `Table/Footer`      | pagination, rows-per-page, total count           |
| `Table/EmptyState`  | illustration + message + primary action           |

## E.6 Navigation

| Name                  | Variants                                    |
|-----------------------|---------------------------------------------|
| `Nav/SidebarIcon`     | inactive, hover, active, with flyout        |
| `Nav/FlyoutPanel`     | default (collapsed), animating, open        |
| `Nav/SubtabPill`      | inactive, hover, active                     |
| `Nav/Breadcrumb`      | default                                      |

## E.7 Overlays

| Name                      | Variants                              |
|---------------------------|---------------------------------------|
| `Overlay/ModalBackdrop`   | default (55% navy)                    |
| `Overlay/Drawer`          | right-slide, left-slide               |
| `Overlay/Popover`         | default, with arrow                   |
| `Overlay/Tooltip`         | default, with delay                   |

---

# PART F — MODALS LIBRARY

Each modal is a top-level Figma component with title, body, footer (Cancel / Save pattern), and variants for loading / error states.

Full copy and layout specs for each modal are in `inflow-captures.md` Part II §11. Summary list:

| Modal ID                    | Open path                            | Notes                                          |
|-----------------------------|--------------------------------------|------------------------------------------------|
| `Modal/CustomFields`        | Options → Global → Custom fields     | 10-slot table, inline dropdown option editor   |
| `Modal/CostingOptions`      | Options → Global → Costing options   | 4 methods + 3 extra-cost strategies            |
| `Modal/CloseTransactions`   | Options → Global → Close transactions| 3 radios                                       |
| `Modal/Currency`            | Options → Global → Currency...       | home currency + auto rates + custom rates      |
| `Modal/Dimensions`          | Options → Global → Dimensions...     | imperial/metric pickers                        |
| `Modal/TransactionNumbers`  | Options → Global → Transaction numbers| 7 rows (SO, SQ, PO, PQ, SC, SA, ST)           |
| `Modal/RenameFields`        | Options → Global → Rename fields     | flat string-table, Reset all button            |
| `Modal/Locations`           | Options → Inventory → Locations      | sublocation toggle, location list, show deactivated |
| `Modal/AdjustmentReasons`   | Options → Inventory → Adjustment reasons | system vs user split                      |
| `Modal/PickingOptions`      | Options → Inventory → Picking options| 3 radios                                       |
| `Modal/Variants`            | Options → Inventory → Variants       | option groups, inline value editor             |
| `Modal/PaymentTerms`        | Options → Orders → Payment terms     | 6 sample rows with days-due numbers            |
| `Modal/ReceiveItems`        | PO Actions → Receive items           | drawer with Expected / Received editable       |
| `Modal/CompleteAndAdjust`   | Stock count sheet → Complete and adjust | confirmation with Δ preview                 |
| `Modal/SampleModeBlock`     | any Delete/Deactivate in sample mode | "Disabled in sample mode" + Subscribe now CTA  |

---

# PART G — EMPTY STATES LIBRARY

| Page                       | Illustration concept          | Copy                                                    | Primary CTA           |
|----------------------------|-------------------------------|---------------------------------------------------------|-----------------------|
| Products list (empty)      | empty shelves                 | "No products yet — Add your first product to start tracking." | + Add your first product |
| Stock counts list (empty)  | empty clipboard               | "No stock counts yet — Catch shrinkage before it costs you." | + New stock count |
| Sales orders (empty)       | empty shopping bag            | "No sales orders yet — Your first order is just a click away." | + New sales order |
| Purchase orders (empty)    | empty packing box             | "No purchase orders yet — Restock smarter with POs."     | + New purchase order |
| Reports family (no data)   | bar chart skeleton            | "No data yet — Run this report after you have some activity." | (no CTA) |
| Product detail → Movement history (empty) | ledger skeleton  | "No movements yet. As soon as you receive, sell, or adjust, you'll see the ledger here." | (no CTA) |

---

# PART H — INTERACTION PATTERNS

## H.1 Sample-mode partial-permission pattern

- ADD and EDIT operations work normally.
- DELETE and DEACTIVATE trigger a tooltip/modal: "Disabled in sample mode" + `Subscribe now` CTA.
- Reason: sample data integrity for other walkthrough sections.

## H.2 Soft-delete / "Show deactivated" toggle

- Delete actions hide but don't destroy.
- Almost every list-editing modal has a `Show deactivated` (or `Show inactive`) footer toggle.
- When toggled on, grayed-out rows reappear at the bottom of the list with a "Restore" icon.

## H.3 Inline sub-editor (Variants, Custom fields dropdowns)

- Clicking an expand arrow on a parent row doesn't open a sub-modal; it expands the row vertically to reveal the value editor.
- Children have drag handles for reordering and per-row delete icons.
- A `+ New X` link at the bottom of the inline area appends a new empty child.
- This keeps the user in ONE editing context.

## H.4 Snapshot-at-creation (stock count sheets)

- When a sheet is generated, Expected quantities are frozen.
- Subsequent movements in the same location do NOT change the sheet's Expected column.
- This prevents cycle-count drift during parallel counting.

## H.5 Hover flyout (sidebar)

- Real mouse hover is required — synthetic events do not reliably trigger the flyout.
- Flyout dismisses on `pointerleave` of BOTH the icon and the flyout panel.
- Clicking a row while the flyout is open triggers navigation.

## H.6 Document number prefix + increment

- Every transaction document has a configurable prefix + next-number + optional suffix.
- Format: `{PREFIX}{zero-padded 6-digit sequence}{SUFFIX}`
- Example live values: `SO-000025`, `PO-000005`, `SC-000003`, `SQ-000001`.

---

# PART I — RECOMMENDED FIGMA FILE STRUCTURE

Create ONE Figma file per team, organized into the following pages (tabs along the left of the Figma file):

```
📄 00 — Cover & index
📄 01 — Tokens (Part A)
   └─ Color styles, text styles, spacing/radii variables, shadows
📄 02 — Chrome (Part B)
   └─ Sidebar, TopBar, SampleBanner, HelpBubble as components
📄 03 — Atoms & molecules (Part E)
   └─ Buttons, Inputs, Pills, Tags, Cards, Tables, Nav, Overlays
📄 04 — Modals (Part F)
   └─ One frame per modal, full state machine (empty, loading, error)
📄 05 — Empty states (Part G)
📄 06 — Products (C.1, C.2)
📄 07 — Stock counts (C.3, C.4, C.5) — state machine diagram inline
📄 08 — Sales orders (C.6, C.7)
📄 09 — Purchase orders (C.8, C.9)
📄 10 — Reports (C.10)
📄 11 — Options (C.11, C.12) — one frame per subtab
📄 12 — Paywall (C.13)
📄 13 — Flows (Part D) — FigJam-style sequence diagrams
📄 14 — Research dump — screenshots keyed to captures.md sections
```

**Conventions:**
- Use Auto Layout everywhere — inFlow's design is heavily grid/flex-based and benefits from it.
- Name layers with the same tokens used in this file (e.g., `Button/Primary/hover`, `Card/PricingTier/most-popular`).
- Set the page background to `surface.page` so card components visually contrast correctly.
- Create ONE Team Library and publish — this keeps derivative OneAce teardown work from diverging.

---

**END OF BLUEPRINT.** Any designer or PM with this file + `inflow-captures.md` Part II + the `inflow-inventory-teardown.md` architectural narrative has enough to reconstruct inFlow Inventory screen-for-screen in Figma.
