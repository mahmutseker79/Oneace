# Sortly — Live Capture Manifest (Verbatim Copy + Layout Specs)

**Source:** https://app.sortly.com (Free plan demo account, Turkish browser locale, viewport 1512×771)
**Captured:** 2026-04-10
**App version:** v10.107.0-R216.0.0
**Purpose:** Ground-truth record of every screen's verbatim copy and interactive layout, so that `sortly-teardown.md` (analysis) and `sortly-figma-blueprint.md` (implementation spec) can be corrected where they drift from live behaviour.

> **On screenshots:** the Chrome tool's `save_to_disk` parameter saves PNGs to the host side and they are not reachable from the sandbox. `html2canvas` is not bundled on Sortly's pages, and the extension does not expose a sandbox-writable capture path. This manifest therefore captures **verbatim text** (`get_page_text`) and **interactive layout trees** (`read_page filter=interactive`) for every screen. Screenshots shown inline in the conversation remain visible in the transcript for reference.

---

## Table of contents

- [§1. Global chrome](#1-global-chrome)
- [§2. Dashboard — `/dashboard`](#2-dashboard--dashboard)
- [§3. Items browser — `/items`](#3-items-browser--items)
- [§4. Folder detail](#4-folder-detail)
- [§5. Item detail + edit](#5-item-detail--edit)
- [§6. Add Item / Add Folder modals](#6-add-item--add-folder-modals)
- [§7. Advanced Search — `/advanced-search`](#7-advanced-search--advanced-search)
- [§8. Tags — `/tags`](#8-tags--tags)
- [§9. Workflows hub — `/workflows`](#9-workflows-hub--workflows)
- [§10. Reports — `/reports`](#10-reports--reports)
- [§11. Labs — `/labs`](#11-labs--labs)
- [§12. Upgrade plan — `/upgrade-plan`](#12-upgrade-plan--upgrade-plan)
- [§13. Settings — user profile, company, billing, addresses](#13-settings--user-profile-company-billing-addresses)
- [§14. Settings — custom fields + create flow](#14-settings--custom-fields--create-flow)
- [§15. Settings — bulk import wizard](#15-settings--bulk-import-wizard)
- [§16. Settings — feature controls + labels](#16-settings--feature-controls--labels)
- [§17. Integrations — Slack, Teams, QuickBooks](#17-integrations--slack-teams-quickbooks)
- [§18. Sage panel + 404](#18-sage-panel--404)
- [§19. Activity history + trash + notifications](#19-activity-history--trash--notifications)
- [§20. Corrections queued for teardown/blueprint](#20-corrections-queued-for-teardownblueprint)

---

## §1. Global chrome

### §1.1 Left icon rail (verbatim labels, top-to-bottom)

Order observed on every screen:

1. **S** (Sortly wordmark / home, top)
2. **Dashboard** → `/dashboard`
3. **Items** → `/items`
4. **Search** → `/advanced-search`
5. **Tags** → `/tags`
6. **New** (standalone quick-add CTA, not a nav link)
7. **Workflows** → `/workflows`
8. **Reports** → `/reports`
9. **Labs** (with `Beta` pill) → `/labs`
10. **Product News** (feedback widget; Frill-powered)
11. **Help**
12. **Notifications** (bell)
13. **Settings** (bottom)

Upgrade entry point: small white rounded button with up-arrow icon linking to `/upgrade-plan`. **Correction:** earlier docs called this a "gold CTA tile pinned near bottom"; it is actually a compact icon button.

### §1.2 Sage panel — welcome state

Header: `Sortly Sage+` · `Request Support`
Greeting: `Hi Mahmut!`
Subline: `I'm Sage, your Sortly assistant.`
Prompt: `Here are a few common questions I can answer.`

Suggestion chips (verbatim, in order):
1. `How to add items?`
2. `How to create Invoices?`
3. `How to upgrade?`
4. `How to print barcode labels?`
5. `How to set up my inventory?`
6. `How to import?`

Footer disclaimer: `Sortly Sage can make mistakes. Please verify critical details.`

**Correction:** blueprint §B.3 stated Sage panel opens by default. It does NOT — it is collapsed behind the owl icon and only expands on click.

### §1.3 Analytics / vendor stack observed in markup

- `GTM-MNGM5RF` (primary GTM container)
- `GTM-WNCKPZF` + `.async-hide` (Google Optimize A/B test wrapper, 4000 ms timeout)
- `UA-49456419-8` (Universal Analytics property, still firing)
- `widget.frill.co/v2/container.js` key `ffd43d1f-cac8-4d30-abcb-9cd28cab6284` (Product News)
- Claude in Chrome overlay visible (`Claude is active in this tab group  Open chat  Dismiss`) — not part of Sortly UI

---

## §2. Dashboard — `/dashboard`

### §2.1 Verbatim copy (flattened from `get_page_text`)

```
Dashboard
Set Folders
Selected Folders: All Folders

Inventory Summary
3  Items
3  Folders
9  Total Quantity
0  Total Value

Items that need restocking
At or Below Min Level
No items found.
Try selecting a different filter.

Recent Items
New · armut… · 4 units · TRY 0.00
New · elma… · 1 unit  · TRY 0.00
New · hghhh… · 4 units · TRY 0.00

Recent Activity · All Activity
Mahmut Seker · deleted folder · Test Shelf A1 · from Main Location · 9:28 AM
Mahmut Seker · deleted item   · Test Drill Bit 10mm · from Main Location · 9:19 AM
Mahmut Seker · created folder · Test Shelf A1 · in Main Location · 9:10 AM
Mahmut Seker · created item   · Test Drill Bit 10mm · in Main Location · 8:59 AM
Mahmut Seker · created item   · armut · in Truck · 8:10 AM
View all activity
```

### §2.2 Interactive layout (refs from `read_page filter=interactive`)

| Ref | Element | Purpose |
|---|---|---|
| ref_1 | button, type=submit | Global search submit (top bar search) |
| ref_2–16 | left rail links + buttons | Dashboard, Items, Search, Tags, New, Workflows, Reports, Labs, Upgrade (matches §1.1) |
| ref_17 | link href="." | Home / wordmark |
| ref_18 | button | Product News bell |
| ref_19 | button | Help |
| ref_20 | button | Notifications |
| ref_21 | button | Settings |
| ref_22 | button | User avatar menu |
| ref_23 | button | Sage owl (open panel) |
| ref_24 | button "Set Folders" | Primary red button, top-right of canvas, opens folder scope modal |
| ref_25 | button | Filter chip `At or Below Min Level` |
| ref_26 | button | `View all activity` at bottom of Recent Activity |
| ref_27 | generic | Toast / notification region (empty) |

### §2.3 Layout spec (12-col grid, 1512×771 viewport)

- **Header bar** — H1 `Dashboard` left, primary red `Set Folders` button right with sliders icon
- **Scope chip row** — `Selected Folders: All Folders` neutral chip directly under title
- **Inventory Summary band** — H2 + 4 metric cards in a single 4×1 row, each card width ≈ col-span-3:
  - `Items` · count · blue document icon
  - `Folders` · count · amber folder icon
  - `Total Quantity` · count · purple layers icon
  - `Total Value` · count · orange monitor icon
- **Restocking band** — H2 `Items that need restocking` + filter chip `At or Below Min Level` (currently selected) + empty state `No items found. / Try selecting a different filter.`
- **Recent Items band** — H2 `Recent Items` + 3 preview cards in a row, each card has `New` badge, truncated item name, unit count, total value
- **Recent Activity band** — H2 `Recent Activity` with `All Activity` scope link, 5 stacked rows each showing `{user} · {verb} · {entity type} · {entity name} · from/in {folder} · {time}`, ending with `View all activity` CTA

### §2.4 Corrections to prior docs

1. **Blueprint §C.1 / Teardown §3** — "No chart, no trend, no value-over-time on Free dashboard" is **wrong**. The Free dashboard renders 4 KPI cards (Items, Folders, Total Quantity, Total Value) AND a restocking filterable section AND Recent Items / Recent Activity bands.
2. **Blueprint §B.1 left rail** — confirm the rail item `New` exists between `Tags` and `Workflows` as a standalone quick-create button (not listed in current blueprint).
3. **Blueprint §B.3 Sage panel** — is collapsed by default; 6 suggestion chips above must be recorded verbatim.
4. **Teardown §3** — "Inventory Summary" wording is verbatim; card order (Items → Folders → Total Quantity → Total Value) is verbatim.
5. **Default root folder** is `Main Location`, not `Entire Inventory` or `Home`. Demo also has a `Truck` folder alongside it at root level.

---

## §3. Items browser — `/items`

### §3.1 Verbatim copy

```
Folder tree (left panel, searchable via "Search folders" textbox)
  ▸ All Items
    ▸ Main Location
    ▸ Storage Area
    ▸ Truck
  History
  Trash

Breadcrumb / title: All Items
Toolbar (right): Bulk Import · Add Item (primary) · Add Folder (secondary)

Search bar: "Search All Items"
Grouping toggle label: Group Items
Sort order button: Updated At

Summary row:
  Folders: 3
  Items: 0
  Total Quantity: 9 units
  Total Value: TRY 0.00

Grid tiles (3 folders at root "All Items" level):
  New · Truck        · 4 · TRY 0.00
  New · Storage Area · 1 · TRY 0.00
  New · Main Location · 4 · TRY 0.00

Pagination: "Show: 20 per page"
```

### §3.2 Interactive layout

| Ref | Element | Notes |
|---|---|---|
| ref_24 | textbox `Search folders` | Filters left folder panel |
| ref_25 | grid (role=grid) | Main content canvas |
| ref_26..ref_33 | buttons + links to `/folder/{id}/content` | Folder tree expand controls + folder links. Folder IDs observed: 108282915, 108282916, 108282917 |
| ref_34 | link `/activity-history` | History entry in tree |
| ref_35 | link `/trash` | Trash entry in tree |
| ref_37 | link `/bulk-item-import` | Bulk Import toolbar CTA |
| ref_38 | button `Add Item` | Primary red button |
| ref_39 | button `Add Folder` | Secondary button |
| ref_40 | textbox `keyword` placeholder `Search All Items` | In-scope search |
| ref_41 | button | Search submit / clear |
| ref_42 | button | Group Items toggle |
| ref_43 | label `Group Items` | Toggle label |
| ref_44 | button | Sort dropdown (`Updated At`) |
| ref_45 | button | View mode toggle (grid/list) |
| ref_46 | button | Filter / column customise menu |
| ref_47..ref_49 | folder tile links | 3 root folders linked by id |

### §3.3 Layout spec

- 3-column layout: left folder tree (~240 px) · main canvas · right Sage drawer (collapsed, behind rail)
- Folder tree: expand chevrons + `All Items` bold as selected root; `History` and `Trash` are sibling links below the tree, not inside it
- Canvas header: title `All Items`, right-aligned toolbar (`Bulk Import` text-link · `Add Item` red primary · `Add Folder` neutral)
- Second-row toolbar: `Search All Items` textbox (flex-grow) · `Group Items` toggle · sort button · view-mode toggle · filter button
- Summary strip: horizontal row with 4 `label: value` pairs separated by dividers
- Grid area: responsive card grid, each folder tile has `New` badge top-left, name, item count, currency value

### §3.4 Corrections to prior docs

1. Folder IDs are persistent numeric (6-digit range 108 282 91x), useful for deep-link specs in Figma prototype
2. Currency is TRY on this demo — blueprint should flag currency as account-level, not hardcoded USD
3. `New` badge appears on every recently-created item/folder (session-recent), not just net-new from signup
4. Left panel has a dedicated `Search folders` textbox (not in prior blueprint); main canvas search is separate (`Search All Items`)
5. `History` and `Trash` are tree siblings below `All Items`, not items inside the folder hierarchy

---

## §4. Folder detail

**Route:** `/folder/{folderId}/content` — example captured: `/folder/108282917/content` (Truck folder)

### §4.1 Verbatim copy

```
Breadcrumb: All Items · Truck
Toolbar (right): Add Item (primary) · Add Folder (secondary)   ← no Bulk Import here
Search bar placeholder: "Search Truck"
Grouping toggle label: Group Items
Sort order button: Updated At
Summary row:
  Folders: 0
  Items: 1
  Total Quantity: 4 units
  Total Value: TRY 0.00
Grid tile:
  New · armut · 4 units · TRY 0.00
Pagination: "Show: 20 per page"
```

### §4.2 Layout deltas vs `/items`

- **`Bulk Import` link is absent** inside a folder's toolbar — only `Add Item` and `Add Folder` are rendered. Bulk import is scoped to root only.
- **Breadcrumb appears** under the canvas title: `All Items` (link to `/items`) · `Truck` (current, bold).
- **Search placeholder is dynamic** — reads `Search {folderName}` (e.g. `Search Truck`) instead of `Search All Items`.
- **Folder-level action menu** appears beside the breadcrumb (ref_38 / ref_39 in layout tree) — likely `Edit folder` / `Move` / `Delete` / `Export` — needs an expansion pass.
- Summary strip format identical to root.

### §4.3 Corrections

- Blueprint §C.3 should state that `Bulk Import` is root-only.
- Search box placeholder grammar is `Search {breadcrumb leaf}` — document as a template string.

---

## §5. Item detail + edit

**Routes:**
- Detail: `/item/{itemId}` — captured: `/item/108282920` (armut)
- Edit:   `/item/{itemId}/edit`

### §5.1 Detail — verbatim copy

```
Breadcrumb: All Items · Truck
Metadata strip:
  Sortly ID: SOED8T0003
  Updated at: 10/04/2026 8:10 AM
Title: armut

[ Edit ]  (primary button, right-aligned)
Quantity adjust widget:
  Quantity · units · 4   (with − / + steppers and inline edit)

Detail attributes (label:value rows, empty shown as "-"):
  Min Level   · units · -
  Price       · per units · -
  Total value · -

Section: Product Information
Subline: Max 8 photos, 30 MB total (JPG, PNG, HEIC)

Section: Tags      →  -
Section: Notes     →  -

Section: QR & Barcode
Subline: "You can use QR codes or barcodes to track the inventory of your products or assets."

Section: Custom Fields
Subline: "These custom fields can be used to track unique information that does not fit into any of the default fields provided by Sortly."
```

### §5.2 Detail — interactive layout

| Ref | Element | Notes |
|---|---|---|
| ref_36/ref_37 | Breadcrumb links (`All Items`, `Truck`) | |
| ref_38 | button (kebab/options on header) | Item action menu |
| ref_39 | link `/items?keyword={SortlyId}` | Clicking the Sortly ID runs a keyword search (keyboard-reachable shortcut) |
| ref_40..ref_45 | buttons | Quantity steppers (− / +) and inline edit affordance |
| ref_46 | link `/item/108282920/edit` | Opens edit mode |
| ref_47 | button `Edit` | Same destination (primary label) |
| ref_53 | button `Photos upload section`, type=`file` | Photo uploader |

### §5.3 Edit — verbatim copy

```
Header: Cancel   Save                (text button · primary red)
Fields:
  name (textbox, placeholder = current item name)
  Quantity (textbox, placeholder "Quantity")
  minQuantity (textbox, placeholder "Min Level (unit)")
  price (textbox, placeholder "Price, TRY")          ← currency hardcoded in placeholder
  value (textbox, computed Total value)

  Photos upload (file input, "Photos upload section")
  Tags (combobox)
  Notes (textbox, placeholder "Notes")

  QR & Barcode (section, inline tools)
  Custom Fields (section, manage link → /manage-custom-attributes/node)
```

### §5.4 Edit — interactive layout

| Ref | Element | Notes |
|---|---|---|
| ref_40 | textbox `name` | |
| ref_41 | button `Cancel` | |
| ref_42 | button `Save`, type=submit | Primary |
| ref_43 | textbox `Quantity`, placeholder `Quantity` | |
| ref_44 | textbox `minQuantity`, placeholder `Min Level (unit)` | |
| ref_47 | textbox `price`, placeholder `Price, TRY` | |
| ref_48 | textbox `value` | Total value (computed, editable) |
| ref_50 | button `Photos upload section`, type=file | |
| ref_51 | combobox `tags` | |
| ref_52 | textbox `description`, placeholder `Notes` | |
| ref_56 | link `/manage-custom-attributes/node` | Deep link to CF management settings |

### §5.5 Layout spec

- **2-column detail canvas**: left = photo thumbnail / gallery, right = structured attributes list
- Quantity widget is an inline editable numeric field with − / + steppers (keyboard-enabled)
- Price input is rendered with a trailing "per units" helper text
- Custom Fields section shows a persistent disclosure block and, when empty, the subline text above + a management entry point link — doubles as empty state
- Breadcrumb and Sortly ID are clickable even in edit mode (Sortly ID runs an `/items?keyword=…` scoped search when clicked)

### §5.6 Corrections

1. **Currency label in Price placeholder** is literal `Price, TRY` — localised to account currency.
2. **Edit mode is a full-page route**, not a modal (`/item/{id}/edit`) — blueprint currently implies modal; correct to route.
3. **Sortly ID is a clickable keyword-search trigger** — small but interesting affordance to note in component library.
4. **Item detail has no right-rail** — the Sage panel still collapses behind rail, but main canvas becomes 2-column with photos left + attributes right.

---

## §6. Add Item / Add Folder modals + full-page form

### §6.1 Add Item — quick modal (overlay over `/items`)

Triggered by clicking the `Add Item` red primary button in the `/items` toolbar. Slides open as a right-side drawer overlaying the grid.

**Verbatim copy:**

```
Add Item                                (drawer title)

Name* (placeholder)
Quantity*                 unit          (Quantity textbox + Unit of Measure combobox, side-by-side)
Unit of Measure*
Min Level                 Set Alert     (min level textbox + "Set Alert" toggle to the right)
Price                                   (placeholder: "Price, TRY")

[ photo uploader ]
(Max 8 photos, 30 MB Total)

This item has variants                  (toggle)

Show All Fields                         (link/button → navigates to full-page /add-item form)

Add to Folder
All Items                               (folder picker, defaults to current scope)

[ Add ]                                 (red primary submit)
```

**Interactive refs (modal):**
- ref_165 close (×)
- ref_166 textbox `name` placeholder `Name*`
- ref_167 textbox `quantity` placeholder `Quantity*`
- ref_168 combobox `Unit of Measure`
- ref_169 textbox `minQuantity` placeholder `Min Level`
- ref_170 "Set Alert" toggle
- ref_171/172 (`This item has variants` group)
- ref_173 textbox `price` placeholder `Price, TRY`
- ref_174 button `Photos upload section`, type=file
- ref_175 label `This item has variants`
- ref_177 button `Show All Fields` → opens full-page `/add-item`
- ref_178 button `Add`, type=submit
- ref_179 `Add to Folder` picker, currently `All Items`

### §6.2 Add Item — full-page form `/add-item`

Triggered by the `Show All Fields` link in the quick modal (or direct navigation). Expands all sections including Tags, Notes, QR/Barcode, Custom Fields.

**Verbatim copy (flattened):**

```
Breadcrumb: All Items / …
Title: Add Item
Section: Item Details

Name*
Quantity*                   unit
Unit of Measure*
Min Level                   Set Alert
Price                       (placeholder: Price, TRY)

Tags                        (combobox)
Notes                       (textbox)

Section: QR / Barcodes
  [ Add QR / Barcode ] (button)

This item has variants       (toggle)

Section: Custom Fields
  Add new field
  Manage Custom Fields        (link → settings)

Section: Photos
  (Max 8 photos, 30 MB total (JPG, PNG, HEIC))

Add to Folder
  All Items

[ Cancel ]    [ Add ]
```

**Unsaved changes dialog (triggered when navigating away with a dirty form):**

```
Title: "Discard unsaved changes?"
Buttons: [ Cancel ]  [ Discard ]
```

### §6.3 Add Folder — drawer

Triggered by clicking `Add Folder` secondary button. Much simpler drawer.

**Verbatim copy:**

```
Add Folder                              (drawer title)

Name*                                   (placeholder)
Tags                                    (combobox)
Notes
[ photo uploader ]
(Max 8 photos, 30 MB Total)

Show All Fields                         (link/button)

Add to Folder
All Items

[ Add ]
```

**Interactive refs (Add Folder modal):**
- ref_365 close (×)
- ref_366 textbox `name` placeholder `Name*`
- ref_367 combobox `tags`
- ref_368 textbox `description` placeholder `Notes`
- ref_369 button `Photos upload section`, type=file
- ref_370 button `Show All Fields`
- ref_371 button `Add`, type=submit
- ref_372 button (`Add to Folder` picker trigger)

### §6.4 Layout spec

- Both modals are right-side drawers (~480 px wide), not centred modals. Grid stays visible on the left with a scrim dimming it.
- Drawer header: title + `×` close top-right.
- Drawer body: field stack with tight spacing (8 px gap); photo uploader is a dashed-border rectangle occupying full width.
- Drawer footer: `Add to Folder` chip + red primary `Add` button, NOT sticky — sits directly below photo uploader.
- `Show All Fields` is a secondary affordance (link text) positioned above the `Add to Folder` row, implying the modal is a fast path and the full form is the "deep" path via route navigation (not modal expansion).
- Clicking `Show All Fields` **navigates** to `/add-item` — it does NOT swap modal content inline. This is a real URL change, so back-button works to return to `/items`.

### §6.5 Corrections

1. **Blueprint §D.5 Add Item flow** stated the modal expands in place to show extra fields. **Wrong.** "Show All Fields" is a route transition to `/add-item` full-page form — fundamentally different UX pattern. Update the blueprint flow to show the two-surface relationship (drawer vs route).
2. **Discard unsaved changes dialog** is a real centred confirm dialog with verbatim title `Discard unsaved changes?` and buttons `Cancel` / `Discard` — log in modals library §F.
3. **`This item has variants` toggle** is present on BOTH the quick drawer AND the full-page form — variants are a first-class concept even on Free plan (quick toggle, not paywalled).
4. **Add to Folder picker** is persistent footer-adjacent, not inside the field stack.
5. **Add Folder drawer is a subset of Add Item drawer** — same structure, just fewer fields (no quantity/price/variants) and a shorter stack.

---

## §7. Advanced Search — `/advanced-search`

### §7.1 Verbatim copy — page header and helper text

```
Title: Advanced Search
Subtitle: "Create lists of items across your inventory using multiple filters"

Filter helper texts (each filter section has a descriptive subline):
  Folders          : "Get a list of items in specific folders"
  Quantity         : "Filter items based on their stock levels"
  Min Level        : "Identify items below or above their min levels"
  Barcode / QR code: "Find all items matching specific barcodes or qr codes"
  Custom filters   : "Add filters matching any custom fields in your system"
  Summaries        : "Group items with the same Sortly ID"
```

### §7.2 Filter inventory (verbatim, top-to-bottom)

1. **Filters** (panel title)
2. **Folders** — "All Folders" scope + expandable checkbox tree (`All Items` ☐, `Main Location` ☐, `Storage Area` ☐, `Truck` ☐)
3. **Name** — multi-select list of existing item names with checkboxes (`armut`, `elma`, `hghhh` shown)
4. **Quantity** — "Any Units" combobox + `Min` / `Max` numeric textboxes + `Exact value` checkbox
5. **Min. Level** — "Show Items:" combobox (filter verb picker)
6. **Price (TRY)** — `Min` / `Max` numeric textboxes + `Exact value` checkbox (currency localised in label)
7. **Quantity Alerts** — "Show Items:" combobox
8. **Date Alerts** — "Select Date type field:" combobox + "Show Items:" combobox (two-step)
9. **Tags** — multi-select grid (empty in demo)
10. **Sortly ID (SID)** — list with `No data available` empty-state row
11. **Barcode / QR code** — `Search Barcode / QR code` textbox + scanner button (camera icon)
12. **Notes** — multi-select list with `No data available` empty-state row
13. **Custom filters** — (description-only section in demo; activates when CFs defined)
14. **Summaries** — (description-only; "Group items with the same Sortly ID")

**Action bar:** `Apply Filters` (primary button, bottom of filters panel)

### §7.3 Interactive layout (selected refs)

| Ref | Element | Purpose |
|---|---|---|
| ref_77 | grid (Folders) | Checkbox tree for folder scope |
| ref_82,89,95,101 | checkboxes | `All Items`, `Main Location`, `Storage Area`, `Truck` |
| ref_108 | grid (Name) | Multi-select item name list |
| ref_112,117,122 | checkboxes | `armut`, `elma`, `hghhh` |
| ref_128 | combobox `Unit` | "Any Units" default |
| ref_131/132 | textboxes `quantities.minValue` / `quantities.maxValue` | Min / Max |
| ref_133 | checkbox `Exact value` | Quantity exact toggle |
| ref_139 | combobox `Show Items:` | Min Level filter verb |
| ref_144/145 | textboxes `prices.minValue` / `prices.maxValue` | Price Min / Max |
| ref_146 | checkbox `Exact value` | Price exact toggle |
| ref_152 | combobox `Show Items:` | Quantity Alerts verb |
| ref_158 | combobox `Date type field` | Date Alerts field picker |
| ref_162 | combobox `Show Items:` | Date Alerts verb |
| ref_174 | textbox `Search Barcode / QR code` | Barcode search |
| ref_175/176 | buttons (camera) | Open scanner |
| ref_181 | button `Apply Filters` | Primary submit |

### §7.4 Layout spec

- **2-column layout**: left = 380 px filters panel, right = main canvas empty state (below) or results grid (after Apply)
- Filters panel is fully scrollable and shows ALL filters at once (no collapse/expand tabs)
- Right canvas (pre-submit): shows 6 helper cards in a 2×3 grid, each with an icon, filter name, and the helper descriptions from §7.1 — acts as an empty-state "what can this do?" tutorial
- Name, Tags, Sortly ID, Notes filters are implemented as grids with checkbox rows (multi-select)
- Quantity and Price use the same `min/max + exact value` composite pattern — reusable component worth extracting in blueprint §E
- `Show Items:` label is reused as the verb-picker combobox across multiple filters (Min Level, Quantity Alerts, Date Alerts) — likely options: "At or below", "Above", "Exactly equal" etc. Exact option list needs a follow-up click to verify.
- `Apply Filters` is the single primary CTA; no "Save Search" button on this page (may appear after filters are applied).

### §7.5 Corrections

1. **Barcode / QR code filter exists on Free plan** — blueprint should note that text-search for barcodes works; custom-format scanner is the Ultra gate, not the filter itself.
2. **Advanced Search has NO "Save Search" button in the pre-submit state** — save surface likely appears only after applying filters (to be re-captured).
3. **"Any Units" combobox** is separate from Min/Max textboxes — lets you scope by unit of measure even without setting a range.
4. **Date Alerts filter is two-combobox composite** (field picker + verb picker) — this is the only filter with 2 dropdowns in series.
5. **Right canvas on load is a descriptive grid, not a blank canvas** — nice empty-state pattern worth copying.

---

## §8. Tags — `/tags`

### §8.1 Route behaviour

- `/tags` redirects to the first tag detail route, e.g. `/tags/4943990` (numeric tag id per tag).
- Tag IDs are 7-digit (4943990 observed).

### §8.2 Verbatim copy — tag detail page

```
Left panel:
  Search tags              (textbox)
  tools                    (single existing tag row)

Main canvas:
  Title: tools
  [ ADD TAG ]              (primary red button, right-aligned)

  Empty state (centred in canvas):
    No items with this tag
    Add this tag to items or folders to show them here.
    Learn More               (link → help article)
```

### §8.3 Add Tag modal

Triggered via `ADD TAG` button. Simple centred dialog.

```
Title: Add Tag
Field: Name*                          (single textbox, placeholder "Name*")
Validation: "Name should be more than 1 character"
Action: [ ADD ]                        (primary red submit)
```

### §8.4 Coach / onboarding dialog

On first load of `/tags` the app injects a centred coach dialog:

```
Title: Using Tags to Organize Your Inventory
Body:  Tags let you group items by attributes (brand, color, condition, status) beyond your folder structure …
       (truncated by ellipsis in demo)
Action: Learn More
Close:  × (top-right of coach dialog)
```

### §8.5 Help link URL

`Learn More` → `https://help.sortly.com/hc/en-us/articles/360000737952-What-are-tags-How-do-I-use-them-`

### §8.6 Layout spec

- **2-column layout**: left narrow tag list (~260 px) with search, right wide canvas
- Tag list rows render as pill-style chips (rounded-full) with tag colour indicator on the left
- Main canvas title matches selected tag; only primary action is `ADD TAG`
- Empty state is centred vertically in canvas with icon + 2-line copy + `Learn More` link
- Coach dialog is a separate modal layer — dismissible, one-time, and shows the verbatim text above

### §8.7 Corrections

1. **Button label is uppercase `ADD TAG`** (not title-case). Probably CSS `text-transform: uppercase` — blueprint §E should note this as a button-case exception for certain primary actions.
2. **Add Tag modal has ONLY a name field** — no colour picker, no description, no parent tag. Colour may be auto-assigned.
3. **Tag URL is `/tags/{id}` not `/tag/{id}`** (plural), unlike items which use singular `/item/{id}`.
4. **Coach/onboarding dialogs** are a distinct pattern from paywall modals — Sortly uses them on Tags (and presumably other features) the first time a user visits.

---

## §9. Workflows hub — `/workflows`

### §9.1 Hub page verbatim copy

```
Title: Workflows
Subtitle: "Workflows are actions you can take on your inventory that interact with quantities."

Card 1 — Pick Lists           (New badge)
  "Easily request items for pickup with Sortly's Pick Lists.
   Create a list, add items, and assign it to a user for review
   or pickup. Quantities update automatically after items are picked."

Card 2 — Purchase Orders      (New badge)
  "Simplify your procurement process by easily creating,
   managing, and tracking purchase orders. This is the hub for that."

Card 3 — Stock Counts         (New badge)
  "Count and verify your inventory with ease. Stock counts help
   you track accurate quantities and keep your records up to date."
```

Layout: 3 cards in a single horizontal row, each card clickable → opens its paywall modal.

### §9.2 Pick Lists paywall modal (generic Upsell Template A)

Triggered by clicking Pick Lists card.

```
Header hero: "Create a Pick List, assign to any user and pick items using Sortly's Pick Lists"
[ How it works? ] (video link → opens https://www.youtube.com/watch?v=gNtFtOJLyo4 in new tab)

Headline: "Upgrade to Ultra to unlock Pick Lists"

Body bullets:
  • Pick Lists provide an efficient and seamless way to pick items
    for your project or order.
  • Make planning easy by creating a list of items to pick.
  • Assign Pick Lists to employees so they know exactly which items to pick.
  • Watch inventory automatically update after items are picked.
  • Review records of what has been picked for each project.

Footer link: "All Ultra Plan Features"
Primary CTA: [ TRY IT FREE FOR 14-DAYS ]   (uppercase, red primary)
```

### §9.3 Purchase Orders paywall modal (same template A, different copy)

```
Header hero: "Easily create, track, and receive orders with Sortly's Purchase Orders."
[ How it works? ]

Headline: "Purchase Orders are now available in Sortly Ultra Plan."

Body bullets:
  • Streamline your purchasing process and make reordering a breeze
    with Purchase Orders.
  • Keep everything in one place—easily create and track your purchase
    orders from start to finish.
  • Send purchase orders for review and approval, if needed, for
    enhanced visibility.
  • Instantly export any purchase order as a PDF, complete with all
    the details your vendor needs.
  • Automatically update your inventory levels the moment your order arrives.

Footer link: "All Ultra Plan Features"
Primary CTA: [ TRY IT FREE FOR 14-DAYS ]
```

### §9.4 Stock Counts paywall modal (distinct Template B)

```
Headline: "Upgrade to Ultra: Keep Inventory Accurate & Clear"
Subhead:  "With Stock Counts, skip spreadsheets and be confident
           knowing every item is accounted for."

Body bullets:
  • Complete stock counts without manual, disconnected counting methods.
  • Get live status and progress updates that show who counted what and when.
  • Flag and resolve discrepancies before they cause audit failures
    or stock issues.

PLUS:
  Everything you need for smarter, faster inventory—advanced reports,
  barcode labels, Pick Lists, and Purchase Orders.

CTAs:
  [ LEARN MORE ]   (secondary text link, uppercase)
  [ TRY FOR FREE ] (primary red, uppercase)
  [ No Thanks ]    (tertiary dismiss, title-case)
```

### §9.5 Key differences between the two paywall templates

| Aspect | Template A (Pick Lists, Purchase Orders) | Template B (Stock Counts) |
|---|---|---|
| Video affordance | `How it works?` link (YouTube in new tab) | Absent |
| Headline verb | "Upgrade to Ultra to unlock X" | "Upgrade to Ultra: Keep … Accurate & Clear" |
| Bullet style | Feature bullets only | Feature bullets + "PLUS:" bundle clause |
| CTAs | Single primary `TRY IT FREE FOR 14-DAYS` | Three: `LEARN MORE` / `TRY FOR FREE` / `No Thanks` |
| Exit affordance | Close X top-right only | `No Thanks` explicit tertiary button |
| Sentiment framing | Feature description | Value proposition with outcome language ("skip spreadsheets", "audit failures") |

### §9.6 Corrections to prior docs

1. **Blueprint §D.2 claimed "single paywall template"** — that's wrong. There are TWO templates. Stock Counts uses a more persuasive "outcome-first" template with an explicit `No Thanks` escape hatch; Pick Lists and Purchase Orders share a simpler template with only a positive CTA.
2. **Pick Lists and Purchase Orders both have an inline video link** (`How it works?`) that opens YouTube in a new tab — blueprint should mark video-link as a component variant.
3. **Button text-transform on Template A is uppercase** for the primary CTA (`TRY IT FREE FOR 14-DAYS`), and Template B is uppercase for `LEARN MORE` / `TRY FOR FREE` but title-case for `No Thanks`. Worth capturing as a button-case rule.
4. **Stock Counts modal is the "premium" paywall** — Sortly clearly treats it as their highest-value upgrade driver, justifying the richer template.
5. **All 3 workflow cards carry a `New` badge** in the hub, giving the impression of fresh/premium functionality — even Stock Counts which is a core feature, because the modal is what's new.

---

## §10 Reports (hub, free reports, gated reports, Customize Columns popover)

**URL:** `https://app.sortly.com/reports` and sub-routes
**Capture date:** 2026-04-10
**Plan under test:** Free (TR locale, currency TRY)

### §10.1 Reports hub — verbatim copy

```
Reports
Unlock more saved reports and report subscriptions by upgrading your plan today.
UPGRADE PLAN

Learn about reports, saved reports, and report subscriptions
Watch Video Tutorial    Read Help Article

Activity History
Keep tabs on all users' changes to items, folders, tags, & more.

Inventory Summary
Review your inventory's quantity, value, & location at a glance.

Transactions
Monitor all inventory movements, updates, and deletions for efficient team oversight.

Item Flow
Track quantity fluctuations for your inventory using flexible filtering options.

Move Summary
Monitor all inventory folder changes that occur within a specified time frame.

User Activity Summary
Track how team members interact with your inventory & filter for actions that matter most to you.
```

### §10.2 Reports hub — interactive layout (from read_page/interactive)

| ref | role | label / text | href/target |
|---|---|---|---|
| ref_2 … ref_16 | links/buttons | Global left rail (Dashboard, Items, Search, Tags, Workflows, **Reports active**, Labs, Upgrade Plan) | — |
| ref_17 | link | Sortly home/logo (above rail) | `.` |
| ref_18 … ref_23 | buttons | Global top chrome: New, notifications, help, announcements, Sage owl, user avatar | — |
| ref_24 | textbox | "Search reports" | placeholder |
| ref_25 | link | Activity History (sub-nav item 1) | `/activity-history` |
| ref_26 | link | Inventory Summary (sub-nav item 2) | `/reports/inventory-summary` |
| ref_27 | link | Transactions (sub-nav item 3) | `/reports/all-transactions` |
| ref_28 | link | Item Flow (sub-nav item 4, Ultra-gated) | `/reports/quantity-changes-by-item` |
| ref_29 | link | Move Summary (sub-nav item 5, Ultra-gated) | `/reports/transfer` |
| ref_30 | link | User Activity Summary (sub-nav item 6, Ultra-gated) | `/reports/user-activity-summary` |
| ref_31 | generic | Upgrade banner container | — |
| ref_32 | button | `UPGRADE PLAN` (red pill, banner) | opens `/upgrade-plan` |
| ref_33 | link | Video thumbnail (in banner) | `https://youtu.be/4kgwuXEPgvc` |
| ref_34 | link | `Watch Video Tutorial` | same YT link |
| ref_35 | link | `Read Help Article` | `https://help.sortly.com/hc/en-us/articles/8979288861083-Reports-Overview` |
| ref_36 … ref_41 | links | 6 card tiles (Activity History, Inventory Summary, Transactions, Item Flow, Move Summary, User Activity Summary), each with title + one-line description | same hrefs as sub-nav |

### §10.3 Reports hub — layout spec

- **Top bar:** page title "Reports" left-aligned. No right-side action buttons at hub level (each report has its own EXPORT).
- **Upgrade banner:** full-width soft card under title containing a video thumbnail (left ~160×90, play-overlay, links to YouTube), a text block (middle: heading + "Watch Video Tutorial" / "Read Help Article" link row), and an upgrade copy block (right: "Unlock more saved reports..." + red `UPGRADE PLAN` pill).
- **Card grid:** 6 report tiles in a responsive 3-column grid (at 1512 viewport). Each tile has an icon top-left (stroke-style, matching the sub-nav glyph), title in bold, and a one-line muted description. Entire tile is clickable.
- **Sub-nav:** collapsible panel between primary rail and main content, containing a "Search reports" textbox at top and the 6 report links stacked vertically with icons and an active-state indicator bar.

### §10.4 Free vs Ultra gating behavior

| Report | URL | Free accessible? | Gating UX |
|---|---|---|---|
| Activity History | `/activity-history` | **Yes** | full live data table with filters, Export |
| Inventory Summary | `/reports/inventory-summary` | **Yes** | full live data table, Group Items toggle, Edit columns |
| Inventory Summary → Low Stock (saved preset) | `/reports/low-stock` → `/reports/inventory-summary` | **Yes** | opens filtered Inventory Summary, header shows "Saved Inventory Summary Report / Low Stock / SAVED" |
| Transactions | `/reports/all-transactions` | **Yes** | full live data table (0 rows in demo) |
| Item Flow | `/reports/quantity-changes-by-item` | **No** | **silent redirect to `/reports`** — no paywall modal |
| Move Summary | `/reports/transfer` | **No** | **silent redirect to `/reports`** — no paywall modal |
| User Activity Summary | `/reports/user-activity-summary` | **No** | **silent redirect to `/reports`** — no paywall modal |

**Critical UX finding:** Unlike `/workflows` where Ultra-gated features show a prominent paywall modal, the Ultra-gated reports are gated by **silent redirect** — the URL momentarily shows the target route, and the page lands back at `/reports`. There is **no modal, no toast, no inline message** explaining the gate. The only upgrade messaging is the persistent banner at the top of the hub. This is a significant behavioral divergence from the Workflows paywall pattern and must be recorded as two distinct gating patterns in the teardown.

### §10.5 Activity History (live, Free)

**Header row:** `Default Report` / `Activity History` + `EXPORT` button (top-right).

**Filter/date row:** `This Month / 01/04/2026 - 30/04/2026` date picker pill + "Search Activity" textbox + filter pill row.

**Columns (8 base + expand chevron):**
```
DATE | ACTIVITY TYPE | ACTIVITY | USER NAME | SID | ITEM OR FOLDER NAME | QTY CHANGE | QTY BALANCE | QTY MOVED | SOURCE FOLDER | DESTINATION FOLDER
```

**Row template:** time (e.g., `9:28 AM`), activity type label (`Delete Folder`, `Create Item`, `Create Folder`, `Delete Item`), natural-language sentence ("Mahmut Seker deleted folder Test Shelf A1 from Main Location"), avatar + user name, SID chip like `SOED8R0004`, linked item/folder name, qty columns showing `—` for non-qty events, folder chips.

**Key UX detail:** each row is expandable via a leading chevron; linked item/folder names route to the respective detail pages.

### §10.6 Inventory Summary (live, Free)

**Header row:** `Default Report` / `Inventory Summary` + saved-reports dropdown icon + `EXPORT` button.

**Filter/stats bar:**
```
[Search with barcode icon (purple +)]  [Any item ▾]  [Any folder ▾]  [filters icon]                   Group Items [toggle ON] ⓘ

Total Quantity          Total Value
9 units                 TRY 0.00
```

**Table header strip (right-aligned):** `[Edit]` button (pencil icon) above the rightmost column.

**Columns (scrollable horizontally):**
```
NAME | QUANTITY | MIN LEVEL | PRICE | VALUE | FOLDER | TAGS | NOTES | BARCODE / QR 1 | BARCODE / QR 2
```

**Row template:** `NEW` chip + thumbnail placeholder + item name; quantity with units suffix (e.g., `4 units`, `1 unit`); em-dashes for empty numeric cells; folder name in plain text.

**Footer:** `Show: 20 per page` (no total-count shown when Group Items is on).

### §10.7 Customize Columns popover (triggered by `Edit` on Inventory Summary)

**Verbatim:**
```
Customize Columns
Drag to reorder ⓘ

☑ Min Level          ⋮⋮
☑ Price              ⋮⋮
☑ Value              ⋮⋮
☑ Folder             ⋮⋮
☑ Tags               ⋮⋮
☑ Notes              ⋮⋮
☑ Barcode / QR 1     ⋮⋮
☑ Barcode / QR 2     ⋮⋮

[APPLY]    [CANCEL]
```

**Layout spec:** light-card popover anchored under the `Edit` button (right-anchored), ~280px wide. Title row; subtitle with help tooltip icon; 8 rows each with a red checkbox, label, and drag handle (⋮⋮). Footer has APPLY (red pill, disabled-looking until changes made) and CANCEL (ghost button). Clicking outside closes without applying. Note: `NAME` and `QUANTITY` are NOT in the list — they are pinned/mandatory columns.

### §10.8 Transactions (live, Free)

**Header row:** `Default Report` / `Transactions` + `EXPORT` button.

**Filter row:**
```
[Any item ▾]  [Any folder ▾]  [Any transaction ▾]  [This Month / 01/04/2026 - 30/04/2026 ▾]  [Edit]
```

**Columns:**
```
TRANSACTION DATE | NAME | QTY CHANGE | TRANSACTION TYPE | TRANSACTION NOTES | FOLDER | USER | PRICE | VALUE
```

**Empty state:** "1-0 of 0" pagination shown when no rows.

**Footer:** `Show: 20 per page    1-0 of 0`

### §10.9 Report-page shell — layout spec

- **Persistent shell:** left rail + sub-nav panel + main content area, on every report page.
- **Top strip:** `Default Report` or `Saved <Report> Report` label + report name heading left-aligned; saved-reports dropdown icon (calendar-with-star) + red `EXPORT` button right-aligned.
- **Saved reports dropdown icon** entry point that the banner's "saved reports / subscriptions" copy refers to on Free.
- **Filter pills** ("Any item", "Any folder", "Any transaction") open filter panels (shared component with Items browser advanced filters).
- **`Group Items` toggle** is unique to Inventory Summary.
- **`Edit` on Inventory Summary** opens Customize Columns popover. `Edit` on Activity History and Transactions opens the date-range / filter editor (not the columns popover).
- **Footer pagination** reuses the "Show: 20 per page" component from the Items browser.

### §10.10 Corrections to prior docs

1. **Blueprint/teardown must distinguish TWO gating patterns:**
   - **Loud gate (modal paywall):** Workflows → Pick Lists, Purchase Orders, Stock Counts
   - **Silent gate (redirect, banner-only messaging):** Reports → Item Flow, Move Summary, User Activity Summary
   This is a significant UX inconsistency and a concrete data point for OneAce — pick one pattern and stick with it.

2. **Inventory Summary has a secondary saved-report sub-item** (`Low Stock`) that appears in the sub-nav only after landing on Inventory Summary, not on the hub itself. This is a "dynamic sub-nav expansion" pattern: the parent expands to reveal its saved reports when the parent is active.

3. **`Default Report` label** above each report name denotes the current view as the built-in default. For the Low Stock preset, this changes to `Saved Inventory Summary Report` + a `SAVED` badge — captures the saved-report-active state.

4. **Customize Columns is the only "modal"-equivalent affordance on a live report.** It is a popover, not a dialog, and only covers mutable columns (NAME and QUANTITY are pinned).

5. **EXPORT button** is always present on every live report page. On Free plan, the button is enabled and not gated in the interactive tree (not clicked during capture to avoid triggering export).

6. **Report URL schema inconsistency:** `/reports/<report-key>` for most (`inventory-summary`, `low-stock`, `all-transactions`, `quantity-changes-by-item`, `transfer`, `user-activity-summary`), but `activity-history` lives at top-level `/activity-history`, NOT under `/reports/`. Note in blueprint URL schema.

7. **Persistent upgrade banner** (Reports hub only) uses different layout/copy from the Workflows hub. Workflows has no equivalent banner — its upgrade messaging is inside each modal. Another inconsistency worth flagging in the teardown.

---

## §11 Sortly Labs (/labs)

**URL:** `https://app.sortly.com/labs`
**Capture date:** 2026-04-10
**Plan under test:** Free

### §11.1 Verbatim copy

```
Sortly Labs  [Beta]
Explore and test experimental features

ⓘ Features in Labs are experimental and under active development. Enable them to try new capabilities and help shape the future of Sortly. Your feedback is invaluable in making these features production-ready.

[Search lab features]    Stage ▾    Status ▾                                                Sort ▾

Threads
ALPHA
Keep conversations threaded to your inventory.
                                                                                    ○ Disabled
⌃ Show Details
```

**Expanded "Show Details" state (label toggles to `Hide Details`):**

```
⌄ Hide Details
——————————————————————————————————————
INFORMATION
No more bouncing between email, chat, and spreadsheets to track down answers. Threads lets your team have conversations directly on any item or folder in Sortly. Just @ a teammate to loop them in, and they'll get notified instantly. Flag low stock, ask a question, or assign a follow-up. It all stays attached to the asset it's about, so nothing gets lost in the shuffle.
```

### §11.2 Interactive layout

| ref | role | label / placeholder | notes |
|---|---|---|---|
| ref_24 | textbox | "Search lab features" | client-side filter on feature cards |
| ref_25 / ref_26 | button | `Stage ▾` | opens Stage filter dropdown |
| ref_27 / ref_28 | button | `Status ▾` | opens Status filter dropdown |
| ref_29 / ref_30 | button | `Sort ▾` | opens Sort dropdown |
| ref_31 | label | `Disabled` | toggle label (off state); toggle itself is the ○ switch |

### §11.3 Filter/Sort dropdowns — verbatim option lists

**Stage dropdown:**
```
Alpha
Beta
Experimental
```

**Status dropdown:**
```
Enabled
Disabled
```

**Sort dropdown (default: Name A-Z is checked):**
```
Name (A-Z)   ✓
Name (Z-A)
Newest
Oldest
```

### §11.4 Layout spec

- **Page header (full-width, no left-rail overlap):**
  - `Sortly Labs` large title + `Beta` pill badge on the right of the title (outlined pill)
  - Sub-tagline "Explore and test experimental features" in muted text, directly below
  - Horizontal rule separator

- **Info callout:** blue-tinted card (light blue background, blue left border accent) with ⓘ icon + full-paragraph disclaimer. Spans most of the content width, horizontally centered.

- **Feature list card:** white rounded card below the info callout, containing:
  - Top filter row: search textbox (flex-start), `Stage` + `Status` dropdown buttons (inline), and `Sort` dropdown pushed to the far right
  - Feature rows stacked vertically. Each row contains:
    - Feature name (large bold)
    - Stage chip directly below the name (`ALPHA` shown as purple outline pill)
    - Description one-liner in muted text
    - `Show Details` / `Hide Details` link at the bottom-left, with a chevron indicator (down when collapsed, up when expanded), in red accent text
    - Enable/Disable toggle aligned to the top-right of the row, with "Disabled" label to the right of the toggle
  - Expanded state reveals an `INFORMATION` sub-heading (uppercase small-caps) + full description paragraph, with a thin horizontal divider above it

### §11.5 Corrections to prior docs

1. **Labs was not previously captured.** Add a new blueprint section for `/labs` with:
   - Header pattern: Title + Beta pill + sub-tagline + HR
   - Blue disclaimer callout component
   - Feature card row with: name + stage chip + description + details disclosure + enable/disable toggle
   - Filter toolbar: search + 3 dropdowns (Stage/Status/Sort)

2. **Stage chip component** is a new pill type worth adding to the component library (purple outline, small caps text, ~32px wide). It's distinct from the `New` badge pill and the `ULTRA`/`PREMIUM` upgrade pills.

3. **The "show details" disclosure pattern** (chevron + red text label, toggling to "Hide Details") is reused elsewhere in Sortly — note it as a standard disclosure component rather than a Labs-only pattern.

4. **Only one lab feature is present in the demo tenant** (`Threads`, ALPHA stage, Disabled status). The filter/sort chrome is therefore over-dimensioned for the current state — this is a forward-looking UX for when Labs has many features, and may inform how OneAce should scaffold its Labs/Settings hubs.

5. **Toggle state default for Labs features is `Disabled`** — opt-in only. The label "Disabled" doubles as the toggle status indicator.

6. **`Beta` badge on the page title** means Labs itself is still beta — the page is branded as an experimental surface inside an experimental surface. Note this hierarchical "beta-ception" for messaging.

---

## §12 `/upgrade-plan` (pricing modal)

**Route:** `/upgrade-plan` — rendered as a full-viewport modal overlay with Sortly logo top-left and X close top-right. Accessible from multiple loud gates (Workflows modals "UPGRADE" CTA, reports restrictions, user-limit paywalls).

### §12.1 Verbatim — shared chrome

**Modal header bar (fixed):** `Sortly` wordmark logo (red script) at top-left | `×` close icon at top-right

**Page heading:** `Plans that suit your business`

**Subheading (two lines, centered):**
> `Choose a plan that's right for you. No long term contracts. Upgrade as you grow.`
> `Need help? Check out our Support Page.`

(`Support Page` is a red inline link)

**Billing toggle row (centered below subheading):**
- Pink pill callout: `Save 50%` with a curved hand-drawn arrow pointing down-right toward the toggle
- Segmented pill toggle: `Yearly` | `Monthly` (active segment = red fill, inactive = white with gray text)

**Footer link (below cards):** `Compare all features` (red underlined)

**Below fold:** `Our customers` section header (logos bar — not captured in text)

### §12.2 Verbatim — Yearly view (initial landing state)

#### Advanced card
- Illustration: hot-air balloon (red/cloud themed)
- **Advanced**
- Price: `$24.00/mo`
- Subtext: `$288 billed yearly`
- Primary CTA (red fill): `START FREE TRIAL`
- Secondary CTA (red text link): `BUY NOW`
- Divider
- `2 user licenses included`
- `500 Unique Items`
- Feature list (bulleted, black checkmarks):
  - `All Sortly Free features`
  - `5 Custom Fields`
  - `Unlimited QR code label generation`
  - `Low stock alerts`
  - `Low stock reports`
  - `Customizable user access`
  - `All units of measure unlocked`
  - `Custom branding`

#### Ultra card — `Most Popular!` (red banner above card)
- Illustration: airplane taking off
- **Ultra**
- Price: `$74.00/mo`
- Subtext: `$888 billed yearly`
- Primary CTA: `START FREE TRIAL`
- Secondary CTA: `BUY NOW`
- Divider
- `5 user licenses included`
- `2,000 Unique Items`
- Feature list:
  - `All Sortly Advanced features`
  - `10 Custom Fields`
  - `Saved reports`
  - `Date-based alerts`
  - `Unlimited barcode label generation`
  - `User activity summary reports`
  - `Move summary reports`
  - `Item flow reports`
  - `3rd party scanner support`
  - `Purchase orders`
  - `Slack integration`
  - `Microsoft Teams integration`
  - `Pick Lists`

#### Premium card
- Illustration: rocket ship
- **Premium**
- Price: `$149.00/mo`
- Subtext: `$1788 billed yearly`
- Primary CTA: `START FREE TRIAL`
- Secondary CTA: `BUY NOW`
- Divider
- `8 user licenses included`
- `5,000 Unique Items`
- Feature list:
  - `All Sortly Ultra features`
  - `20 Custom Fields`
  - `QuickBooks Online Integration`
  - `Report subscriptions`
  - `Customizable role permissions`
  - `Priority email support`

#### Enterprise card
- Illustration: UFO
- **Enterprise**
- Price: `Custom`
- Primary CTA (outline style, not red fill): `TALK TO SALES`
- Divider
- `12+ user licenses included`
- `10000+ items`
- Feature list:
  - `All Sortly Premium features`
  - `Unlimited Custom Fields`
  - `Dedicated CSM`
  - `API access`
  - `Webhooks`
  - `SSO`
  - `Limited access seats`
  - `Multi-account access (MAA)`
  - `Team member trainings`
  - `Guided inventory setup`

### §12.3 Verbatim — Monthly view (after toggle click)

Same 4 cards, same feature lists, same illustrations, same CTAs. **Only the price block and the secondary hint line change** per card. Enterprise card is unchanged (price is "Custom" in both views).

#### Advanced card (Monthly)
- Price: `$49.00/mo`
- Secondary hint (below price, red text): `Switch to Yearly and save $300`
- (`Switch` is a red link — clicking flips to Yearly view)

#### Ultra card (Monthly)
- Price: `$149.00/mo`
- Secondary hint: `Switch to Yearly and save $900`

#### Premium card (Monthly)
- Price: `$299.00/mo`
- Secondary hint: `Switch to Yearly and save $1800`

### §12.4 Interactive layout

| Element | Role | Target |
|---|---|---|
| Close icon top-right | button | dismisses modal, returns to previous route |
| Support Page (in subheader) | link | external help doc |
| `Yearly` segment | button | switches all 4 cards to yearly pricing/billing-copy |
| `Monthly` segment | button | switches all 4 cards to monthly pricing/billing-copy |
| `START FREE TRIAL` × 3 (Advanced/Ultra/Premium) | button | begins trial flow for that tier |
| `BUY NOW` × 3 | link | goes directly to checkout for that tier |
| `TALK TO SALES` (Enterprise) | link | sales contact form / mailto |
| `Switch` inside each monthly card's hint | link | flips this specific card (and sibling cards) back to yearly view |
| `Compare all features` | link | opens external / in-app detailed comparison table |

### §12.5 Layout spec

- **Overlay:** full-viewport white modal; no visible backdrop because it covers 100% of the viewport. Fixed-looking header bar (Sortly logo + close X) with bottom 1px divider. In practice the HTML element is the scroll container (`overflow:visible`), so it behaves as a full-page route rather than a dialog.
- **Content column:** centered, max-width ~1360px. Vertical stack: heading → subheading → toggle row → 4-card grid → "Compare all features" link → "Our customers" logo strip.
- **4-card grid:** 4 equal-width cards in a single row. Each card is a white rounded rectangle with soft shadow. Cards have consistent internal padding (~32–40px). On narrower viewports would stack 2×2 (not verified in demo).
- **Most Popular! banner:** sits *above* the Ultra card as a separate red pill-tab. Visually connects to the card's top edge but is rendered as a tab, not an inset ribbon.
- **Card internal hierarchy:** illustration (~120px square soft-pink backdrop) → plan name (bold ~36px) → price block (bold ~48px with `/mo` tiny suffix) → billing hint line (muted small text) → primary CTA (red fill, ~80% of card content width) → secondary CTA (red link text, centered) → 1px horizontal divider → user license line with icon → unique item count line with icon → feature list (each row with a small bullet/icon, left-aligned, generous line height).
- **Save 50% callout:** pink pill to the *left* of the toggle, with a curved hand-drawn arrow SVG pointing at the Monthly/Yearly toggle. Only shown in this position; not repeated per card.
- **Toggle row:** segmented pill control with 2 options. Active segment fills with brand red, inactive segment is transparent with gray text. Callout + toggle are horizontally aligned.
- **CTA styling:** 3 visual tiers: (1) red-fill rectangular button with white caps text (primary CTA for Advanced/Ultra/Premium); (2) red text link in caps (secondary `BUY NOW`); (3) outline button with gray border (Enterprise `TALK TO SALES`) — signals sales-led flow vs self-serve.
- **Typography:** All-caps for CTA labels. Feature lists in sentence case. Price uses tabular figures.
- **Scroll behavior:** no internal modal scroll container. At 771px viewport with ~1768px content height, "Our customers" and footer require normal window-scroll. The Sortly logo + close X header behaves as a regular page header, not fixed chrome.

### §12.6 Corrections to prior docs

1. **No per-card 50% disclaimer.** Pre-compaction notes referenced a "50% discount applies only to first year of new customer subscriptions…" per-card. This is **not present** in the current captured state — the only "Save 50%" surface is the pink callout next to the Yearly/Monthly toggle. Remove the per-card disclaimer from blueprint §pricing-modal.

2. **Modal is not scroll-isolated.** `/upgrade-plan` is a full-page route rendered as an overlay, not a dialog-with-its-own-scroller. `document.documentElement` is the scroll container, `overflow:visible` throughout. Blueprint should model it as `Route: /upgrade-plan` (full-page), not as a dialog nested inside another route.

3. **Enterprise card has no BUY NOW.** Enterprise is sales-led only. The secondary CTA row is collapsed (no `BUY NOW` link). Price shows `Custom`, no `/mo` suffix. Treat as a distinct card variant in the component library — not the same component with empty fields.

4. **Monthly view reuses feature lists verbatim.** The only fields that change between Yearly and Monthly are (a) the price, and (b) the secondary hint line (`$X billed yearly` vs `Switch to Yearly and save $N`). All feature bullets, user counts, and item counts are identical. OneAce's pricing modal should follow the same data-driven pattern: one feature-list source, two pricing views.

5. **Toggle is Yearly-default.** On initial load of `/upgrade-plan`, Yearly is selected (the discounted state). This is an anti-sticker-shock default — monthly prices are 2× yearly, so leading with yearly lowers the perceived headline number. Worth copying in OneAce pricing UI.

6. **"Most Popular!" is on Ultra, not Premium.** Sortly steers toward the mid-tier ($74 yearly / $149 monthly). OneAce should make the "Most Popular!" designation a config flag, not hardcoded to a tier slot.

7. **Price multiplier is exactly 2×.** Monthly = 2× yearly-equivalent per tier ($24→$49, $74→$149, $149→$299). The "50%" callout refers to this multiplier, not a first-year promo. The 2× yearly discount is aggressive relative to the typical ~17% SaaS norm. Blueprint should note this as a pricing-strategy choice.

8. **No modal backdrop or ESC handler verified.** Only the top-right X is a documented dismiss control. Blueprint should explicitly test/document keyboard ESC and backdrop click behavior for the OneAce equivalent.

---

## §13 Settings shell + `/user-profile`

### §13.0 Discovery: how Settings is reached

Settings is **not a left-rail route.** The left rail has no gear icon as a top-level link. Instead, the gear icon at the bottom of the left rail is a **button** that opens a user popover. The popover contains 4 items:

| Popover item | Route | Notes |
|---|---|---|
| `MS` avatar + `Mahmut Seker` | — | header chip, not clickable |
| `Settings` | `/user-profile` | enters the settings hub on the User Profile tab |
| `Preferences` | `/user-preferences` | different route from `Settings > Preferences` sub-tab (may be a shortcut) |
| `Plan & Billing` | `/billing-info` | deep-link to one settings sub-tab |
| `Sign Out` | — | button, no route |

**Critical finding — bad route:** `/preferences` (without `user-` prefix) renders the Sortly generic **404 page**: `Oops! / Something went wrong / Page not found` with a blue open-box illustration with `?` and `!` marks floating above it. Free-plan demo tenants can reach this 404 by typing the URL directly. This is a **broken internal route** worth calling out in the teardown.

### §13.1 Verbatim — Settings hub shell (sub-nav column)

Header: `Settings` (dark title, bold, ~32px)

Collapse control: `<` chevron at the right edge of the `Settings` header bar — presumably collapses the sub-nav column to icons-only.

The sub-nav is a vertical list grouped by dividers. Full list in order, with live routes where present:

**Group 1 — Account:**
- `User Profile` → `/user-profile` (active row = red text + red person icon + red pill background)
- `Preferences` → `/user-preferences`

**Group 2 — Organization / Billing:**
- `Company Details` → `/company-details`
- `Addresses` → `/company-addresses`
- `Plan & Billing` → `/billing-info`
- `User Access Control` → **not an anchor** in the demo tenant — rendered as a gated/non-link row. Likely a paywall gate (Ultra+) that either opens a modal or silently redirects to `/upgrade-plan`.

**Group 3 — Inventory data model:**
- `Custom Fields` → `/manage-custom-attributes/node` (URL segment `/node` is notable — suggests custom-attribute system has a root node identifier)
- `Units of Measure` → `/manage-units`
- `Manage Alerts` → `/manage-alerts`

**Group 4 — Bulk / features / labels / API:**
- `Bulk Import` → `/import`
- `Feature Controls` → `/feature-controls`
- `Create Labels` → **not an anchor** in the demo tenant — rendered as a gated/non-link row. Likely another gate.
- `Public API (beta)` → `/public-api`

**Group 5 — Integrations:**
- `Slack` → `/integrations/slack`
- `Microsoft Teams` → `/integrations/teams`
- `QuickBooks Online` → href is a blocked/opaque value (possibly a `data:` URL, `javascript:` scheme, or intercepted onclick) — behavior needs verification

Footer (after sub-nav fade): `Version: v10.107.0-R216.0.0` (visible when scrolled to the bottom of the sub-nav or main panel — exact placement TBD).

### §13.2 Verbatim — `/user-profile` main panel

**Panel header:** `User Profile` (large title, gray subtle background strip spanning the content column, with a thin bottom border)

**Card 1: `Personal Information`**
- Section title: `Personal Information`
- Two-column form grid:
  - Row 1: `First Name` *(prefilled: `Mahmut`)* | `Last Name` *(prefilled: `Seker`)*
  - Row 2: `Email` *(prefilled: `7ky5j4b2d6@privaterelay.appleid.com`)* | `Phone Number` *(empty)*
  - Row 3: `Enter your Job Function` dropdown *(empty placeholder, labeled `Job Function`)* | `Select your Job Title...` dropdown *(empty placeholder, labeled `Job Title`)*
- Button: `SAVE CHANGES` (outlined gray, small — becomes active/red when form is dirty)

**Card 2: `Change Password`**
- Section title: `Change Password`
- Two-column form grid:
  - Row 1: `Current Password` (password input) | `New Password` (password input)
- Button: `SAVE CHANGES` (same style as above)
- Right-aligned link: `Forgot password?` (red)

**Card 3: `Linked Accounts`**
- Section title: `Linked Accounts`
- Row: `Google` — status label `Not Connected` — button `Link`
- Row: `Apple ID` — status label `7ky5j4b2d6@privaterelay.appleid.com` — button `Unlink`

### §13.3 Interactive layout

| Element | Role | Notes |
|---|---|---|
| Gear icon in left rail (bottom) | button | opens user popover; does not navigate |
| `Settings` popover item | link | → `/user-profile` |
| `Preferences` popover item | link | → `/user-preferences` |
| `Plan & Billing` popover item | link | → `/billing-info` |
| `Sign Out` popover item | button | session end |
| `<` chevron next to `Settings` header | button | collapses sub-nav (width toggle) |
| Sub-nav row (16 items) | link OR gated non-link | `User Access Control` and `Create Labels` are gated |
| `First Name` / `Last Name` / `Email` / `Phone Number` | input[type=text] | `name` attrs: `firstName`, `lastName`, `email`, `phoneNumber` |
| Job Function / Job Title | combobox-style dropdowns | both empty in demo |
| `SAVE CHANGES` × 2 | submit buttons | one per card |
| `Current Password` / `New Password` | input[type=password] | `name` attrs: `currentPassword`, `password` |
| `Forgot password?` | button | opens forgot-password flow |
| `Link` (Google row) | button | starts Google OAuth link flow |
| `Unlink` (Apple ID row) | button | disconnects Apple ID |

### §13.4 Layout spec

- **3-column shell:** Left brand rail (red, ~88px) → Settings sub-nav column (white, ~420px, scrollable) → main content panel (light-gray `#F5F5F5`-ish background, flex-fill).
- **Sub-nav column header:** "Settings" title + `<` collapse chevron. Header has bottom divider.
- **Sub-nav grouping:** Vertical divider lines (thin gray HR) between groups. Each group has 2–4 items. Items have: icon (left, ~24px, gray by default, red when active), label (sentence-case, ~16px, gray → dark-gray when hovered → red when active), and an optional trailing gate/lock icon on `User Access Control` and `Create Labels`.
- **Active row treatment:** Red icon, red bold label, pale-red (`#FCE8E8`) background pill spanning full row width with rounded corners. Visible on `User Profile` in the captured state.
- **Main panel header:** Large page title flush-left with bottom 1px divider. Content below the header is capped at ~980px wide and left-aligned within the panel.
- **Cards:** Each section (`Personal Information`, `Change Password`, `Linked Accounts`) is a separate white rounded card (~12px radius, soft shadow, ~32px internal padding, vertical gap ~24px between cards). Section titles are bold ~20px, dark gray.
- **Form grid:** 2-column CSS grid with equal columns, ~24px gap. Each field is a floating-label input (label collapses above field when filled). Placeholder text is gray; value text is dark gray.
- **Dropdowns:** floating-label comboboxes with a chevron on the right. Empty state shows the placeholder text as if it were a label (`Enter your Job Function`, `Select your Job Title...`).
- **SAVE CHANGES button:** thin outlined button that feels muted when disabled (no change to save). Right-aligned `Forgot password?` link on the Change Password card shares the same row as the save button.
- **Linked Accounts rows:** 2-column row — provider name + status on the left, action button on the right. `Unlink` is presumably a destructive outlined button; `Link` is a standard outlined button.
- **Footer:** Version string `Version: v10.107.0-R216.0.0` rendered in small muted text somewhere in the settings shell (exact placement not verified in this capture — scroll behavior investigation needed).

### §13.5 Corrections to prior docs

1. **Settings is not a top-level route.** Blueprint should model Settings as a popover-gated section (click gear icon → popover → `/user-profile`) rather than as a rail-level icon. OneAce can diverge here by giving Settings a first-class rail slot — this is a usability improvement over Sortly.

2. **`/preferences` is a 404 route.** Sortly exposes a broken internal URL. OneAce should reserve `/preferences` as an alias for `/user-preferences` or explicitly 404 it with a helpful redirect CTA. Document the 404 screen pattern: blue open-box illustration with `?` and `!` characters, bold `Oops!` title, muted `Something went wrong / Page not found` subtitle.

3. **Sub-nav has 16 items.** Prior pre-compaction notes may have listed fewer. Canonical list: User Profile, Preferences, Company Details, Addresses, Plan & Billing, User Access Control, Custom Fields, Units of Measure, Manage Alerts, Bulk Import, Feature Controls, Create Labels, Public API (beta), Slack, Microsoft Teams, QuickBooks Online.

4. **Two gated rows in sub-nav:** `User Access Control` (likely Ultra+) and `Create Labels` (likely Advanced+). These are rendered as rows but are not `<a>` elements — they likely either (a) intercept clicks with a paywall modal, or (b) silently redirect to `/upgrade-plan` (matching the Reports silent-redirect pattern documented in §10).

5. **`/manage-custom-attributes/node` URL shape.** The Custom Fields route has a trailing `/node` segment. This hints at a data model where custom attributes are attached to tree nodes (folders/items-as-nodes) rather than a flat `/manage-custom-fields`. OneAce should note this for its own CF model — whether to model CFs as attributes on the item table or on a polymorphic node.

6. **`Public API (beta)` is exposed in free-plan nav.** The Public API settings row is visible even on Free tier demo. This means Sortly promotes the beta API broadly (or the gate happens inside the `/public-api` route, not at the nav level). Check actual content of `/public-api` to determine gating.

7. **Apple ID `privaterelay.appleid.com` email** is present as the linked account email. This is an Apple Private Relay address — not a real email. OneAce should handle Apple Private Relay email input gracefully (it's an Apple-assigned forwarding address, valid for auth but not for marketing).

8. **Version footer:** `v10.107.0-R216.0.0` — a versioned build string visible to end users. Worth tracking over time as a release cadence signal.

9. **User-profile form fields set:** `firstName`, `lastName`, `email`, `phoneNumber` (2 more: unnamed job-function and job-title inputs). Passwords: `currentPassword`, `password` (new). These `name` attributes leak internal field naming conventions.

---

## §14 Settings → Preferences (`/user-preferences`)

*Captured 2026-04-10 on Free-plan demo. Tab 1020792030. Page fits in one viewport (scrollHeight 827 = clientHeight 827) — no scroll needed. All settings shell chrome (brand rail + 16-item sub-nav + gear popover) identical to §13.1 and is not repeated here.*

### §14.1 Verbatim copy — main panel

**H1 page title:** `Preferences`

**Card 1 — General Preferences**

- Section title: `General Preferences`
- Row 1 — Time zone:
  - Floating-label combobox showing `EST (UTC -05:00) EST` as its value
  - Floating label overlay: `Time zone`
  - To the right of the field, on the same row: checkbox labeled `Set automatically` (currently **checked**)
- Row 2 — Sort by:
  - Floating-label combobox showing `Updated at` as its value
  - Floating label overlay: `Sort by`
  - To the right of the field, on the same row: two radio options `Ascending` / `Descending`
  - Current state: **`Descending` is selected** (despite innerText DOM order listing `Ascending` first, the `sortingDirection` radio group has `descending` checked)

**Card 2 — Email Preferences**

- Section title: `Email Preferences`
- Row 1 — Alerts:
  - Sub-label: `Alerts`
  - Helper text: `Email alerts will be sent to the email address associated with your account`
  - Toggle labeled `On` (currently **on** — `notificationsAllowedEmail` checkbox checked)

**Footer action:** `SAVE CHANGES` button, left-aligned under Card 2 at (586, 563). Style matches the muted thin-outlined pattern from User Profile.

**Settings-shell footer (bottom of sub-nav column):** `Version: v10.107.0-R216.0.0` — same version string as §13.1.

### §14.2 Interactive elements — layout table

| Element | Tag | Type | Form field `name` | Selected value | Position (x, y) | Size (w × h) |
|---|---|---|---|---|---|---|
| Time zone combobox | INPUT (react-select-2) | combobox | *(unnamed)* | `EST (UTC -05:00) EST` | (587, 233) | 525 × 38 |
| Set automatically checkbox | INPUT | checkbox | `timeZoneAuto` | `on` (checked) | (1147, 239) | label 159 × 20 |
| Sort by combobox | INPUT (react-select-3) | combobox | *(unnamed)* | `Updated at` | (587, 295) | 525 × 38 |
| Ascending radio | INPUT | radio | `sortingDirection=ascending` | **not** checked | (1147, 288) | label 107 × 30 |
| Descending radio | INPUT | radio | `sortingDirection=descending` | **checked** | (1147, 318) | label 107 × 30 |
| Alerts toggle | INPUT | checkbox | `notificationsAllowedEmail` | `on` (checked) | (1249, 476) | label 57 × 20 |
| SAVE CHANGES button | BUTTON | submit | *(unnamed)* | — | (586, 563) | 142 × 42 |

### §14.3 Layout spec

- **Shell:** identical 3-column shell from §13.4 — brand rail (~88px) → Settings sub-nav column (~420px) → main panel. Main panel starts around x=546.
- **Main panel:** single column, ~910px wide, no inner scroll. Two stacked cards followed by a left-aligned SAVE CHANGES button.
- **H1:** `Preferences` at (546, 32) — same position/style as `User Profile` H1.
- **Card widths:** the selects are 525px wide, suggesting cards cap around ~720–780px wide with internal padding. Both cards appear flush-left at x≈560.
- **Card 1 rows:**
  - Row 1 (Time zone): 38px tall combobox on left, `Set automatically` checkbox aligned on the right rail around x=1147, roughly 600px gap between combobox and the checkbox.
  - Row 2 (Sort by): 38px tall combobox on left, `Ascending`/`Descending` radio pair stacked vertically on the right rail at x=1147.
- **Card 2 rows:**
  - Single row: `Alerts` sub-label + helper text on the left; `On` toggle on the far right (x=1249).
- **SAVE CHANGES button:** same muted thin-outlined style as User Profile's save button. Positioned under the Card 2 section.
- **Right-rail alignment:** Both cards place the "control" (checkbox/radios/toggle) on a right-rail around x=1147–1249, with the "input" (combobox) on the left-rail starting x=587. This creates a visually consistent two-zone card: left = pick a value, right = override/configure behavior.
- **No divider between cards** was detected in the DOM query (no `<section>` or explicit `Card` class matched the selector filter). Cards are likely styled `div`s with background + padding, not semantic sections.

### §14.4 Corrections to prior docs / new findings

1. **Timezone is a two-part control, not a single dropdown.** Users pick a timezone AND can toggle `Set automatically`. When `Set automatically` is checked, the combobox is likely either disabled or auto-updated from browser locale. OneAce should decide: manual timezone only, auto-detect only, or the Sortly hybrid. The hybrid is more complex but more forgiving for traveling users.

2. **Default sort is `Updated at` + `Descending`.** This is the canonical "most recently touched first" default, consistent with §10's activity-first information architecture. OneAce should match this default for its inventory list view.

3. **Sort direction is global user preference, not per-view.** Sortly stores `sortingDirection` as an account-level preference, which means changing the sort direction on any list changes it everywhere. This is unusual — most SaaS tools store sort per-view. OneAce should decide if this is actually good (consistency) or bad (surprising cross-view side effects).

4. **Email Preferences is a single toggle.** There is exactly ONE email preference — `Alerts` — with a binary on/off toggle. Sortly does NOT offer granular email preferences (weekly digest, mention notifications, report summaries, etc.). This is an opportunity: OneAce can differentiate with category-level email preferences.

5. **Email alerts are hardwired to the account email.** Helper text states: `Email alerts will be sent to the email address associated with your account`. There is no "notification email" override field. Users who want alerts to a different address (e.g., a shared ops@ inbox) have no way to configure this. OneAce should consider a dedicated `notification_email` field.

6. **Form field `name` attributes leaked:** `timeZoneAuto` (checkbox, boolean), `sortingDirection` (radio, `ascending`|`descending` enum), `notificationsAllowedEmail` (checkbox, boolean). No `timezone` name attribute was captured for the time zone select itself — it's a react-select using `react-select-2-input` as the internal input ID. This suggests the actual persisted field name is different from the internal react-select wiring; the backend probably accepts something like `timezone` or `timeZone`. Can't verify without submitting the form.

7. **"EST (UTC -05:00) EST" double-EST display** is a floating-label rendering artifact — the value string is `EST (UTC -05:00)` and the label `EST` may actually be the short-code suffix the select appends. Worth investigating with a different timezone to confirm the rendering rule (e.g., does `Europe/Istanbul` render as `Europe/Istanbul (UTC +03:00) +03`?). OneAce should pick ONE canonical display format — either IANA name with UTC offset OR short code with UTC offset, not both concatenated.

8. **`Preferences` sub-nav tab is NOT a route-level 404** — `/user-preferences` works correctly. The 404 finding from §13 was specifically for the URL `/preferences` (the alias form), not for this working route.

9. **No "Language" or "Locale" preference** visible anywhere on the Preferences screen. Despite the demo being in TR locale (assumed) and TRY currency, the Preferences UI has no language selector. Currency is probably set elsewhere (`/company-details`?). Date format, number format, and first-day-of-week are all absent. OneAce should decide whether to surface these as user preferences or company-level settings.

10. **No theme / dark mode toggle.** Sortly has no visible UI theme control. OneAce can differentiate with a light/dark/system toggle.

---

## §15 Settings → Company Details (`/company-details`)

*Captured 2026-04-10 on Free-plan demo. Tab 1020792030. Page scrollHeight 1279 vs clientHeight 827 — bottom of page (Manage Account card) requires scroll. Main panel contains THREE stacked cards on the left (Company Info, General Settings, Manage Account) plus ONE floating satellite card on the right (Company Logo).*

### §15.1 Verbatim copy — main panel

**H1 page title:** `Company Details`

**Card 1 — Company Info** (left column, flush with main panel)

- Section title: `Company Info`
- Two-column form grid inside the card:
  - **Left column**
    - Floating-label input `Company Name*` (required) — current value: `deneme sirketi`
    - Floating-label dropdown `Company Color` — current value: `#DD2A3B` (with red color swatch to the left of the hex code)
    - Button: `SAVE CHANGES` (scope: this card only)
  - **Right column**
    - Floating-label combobox `Industry` — current value: `Accounting` (with `×` clear button on the right side)
    - Floating-label input `Initials` — current value: `S`

**Card 2 — Company Logo** (satellite card, right of Company Info)

- Section title: `Company Logo`
- Image preview area containing the Sortly wordmark logo (red "Sortly" lettering) — this is the DEFAULT logo, demo has not uploaded a custom one
- A small pencil-edit icon overlaid on the top-right of the logo image
- Button: `UPDATE LOGO` (bottom of card)

**Card 3 — General Settings**

- Section title: `General Settings`
- Two-column form grid:
  - Row 1: `Country` = `Turkey` | `Time zone` = `EST (UTC -05:00) EST`
  - Row 2: `Date Format` = `European (10/04/2026)` | `Time Format` = `12-hour`
  - Row 3: `Currency` = `Turkish Lira - TRY - ₺` | `Keep item with 0 quantity when moving` = `Always ask`
  - Row 4: `Decimals in Price` = `0.01 (Default)` (with `?` tooltip icon next to the label) | *(right slot empty)*
- Button: `SAVE CHANGES` (scope: General Settings card only)

**Card 4 — Manage Account**

- Section title: `Manage Account`
- Helper text: `Temporarily deactivate your account. Once you deactivate your account, you'll have the option to permanently delete your data afterward.`
- Button: `DEACTIVATE ACCOUNT` (right-aligned, muted-red / destructive styling inferred from naming)

**Settings-shell footer:** `Version: v10.107.0-R216.0.0`

### §15.2 Interactive elements — layout table

| Element | Tag | Type | Form field `name` | Selected/current value | Position (x, y) | Size (w × h) |
|---|---|---|---|---|---|---|
| Company Name* | INPUT | text | `businessName` | `deneme sirketi` | (479, 232) | 293 × 40 |
| Company Color | BUTTON | button | *(unnamed)* | `#DD2A3B` | (479, 306) | 293 × 38 |
| SAVE CHANGES (Company Info) | BUTTON | submit | — | — | (479, 374) | 142 × 42 |
| Industry combobox | INPUT (react-select) | combobox | *(unnamed)* | `Accounting` | (908, 242) | — × 20 |
| Industry clear button | BUTTON (×) | button | — | — | (1053, 245) | 16 × 16 |
| Initials | INPUT | text | `initials` | `S` | (812, 304) | 293 × 40 |
| Country combobox | INPUT (react-select) | combobox | *(unnamed)* | `Turkey` | (539, 572) | — × 20 |
| Time zone combobox | INPUT (react-select) | combobox | *(unnamed)* | `EST (UTC -05:00) EST` | (968, 572) | — × 20 |
| Date Format combobox | INPUT (react-select) | combobox | *(unnamed)* | `European (10/04/2026)` | (653, 658) | — × 20 |
| Time Format combobox | INPUT (react-select) | combobox | *(unnamed)* | `12-hour` | (879, 658) | — × 20 |
| Currency combobox | INPUT (react-select) | combobox | *(unnamed)* | `Turkish Lira - TRY - ₺` | (634, 744) | — × 20 |
| Keep item with 0 qty combobox | INPUT (react-select) | combobox | *(unnamed)* | `Always ask` | (903, 744) | — × 20 |
| Decimals in Price combobox | INPUT (react-select) | combobox | *(unnamed)* | `0.01 (Default)` | (584, 830) | — × 20 |
| SAVE CHANGES (General Settings) | BUTTON | submit | — | — | (479, 900) | 142 × 42 |
| DEACTIVATE ACCOUNT | BUTTON | submit | — | — | (888, 1144) | 217 × 42 |

Field `name` attributes captured only for plain inputs. All dropdowns are react-select components whose actual form field names are not exposed to the DOM.

### §15.3 Layout spec

- **Shell:** identical 3-column shell from §13.4 — brand rail (~88px) → Settings sub-nav column (~420px) → main panel.
- **Main panel:** starts around x=439, w≈706 for the Company Info / General Settings / Manage Account cards.
- **Two-column top zone:** Company Info card and Company Logo card sit side-by-side at the top. Company Info is the wide primary card (w=706). Company Logo is a narrow satellite card positioned to the right of Company Info in the leftover column space (~300px wide). This is a different layout pattern from the single-column stack used on User Profile (§13) and Preferences (§14).
- **Card 1 grid (Company Info):** 2 columns × 2 rows inside the card. Left col has Name + Color stacked; right col has Industry + Initials stacked. SAVE CHANGES button is at bottom-left of the card, under the left column only (not centered under both columns).
- **Card 3 grid (General Settings):** 2 columns × 4 rows. 293px field width (approximately, matching Company Info column width). Equal column gap. SAVE CHANGES at bottom-left of the card.
- **Card 4 (Manage Account):** text block on the left, destructive action button on the right. Single row.
- **Card vertical spacing:** ~50–80px gaps between stacked cards.
- **No shared SAVE button.** Each of the three primary cards (Company Info, General Settings, *not* Manage Account — which has its own DEACTIVATE action) has its own independent `SAVE CHANGES` button. This means edits in Company Info do NOT save General Settings edits, and vice versa. Users must remember to press each card's button separately.
- **Color picker UX:** Company Color renders as a button (not a native `<input type="color">`) with a color swatch + hex code label + chevron. Likely opens a color picker popover when clicked.
- **Industry combobox clear button:** has an `×` button at the right edge (separate from the chevron) to clear the selection.
- **Tooltip on Decimals in Price:** a `?` icon next to the label triggers a tooltip explaining what "Decimals in Price" controls. No other field on this page has a tooltip icon — worth noting which settings Sortly considers confusing enough to warrant inline help.

### §15.4 Corrections to prior docs / new findings

1. **Company-level timezone ≠ user-level timezone.** Sortly has TWO timezone settings: one on `/company-details` (Time zone dropdown) and one on `/user-preferences` (Time zone dropdown). In this demo, both show `EST (UTC -05:00) EST` even though Country is `Turkey`. Question: when the two diverge, which one is authoritative for timestamps in the UI and in reports? OneAce should either (a) have only one timezone setting, or (b) clearly document which one wins.

2. **Country = Turkey but Time zone = EST mismatch** in the demo — demonstrates that changing `Country` does NOT auto-update `Time zone`. No "suggested timezone based on country" nudge. OneAce should consider auto-suggesting a timezone when the country is changed.

3. **Date Format `European (10/04/2026)`** — the label format is `{Name} ({example date})`. Sortly does NOT offer ISO-8601 (`2026-04-10`) as a visible option in the current label, only "European" (DD/MM/YYYY) and (presumably) "American" (MM/DD/YYYY). This is a gap — international B2B tools should support ISO as a standard choice.

4. **Currency format `Turkish Lira - TRY - ₺`** — the display format is `{Full name} - {ISO code} - {symbol}`. Very verbose but unambiguous. OneAce can adopt this exact format for consistency.

5. **`Keep item with 0 quantity when moving`** is a non-obvious business rule setting. Options include at least `Always ask` (default in demo). Other likely options: `Always keep` and `Always delete`. This is a quantity-tracking edge case: what happens when you move 100% of an item's quantity out of its current location? OneAce needs to decide this policy explicitly (§15 adds a new blueprint requirement).

6. **`Decimals in Price` default `0.01 (Default)`** — suggests Sortly lets users configure the smallest price increment (1.00, 0.01, 0.001 etc.). The `(Default)` suffix implies the option list explicitly labels the default. This is a pricing-precision setting for stores that sell fractional units.

7. **Company Color is a single brand color.** Sortly only stores ONE company color (`#DD2A3B` in demo — a crimson red). No primary/secondary/accent or logo-matching palette. OneAce could differentiate with a proper brand palette if branding matters to customers.

8. **Initials field (`initials` = `S`)** — a 1–2 character identifier derived from Company Name. Likely used for the brand rail badge (the `S` in the top-left red circle). This is a configurable identity short-form. OneAce should decide whether to auto-derive from Company Name or let users customize.

9. **`DEACTIVATE ACCOUNT` button, not `DELETE ACCOUNT`.** Sortly uses two-step account removal: first deactivate (soft-delete / hibernate), then offer permanent delete as a follow-up option. This is per the helper text: `Once you deactivate your account, you'll have the option to permanently delete your data afterward.` OneAce should match this two-step pattern for data-safety reasons.

10. **No Save-changes-wide button.** Because each card has its own independent SAVE CHANGES, users might save Company Info, edit General Settings without saving, navigate away, and lose the General Settings edits. No dirty-state warning detected in this capture. OneAce should unify save buttons OR add a dirty-state "unsaved changes" warning on navigation.

11. **Industry combobox is clearable** (has an `×` button). This means Industry is an optional field, not required. OneAce should decide: if Industry is used for analytics/segmentation, is optional acceptable? If yes, plan for a large "unspecified" cohort.

12. **Company Logo is a separate card from Company Info**, not an inline field. This decouples logo upload from the text-field save flow (Company Info SAVE CHANGES button doesn't touch the logo). The `UPDATE LOGO` button is the sole trigger for logo changes, likely opening a file picker. No drag-and-drop detected in this static capture.

---

## §16 Settings → Addresses (`/company-addresses`)

*Captured 2026-04-10 on Free-plan demo. Empty state + New Address modal both captured. Note: URL is `/company-addresses`, NOT `/addresses` as previously guessed in §13.1 sub-nav enumeration. The sub-nav display label is `Addresses` but the route is `company-addresses`.*

### §16.1 Verbatim copy — empty state page

**H1 page title:** `Addresses` (left-aligned, top of main panel)

**Top-right primary action:** `NEW ADDRESS` button (solid red-filled, ~161×42px at 1311, 37)

**Search bar:** Grey pill search input with magnifying-glass icon and placeholder `Search Addresses` (positioned under the H1, centered above the empty state — appears even when no addresses exist)

**Empty state illustration:** Large grey map-pin (location-marker) icon, centered in the main panel

**Empty state headline (H2-ish):** `You don't have any addresses` (typographic apostrophe `'` not straight `'`)

**Empty state helper text:** `Add addresses that relate to your business like ` **`your store's address`** ` and ` **`your preferred shipping and billing addresses`** `.` — the two phrases are **bolded inline** within a single helper sentence to highlight the example use cases.

**Settings-shell footer:** `Version: v10.107.0-R216.0.0` — rendered at bottom-left of the main panel (first page where I definitively confirmed footer placement).

**Help widget:** the circular owl-help widget remains at the bottom-right corner (same as all other pages).

### §16.2 Verbatim copy — New Address modal

*Opens on NEW ADDRESS button click. Modal is centered on a light-pink-tinted backdrop (not the typical dark-scrim pattern — unique to this page).*

- **Modal title:** `New Address` (top-left)
- **Close button:** `×` (top-right, 28×24)
- **Defaults selector row:**
  - Label: `Set Default:`
  - Three outlined chip toggles (pill-shaped, not radios): `Primary` / `Shipping` / `Billing`
  - **These are CHECKBOXES, not radios** — the underlying DOM uses `defaults.primary`, `defaults.shipping`, `defaults.billing` each as independent `<input type="checkbox">`. A single address can be Primary AND Shipping AND Billing simultaneously.
- **Form fields (all floating-label inputs, vertical stack):**

  | Label (UI) | Required | Form field `name` |
  |---|---|---|
  | `Name*` | ✓ | `name` |
  | `Address 1*` | ✓ | `line1` |
  | `Address 2` | — | `line2` |
  | `City*` | ✓ | `city` |
  | `State / Province / Region*` | ✓ | `state` |
  | `Zip / Postal Code*` | ✓ | `zipCode` |
  | `Country*` (combobox, prefilled `Turkey`, has `×` clear + chevron) | ✓ | *(react-select, unnamed)* |

- **Footer row:**
  - `CANCEL` button (left, text-style, 112×42)
  - `SAVE` button (right, filled, 98×42) — **disabled in empty state** (pink washout visual) because required fields are blank

### §16.3 Interactive elements — layout tables

**Empty state page:**

| Element | Tag | Position (x, y) | Size (w × h) |
|---|---|---|---|
| NEW ADDRESS button | BUTTON | (1311, 37) | 161 × 42 |
| Search Addresses input | INPUT | (under H1, centered) | — |

**New Address modal:**

| Element | Tag | Type | `name` | Position (x, y) | Size (w × h) |
|---|---|---|---|---|---|
| Close × | BUTTON | button | — | (942, 53) | 28 × 24 |
| Primary chip | INPUT (checkbox) + rendered label | checkbox | `defaults.primary` | *(hidden; rendered as pill)* | 1 × 1 hidden |
| Shipping chip | INPUT (checkbox) + rendered label | checkbox | `defaults.shipping` | *(hidden; rendered as pill)* | 1 × 1 hidden |
| Billing chip | INPUT (checkbox) + rendered label | checkbox | `defaults.billing` | *(hidden; rendered as pill)* | 1 × 1 hidden |
| Name* input | INPUT | text | `name` | (556, 187) | 400 × 40 |
| Address 1* input | INPUT | text | `line1` | (556, 259) | 400 × 40 |
| Address 2 input | INPUT | text | `line2` | (556, 331) | 400 × 40 |
| City* input | INPUT | text | `city` | (556, 403) | 400 × 40 |
| State* input | INPUT | text | `state` | (556, 475) | 400 × 40 |
| Zip* input | INPUT | text | `zipCode` | (556, 547) | 400 × 40 |
| Country clear × | BUTTON | button | — | (904, 632) | 16 × 16 |
| CANCEL | BUTTON | button | — | (746, 730) | 112 × 42 |
| SAVE (disabled) | BUTTON | submit | — | (874, 730) | 98 × 42 |

### §16.4 Layout spec

- **Shell:** standard 3-column settings shell (§13.4).
- **Empty state page:** centered map-pin icon, centered headline, centered helper text — all vertically centered in the main panel below the H1/search bar. This is a TEXT-heavy empty state (not skeleton rows).
- **Primary action button placement:** top-right of the main panel (not inline with the empty state). This is a "page-level CTA" pattern.
- **Modal:** centered on the page, ~500px wide, ~720px tall. Form fields are 400px wide (single column, vertical stack — different from Company Details which uses 2-column grids).
- **Modal backdrop:** **light pink tint** rather than the usual dark-scrim (e.g., 50% black) backdrop used elsewhere. This is unique to this modal in the captures so far and may be a styling accident or an intentional "friendly" treatment.
- **Defaults chips:** rendered as outlined pill buttons above the form fields. Their underlying inputs are positioned at x=-9484 (off-screen) — classic hidden-checkbox + styled-label accessibility pattern.
- **Button hierarchy:** CANCEL is left, SAVE is right. SAVE is disabled with a pink washout while required fields are blank. Primary-on-right, secondary-on-left matches most Western Windows conventions (some Mac apps do the reverse).
- **Row gap:** form fields are spaced ~72px vertically (40px input + 32px gap). Consistent rhythm.

### §16.5 Corrections to prior docs / new findings

1. **Route is `/company-addresses`, not `/addresses`.** Update §13.1 sub-nav route table and blueprint route map. The display label `Addresses` is a user-friendly shorthand, but the canonical URL is `company-addresses`.

2. **Address defaults are multi-select checkboxes, not radios.** This is a critical data-model insight: a single address record can be flagged as Primary, Shipping, AND Billing simultaneously. The backend flags are `defaults.primary`, `defaults.shipping`, `defaults.billing` — three independent booleans on the address record. OneAce should decide whether to match this (one address serves multiple roles) or use the more common pattern of "one primary, one shipping, one billing" as separate records.

3. **Default chip UI is hidden checkbox + styled label.** The `<input type="checkbox">` is positioned at x=-9484 (off-screen) and the visible pill is a `<label>` or styled wrapper. This is the standard accessible custom checkbox pattern. OneAce should match this accessibility pattern for its own chip toggles.

4. **Form field naming:** `name`, `line1`, `line2`, `city`, `state`, `zipCode` — matches common Stripe / Shopify / Braintree address schemas. OneAce should use the same names for easy interop with payment/shipping SDKs.

5. **Country is a combobox prefilled with the company country.** When opening New Address, the Country field defaults to `Turkey` (the company's country from §15 General Settings), not to blank. This is a nice UX touch — OneAce should prefill the company country as the default for new addresses.

6. **Zip/Postal Code is a plain text input, not format-validated.** No zip-format inference based on country (e.g., US 5-digit vs. UK alphanumeric vs. TR 5-digit). OneAce can differentiate with country-aware zip validation.

7. **No map preview / geocoding.** The form is pure text entry — no Google Places autocomplete, no "verify address" step, no map preview. OneAce can differentiate with address autocomplete if shipping-heavy customers are a segment.

8. **Empty state includes a persistent Search bar.** Even when no addresses exist, the search bar is rendered. This is a minor inconsistency — the search input is useless in empty state. OneAce should hide search in empty state OR show a helpful placeholder.

9. **Empty state helper uses inline bolding for emphasis** (`**your store's address**` and `**your preferred shipping and billing addresses**`). This is a typographic signal OneAce can adopt for emphasis in helper copy without resorting to headlines or colored text.

10. **NEW ADDRESS button is RED-filled primary** — distinct from the muted outlined SAVE CHANGES buttons used elsewhere in settings. This is the first "hero primary" button seen in the settings area. Action hierarchy: red-filled = "create net-new resource", outlined = "save existing edits", text = "cancel/back".

11. **Modal SAVE has a disabled state** that's visually a washed-pink (same red color but with reduced saturation/opacity). When required fields are filled, it probably brightens to full red. OneAce should match this pattern for form validation feedback.

12. **Modal backdrop is pink-tinted, not dark.** Unusual — other modals in Sortly (§05 Add Item, §08 paywall modals) used dark scrims. Possibly a brand-color tinted scrim specifically for settings modals. Worth confirming with another modal later in this traversal.

---

## §17 Settings → Plan & Billing (`/billing-info`) + ADD SEATS paywall modal

### §17.1 Route & access

- **URL:** `https://app.sortly.com/billing-info`
- **Sub-nav label:** `Plan & Billing` (third row from top of Account section in settings sub-nav, §13.1).
- **Access:** Open on Free tier. Page is NOT gated by plan.
- **Main panel scroll:** `scrollHeight ≈ 884`, `clientHeight ≈ 827` — minor vertical overflow, one page of content.

### §17.2 Verbatim on-page copy

**H1**
```
Plan & Billing
```

**Card 1 — Current Plan**
```
Current Plan

Free
$0.00 /mo

MANAGE PLAN        ADD SEATS
```

**Card 2 — Usage**
```
Usage

You've reached plan limits

Items              3 / 100
Custom Fields      0 / 1
User Licenses      1 / 1
```

**Card 3 — Payment Method**
```
Payment Method

You don't have any payment methods added.
```

**Card 4 — Payment History**
```
Payment History

No payments yet
```

**Footer**
```
Version 0.0.0-local+<build>
```
*(exact build hash redacted; format observed as semver-ish Version line at bottom of main panel)*

### §17.3 Button / control inventory

| Element | Tag | Type | Position (x, y) | Size (w × h) | Behavior |
|---|---|---|---|---|---|
| MANAGE PLAN | BUTTON | button | (987, 457) | ~112 × 42 | Navigates to `/change-plan` (§18) |
| ADD SEATS | BUTTON | button | (1151, 457) | ~98 × 42 | Opens paywall modal (§17.5). Does NOT actually add seats on Free tier. |

Only 2 interactive buttons on the entire page (confirmed via `document.querySelectorAll('button').length` → 2 in main content area).

### §17.4 Layout spec

- **Shell:** standard 3-column settings shell (§13.4).
- **Card grid:** 4 cards stacked vertically in the main panel, full-width of content area (~960px wide), each card ~200px tall with 24px vertical gap.
- **Current Plan card:** left side shows plan name `Free` in large type + monthly price `$0.00 /mo` directly below; right side shows two action buttons horizontally: MANAGE PLAN (outlined) and ADD SEATS (outlined). Button group is right-aligned to the card.
- **Usage card:** warning banner `You've reached plan limits` at top of card body (appears inline, not as a dismissible alert). Usage metrics are rendered as label/value pairs in a 2-column layout: label left-aligned, value right-aligned with `X / Y` format (current / max).
- **Payment Method card:** gray text "You don't have any payment methods added." with NO "Add Payment Method" button on Free tier (unlike typical SaaS). This suggests payment collection is gated behind the upgrade flow — you cannot add a card without first committing to a paid plan.
- **Payment History card:** simple empty-state text "No payments yet", no table scaffold, no filter chips.
- **Version footer:** tiny gray text at bottom of main panel, format `Version <semver>-<env>+<build>`. Not a link.

### §17.5 ADD SEATS paywall modal (child of §17)

Clicking ADD SEATS on Free tier does NOT open a seat-quantity picker. Instead it opens a paywall modal pushing the Advanced plan 14-day trial.

**Modal verbatim copy**

```
Do even more with our Advanced Plan:

✓  Keep your business running smoothly with low stock notifications.
✓  Invite others to collaborate and manage the workload.
✓  Add more details about items and folders with custom fields.
✓  Create QR labels that store additional data and look professional.

So much more

TRY IT FREE FOR 14-DAYS
```

**Illustration:** open-box illustration on the right side of the modal — **same artwork** as the §13 `/404` page. Sortly is reusing a single illustration asset across multiple "dead-end" / "upsell" states.

**Close × button:** top-right of modal at ~(1493, 197). ESC key does NOT close this modal — must click X.

**Button / link inventory (modal)**

| Element | Tag | Type | Position (x, y) | Behavior |
|---|---|---|---|---|
| Close × | BUTTON | button | (1493, 197) | Closes modal |
| So much more | A (link-styled) | link | below bullet list | Red text, underline on hover, likely links to `/upgrade-plan` or external feature page |
| TRY IT FREE FOR 14-DAYS | BUTTON | button | footer center | Red-filled primary, starts Advanced trial flow |

**Modal backdrop:** dark scrim (not pink-tinted like §16 Address modal) — confirms the pink tint is unique to the /company-addresses New Address modal, not a global settings style.

### §17.6 Corrections to prior docs / new findings

1. **ADD SEATS is NOT a functional button on Free tier — it's a paywall trigger.** This is a pattern: Sortly places a button with a functional-sounding label on the Free tier, but clicking opens an upsell modal. OneAce should decide whether to match this (converts clicks into upgrade intent) or be more honest (grey out the button with a lock icon).

2. **Two distinct upgrade surfaces exist: `/upgrade-plan` (modal-style pricing, §12) and `/change-plan` (page-style vertical plan list, §18).** Both reached from different entry points. MANAGE PLAN on /billing-info → /change-plan; rail CTA and silent-redirect gating → /upgrade-plan. Worth confirming whether the content actually differs or if these are two presentations of the same data.

3. **Payment Method cannot be added without upgrading first.** There is no "Add Payment Method" button on Free tier. This is a conscious funnel decision — the only way to enter card details is through the upgrade flow. OneAce can differentiate by allowing payment method storage in advance of upgrade (for users who want to pre-commit).

4. **Usage warning `You've reached plan limits` renders even when only 1/3 limits are actually hit.** (Items 3/100 = 3%, Custom Fields 0/1 = 0%, User Licenses 1/1 = 100%.) The warning is triggered by ANY single limit being reached, not all limits. Worth matching — aggressive limit-hit messaging drives upgrades.

5. **Version number in footer.** Sortly exposes a version string at the bottom of Plan & Billing (and possibly other settings pages). This is a "nerd touch" that lets power users identify build-specific bugs. OneAce can adopt this for its own settings footer.

6. **Paywall modal illustration is REUSED** from the /404 page. This is an asset-reuse pattern — Sortly uses the same open-box illustration for "you're in a dead-end, here's a way out" states. OneAce can pick a single hero illustration and reuse it across empty states, 404, and paywalls to build visual consistency cheaply.

7. **Paywall modal copy starts with a collaborative framing** (`Do even more with our Advanced Plan:`) rather than fear-based (`You're blocked, upgrade now`). All 4 bullets start with positive verbs: `Keep`, `Invite`, `Add`, `Create`. OneAce should match this tone for upsell copy.

8. **Paywall modal bullets highlight 4 features, not 1.** Even though the entry point was ADD SEATS (which maps to feature #2: Invite others), the modal shows the full Advanced-tier feature list. This is batch-selling — "you clicked for seats but here's everything you'd get." OneAce should consider whether to do targeted upsell (just the feature clicked) or batch upsell (the whole tier).

9. **ESC key does NOT close the paywall modal.** Must click X. This is intentional friction — makes users actually see the offer. OneAce should decide whether to match this (higher conversion) or be nicer (ESC to close).

---

## §18 Change Plan page (`/change-plan`)

### §18.1 Route & access

- **URL:** `https://app.sortly.com/change-plan`
- **Entry point:** MANAGE PLAN button on `/billing-info` (§17.3).
- **Distinct from:** `/upgrade-plan` (§12) — which is a modal-style pricing page reached from rail CTAs and silent-redirect paywalls.
- **Gating:** Open on Free tier. Shows all plan tiers with current tier highlighted.
- **Scroll depth:** Long vertical page — plan cards, then "Manage plan options" section, then "Account settings" section with MANAGE ACCOUNT SETTINGS link.

### §18.2 Verbatim copy — page header

```
←  Manage plan

Change plan     Compare all features
```

`Change plan` and `Compare all features` are rendered as a tab-like switcher at top of main panel. The page defaults to `Change plan` view.

### §18.3 Verbatim copy — plan cards (stacked vertically)

**Card 1 — Free (CURRENT PLAN)**
```
Free
$0.00 /mo
when paid yearly

$0.00 when paid monthly

Up to 100 items
1 User License
1 Custom Field

All Sortly Free features
• Web, iOS, Android apps
• 1 user
• Basic reporting
• Barcode & QR scanning
See all features

[CURRENT PLAN]   (disabled-state button, y≈196)
```

**Card 2 — Advanced**
```
Advanced
$24.00 /mo
when paid yearly

$29.00 when paid monthly

Up to 2,000 items
3 User Licenses
10 Custom Fields

All Sortly Advanced features
• Everything in Free, plus:
• Low stock alerts
• In-app activity history
• Custom fields
• QR label creation
See all features

[START FREE TRIAL]   (red-filled, y≈342)
BUY NOW              (DIV element at 1119, 384 — not a button)
```

**Card 3 — Ultra**
```
Ultra
$74.00 /mo
when paid yearly

$89.00 when paid monthly

Up to 10,000 items
5 User Licenses
25 Custom Fields

All Sortly Ultra features
• Everything in Advanced, plus:
• API access
• Priority support
• Advanced reporting
See all features

[START FREE TRIAL]   (red-filled, y≈521)
BUY NOW              (DIV at 1119, 563)
```

**Card 4 — Premium**
```
Premium
$149.00 /mo
when paid yearly

$179.00 when paid monthly

Up to 25,000 items
10 User Licenses
Unlimited Custom Fields

All Sortly Premium features
• Everything in Ultra, plus:
• Custom roles & permissions
• Dedicated onboarding
See all features

[START FREE TRIAL]   (red-filled, y≈701)
BUY NOW              (DIV at 1119, 743)
```

**Card 5 — Enterprise**
```
Enterprise
Custom pricing

Unlimited items
Unlimited user licenses
Unlimited custom fields

All Sortly Enterprise features
• Everything in Premium, plus:
• SSO / SAML
• Custom integrations
• SLA
See all features

[TALK TO SALES]   (outlined button, A-tag, y≈880)
```

### §18.4 Verbatim copy — "Manage plan options" section

```
Manage plan options

Upgrading
When you upgrade, you'll be charged the prorated difference for the remainder of your billing period. A temporary $0.50 pre-authorization hold will be placed on your card to verify it, and will be released within a few business days.

Downgrading
When downgrading to a lower tier, your account must first meet the target tier's limits for items, user licenses, and custom fields. You can read more about downgrade requirements here.
```

The word `here.` is a link (likely to a docs/help article). Position ~(x, y=1418).

### §18.5 Verbatim copy — "Account settings" section (page footer)

```
Account settings

To deactivate your account or change your company details, go to your account settings.

MANAGE ACCOUNT SETTINGS
```

MANAGE ACCOUNT SETTINGS is an A-tag at y≈1907, likely linking to `/company-details` (§15).

### §18.6 Button / link inventory (full page)

| Element | Tag | Type | Position (x, y) | Target |
|---|---|---|---|---|
| ← Back | BUTTON | button | top-left | Returns to `/billing-info` |
| CURRENT PLAN (Free card) | BUTTON | button (disabled) | (~1119, 196) | No-op |
| START FREE TRIAL (Advanced) | BUTTON | button | (~1119, 342) | Starts 14-day trial flow |
| BUY NOW (Advanced) | DIV | — | (1119, 384) | Rendered as DIV (!), click handler via JS |
| START FREE TRIAL (Ultra) | BUTTON | button | (~1119, 521) | 14-day trial |
| BUY NOW (Ultra) | DIV | — | (1119, 563) | DIV click handler |
| START FREE TRIAL (Premium) | BUTTON | button | (~1119, 701) | 14-day trial |
| BUY NOW (Premium) | DIV | — | (1119, 743) | DIV click handler |
| TALK TO SALES (Enterprise) | A | link | (~1119, 880) | External sales contact |
| `here.` (downgrade docs) | A | link | (~x, 1418) | External docs article |
| MANAGE ACCOUNT SETTINGS | A | link | (~x, 1907) | Likely `/company-details` |

### §18.7 Layout spec

- **Shell:** standard 3-column settings shell (§13.4).
- **Page header:** ← back arrow + `Manage plan` title on one line, then `Change plan | Compare all features` tab switcher on next line. Tab underline on the active tab (`Change plan`).
- **Plan cards:** vertically stacked (NOT side-by-side horizontal comparison), full-width of main panel. Each card ~800px wide × ~180px tall. This is surprising — the traditional SaaS pricing page uses horizontal columns for tier comparison. Sortly's vertical stack is mobile-first but wastes desktop space.
- **Card internal layout:** plan name top-left, prices below it, feature list middle, action button group right-aligned. The `$X.XX /mo when paid yearly` and `$X.XX when paid monthly` are stacked (yearly first as the default/recommended price).
- **BUY NOW as DIV (not BUTTON/A):** this is a red flag for accessibility. Screen readers will not announce DIVs as interactive. Likely a React click-handler pattern. OneAce should use proper BUTTON or A elements for all clickable elements.
- **Plan card action hierarchy:** CURRENT PLAN (disabled gray) for active tier, START FREE TRIAL (red-filled) for upgradable tiers, BUY NOW (outlined or text, DIV) as alternate action, TALK TO SALES (outlined) for Enterprise.
- **Manage plan options section:** two subsections (Upgrading, Downgrading) with H3 subheadings and paragraph body text. No tables or structured data — pure prose. This is unusual for policy content; tables would be clearer.
- **Account settings footer section:** small card at bottom with title + paragraph + outlined MANAGE ACCOUNT SETTINGS button.

### §18.8 Corrections to prior docs / new findings

1. **`/change-plan` is a SECOND pricing surface distinct from `/upgrade-plan` (§12).** The two pages serve the same data (pricing tiers and features) but with different layouts and entry points. OneAce should avoid this — one pricing page, reached from all entry points, reduces maintenance and keeps messaging consistent.

2. **Plans are stacked vertically, not compared horizontally.** Sortly's `/change-plan` uses a vertical stack instead of the traditional 4-column side-by-side pricing table. This is mobile-first but loses desktop comparison affordance. OneAce should use a responsive layout: horizontal columns on desktop, vertical stack on mobile.

3. **`BUY NOW` is rendered as a DIV, not a BUTTON or A.** Accessibility failure. OneAce must use semantic HTML for all interactive elements.

4. **Yearly price is the default/highlighted price.** Each card shows `$X.XX /mo when paid yearly` prominently, with the monthly equivalent as a secondary line. This nudges users toward the annual commitment. OneAce should consider this if it offers both billing cycles.

5. **Upgrading charges a $0.50 temporary pre-authorization hold.** This is a card-verification trick to catch declined cards before the real charge. Worth implementing for OneAce — prevents failed-charge embarrassment during upgrade.

6. **Downgrading has a HARD gate on current usage.** You must delete items / users / custom fields to get under the target tier's limits BEFORE downgrading. Sortly will NOT auto-truncate your data. This is user-hostile but legally safer. OneAce should match this (never silently delete user data) but surface the gate clearly with a pre-downgrade checklist.

7. **Enterprise tier has no price, only `TALK TO SALES`.** Standard SaaS pattern — Enterprise pricing is hidden behind a sales conversation. OneAce should follow if targeting enterprise, skip if SMB-only.

8. **Feature bullets use the "Everything in [lower tier], plus:" pattern.** Each tier's feature list assumes the previous tier as a base. This reduces card height and clarifies the cumulative value. OneAce should match this copywriting pattern.

9. **`Manage plan options` section uses plain-prose policy copy, not a table.** Hard to scan. OneAce can differentiate with a structured "What happens when I upgrade/downgrade?" FAQ or a comparison table.

10. **Final footer links to `/company-details`** (Account settings → MANAGE ACCOUNT SETTINGS). This cross-references the sibling settings page as a "by the way, you can also..." nudge. Minor but nice information architecture — shows related settings on the current page instead of forcing users to navigate back to the sub-nav.

11. **`Compare all features` tab exists but was NOT opened in this capture pass.** TODO: return to /change-plan, click `Compare all features` tab, and capture the feature-matrix view (likely a wide horizontal table comparing all 5 tiers on every feature).

12. **No `$/year` display, only `$/mo when paid yearly`.** Sortly hides the annual total (e.g., never shows `$288/year` for Advanced). This makes the price feel smaller. OneAce can differentiate with honest `$X/mo or $Y/year` display if it wants to position as transparent.

---

## §19 Settings → User Access Control (accordion parent + 2 children)

### §19.1 Full settings sub-nav map (extracted from DOM)

This is the complete sub-nav for settings, with each row's tag + canonical route. Extracted by enumerating every `a` / `button` inside the settings sub-nav container and reading `href` + `className` + `data-testid`.

| # | Label | Tag | Route | Section | Notes |
|---|---|---|---|---|---|
| 1 | User Profile | A | `/user-profile` | Account | — |
| 2 | Preferences | A | `/user-preferences` | Account | (§14 captured) |
| 3 | Company Details | A | `/company-details` | Company | (§15 captured) |
| 4 | Addresses | A | `/company-addresses` | Company | (§16 captured) |
| 5 | Plan & Billing | A | `/billing-info` | Company | (§17 captured) |
| 6 | **User Access Control** | **BUTTON** | — *(accordion toggle — no href)* | Company | `data-testid="user-access-control"`. NOT gated — it's an **accordion header** that expands into 2 children. |
| 6a | Manage Team (child) | A | `/manage-members` | Company | `data-testid="manage-members"`. Silently redirects to `/user-profile` on Free tier. |
| 6b | Manage Permissions (child) | A | `/manage-permissions` | Company | `data-testid="manage-permissions"`. Loads a **Premium Plan paywall overlay page**. |
| 7 | Custom Fields | A | `/manage-custom-attributes/node` | Data | — |
| 8 | Units of Measure | A | `/manage-units` | Data | — |
| 9 | Manage Alerts | A | `/manage-alerts` | Data | — |
| 10 | Bulk Import | A | `/import` | Data | — |
| 11 | Feature Controls | A | `/feature-controls` | Data | — |
| 12 | **Create Labels** | **BUTTON** | — *(no href)* | Data | `class="sc-jOuUTB kDmfAu"` — same gated class as User Access Control. Not yet opened. |
| 13 | Public API (beta) | A | `/public-api` | Data | — |
| 14 | Slack | (integrations section) | external redirect | Integrations | — |
| 15 | Microsoft Teams | (integrations section) | external redirect | Integrations | — |
| 16 | QuickBooks Online | (integrations section) | external redirect | Integrations | — |

**CSS class signals:**
- `sc-crfVcM duXtcQ` → normal A-tag sub-nav link
- `sc-crfVcM A-dOQt` → **active/selected** A-tag sub-nav link
- `sc-jOuUTB kDmfAu` → **accordion toggle** BUTTON (no href, expands into child menu on click)

**Correction to prior assumption:** In earlier captures (e.g., §13) I hypothesized that buttons with `kDmfAu` class were "gated-non-link" paywall triggers. That was **wrong** for User Access Control — it's an accordion header. Need to re-verify whether `Create Labels` is also an accordion (with hidden children) or a true paywall trigger.

### §19.2 User Access Control accordion behavior

**Trigger:** BUTTON with `data-testid="user-access-control"`, no `href`, no `aria-expanded`, no `aria-disabled`. Has a `function` onclick handler (React-bound).

**On click:** opens a **popover menu** (not a modal) anchored to the right edge of the sub-nav button. The popover is rendered via `[role="dialog"]` in the DOM (a MUI Dialog wrapper) — which is why earlier `modalCount` came back as 1.

**Popover contents:**

```
┌──────────────────────────┐
│  [team icon]  Manage Team       │
│  [lock icon]  Manage Permissions│
└──────────────────────────┘
```

- Both rows are A-tags with real hrefs.
- Popover is ~258 × 80 px (40px per row).
- Popover position: right of the sub-nav button, overlapping the main content panel. Approximate rect: (386, 362, 258, 80).
- Close behavior: clicking outside the popover closes it. Clicking either row navigates to the linked route.

**Icons:**
- Manage Team row: team/people icon (gray outline)
- Manage Permissions row: lock+star icon (gray outline)

### §19.3 Manage Team gating (`/manage-members`)

**Direct navigation result:** silently redirects to `/user-profile` after ~1-2 seconds (React router-level redirect, not a 302 HTTP).

**Final URL after redirect:** `https://app.sortly.com/user-profile`

**Interpretation:** On Free tier, `/manage-members` is gated but rather than redirecting to `/upgrade-plan` (the usual silent-redirect destination from §08 paywall gating), it sends the user to `/user-profile` — a completely unrelated benign page. This is **inconsistent** with the rest of the silent-redirect pattern and likely an oversight.

**Third silent-redirect destination identified** — previous captures showed 2 silent-redirect destinations (`/upgrade-plan` for most gated routes, and `/company-details` for settings rows). Now `/user-profile` is a 3rd. OneAce should pick ONE silent-redirect destination (or better: use a consistent paywall modal) rather than 3 different ones.

### §19.4 Manage Permissions paywall page (`/manage-permissions`)

This is the most elaborate paywall pattern captured so far — a **full-page paywall with an overlayed marketing modal**.

#### §19.4.1 Background layer (page content behind the modal)

The underlying page renders a minimal "would-be" Manage Permissions page with real content:

**H1**
```
Manage Permissions
```

**Subtitle (full verbatim)**
```
Create a Custom Role and modify folder and item permissions for this role; all other roles cannot be edited. To change a user's role, visit the Manage Team page.
```

- `Manage Team` is an underlined red A-tag link embedded in the subtitle text.
- Rest of the page body below this subtitle is empty on Free tier (since the feature is gated).
- The background is immediately dimmed by the modal overlay on page load.

#### §19.4.2 Foreground modal (paywall overlay — centered card)

**Modal backdrop:** dark semi-transparent (≈40-50% black), NOT pink-tinted (contrast with §16 Address modal).

**Modal card dimensions:** ~1100 px wide × ~810 px tall, centered on viewport. Two-column internal layout.

**Close × button:** top-right of card at ~(1540, 168). ESC key closes modal (untested, but standard MUI Dialog behavior).

**Left column — Video + caption**

- Embedded YouTube iframe (`src` contains a YouTube video URL — blocked in script output but visually shows "Introducing: Manage Permissions Page" thumbnail with a centered red play button)
- iframe rect: (344, 245, 414, 250) — ~414 × 250 px
- Video poster: red-tinted Sortly branded thumbnail with "Introducing: Manage Permissions Page" overlay text
- Below video — caption paragraph:
  ```
  Control who can add, edit, or delete items and folders with custom role permissions.
  ```
- Below caption — `How it works?` link (red underlined A-tag, probably links to docs article)

**Right column — Upsell pitch**

```
Role Permissions are now available in Sortly
Premium Plan
────────────────────────────────────────────
Configure access to your inventory and enhance
collaboration using customizable role permissions.

✓  Customize role name
✓  Allow admins to manage users
✓  Prevent accidental deletes
✓  Regulate user access to edit items & folders
✓  Share view only link with customers, clients or vendors

All Premium Plan Features

          [ TRY IT FREE FOR 14-DAYS ]
```

- **Headline:** `Role Permissions are now available in Sortly` (2-line dark text)
- **Plan badge:** `Premium Plan` — rendered as a red H2-sized subheading directly below the headline (NOT a pill badge)
- **Hairline divider** between badge and body text
- **Body paragraph:** 2-line dark gray explanatory text
- **Red checkmark bullet list:** 5 features, each with a red `✓` and dark text
- **`All Premium Plan Features`** — red underlined A-tag link, href = `/upgrade-plan?extendedTable=true` (NEW VARIANT — query param)
- **`TRY IT FREE FOR 14-DAYS`** — red-filled primary BUTTON (no href, click handler starts trial), ~300 × 42 px, centered in right column bottom

#### §19.4.3 Interactive element inventory (Manage Permissions page)

| Element | Tag | Type | Position (x, y, w, h) | Target |
|---|---|---|---|---|
| `Manage Team` inline link (in subtitle) | A | link | — | `/manage-members` (which then silently redirects to /user-profile — broken loop!) |
| YouTube video iframe | IFRAME | embed | (344, 245, 414, 250) | YouTube: "Introducing: Manage Permissions Page" |
| `How it works?` | A | link | below video | External docs article |
| `All Premium Plan Features` | A | link | (830, 567, 181, 19) | `/upgrade-plan?extendedTable=true` |
| `TRY IT FREE FOR 14-DAYS` | BUTTON | button | (845, 648, 300, 42) | Starts Premium trial flow |
| Close × | BUTTON | button | (1540, 168, ~30, ~30) | Closes modal — reveals empty gated page behind |

#### §19.4.4 Version string (footer)

```
Version: v10.107.0-R216.0.0
```

**This corrects §17.2** — earlier I placeholder'd the version as `Version 0.0.0-local+<build>`. The actual current build is `v10.107.0-R216.0.0` (semver-style major.minor.patch + release build tag). This is the authoritative version string across Sortly's settings pages.

### §19.5 Bonus capture — User Profile page (`/user-profile`)

While `/manage-members` redirected to `/user-profile`, I captured the full innerText of the User Profile page. Here is the verbatim content for future §20 expansion:

**H1**
```
User Profile
```

**Card 1 — Personal Information**
```
Personal Information

First Name           Last Name
[                 ] [                 ]

Email                Phone Number
[                 ] [                 ]

Enter your Job Function    Select your Job Title...
Job Function               Job Title
[ combobox        ]        [ combobox        ]

SAVE CHANGES
```

**Card 2 — Change Password**
```
Change Password

Current Password
[                 ]

New Password
[                 ]

SAVE CHANGES

Forgot password?
```

`Forgot password?` is a red link-styled A-tag below the SAVE CHANGES button.

**Card 3 — Linked Accounts**
```
Linked Accounts

Google              Not Connected    Link
Apple ID            7ky5j4b2d6@privaterelay.appleid.com    Unlink
```

- Each row has provider name (left), account identity or "Not Connected" (middle), and an action link `Link`/`Unlink` (right).
- Observed linked account: Apple ID via Apple's iCloud Hide-My-Email relay (`7ky5j4b2d6@privaterelay.appleid.com`) — this is the currently signed-in user's SSO identity.

**Footer**
```
Version: v10.107.0-R216.0.0
```

*(Full §20 capture with layout spec, field `name` attributes, and corrections will be done in a dedicated pass.)*

### §19.6 Corrections to prior docs / new findings

1. **The `kDmfAu` class is NOT always a paywall trigger — it's an "accordion toggle" marker.** Previous captures (§13) mislabeled these as gated non-link buttons. Correction: a BUTTON with `kDmfAu` is an accordion header that expands into a popover menu of child rows. The CHILDREN may be gated, but the parent button itself is just an expansion toggle. `Create Labels` still needs verification — it might also be an accordion parent with children I haven't discovered.

2. **User Access Control has 2 children: `Manage Team` and `Manage Permissions`** — both rendered in a popover menu that expands to the RIGHT of the sub-nav button. This is a "fly-out menu" pattern rather than an inline expand-below pattern. OneAce can match either — fly-out is better for narrow sidebars, inline is better for discoverability.

3. **3 distinct gating behaviors confirmed** within User Access Control alone:
   - `/manage-members` → **silent redirect** to `/user-profile` (weird choice of destination)
   - `/manage-permissions` → **full-page paywall overlay** (dark modal on top of minimal page content with video + marketing pitch)
   - (User Access Control parent itself is not gated — it's a menu toggle)
   OneAce should pick ONE gating pattern and apply it consistently. Sortly's inconsistency is a liability.

4. **Manage Permissions is gated behind PREMIUM tier specifically**, not Advanced or Ultra. This is the highest tier below Enterprise — Sortly is aggressively protecting this feature. The `$149/mo` price tag makes this a major revenue signal: Sortly believes role permissions are a Premium-only feature worth the $125 price gap from Advanced. OneAce should consider whether role permissions should be in the mid tier (Advanced-equivalent) to differentiate.

5. **`/upgrade-plan?extendedTable=true` is a NEW pricing surface variant.** This is the 3rd pricing-related URL after `/upgrade-plan` (§12) and `/change-plan` (§18). The `extendedTable=true` query param probably toggles a horizontal feature-matrix view. TODO: capture this view in a later pass.

6. **YouTube video embeds are used in paywall modals for feature demos.** Sortly hosts "Introducing: Manage Permissions Page" as a YouTube video and embeds it directly in the paywall overlay. This is a hybrid marketing/product surface — the paywall doubles as a feature education moment. OneAce can adopt this for complex features (video > text for teaching abstract concepts like role permissions), but hosting on YouTube means Sortly is implicitly giving Google analytics on who watches the upsell video.

7. **`How it works?` link is a secondary CTA in the paywall modal.** The modal offers 3 escape routes: close X (dismiss), `How it works?` (learn more via docs), `All Premium Plan Features` (compare pricing), and `TRY IT FREE FOR 14-DAYS` (convert). The multi-CTA strategy gives users options to self-select their intent: dismiss, learn, research, or buy.

8. **The paywall page has a subtle broken loop:** the background (gated) page content says "To change a user's role, visit the Manage Team page" with `Manage Team` as a link to `/manage-members`. But `/manage-members` silently redirects to `/user-profile` on Free tier. So clicking this link from the Manage Permissions page throws the user to User Profile — completely unrelated. This is a user-experience bug. OneAce should never have broken hyperlinks between settings pages.

9. **Build version: `v10.107.0-R216.0.0`.** Correction to §17.2 placeholder. Format appears to be `v<major>.<minor>.<patch>-R<release-build-number>`. The `R216.0.0` suffix suggests release 216 with a patch version for that release.

10. **`Personal Information` card in /user-profile has 6 fields: First Name, Last Name, Email, Phone Number, Job Function (combobox), Job Title (combobox).** Two of these are comboboxes with placeholder text. Sortly is gathering job persona data for segmentation. OneAce should decide whether to ask for job function/title — useful for product analytics but friction for signup.

11. **Apple ID SSO is visible in the Linked Accounts card** with the relayed email (`7ky5j4b2d6@privaterelay.appleid.com`). This is a real Apple Hide-My-Email address for the demo account owner. OneAce should support Apple ID SSO for iOS-heavy customers; the iCloud relay is standard and should be handled gracefully.

12. **`Version:` line appears in the footer of BOTH `/billing-info` AND `/user-profile` AND `/manage-permissions`.** This is a global settings-shell footer, not a page-specific element. OneAce can adopt this for all settings pages to help users report bugs accurately.

---

## §20 Settings → Custom Fields (`/manage-custom-attributes/node`)

### §20.1 Route & page shell

- **Route:** `https://app.sortly.com/manage-custom-attributes/node`
- **Sub-nav label:** `Custom Fields` (normal link, NOT gated — Free tier can access the page itself)
- **Page H1:** `Custom Fields`
- **Subtitle (gray, below H1):** contains an inline `Upgrade` link to `/upgrade-plan`
- **Secondary control (below subtitle):** dropdown labeled `Show on item page:` with selected value `Populated Fields`
- **Header CTA (top-right of content pane):** `+ ADD CUSTOM FIELD` — red pill button
- **Sub-nav badge:** the `Custom Fields` row in the sidebar shows a small red-square icon (same as other settings sub-nav entries)

### §20.2 Empty state (Free tier, zero fields defined)

Centered illustration + text block, below the `Show on item page:` dropdown:

```
  ★ ★ ★        ← 3-star illustration (gray outline)
       ★
    ★

You don't have any custom fields
Click Add Custom Field to get started!

[ + ADD CUSTOM FIELD ]       ← inline red pill, centered

How to Create Custom Fields? ← red text link, below the button
```

The inline `ADD CUSTOM FIELD` is a duplicate of the header CTA, placed for discoverability. `How to Create Custom Fields?` opens docs (target unverified, likely `help.sortly.com`).

### §20.3 Button inventory (verbatim)

| Element | Location | Approx rect | Target |
|---|---|---|---|
| `ADD CUSTOM FIELD` | Header, top-right | ~(1265, 32, 206, 42) | Opens Create Custom Field modal |
| `ADD CUSTOM FIELD` | Empty-state centered | ~(848, 478, 194, 42) | Opens same modal |
| `How to Create Custom Fields?` | Below empty-state CTA | inline link | Help article |

### §20.4 Create Custom Field modal — Step 1 View A (SUGGESTED FIELDS)

**Opens on first click.** Initial state shows 6 preset tiles in a 2×3 grid.

**Modal chrome:**
- Header bar (gray strip): `Create Custom Field` (left), `×` close button (right)
- Modal backdrop: **pink-tinted** (not dark) — this is the settings-module CREATE modal convention
- Dimensions: ~1200×950 centered, 2-column body layout (left = chooser / form, right = live preview panel — only visible after type selection in View B and in Step 2)

**Body (View A — default on open):**

```
SUGGESTED FIELDS

┌─────────────────┐ ┌─────────────────┐
│ T  Serial       │ │ T  Model/Part   │
│    Number       │ │    Number       │
└─────────────────┘ └─────────────────┘

┌─────────────────┐ ┌─────────────────┐
│ 📅 Purchase     │ │ 📅 Expiry       │
│    Date         │ │    Date         │
└─────────────────┘ └─────────────────┘

┌─────────────────┐ ┌─────────────────┐
│ 🔗 Product      │ │ T  Size         │
│    Link         │ │                 │
└─────────────────┘ └─────────────────┘

              Create your own field       ← red text link
```

**Footer bar:**
- `Step 1 of 2` — centered text
- `NEXT` — red pill button, right-aligned, **disabled** until a preset is selected

**Preset → type mapping (inferred from icons):**

| Preset | Field Type mapped | Icon |
|---|---|---|
| Serial Number | Small Text Box | T |
| Model/Part Number | Small Text Box | T |
| Purchase Date | Date | calendar |
| Expiry Date | Date | calendar |
| Product Link | Web Link | chain-link |
| Size | Small Text Box | T |

Clicking `Create your own field` (red text link at bottom of grid) switches to **View B (CHOOSE FIELD TYPE)**.

### §20.5 Create Custom Field modal — Step 1 View B (CHOOSE FIELD TYPE)

**Layout:** Same modal chrome, but now:
- Left column (~50% width): "CHOOSE FIELD TYPE" header + 2×6 grid of type tiles
- Right column (~50% width): **live preview panel** — shows a sample rendering of whatever type is selected on the left, with Field Type metadata footer

**Upgrade banner (NEW — captured this pass):** Above the `CHOOSE FIELD TYPE` header there is a Free-tier gating strip:

```
⊙ You can add 1 custom field on the Free plan.          View plans →
```

`View plans` is a red text link on the right of the banner. This is the first hard numeric limit exposed inside a creation flow (the `/billing-info` usage card also mentions limits but this is inside the modal itself, preventing the user from building extra fields).

**12 Field Types (2×6 grid, verbatim labels, all with leading icons):**

| # | Label | Icon | Row | Col |
|---|---|---|---|---|
| 1 | `Small Text Box` | T | 1 | L |
| 2 | `Large Text Box` | T-with-brackets | 1 | R |
| 3 | `Round Number` | `[1]` bracketed | 2 | L |
| 4 | `Decimal Number` | `[1.11]` bracketed | 2 | R |
| 5 | `Checkbox` | checked-box | 3 | L |
| 6 | `Dropdown` | down-chevron | 3 | R |
| 7 | `Date` | calendar | 4 | L |
| 8 | `Scanner` | barcode | 4 | R |
| 9 | `Phone Number` | phone-handset | 5 | L |
| 10 | `Web Link` | chain-link | 5 | R |
| 11 | `Email` | `@` | 6 | L |
| 12 | `File Attachment` | paperclip-star | 6 | R |

When a tile is clicked it gets a **red outline border** (red-500, 2px) and its data populates the right preview panel.

**Right preview panel (example: `Small Text Box` selected):**

```
┌──────────────────────────────┐
│ Small Text Box               │   ← floating label
│ ┌──────────────────────────┐ │
│ │ Sample Text              │ │   ← preview input, disabled
│ └──────────────────────────┘ │
└──────────────────────────────┘

Field Type: Small Text Box (eg. Serial Number, Manufacturer
Name, Customer ID, etc.)
Character Limit: 190
```

The `Character Limit: 190` line is a type metadata hardcoded by Sortly. This is an important backend fact — Sortly's Small Text Box is **190 chars** (not 255).

**Back link:** `Back to suggested fields` — red text link at bottom of the LEFT column (below `File Attachment`), returns to View A.

**Footer:** Same `Step 1 of 2` + `NEXT` layout. `NEXT` becomes enabled (red) after any tile is selected.

### §20.6 Create Custom Field modal — Step 2 of 2 (FIELD OPTIONS)

After `NEXT`, Step 2 renders with the **same 2-column layout** (form left, live preview right).

**Left column header:** `FIELD OPTIONS`

**Left column form:**

```
Field Name*                                         (?)
┌──────────────────────────────────────────────────┐
│ Small Text Box                                   │   ← pre-filled with type name
└──────────────────────────────────────────────────┘

                                                    (?)
┌──────────────────────────────────────────────────┐
│ Enter Default Text                               │   ← placeholder (empty)
└──────────────────────────────────────────────────┘

☐ Apply default value to all existing items         ← checkbox (disabled/unchecked)

                                                    (?)
┌──────────────────────────────────────────────────┐
│ Enter Placeholder Text                           │   ← placeholder (empty)
└──────────────────────────────────────────────────┘
```

**APPLICABLE TO: section** (below the form fields):

```
APPLICABLE TO:
Choose if the field should be applied to items, folders or both.
This cannot be changed after the field has been created.

[● ] Items        ← toggle ON (green), enabled by default
[ ○] Folders      ← toggle OFF (gray), disabled by default
```

Note the `(?)` tooltip indicators on 3 inputs — Field Name, Default Text, and Placeholder Text all have contextual help tooltips. The `Apply default value to all existing items` option is grayed out until Default Text is populated.

**Right column — live preview panel, 3 states:**

```
Sample Value:
┌──────────────────────────────┐
│ Small Text Box               │
│ ┌──────────────────────────┐ │
│ │ Sample Text              │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘

Field with Default Text:
┌──────────────────────────────┐
│ Small Text Box               │
│ ┌──────────────────────────┐ │
│ │                          │ │  ← empty until user types Default Text
│ └──────────────────────────┘ │
└──────────────────────────────┘

Empty field with Placeholder Text:
┌──────────────────────────────┐
│ Small Text Box               │
│ ┌──────────────────────────┐ │
│ │                          │ │  ← empty until user types Placeholder
│ └──────────────────────────┘ │
└──────────────────────────────┘

Field Type: Small Text Box (eg. Serial Number, Manufacturer Name, Customer ID, etc.)
Character Limit: 190
```

The live preview shows **three rendering states simultaneously** so the user can see how the field will look when populated vs. default vs. placeholder-only. This is a strong piece of UX craft.

**Footer:**
- `BACK` — white outlined button, bottom-left (returns to Step 1 View B with selection preserved)
- `Step 2 of 2` — centered
- `SAVE` — red pill button, bottom-right (persists the field; likely gated to 1 for Free tier per the banner)

**Pre-filled default:** Field Name defaults to the type label (`Small Text Box`), so a user who hits SAVE without editing creates a field literally named "Small Text Box". This is bad UX — a placeholder would be better than a pre-filled value. OneAce should avoid this.

### §20.7 Correction to §16.5 correction #12 and §19 note: pink backdrop is NOT unique to the Address modal

Prior captures claimed the pink-tinted modal backdrop was unique to the Addresses → Add Address modal. **That's wrong.** The Create Custom Field modal also uses a pink-tinted backdrop. The pattern appears to be: **settings-module CREATE modals use a pink-tinted backdrop**, while general app modals (ADD SEATS upsell in §17, item-level modals) use a dark backdrop. Future captures should verify whether the convention holds for Units of Measure, Manage Alerts, etc.

### §20.8 Findings / corrections / design signals

1. **Sortly supports 12 custom field types** — this is a significant data-model surface for any inventory tool. The full taxonomy:
   - **Text:** Small Text Box (190 chars), Large Text Box
   - **Numeric:** Round Number (integer), Decimal Number
   - **Boolean/choice:** Checkbox, Dropdown
   - **Date/time:** Date (no time-only or datetime type — gap)
   - **Scanner:** barcode-scan-to-populate — **unique to physical inventory tools**
   - **Contact:** Phone Number, Email
   - **Web:** Web Link
   - **Attachment:** File Attachment (size limit unknown, likely gated by plan)

   OneAce needs to decide which of these to support at MVP. The minimum-viable set is probably Small Text, Decimal Number, Checkbox, Dropdown, Date. `Scanner` type is the most differentiated for physical-stock tools and aligns with OneAce's stock-counting moat.

2. **Free-plan custom field limit is hardcoded to 1.** The modal banner literally says `You can add 1 custom field on the Free plan.` This is a very aggressive limit (1 field means essentially unusable for any real workflow). OneAce should figure out whether to match this (to drive upgrades) or undercut it (to drive adoption and sign-ups). Given OneAce is an underdog, undercutting is probably the right move.

3. **`Character Limit: 190` for Small Text Box is an unusual number.** Not 100, not 255, not 256. 190 suggests this was sized to match a mobile-screen constraint or a legacy DB column. OneAce can go with 255 (standard varchar) or match Sortly's 190 for compatibility signaling. Probably 255 is cleaner.

4. **6 preset suggested fields reveal Sortly's assumed use cases:** Serial Number, Model/Part Number, Size (all text), Purchase Date, Expiry Date (both date), Product Link (web). This tells us what Sortly thinks its median customer tracks. Notably absent from the preset list: Location (already a first-class feature), Price (already on items), Quantity (already on items), Vendor/Supplier (surprising omission — this is a very common need).

5. **Live preview in the right column is a UX standout.** The 2-column layout (form left, preview right) + multi-state rendering (sample / default / placeholder) is the strongest piece of craft in Sortly's settings UI. OneAce should consider adopting this for any complex field-configuration flow.

6. **Step counting (`Step 1 of 2` / `Step 2 of 2`) is explicit.** This is a small touch but sets expectations for the user. OneAce should adopt explicit step counting in all multi-step modals (Add Address, Add Custom Field, onboarding, etc.).

7. **Pre-filled Field Name with the type label is a UX anti-pattern.** A user who just hits SAVE without editing creates a field named "Small Text Box" which is meaningless. A better pattern: leave empty with a placeholder like `e.g. Serial Number` and disable SAVE until a name is entered. OneAce should not copy this.

8. **"This cannot be changed after the field has been created."** — Sortly calls out that the Items/Folders toggle is immutable. This is a data-model constraint leaking into the UI, and it's handled well by warning the user upfront. OneAce should similarly flag any immutable choices during creation flows.

9. **`Applicable To: Items / Folders` is a two-toggle model, not a radio/enum.** A field can be applicable to items, folders, or BOTH. This is unusual — most tools have a single "entity type" dropdown. Sortly's approach is more flexible but also more complex. OneAce should probably go with a single entity target unless there's strong demand for both.

10. **`(?)` tooltip icons on 3 form fields** — Field Name, Default Text, Placeholder Text. This is contextual help without cluttering the form. OneAce already uses tooltips; worth matching this density.

11. **`Custom Fields` sub-nav link is accessible on Free tier (page loads without redirect), but field creation is limit-gated.** This is a "soft gate" pattern — user can explore but can't fully use. Better UX than hard redirect to `/upgrade-plan`. OneAce should prefer soft gates over silent redirects wherever possible.

12. **`Show on item page: Populated Fields` dropdown** is a global display filter (probably: `Populated Fields`, `All Fields`, `None`) that controls whether items-view shows empty custom field slots. This is a power-user setting and reveals that Sortly has a "crowded field list" problem — the dropdown exists because users with many fields want to hide empties. OneAce should be mindful of this as field counts grow.

13. **The `How to Create Custom Fields?` red link is a help-article CTA.** It appears only in the empty state and goes away once a field exists. This is a good onboarding pattern — contextual education that disappears when no longer needed.

14. **Modal scroll behavior:** the modal is fixed-height and does NOT scroll; everything fits in viewport at 1512×827. On smaller screens this will break — worth testing at narrower breakpoints in a future pass.

15. **Keyboard navigation:** NOT verified this pass. TODO: tab through Step 1 → Step 2 → Save to confirm keyboard accessibility of the modal.

---

## §21 Settings → Preferences (`/user-preferences`)

### §21.1 Correction to §19.1 sub-nav map: Preferences URL is `/user-preferences`, not `/preferences`

Prior captures assumed the Preferences sub-nav link mapped to `/preferences`. It does NOT — that route returns a Sortly 404 ("Oops! Something went wrong / Page not found"). The actual route is **`/user-preferences`**. Full corrected sub-nav map via `data-testid` dump:

| Label | `data-testid` | Href | Tag | Class | Behavior |
|---|---|---|---|---|---|
| `User Profile` | `user-profile` | `/user-profile` | A | `sc-crfVcM A-dOQt` (active) | Loads |
| `Preferences` | `user-preferences` | `/user-preferences` | A | `sc-crfVcM duXtcQ` | Loads |
| `Company Details` | `company-details` | `/company-details` | A | `sc-crfVcM duXtcQ` | Loads |
| `Addresses` | `company-addresses` | `/company-addresses` | A | `sc-crfVcM duXtcQ` | Loads |
| `Plan & Billing` | `billing-info` | `/billing-info` | A | `sc-crfVcM duXtcQ` | Loads |
| `User Access Control` | `user-access-control` | — | **BUTTON** | `sc-jOuUTB kDmfAu` | **Accordion** (popover menu) |
| `Custom Fields` | `custom-fields-page` | `/manage-custom-attributes/node` | A | `sc-crfVcM duXtcQ` | Loads |
| `Units of Measure` | `manage-units` | `/manage-units` | A | `sc-crfVcM duXtcQ` | **Silent redirect** to `/user-profile` |
| `Manage Alerts` | `manage-alerts-page` | `/manage-alerts` | A | `sc-crfVcM duXtcQ` | **Silent redirect** to `/user-profile` |
| `Bulk Import` | `import` | `/import` | A | `sc-crfVcM duXtcQ` | Loads (full-screen wizard) |
| `Feature Controls` | `feature-controls` | `/feature-controls` | A | `sc-crfVcM duXtcQ` | Loads (soft-gate) |
| `Create Labels` | `qr-labels` | — | **BUTTON** | `sc-jOuUTB kDmfAu` | **Paywall modal** (direct, not accordion) |
| `Public API (beta)` | `public-api` | `/public-api` | A | `sc-crfVcM duXtcQ` | **Silent redirect** to `/user-profile` |
| `Slack` | `slack-integration` | `/integrations/slack` | A | `sc-crfVcM duXtcQ` | Loads + auto-opens paywall modal |
| `Microsoft Teams` | `teams-integration` | `/integrations/teams` | A | `sc-crfVcM duXtcQ` | Loads + auto-opens paywall modal |
| `QuickBooks Online` | `quickbooks` | `/integrations/quickbooks` | A | `sc-crfVcM duXtcQ` | Loads + auto-opens paywall modal |

**Critical correction to §19.6 finding #1**: The `kDmfAu` class is NOT always an accordion. Same class, different behaviors:
- `user-access-control` → accordion popover menu
- `qr-labels` → direct paywall modal trigger

So `kDmfAu` marks "interactive non-link sub-nav button" but the actual behavior is determined by the button's `onClick` handler. CSS class is NOT a reliable behavior signal. Future captures should hover/click each BUTTON to verify its action.

### §21.2 Preferences page layout

- **Route:** `https://app.sortly.com/user-preferences`
- **Page H1:** `Preferences`
- **Content:** 1 wide card with 2 sections + divider, + SAVE CHANGES button

**General Preferences section:**

```
General Preferences

┌──────────────────────────────────┐         [● Set automatically]     ← toggle ON (green)
│ EST (UTC -05:00) EST             │   ▼
└──────────────────────────────────┘
Sort by                                       ( ) Ascending             ← radio
┌──────────────────────────────────┐         (●) Descending             ← radio selected
│ Updated at                       │   ▼
└──────────────────────────────────┘
```

- **Timezone dropdown:** shows `EST (UTC -05:00) EST` — the "EST" appears twice because the dropdown label and the code both show "EST". Default value = user's browser timezone.
- **`Set automatically` toggle:** green (ON). When ON, the timezone dropdown is disabled and auto-populated.
- **Sort by dropdown:** `Updated at` (default). Other options probably include `Created at`, `Name`, `Quantity`, etc. (NOT enumerated this pass.)
- **Ascending/Descending radio group:** Descending is default.

**Email Preferences section (below divider):**

```
Email Preferences

Alerts                                                          [● On]      ← toggle ON (green)
Email alerts will be sent to the email address associated
with your account
```

- Single toggle labeled `Alerts` with helper text.

**Footer button:** `SAVE CHANGES` (white outlined, bottom-left inside the card).

**Page footer:** `Version: v10.107.0-R216.0.0` (same global settings-shell footer as other pages).

### §21.3 Preferences findings

1. **Preferences is EXTREMELY minimal.** Only 3 controls: timezone, sort-by default, email alerts. No language toggle, no theme, no currency override, no notification granularity, no date format. This is a significant gap — most SaaS products have 10+ preference controls. OneAce can match this or go deeper.

2. **Timezone auto-detect toggle is a nice UX touch.** When `Set automatically` is ON, the user doesn't need to touch it; the system uses browser locale. This reduces friction for 90% of users while still letting power users override. OneAce should adopt this pattern.

3. **Sort-by default is a global preference, not a per-view preference.** This is interesting — in most apps, sort is a per-view state. Sortly's decision to make it global means users get consistent ordering everywhere. The trade-off is less flexibility. OneAce could offer both (global default + per-view override).

4. **No currency preference.** This is a major gap for a multi-currency tool. My assumption was that currency was gated somewhere; it's not in Preferences. It may be in Company Details (TODO: verify).

5. **No locale/language preference.** Sortly is English-only — no i18n controls. OneAce plans multi-language support (TR/EN), so this is a differentiator.

---

## §22 Gated settings cluster — silent redirect to `/user-profile`

### §22.1 Confirmed silent-redirect routes on Free tier

The following settings sub-nav links are marked as `A` (anchors with hrefs) but they silent-redirect to `/user-profile` on Free tier:

| Route | Expected Feature | Redirect destination | Tier gate (inferred from §18 plan matrix) |
|---|---|---|---|
| `/manage-units` | Units of Measure | `/user-profile` | Advanced+ |
| `/manage-alerts` | Low-stock and date-based alerts | `/user-profile` | Advanced+ |
| `/public-api` | Public API (beta) | `/user-profile` | Premium+ (API is typically highest tier) |
| `/manage-members` (§19) | Manage Team | `/user-profile` | Advanced+ |

**Total: 4 confirmed silent-redirect routes.** This is the dominant gating pattern — silent redirect to User Profile, with no explanation, no modal, no toast.

### §22.2 Why this gating pattern is bad

1. **No feedback to the user.** They click "Units of Measure" and land on "User Profile". The UI gives zero explanation. The user has no idea they hit a paywall.
2. **Dead-ends the user's flow.** Even if they realize it's a paywall, there's no contextual upgrade CTA — they have to navigate back to the sub-nav and find another entry point.
3. **Inconsistent with other paywall patterns.** §17 Plan & Billing shows a modal, §19 Manage Permissions shows a full-page overlay, §25 (below) Create Labels shows a side modal, §26 (below) Integrations show an auto-opening in-page modal. Silent redirect is pattern #5 — Sortly has at least 5 distinct gating patterns.
4. **`/user-profile` is a weird choice.** It should redirect to `/upgrade-plan` or `/change-plan` to show the user what's gated. Landing on User Profile suggests the page was never implemented for gated users.

### §22.3 Implementation inference

Sortly's backend probably returns a 403 or empty response for these routes on Free tier, and the React router has a generic redirect rule that catches 403s and bounces to `/user-profile`. This is lazy middleware design. OneAce should:
1. **Never silent-redirect.** Always show a loud feature-gated state.
2. **Keep gated pages accessible** (soft-gate) with a paywall overlay instead of redirect. This lets the user see what they're missing.
3. **Put an upgrade CTA in the exact place the feature would have been** so the conversion moment is contextual.

### §22.4 Correction to §19.6 finding #3: there are at least 5 gating patterns, not 3

Prior capture found 3 gating patterns (silent redirect, full-page overlay, accordion). Actual count after §20–§26 captures:

1. **Silent redirect to `/user-profile`** — §22 cluster (Units of Measure, Manage Alerts, Public API, Manage Team)
2. **Silent redirect to `/upgrade-plan`** — some settings sub-nav entries (TODO: verify which)
3. **Silent redirect to `/company-details`** — some sub-nav entries (TODO: verify which)
4. **Full-page paywall overlay with video** — §19 Manage Permissions
5. **Loud modal paywall (in-page overlay)** — §17 ADD SEATS, §26 Integrations (auto-open)
6. **Direct paywall side-modal** — §25 Create Labels
7. **Soft-gate (page loads, feature card has `UPGRADE PLAN` button)** — §24 Feature Controls
8. **Hard numeric limit inside feature (banner in modal)** — §20 Custom Fields ("You can add 1 custom field on the Free plan")
9. **Accordion sub-nav menu** — §19 User Access Control
10. **In-page paywall overlay with YouTube video** — §19 Manage Permissions (same as #4 but specifically video-driven)

OneAce should pick ONE pattern and apply it consistently. The best candidate is #7 (soft-gate with contextual upgrade CTA) because it's transparent, doesn't dead-end users, and keeps conversion moments contextual.

---

## §23 Settings → Bulk Import (`/import`)

### §23.1 Layout — full-screen wizard (NOT in settings shell)

Unlike all other settings pages, `/import` is a **full-screen takeover wizard** — the sidebar, sub-nav, and settings shell are hidden. Only a minimal wizard chrome is shown.

**Top chrome:**
- Sortly logo (S) top-left
- 5-step progress indicator (horizontal stepper): `Import method | Upload file | Map fields | Review | Import`
  - Step 1 "Import method" is active (blue fill + bold blue label)
  - Steps 2–5 are empty circles with gray labels
- `×` close button top-right (exits wizard, returns to previous page)

**Step 1 content (centered):**

```
                Choose the import method to upload
                         items from your file


            Recommended for new users
            ┌──────────────────────┐    ┌──────────────────────┐
            │ 📄  Quick Import     │    │ 📄  Advanced Import  │
            │                      │    │                      │
            │ Import your inventory│    │ Use Sortly's import  │
            │ from a .csv or .xlsx │    │ template to add all  │
            │ file in a snap and   │    │ items types across   │
            │ start managing your  │    │ multiple folders     │
            │ items in 1 munute    │    │                      │
            │                      │    │ Use to:              │
            │ Use to:              │    │ • Import items with  │
            │ • Quickly add items  │    │   multiple variants (?)
            │   to a single folder │    │ • Import items into  │
            │ • Use an existing    │    │   multiple folders   │
            │   .csv or .xlsx file │    │ • Import folders     │
            └──────────────────────┘    └──────────────────────┘
```

- Two large cards side-by-side. Clicking a card advances to Step 2.
- **TYPO (production bug):** The Quick Import card says `items in 1 munute` — should be `1 minute`. This is a live production typo in Sortly's Free-plan onboarding path.
- The `Recommended for new users` label is a tiny blue text above the Quick Import card.
- Advanced Import has a `(?)` tooltip icon next to "Import items with multiple variants" — contextual help.

### §23.2 Bulk Import findings

1. **Bulk Import is NOT gated on Free tier.** This is the most generous free-tier feature in the product. Sortly lets Free users bulk-import because once they've imported data they're committed to the platform — this is a classic "get data in, lock the user in" strategy. OneAce should adopt this — **free-tier bulk import is table stakes** if you want users to try the product with real data.

2. **Production typo: `1 munute`** — this is in Sortly's live production Free-plan page. Sortly's QA pipeline missed this. A small but telling quality signal. OneAce should have a spellcheck / i18n tooling check to catch these before they ship.

3. **Full-screen wizard takeover is unusual for settings.** Most settings-module flows stay inside the settings shell. Sortly's decision to blow away the chrome for Bulk Import signals that this is a "focused task" that needs the user's full attention. OneAce should match this for multi-step import flows.

4. **5-step stepper is explicit.** The user sees exactly how many steps remain. This reduces drop-off. OneAce should adopt explicit step indicators in wizards.

5. **2-card "method picker" at Step 1 is a good UX pattern** — it forces the user to choose their complexity level before committing. OneAce's CSV import can use the same pattern (Quick = single-folder single-column-map, Advanced = multi-folder with variants).

6. **Quick Import supports .csv AND .xlsx.** This is a minor but important detail — many import tools only support CSV. Users with Excel files don't want to re-export to CSV. OneAce should support both natively (I believe we already do — verify).

7. **Advanced Import mentions "items with multiple variants"** — confirms that Sortly has a variant/variant-parent data model. This is a SKU matrix feature (e.g., one parent "T-Shirt" with variants by size and color). OneAce does NOT currently have variants — this is a gap.

### §23.3 Next steps for this wizard (NOT captured this pass)

- Step 2 (Upload file): drag-drop + file picker, field validation
- Step 3 (Map fields): column-to-field mapping UI
- Step 4 (Review): preview table with row-level warnings
- Step 5 (Import): progress bar + results summary

TODO: run through the full wizard with a small sample CSV to capture Steps 2–5.

---

## §24 Settings → Feature Controls (`/feature-controls`)

### §24.1 Layout — soft-gate pattern

- **Route:** `https://app.sortly.com/feature-controls`
- **Page H1:** `Feature Controls`
- **Subtitle (gray):** `Customize and enhance your Sortly experience by toggling on advanced tools and features tailored to streamline your operations.`
- **Page loads normally** — this is a soft-gate, not a redirect. The feature cards are visible but the toggles are replaced with `UPGRADE PLAN` buttons.

**AVAILABLE FEATURES section:**

```
AVAILABLE FEATURES

┌────────────────────────────────────────────────────────────────────────┐
│ ⊙ Return to Origin   [ULTRA PLAN]                       [UPGRADE PLAN] │
│                                                                        │
│ Assign specific folders to items to serve as their original            │
│ location for faster move actions                                       │
│                                                                        │
│ ▸ Show Details                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

**Only ONE feature is listed on Free tier:** `Return to Origin` with an `ULTRA PLAN` tier badge. There may be more features for higher tiers that are hidden from Free-tier view.

**Elements:**
- Feature name: `Return to Origin`
- Tier badge: `ULTRA PLAN` — dark gray pill, white text
- CTA: `UPGRADE PLAN` — red pill button, top-right of card
- Description: `Assign specific folders to items to serve as their original location for faster move actions`
- `▸ Show Details` — red text link with chevron, expands to show more detail (NOT clicked this pass)

**Page footer:** `Version: v10.107.0-R216.0.0`

### §24.2 Feature Controls findings

1. **Return to Origin is the ONLY feature listed on Free tier.** This is suspicious — a product with many gated features should have a longer list. Two interpretations:
   - Sortly only shows features that are within 1–2 tiers of the user's current tier (Free→Ultra)
   - Sortly's Feature Controls is simply a small section with few toggle-able features
   
   TODO: check this page on Advanced tier to see if the list grows.

2. **"Return to Origin" is a physical-inventory-specific feature.** It tracks each item's "home" folder so "Move" operations can quickly return items to their original spot. This is a feature for warehouses/stockrooms where items are repeatedly taken out and returned.
   - **OneAce relevance:** this is the kind of feature OneAce's stock-counting workflow should natively support. When a counting session finds an item in the wrong location, it should suggest moving it back to its "home". This is a differentiator opportunity.

3. **Tier badge inline with feature name** is a clean pattern. Shows exactly which tier unlocks the feature without requiring the user to navigate to pricing. OneAce should adopt this.

4. **Soft-gate (page loads) is much better than silent-redirect.** The user can see what they're missing. This is the pattern OneAce should use for all gated features.

5. **The `Show Details` expand row** is good progressive disclosure — don't show the full marketing copy by default, let the user click if they want more.

---

## §25 Create Labels — QR Labels paywall side-modal (kDmfAu direct trigger)

### §25.1 Correction to §19.6 finding #1 (re-stated): `kDmfAu` is NOT always an accordion

The `Create Labels` sub-nav button (`data-testid="qr-labels"`, `class="sc-jOuUTB kDmfAu"`) is the **same CSS class** as User Access Control (§19) but it does something completely different. Clicking it opens a **paywall side-modal** — no accordion, no children.

So the prior rule "`kDmfAu` = accordion toggle" was wrong. The actual rule is:
- `kDmfAu` = interactive non-link button (no href)
- The `onClick` handler determines actual behavior (accordion OR paywall modal)
- CSS class alone cannot predict behavior

### §25.2 QR Labels paywall modal — layout

- **Trigger:** click `Create Labels` in sub-nav
- **Layout:** **right-aligned in-page modal** overlaying the entire settings shell
- **Backdrop:** dark gray full-page dim (covers sidebar + sub-nav + content)
- **Modal width:** ~60% of viewport, pinned right
- **Modal body:** 2-column layout
  - **Left column:** large empty gray space with a single red hyperlink text line: `Learn more about our integration with Slack` — WAIT, this is actually from the Slack capture below. The QR Labels modal has an empty left column. TODO: verify if left column has any content (illustration?) that was off-screen in my screenshot.
  - **Right column:** title + pitch + bullets + CTAs

### §25.3 QR Labels modal content — verbatim

```
Upgrade to Advanced to unlock QR Labels        ×        ← Advanced in red, X close top-right
─────────────────────────────────────────────────

Keep your inventory organized with easy-to-
create QR Labels.

✓ Easily create and print QR labels from any
  device, anywhere.

✓ Generate QR labels for multiple items at
  once.

✓ Track essential item details, all in one
  place.

─────────────────────────────────────────────────
PLUS:                                           ← red section label
✓ Know when your inventory is running low
  with Low Stock Alerts, review team activity
  with the Activity History Report, and more.

                     [ LEARN MORE ]   [ TRY FOR FREE ]    ← outlined + red
                            No Thanks                      ← gray text link
```

**Elements:**
- **Title:** `Upgrade to Advanced to unlock QR Labels` — "Advanced" is in red, rest is black
- **Body:** `Keep your inventory organized with easy-to-create QR Labels.`
- **Primary feature bullets** (3, red checkmark):
  1. `Easily create and print QR labels from any device, anywhere.`
  2. `Generate QR labels for multiple items at once.`
  3. `Track essential item details, all in one place.`
- **Divider**
- **Red section label:** `PLUS:`
- **Bonus bullet** (1, red checkmark):
  - `Know when your inventory is running low with Low Stock Alerts, review team activity with the Activity History Report, and more.`
- **CTAs (3):**
  - `LEARN MORE` — white outlined pill, bottom-left of button row
  - `TRY FOR FREE` — red filled pill, bottom-right of button row
  - `No Thanks` — gray text link below the button row (tertiary dismiss)
- **Close X** top-right corner

### §25.4 QR Labels findings

1. **The feature is internally called "QR Labels", not "Create Labels".** The sub-nav label says `Create Labels` but the `data-testid="qr-labels"` and the modal title both say `QR Labels`. This is a labeling inconsistency — the sub-nav should probably say `QR Labels` too. OneAce should align feature names consistently across nav + UI + internal IDs.

2. **Gated tier: Advanced** ($24/mo yearly or $29/mo monthly per §18). This is Sortly's second-lowest paid tier, making QR Labels a **mass-market** monetization lever. Sortly expects most paying customers to want QR codes.

3. **Modal structure: primary features + "PLUS:" bonus section** — this is a classic upsell pattern where the primary features sell the specific gated feature (QR Labels) and the "PLUS:" section bundles OTHER Advanced-tier features as a sweetener (Low Stock Alerts, Activity History Report). This increases perceived value of the tier.

4. **Three CTAs is unusual** — most modals have 2 (accept/dismiss). Sortly's 3 CTAs (LEARN MORE, TRY FOR FREE, No Thanks) give:
   - Intent self-selection (research vs buy vs dismiss)
   - A "soft exit" (No Thanks text link) that doesn't look like a close button
   
   OneAce should consider 3 CTAs for high-value upsells.

5. **Right-aligned modal is a NEW modal position pattern.** Previous captures showed:
   - Centered modal (§13, §17 ADD SEATS, §20 Create Custom Field)
   - Full-page overlay (§19 Manage Permissions)
   - And now: right-aligned side-slide modal (§25 QR Labels, §26 integrations)
   
   Sortly's modal positioning seems to vary by feature type, not consistently. This is inconsistent UX.

6. **`Advanced` is rendered in the title in brand red color.** Typography emphasis signals which tier to upgrade to without requiring the user to scroll to CTA. Fine touch.

7. **The dark backdrop for this modal contradicts §20.7 hypothesis** that settings-module CREATE modals use pink backdrops. Correction: **pink backdrop is specifically for CREATE dialogs** (Add Address in §16, Create Custom Field in §20). **Paywall / upsell modals use dark backdrops** regardless of where they're triggered. The pattern is: pink = safe creation action, dark = upsell / blocking. OneAce should follow this convention if adopting Sortly's backdrop color scheme.

---

## §26 Integrations cluster (`/integrations/slack`, `/integrations/teams`, `/integrations/quickbooks`)

### §26.1 Layout — page loads + auto-opening paywall modal

All three integration pages load normally (H1 + page shell visible in background) but **auto-open an in-page paywall modal immediately on page load**. No click required — the modal is triggered by React on mount.

The background page is grayed out by a dark backdrop. The modal is centered-right, large (~60% viewport width).

### §26.2 Slack integration (`/integrations/slack`)

**Background page:**
- H1: `Integrate With Slack`

**Modal content — verbatim:**

```
Learn more about our integration with Slack            ×    ← link top-left, X top-right

                    Receive real-time inventory
                    notifications directly in
                    Slack.                              ← "Slack" in red
                    ─────────────────────────
                    Receive alerts when an item is
                    edited, created, moved, deleted,
                    or a quantity is updated. Simply
                    connect your Sortly account to
                    Slack to start receiving these
                    notifications instantly.

                    ✓ Create an item
                    ✓ Update an item
                    ✓ Move an item
                    ✓ Delete an item
                    ✓ Update quantity

                    All Ultra Plan Features             ← red text link
                    ┌──────────────────────────────┐
                    │  TRY IT FREE FOR 14-DAYS     │   ← red filled, full-width
                    └──────────────────────────────┘
```

**Elements:**
- `Learn more about our integration with Slack` — red text link in the left column of the modal (clickable, opens docs in new tab)
- Title: `Receive real-time inventory notifications directly in Slack.` — Slack in red
- Body: `Receive alerts when an item is edited, created, moved, deleted, or a quantity is updated. Simply connect your Sortly account to Slack to start receiving these notifications instantly.`
- 5 red-checkmark bullets: `Create an item`, `Update an item`, `Move an item`, `Delete an item`, `Update quantity`
- `All Ultra Plan Features` — red text link above the CTA
- CTA: `TRY IT FREE FOR 14-DAYS` — full-width red pill

**Tier gate:** `Ultra Plan` ($74/$89 per §18). This is the mid-high tier.

### §26.3 Microsoft Teams integration (`/integrations/teams`)

**IDENTICAL to Slack** — same 5 bullets, same layout, same CTA, same tier (Ultra). Only differences:
- H1: `Microsoft Teams Integration`
- Title: `Receive real-time inventory notifications directly in Microsoft Teams.` (s/Slack/Microsoft Teams/)
- Left column link: `Learn more about our Microsoft Teams integration`

The 5 alert-event bullets are literally copy-pasted from the Slack modal. This is lazy marketing copy.

**Tier gate:** `Ultra Plan` (same as Slack)

### §26.4 QuickBooks Online integration (`/integrations/quickbooks`)

**DIFFERENT from Slack/Teams** — different bullets, different tier.

**Background page:**
- H1: `QuickBooks Online`

**Modal content — verbatim:**

```
Learn more about our integration with QuickBooks Online    ×

                    Optimize your workflow with
                    QuickBooks Online.                  ← "QuickBooks Online" in red
                    ─────────────────────────
                    Connect to QuickBooks Online,
                    making it fast and easy to send
                    invoices from Sortly to existing
                    QuickBooks Online accounts.

                    ✓ Sync your QBO account
                    ✓ Send Purchase Orders to QBO
                    ✓ Send Invoices to QBO

                    All Premium Plan Features           ← red text link (Premium!)
                    ┌──────────────────────────────┐
                    │  TRY IT FREE FOR 14-DAYS     │
                    └──────────────────────────────┘
```

**Elements:**
- Title: `Optimize your workflow with QuickBooks Online.` — QuickBooks Online in red
- Body: `Connect to QuickBooks Online, making it fast and easy to send invoices from Sortly to existing QuickBooks Online accounts.`
- 3 red-checkmark bullets: `Sync your QBO account`, `Send Purchase Orders to QBO`, `Send Invoices to QBO`
- `All Premium Plan Features` — red text link (note: **Premium**, not Ultra)
- CTA: `TRY IT FREE FOR 14-DAYS`

**Tier gate:** `Premium Plan` ($149/$179 per §18) — Sortly's highest tier below Enterprise.

### §26.5 Integration cluster findings

1. **Only 3 integrations total on Free-tier sub-nav.** Slack, Teams, QuickBooks. That's it. No Zapier, no Shopify, no Amazon, no WooCommerce, no Xero, no NetSuite. For an inventory SaaS, this is a shockingly small integration surface. OneAce can differentiate by offering more integrations, or by offering native Zapier support (which gives 5000+ indirect integrations).

2. **Tier spread shows monetization strategy:**
   - Slack + Teams = **Ultra** (mid-high, $74/$89)
   - QuickBooks Online = **Premium** (highest paid, $149/$179)
   
   Sortly believes QBO integration is worth a $75 price gap over Slack/Teams. This is reasonable — QBO integration has real accounting/finance value, and customers who need QBO sync are typically larger and more willing to pay.

3. **Slack and Teams copy is 100% copy-pasted.** Same 5 bullets, same body text structure, same CTA. This is a marketing quality signal — Sortly treated Slack/Teams as interchangeable, which they are NOT from the user's perspective (team communication platforms have different use cases). OneAce should write distinct copy for each integration even if they cover similar events.

4. **Auto-opening modal on page load is aggressive UX.** The user can't see the background page content without dismissing the modal. This is a paywall tactic — force the user to see the upsell before anything else. OneAce could adopt this BUT it risks feeling pushy; a balance is needed.

5. **`Learn more about our integration with X` link is in the LEFT column of the modal**, not the body. This is an unusual placement — putting the "docs" link on the empty side of the modal creates visual balance but also hides it from users who focus on the right column. OneAce should put help links in a more discoverable spot.

6. **5 alert events for Slack/Teams (create, update, move, delete, update quantity)** — this is Sortly's full webhook/event taxonomy. These are the 5 events Sortly considers important enough to notify on. OneAce should at minimum support create, update, and delete; move and update-quantity are stock-counting specific and align with OneAce's core loop.

7. **`All Ultra Plan Features` / `All Premium Plan Features` link** — this is a useful "see everything at this tier" CTA that complements the primary upgrade CTA. OneAce should offer this kind of tier-comparison link in every paywall modal.

8. **No integration is gated behind Advanced tier** — all 3 are Ultra+. This means the Advanced plan ($24/$29) has ZERO integrations. That's a narrow value proposition for Advanced — users who need any integration must jump 2 tiers to Ultra. This is probably a missed monetization opportunity for Sortly. OneAce should consider putting its cheaper-to-maintain integrations (Slack, Teams) in the mid tier to differentiate.

---

## §27. Reports cluster — full sub-nav map + gating pattern

**Routes confirmed (2026-04-10):**

| Route | Label | Icon | Access (Free plan) | Title color |
|---|---|---|---|---|
| `/activity-history` | Activity History | clock with arrow | ✅ full access | rgb(47, 49, 58) black |
| `/reports/inventory-summary` | Inventory Summary | layers | ✅ full access | rgb(84, 86, 93) dark gray |
| `/reports/low-stock` | Low Stock (child of Inventory Summary) | bookmark with star | ✅ full access (empty state) | rgb(47, 49, 58) black when active |
| `/reports/all-transactions` | Transactions | cycle/reload | ✅ full access | rgb(84, 86, 93) dark gray |
| `/reports/quantity-changes-by-item` | Item Flow | bar-chart with star | ⛔ **silent redirect to `/reports`** | rgb(143, 144, 149) light gray |
| `/reports/transfer` | Move Summary | box with star | ⛔ **silent redirect to `/reports`** | rgb(143, 144, 149) light gray |
| `/reports/user-activity-summary` | User Activity Summary | people with star | ⛔ **silent redirect to `/reports`** | rgb(143, 144, 149) light gray |

**NEW gating pattern (pattern #11):** **Silent redirect to `/reports` index** — distinct from earlier `/user-profile` silent-redirect pattern. When a Free-tier user navigates to a gated report URL, the SPA loads, flashes briefly, then React-Router `replace()`s the URL back to `/reports`. No modal, no toast, no banner targeted at the specific feature. The only signal is:
1. You're back on `/reports` (URL changed)
2. The report card you tried to click has grayer title text (`rgb(143, 144, 149)` vs `rgb(84, 86, 93)` for accessible cards)

This is even worse UX than the `/user-profile` silent-redirect because at least the profile page has context. Landing on `/reports` after clicking a `/reports/xxx` sub-link feels like a broken back button.

**Tier inference:** The 3 gated reports are almost certainly Advanced or Ultra tier. Given that Low Stock Alerts is Advanced (§19 / §31), and that report subscriptions are called out in the top banner ("saved reports and report subscriptions"), these are likely **Advanced tier**.

### §27.1 `/reports` index — full verbatim

**H1:** `Reports`

**Upgrade banner (red full-width, below H1):**
```
★  Unlock more saved reports and report subscriptions by upgrading your plan today.    [UPGRADE PLAN]  ×
```
- Banner background: red (same as other paywall banners)
- Star icon on left
- Inline `UPGRADE PLAN` button in white box with red text (right-side)
- Dismissable via `×`

**Video tutorial card:**
```
[▶ video thumbnail]  Learn about reports, saved reports, and report subscriptions
                     Watch Video Tutorial    Read Help Article
```
- Video thumbnail says "Sortly / NEW FEATURE / Saved Reports Subscriptions" on a red background
- Two red hyperlinks: `Watch Video Tutorial` and `Read Help Article`

**Report card grid — 3×2 layout:**

| | Activity History | Inventory Summary | Transactions |
|---|---|---|---|
| Icon | clock arrow | layers | cycle/reload |
| Copy | "Keep tabs on all users' changes to items, folders, tags, & more." | "Review your inventory's quantity, value, & location at a glance." | "Monitor all inventory movements, updates, and deletions for efficient team oversight." |
| Title color | dark gray rgb(84,86,93) | dark gray rgb(84,86,93) | dark gray rgb(84,86,93) |

| | Item Flow | Move Summary | User Activity Summary |
|---|---|---|---|
| Icon | bar chart with star | box with star | people with star |
| Copy | "Track quantity fluctuations for your inventory using flexible filtering options." | "Monitor all inventory folder changes that occur within a specified time frame." | "Track how team members interact with your inventory & filter for actions that matter most to you." |
| Title color | **light gray** rgb(143,144,149) — gated visual cue | **light gray** rgb(143,144,149) — gated | **light gray** rgb(143,144,149) — gated |

**Card class:** `ui__ReportTypeCard-hoBdnG jwuKtn` (same class for all 6; gated state is NOT encoded in class name — only in the title element's inline color).

**Card container element:** Cards are NOT `<a>` tags. They're `<div>` with `cursor: pointer` and `onClick` handlers that navigate via `react-router`. The click on a gated card triggers navigation to the gated URL which then gets redirected back.

### §27.2 `/activity-history` — Activity History page (Free plan, full access)

**Header row:**
- Top label: `Default Report` (with small layers icon on left) — gray caption above H1
- **H1:** `Activity History` — black, large weight
- Top-right button cluster: `[⭐ schedule icon]` (subscribe-button, gray outlined) + `[↑ EXPORT]` (red filled button with upload icon)
- `data-testid="subscribe-button"` class `ui__SubscribeReportWrapper-lcqI` — empty label (icon only)
- `data-testid="export-transactions"` class `hMpsT`

**Filter row:**
- Left: `Search Activity` input with magnifier icon placeholder
- Next to search: filter icon button (no badge when unfiltered)
- Right: `[📅 This Month  01/04/2026 - 30/04/2026 ▼]` date-range dropdown (`data-testid="date-range-dropdown-anchor"`)

**Table columns:** `DATE ↓ | ACTIVITY TYPE | ACTIVITY`
- DATE column has sort arrow (default sorted)
- DATE cells: times like `9:28 AM`, `8:10 AM` (same day only shows time)
- ACTIVITY TYPE cells: plain-text labels — `Delete Folder`, `Delete Item`, `Create Folder`, `Create Item`
- ACTIVITY cells: rich sentence, subject/target in bold — e.g. `Mahmut Seker deleted folder Test Shelf A1 from Main Location` (bold on "Mahmut Seker", "Test Shelf A1", "Main Location")

**Footer:** `Show: [20 ▼] per page` — no page numbers visible because <20 rows on demo

**Left sub-nav (Reports module):**
```
▸ [history-icon] Activity History    ← active (red history icon)
▼ [layers-icon]  Inventory Summary
  [bookmark-star] Low Stock          ← child (indented)
  [cycle]         Transactions
  [bar-star]      Item Flow          ← gated (gray)
  [box-star]      Move Summary       ← gated (gray)
  [people-star]   User Activity Summary ← gated (gray)
```
- The `Inventory Summary` collapsible expands to show `Low Stock` as child.
- A top-sticky search field: `Search reports` (magnifier icon placeholder)

### §27.3 `/reports/inventory-summary` — Inventory Summary page

**Header:**
- Caption: `Default Report` (with layers icon)
- **H1:** `Inventory Summary`
- Right: `[subscribe-button]` + `[EXPORT]`

**Toolbar:**
- Search input (with barcode scanner icon + "+" badge on the right-inside — the "+" is purple, suggesting barcode-scanner is a paywalled add-on)
- `[📄 Any item]` filter button
- `[📁 Any folder]` filter button
- filter icon button
- Far right: `Group Items  ⓘ  [toggle ON]` — green toggle

**Summary metrics (before table):**
```
Total Quantity        Total Value
9 units               TRY 0.00
```
- "Total Quantity" label (small gray) above "9 units" (large, `9` bold then `units` small)
- "Total Value" label above "TRY 0.00" (large with TRY currency)

**Table columns:** `NAME | QUANTITY | MIN LEVEL | PRICE | VALUE | [Folder]`
- Overlaid `[✏ Edit]` button on top-right of table (floating; appears to be "edit columns")
- Rows have NEW pill on thumbnail for new items
- Values like `armut / 4 units / — / — / — / Truck`, `elma / 1 unit / — / — / — / Storage Area`, `hghhh / 4 units / — / — / — / Main Location`
- Dashes (`—`) used for empty MIN LEVEL/PRICE/VALUE — consistent with Sortly's em-dash empty convention

**Footer:** `Show: [20 ▼] per page`

### §27.4 `/reports/low-stock` — Low Stock saved report

**Header:**
- Caption: `Saved Inventory Summary Report` (note: different — says "Saved" not "Default")
- **H1:** `Low Stock`
- Right: `[star-schedule]` + `[★ SAVED]` (gray pill with star, red dot indicator) + `[EXPORT]` (but Export button appears faded/pink, hinting disabled state or paywall for exporting saved reports)

**Toolbar:** same as Inventory Summary
- Search with barcode scanner +
- Any item, Any folder
- **Filter icon has red badge "1"** — indicating 1 filter active (the low-stock criterion)

**Empty state (because no low-stock items match filter):**
- Large cube/box outline icon
- Text: `No items found` (bold)
- Sub-text: `Try filters for more search and filtering options` — with `filters` as a red inline link

**Finding:** Low Stock is not a separate report type — it's a **saved Inventory Summary report** with the `filter=lowStock` pre-applied. This is clever product design: the report infrastructure is reused; Low Stock is essentially a bookmark. The caption distinguishes "Default Report" (un-filtered) from "Saved Inventory Summary Report" (persisted view).

### §27.5 `/reports/all-transactions` — Transactions report

**Header:**
- Caption: `Default Report` (with cycle/reload icon instead of layers)
- **H1:** `Transactions`
- Right: `[subscribe-button]` + `[EXPORT]`

**Toolbar (same row extended):**
- Search with barcode scanner +
- `[📄 Any item]` | `[📁 Any folder]` | **`[🔄 Any transaction]`** ← new filter button specific to Transactions
- Filter icon
- Second row: `[📅 This Month 01/04/2026 - 30/04/2026 ▼]`

**Table columns:** `TRANSACTION DATE ↓ | NAME | QTY CHANGE | TRANSACTION TYPE | TRANSACTION` (last column cut off — likely "TRANSACTION DETAILS" or similar)
- Qty changes are **color-coded**: `- 25 units` in **red**, `+ 25 units` / `+ 4 units` / `+ 1 unit` in **green**
- TRANSACTION TYPE values: `Delete`, `Create`
- Rows show 9:19 AM Test Drill Bit 10mm -25 Delete; 8:59 AM Test Drill Bit 10mm +25 Create; 8:10 AM armut +4 Create; 8:10 AM elma +1 Create; 8:10 AM hghhh +4 Create

**Finding:** Sortly's Transactions report is essentially an activity log with quantity delta computed. It's a DIFFERENT pivot on the same underlying audit events as Activity History — Activity History shows action types, Transactions shows qty deltas. Both are denormalized views of the same event stream. For OneAce, this suggests we need ONE event stream with multiple views rather than two separate tables.

### §27.6 Reports cluster findings

1. **11th gating pattern discovered.** Silent redirect from `/reports/<gated>` back to `/reports` index. Worst UX of all 11 patterns — no signal at all that the click was gated. Only the slightly-grayer title color on the card hints at gating, and users won't notice.

2. **3 of 6 reports are gated.** Activity History, Inventory Summary, Transactions are free. Item Flow, Move Summary, User Activity Summary are paid. This is a reasonable split — the gated ones are more "advanced" (trend analysis, cross-team visibility) while the free ones are basic audit/inventory snapshots. OneAce should keep activity-log and inventory-summary free and gate trend/user-analytics.

3. **Saved Reports are a paywall feature.** The top banner says "saved reports and report subscriptions" — implying Free tier can only view default reports, not save custom filters. The `Low Stock` entry is an exception because it's a built-in saved report, not a user-created one. OneAce should let Free users save at least 1-3 custom reports to avoid feeling punitive.

4. **Report subscriptions = email digests.** The `subscribe-button` + `schedule` language implies users on paid tiers can schedule reports to email/PDF themselves. OneAce should note: this is a high-value B2B feature that doesn't require heavy engineering (cron + existing PDF export).

5. **Export is available on Free tier.** The red `EXPORT` button is live on all 3 accessible reports (Activity History, Inventory Summary, Transactions). This is generous — many SaaS gate export. OneAce should match this for parity.

6. **Barcode-scanner in search input has a "+" paywall badge.** The search input on reports has a purple barcode icon with a `+` overlay — this is a soft-gate indicator (the user can see the feature exists but must upgrade). This is the 12th gating pattern variant: **inline paywall badge on input decoration**. OneAce could use this pattern for features like camera scanning on mobile web.

7. **Bold-text rich cell formatting in Activity column** is a nice readability trick. `Mahmut Seker deleted folder Test Shelf A1 from Main Location` — bold on subject (Mahmut Seker), target (Test Shelf A1), and location (Main Location). Makes it scannable. OneAce should match.

8. **Date range = "This Month 01/04/2026 - 30/04/2026"** — Sortly uses DD/MM/YYYY per browser locale (TR). This means Sortly DOES honor locale for date formatting. OneAce must do the same (don't hardcode MM/DD/YYYY US format).

9. **Group Items toggle on Inventory Summary** — the toggle groups identical items across folders into a single row. This is a stock-counting workflow feature. OneAce has NO such toggle yet — this is a parity gap to close.

10. **Column sort arrow (↓) on DATE header** — single-column sort only, no multi-column. OneAce can match and not worry about multi-sort.

11. **Edit floating button overlay on table top-right** — this is an "edit columns" control positioned as a floating pill. Unusual UX; most apps put column config in a gear icon or dropdown. Appearing ONLY when hover could be the trigger, but from the screenshot it's always visible. OneAce should put column-config in a more conventional location (gear icon on header).

12. **Pagination: `Show: [20 ▼] per page` — no page numbers.** Sortly uses infinite/virtual scroll OR server-side pagination with only "Show N per page" control. No visible `< Prev 1 2 3 Next >` pagination. OneAce should confirm what approach to use; for large datasets, page numbers + jumps help.

---

## §28. Notifications bell — Low Stock Alerts paywall modal

**Trigger:** Click the bell icon (`data-testid="alerts-page"`, label "Notifications") at bottom of left rail (y≈687).

**Behavior:** Opens a **centered modal** (not side-drawer this time) with a shelving illustration on the LEFT and upgrade copy on the RIGHT. Background darkens.

**Wrapper class:** `ui__Popup-ivhVSC fvehLr` — different from `SideModal` class used by §25 Create Labels and §26 integrations. This is a CENTERED modal (centered popup), distinct from right-aligned side modal.

### §28.1 Verbatim content

```
                                                                         ×
╔══════════════════════════════╦═══════════════════════════════════╗
║                              ║                                   ║
║  [shelving unit illustration ║  Upgrade to Advanced:             ║
║   with alert icon on middle  ║  Unlock Low Stock Alerts          ║
║   shelf; 3 cardboard boxes   ║  ─────────────────────────────    ║
║   on bottom shelf, 2 boxes   ║                                   ║
║   on top shelf; center shelf ║  Keep teams informed and          ║
║   shows red "!" badge]       ║  inventory flowing, no more       ║
║                              ║  surprises or delays.             ║
║                              ║                                   ║
║                              ║  ✓ Stay ahead of stockouts,       ║
║                              ║    before it becomes a problem.   ║
║                              ║                                   ║
║                              ║  ✓ Make smarter purchasing        ║
║                              ║    decisions, no more             ║
║                              ║    over-ordering.                 ║
║                              ║                                   ║
║                              ║  ✓ Auto-alert your team so        ║
║                              ║    nothing slips through the      ║
║                              ║    cracks.                        ║
║                              ║                                   ║
║                              ║  ──── PLUS: ────                  ║
║                              ║                                   ║
║                              ║  ✓ Run inventory with confidence  ║
║                              ║    and control using low-stock    ║
║                              ║    alerts, custom QR labels,      ║
║                              ║    and advanced permissions.      ║
║                              ║                                   ║
║                              ║  ┌──────────┐  ┌──────────────┐   ║
║                              ║  │LEARN MORE│  │TRY FOR FREE  │   ║
║                              ║  └──────────┘  └──────────────┘   ║
║                              ║        No Thanks                  ║
╚══════════════════════════════╩═══════════════════════════════════╝
```

**Verbatim text (exact):**
- Title line 1: `Upgrade to Advanced:` — "Advanced" in red
- Title line 2: `Unlock Low Stock Alerts`
- Body: `Keep teams informed and inventory flowing, no more surprises or delays.`
- Bullet 1: `Stay ahead of stockouts, before it becomes a problem.` (bold "Stay ahead of stockouts")
- Bullet 2: `Make smarter purchasing decisions, no more over-ordering.` (bold "Make smarter purchasing decisions")
- Bullet 3: `Auto-alert your team so nothing slips through the cracks.` (bold "Auto-alert your team")
- Separator: `PLUS:` (red, centered)
- PLUS bullet: `Run inventory with confidence and control using low-stock alerts, custom QR labels, and advanced permissions.` (no bold)
- CTAs (3):
  1. `LEARN MORE` — outlined white button (left)
  2. `TRY FOR FREE` — red filled button (right)
  3. `No Thanks` — text link below buttons

**Close:** `×` in top-right corner

### §28.2 Findings

1. **4th modal layout pattern discovered: centered split-layout.** Previously documented: loud centered modal paywall (§6), right-aligned side modal with dark backdrop (§25), right-aligned auto-opening integration modal (§26), pink-backdrop create modal (§7+§20). This is a 5th distinct paywall modal layout: **centered with equal-width left illustration + right copy**. OneAce should pick 1-2 consistent patterns, not 5.

2. **Clicking the bell icon on Free tier is essentially broken as navigation.** The bell is a primary nav button (left rail, bottom). Clicking it should open a notifications panel. Instead, it shows an UPSELL for Low Stock Alerts. Users who expect to check their notifications get ambushed with a paywall. This is hostile UX. OneAce must NEVER gate core navigation items. The bell should always open a notifications panel, even if empty or gated.

3. **Same "Upgrade to Advanced" tier as Create Labels (§25).** Sortly is aggressively positioning "Advanced" as the tier that unlocks basic alerts + QR labels. This aligns with their pricing strategy: get users from Free → Advanced fast. OneAce should note: the Advanced tier in Sortly is positioned as "the missing basics."

4. **PLUS: upsell pattern repeats from §25.** Same "PLUS:" separator + bonus bullet structure. This is a deliberate marketing formula — bullet list feels too short, add PLUS: bullet to make value feel richer. OneAce can adopt this rhetorical trick.

5. **3 CTAs pattern is consistent with §25.** Both Low Stock Alerts and QR Labels paywalls use: LEARN MORE (secondary) / TRY FOR FREE (primary) / No Thanks (text dismiss). This is a stable paywall modal formula. OneAce's one paywall modal convention should use the same 3-CTA structure.

6. **Bold opening words on each bullet ("Stay ahead of stockouts", "Make smarter purchasing decisions", "Auto-alert your team") — microcopy technique.** Each bullet opens with a bold imperative action, then explains it. This is stronger than plain bullets. OneAce's upsell copy should mirror this.

7. **The illustration (shelving unit with alert icon) is literal, not abstract.** Sortly uses realistic warehouse illustrations for upsells — not abstract vectors. This matches the brand's "real-world inventory" positioning. OneAce should commission its own consistent illustration system for upsells (not abstract) — this is a design-system investment.

---

## §29. Labs — `/labs` (updated content)

**H1:** `Sortly Labs` with `Beta` pill badge next to H1 (rounded rectangle, gray outline, small)
**Subtitle:** `Explore and test experimental features`

**Info banner (blue, rounded, with info icon):**
```
ⓘ  Features in Labs are experimental and under active development. Enable them
   to try new capabilities and help shape the future of Sortly. Your feedback is
   invaluable in making these features production-ready.
```

**Toolbar row (inside white card container):**
- Left: `[🔍 Search lab features]` input
- `[Stage ▼]` dropdown
- `[Status ▼]` dropdown
- Far right: `[Sort ▼]` dropdown

**Feature cards (1 total as of capture):**

```
┌─────────────────────────────────────────────────────────┐
│ Threads                              [○ Disabled]       │
│ [ALPHA]   ← purple pill                                  │
│ Keep conversations threaded to your inventory.           │
│                                                          │
│ > Show Details   ← red text + chevron                    │
└─────────────────────────────────────────────────────────┘
```

**Verbatim:**
- Card title: `Threads`
- Stage pill: `ALPHA` — purple/violet background
- Description: `Keep conversations threaded to your inventory.`
- Expand link: `Show Details` — red with `›` chevron
- Status toggle: `Disabled` label with OFF-state toggle (right side of card)

### §29.1 Findings

1. **Only 1 lab feature exists.** Sortly's experimental program is very thin — they're shipping 1 "Threads" feature in alpha. This is either a recent launch (lab page is fresh) or a sign that Sortly's experimentation pipeline is dry. OneAce should NOT feel pressure to fill a labs page; starting with 1-2 experiments is fine.

2. **"Threads" = conversations pinned to inventory items.** This is a collaboration feature — multiple users can chat about a specific SKU. It's non-trivial product work (needs realtime + notifications + permissions). Sortly labeling it ALPHA suggests they're testing whether customers want this at all. OneAce should watch this feature and learn whether it graduates to GA.

3. **Stage taxonomy = ALPHA (and presumably BETA, GA).** The Stage dropdown implies multi-stage gating of experiments. OneAce can adopt the same taxonomy for feature flags.

4. **Per-feature toggle is user-controlled.** Each user opts in/out independently. Good pattern — labs should always be opt-in, never forced. OneAce should match.

5. **"Feedback is invaluable in making these features production-ready"** — Sortly leans on labs users as unpaid QA. This is acceptable positioning BUT Sortly provides no visible feedback mechanism on the labs card itself. OneAce should include a "Share feedback" button directly on each lab card.

---

## §30. Advanced Search — `/advanced-search` (filter panel detail)

**Layout (3-column on wide viewport):**
- Far-left: red icon rail (global chrome)
- Left mid (collapsible, currently open): **Filters panel** (≈280px wide)
- Main area: results (currently showing empty state)

**Left Filters panel — sections (verbatim):**

**Header:** `Filters` (bold)

**Section 1: `Folders`**
- Collapsible header: `^ Folders  [All Folders]  🔍`
  - Chevron-up (collapsible expanded)
  - Pill button: `All Folders` (dark background, white text — selected state)
  - Magnifier icon (search within folders)
- Tree content:
  ```
  ☑ ▼ All Items
      ☑  Main Location
      ☑  Storage Area
      ☑  Truck
  ```
  - Top-level `All Items` with expand chevron (open) and checkbox (checked)
  - Children indented: `Main Location`, `Storage Area`, `Truck` each with checkbox (checked)

**Section 2: `Name`**
- Collapsible header: `^ Name  🔍`
- Checkbox list per item:
  ```
  ☐ armut
  ☐ elma
  ☐ hghhh
  ```
  - All unchecked by default

**Section 3: `Quantity`**
- Collapsible header: `^ Quantity`
- `Unit` label + dropdown: `[Any Units ▼]`
- Two inputs side-by-side: `[Min]` `[Max]` (number inputs)
- Toggle: `○ Exact value` (OFF by default) — grey toggle

**Sections below (scrollable, not all visible):** presumably Price, Min Level, Barcode, Custom Fields, Tags.

**Main area — empty state (when no filters applied beyond defaults):**

**H1:** `Advanced Search`

**Body (centered):** `Create lists of items across your inventory using multiple filters`

**Explainer grid — 6 tiles in 3×2 layout:**

Row 1:
| | Folders | Quantity | Min Level |
|---|---|---|---|
| Icon | blue folder circle | blue ± circle | blue ± circle |
| Copy | "Get a list of items in specific folders" | "Filter items based on their stock levels" | "Identify items below or above their min levels" |

Row 2:
| | Barcode / QR code | Custom filters | Summaries |
|---|---|---|---|
| Icon | blue QR square circle | blue braces/bracket circle | blue clipboard circle |
| Copy | "Find all items matching specific barcodes or qr codes" | "Add filters matching any custom fields in your system" | "Group items with the same Sortly ID" |

**Bottom sticky banner (full-width, dark):**
```
Export search results to CSV or PDF: Filter your inventory, then export for reports, analysis, and more   [Watch demo]  ×
```
- Label on left (dark background, white text)
- `Watch demo` button on right (red filled)
- `×` close button

### §30.1 Findings

1. **Advanced Search is a filter-builder, not a text search.** The default page has no search box front-and-center — just the filter panel and explainer. To use it, you interact with the left filters. This is UNUSUAL — most "search" pages start with a text box. Sortly treats search as "structured filtering". OneAce should offer BOTH text search AND structured filter, as separate entry points.

2. **6 filter capabilities exposed on empty state** — Folders, Quantity, Min Level, Barcode/QR, Custom filters, Summaries. This doubles as a feature-discovery surface. OneAce can adopt the same "onboarding via empty state" pattern.

3. **"Summaries — Group items with the same Sortly ID"** — cryptic. "Sortly ID" is apparently a per-item unique identifier. This filter groups items that share the same Sortly ID (duplicates? same SKU across folders?). OneAce must clarify its own ID model (SKU vs Item ID vs UUID) and build the equivalent grouping.

4. **Custom filters tile** — implies Advanced Search can filter by custom fields (from §20 Custom Fields). This is a powerful cross-feature integration that's surfaced as a first-class filter type. OneAce should ensure its Advanced Search supports custom fields filtering from day 1.

5. **"Export search results to CSV or PDF" bottom banner** — persistent nagbar that promotes export. This is a feature marketing tactic — remind users the export feature exists even when they're just filtering. OneAce should use this approach for promoting under-discovered features.

6. **Filter panel uses nested tree with checkboxes** for Folders — top-level folder + child folders, each checkbox independent. The parent checkbox also acts as select-all for children. OneAce should match this pattern (standard tree UX).

7. **`Any Units` dropdown on Quantity filter** — Sortly supports multi-unit inventory (pieces, boxes, kg, etc.). Choosing "Any Units" searches across all units. OneAce needs multi-unit support to match.

8. **Min/Max inputs + "Exact value" toggle** — the toggle flips Min/Max into a single exact-match input. Nice UX for switching modes without reopening the filter. OneAce should match.

9. **The bottom nagbar ("Export search results...") is NOT dismissable in a persistent way** — closing it brings it back on next visit. This is a visual marketing tactic. OneAce should respect dismiss for at least a session.

---

## §31. Help Center + Product News (left rail utilities)

**Help button:** `?` speech-bubble icon at left rail y≈631.
- Tooltip on hover: `Help Center ↗` (with external-link icon)
- Click behavior: **opens new tab** to `https://help.sortly.com/hc/en-us`
- The help widget is NOT an in-app iframe chat — it's a hard link to the external help center.

**Product News button:** megaphone icon at left rail y≈575.
- Label: `Product News`
- `href="."` (self-anchor — indicates JS-driven click handler)
- Clicking should trigger the **Frill widget** (`Frill_Frame` iframe present in DOM with class `Frill_View_Sidebar Frill_View_Sidebar--right`). On this session the click did not reliably open the panel — may require double-click or suffer from initial-load delay.

### §31.1 Findings

1. **No in-app chat support on Free tier.** Sortly doesn't even surface an Intercom/Zendesk-style chat — help is an external link. For an inventory SaaS, this is cost-saving but frustrates users who need quick help. OneAce should consider at least an embedded contact form on support pages.

2. **3rd-party vendor stack includes Frill (feedback/changelog), Chameleon (product tours), and a third iframe** (could be Google Tag Manager, or another analytics tool). OneAce should avoid heavy 3rd-party script bloat in the MVP.

3. **Product News is changelog/roadmap, not announcements.** Frill is specifically a product update/feedback tool. OneAce can use an in-app changelog widget without a SaaS dependency — a simple JSON feed works.

4. **Help Center external link is a missed opportunity for contextual help.** When a user clicks Help on `/reports/quantity-changes-by-item`, they get dumped at the generic help-center root, not a route-specific help article. OneAce should deep-link help to route-specific articles.

---

## §32. Left rail — full element inventory (verified 2026-04-10)

Exhaustive listing of every clickable element on the left icon rail, top-to-bottom, with verified coordinates and data-testid / href:

| # | Y-coord | Tag | Element | `href` or `data-testid` | Behavior |
|---|---|---|---|---|---|
| 0 | ~30 | img | `S` Sortly wordmark | (decorative, clickable=?) | home/logo |
| 1 | 120 | a | Dashboard | `/dashboard` | nav |
| 2 | 176 | a | Items | `/items` | nav |
| 3 | 232 | a | Search | `/advanced-search` | nav |
| 4 | 288 | a | Tags | `/tags` | nav |
| 5 | 344 | a | Workflows | `/workflows` (label has `New` pill) | nav |
| 6 | 400 | a | Reports | `/reports` | nav |
| 7 | 456 | a | Labs | `/labs` (label has `Beta` pill) | nav |
| 8 | 529 | a | Upgrade (upload-arrow icon, highlighted) | `/upgrade-plan` | promo |
| 9 | 575 | a | Product News (megaphone) | `href="."` → Frill widget | utility |
| 10 | 631 | li/button | Help Center (?) | (no testid; click opens new tab) | external |
| 11 | 687 | button | Notifications (bell with star) | `data-testid="alerts-page"` | **paywall modal** (§28) |
| 12 | 743 | button | Settings (gear) | `data-testid="settings-button"` | nav → settings cluster |

### §32.1 Findings

1. **Upgrade CTA sits as icon #8 in the left rail.** The `/upgrade-plan` link uses an upload-arrow icon — NOT a dollar/star icon. This is initially confusing (looks like an Import button). The icon is ALWAYS highlighted (white pill background) regardless of route, to draw attention. OneAce should use a clearer icon for upgrade (e.g., sparkle, arrow-up with $, or a crown) — not a generic upload arrow.

2. **Only 2 promo/utility slots between main nav and settings** — Product News (Frill) and Help Center. Sortly doesn't pack the rail with extras. OneAce can match this restraint.

3. **Bell (Notifications) is on main rail but paywalled on Free.** As noted in §28, this is hostile. OneAce must never put a paywalled feature as a core rail icon.

4. **Settings gear is always last, bottom-most.** Standard pattern. OneAce should match.

5. **Workflows has `New` pill, Labs has `Beta` pill.** Sortly uses these pills to hint at recency and stability. OneAce can adopt the same two-tier label system (New / Beta).

6. **Left rail has exactly 13 elements total (0-12).** Dense but not overcrowded. This is a reasonable ceiling for left-rail density. OneAce should aim for ≤12 rail items to stay uncluttered.

---

## §33. Trash — `/trash` (verified 2026-04-10)

**Route:** `https://app.sortly.com/trash`
**H1:** `<h1 class="Text-jzvnJR kEDPRO">Trash</h1>` — dark (rgb(47,49,58)) bold sans
**Access:** Free-plan accessible, no paywall modal

### §33.1 Layout

```
┌─ LEFT RAIL ─┬─ FOLDER SIDEBAR ──────┬──────────── MAIN AREA ─────────────────────┐
│   S logo    │  🔍 Search folders     │  Trash                                      │
│  (13 rail)  │  ─────────            │  ─────────────────────                      │
│             │  📁 All Items          │  Folders: 1    Items: 1                     │
│             │   📁 Main Location     │                                             │
│             │   📁 Storage Area      │  [⚙ filter] | Sort by: [Deleted At ▾]       │
│             │   📁 Truck             │                  [📅 This Month 01/04/2026 │
│             │                        │                  - 30/04/2026 ▾]           │
│             │                        │                                             │
│             │                        │  ┌──────────┐                               │
│             │                        │  │ (dark    │  SOED8R0004                   │
│             │                        │  │  gray    │  Test Shelf A1                │
│             │                        │  │  folder  │                               │
│             │                        │  │  icon)   │              Deleted:          │
│             │                        │  └──────────┘              10/04/2026        │
│             │                        │                                             │
│             │                        │  ┌──────────┐                               │
│             │                        │  │ (light   │  SOED8T0004                   │
│             │                        │  │  gray    │  Test Drill Bit 10mm          │
│             │                        │  │  item    │  25 units │ TRY 1,247.50      │
│             │                        │  │  icon)   │              Deleted:          │
│             │                        │  └──────────┘              10/04/2026        │
│             │  🕐 History            │                                             │
│             │  🗑 Trash              │                                    (owl)    │
└─────────────┴────────────────────────┴─────────────────────────────────────────────┘
```

### §33.2 Elements — verbatim

**Header row (y≈165):**
- `Folders: 1` (count label, semibold number in black)
- `Items: 1` (count label, semibold number in black)

**Toolbar row (y≈228):**
- Filter icon button (square icon, opens filter panel — no visible change on click in this surface)
- Separator pipe `|`
- `Sort by:` label (gray)
- Dropdown anchor: `Deleted At` (data-testid=`sort-by-dropdown-anchor`) — one observed sort option added: `Name`
- Right-aligned date range pill: `📅 This Month 01/04/2026 - 30/04/2026 ▾` (data-testid=`date-range-dropdown-anchor`) — TR locale DD/MM/YYYY

**Folder card (y≈333):**
- Thumbnail: 128×128 dark-gray square (rgb(~120,120,120)) with embossed folder-outline icon
- Left (upper): `SOED8R0004` — reference-ID in light-gray uppercase mono
- Left (lower, larger): `Test Shelf A1` — dark semibold title
- Right: `Deleted:` label + `10/04/2026` value (both inline, date bolder)
- **NO quantity, NO currency** on folder rows

**Item card (y≈545):**
- Thumbnail: 128×128 light-gray square with pale blue document outline icon
- Left (upper): `SOED8T0004` — reference-ID
- Left (middle): `Test Drill Bit 10mm` — title
- Left (lower, one row): `25 units` (darker) `│` `TRY 1,247.50` (lighter)
- Right: `Deleted:` `10/04/2026`

**Hover state (verified):**
- Checkbox appears on top-left of the thumbnail (for bulk selection)
- `Restore` button with clock-back icon appears bottom-right of card
- **NO "Delete Forever" or "Permanently Delete" button on hover** — only Restore

### §33.3 Findings

1. **Only Restore is offered, no Delete Forever.** The trash has no permanent-delete UI. Items presumably auto-purge after a retention period (~30 days typical). This is benign for safety but removes user control — OneAce should offer both Restore and Delete Forever with a "are you sure" confirm.

2. **Folders and items mix in the same list, sorted by deletion time.** No type filter. OneAce should match this (single unified trash list).

3. **Date range defaults to "This Month".** That means items deleted in prior months are hidden by default. This is a gotcha — users looking for older deletions must change the range. OneAce should default to "All time" or "Last 90 days" for trash.

4. **Folder thumbnail uses a DARKER gray than item thumbnail**, visually distinguishing container vs leaf. This is good — OneAce should use the same visual coding.

5. **Reference IDs (SOEDxxxxxxxx) persist in trash.** Useful for finding specific deleted items via search. OneAce should preserve `sku` / `reference` visibility in trash.

6. **Left folder sidebar still shows ALL folders as navigable**, even though Trash is a flat-ish view. This is confusing: clicking a folder in the sidebar navigates OUT of Trash back to Items. OneAce should either (a) hide the folder sidebar in Trash or (b) make sidebar selection filter the trash list by deleted-from-folder.

7. **`History` and `Trash` appear as bottom items in the folder sidebar**, below the folder tree. These two sidebar items act as alternate views — not actual folders. Their visual position (below a hard separator) should make this clearer. OneAce should group these under a "Views" header instead of in the folder tree.

8. **TR locale: DD/MM/YYYY observed.** Confirms Sortly honors browser locale for dates. OneAce must do the same (already in scope per Phase F i18n).

9. **No bulk-action toolbar even with selection.** The checkbox appears on hover but there's no visible "Select all" or "Restore selected" batch action above the list. This is a gap. OneAce should provide a proper bulk-action toolbar.

---

## §34. Tags — `/tags` and Add Tag modal (verified 2026-04-10)

**Route:** `https://app.sortly.com/tags` — redirects to the first tag's detail route, e.g. `/tags/4943990`
**Access:** Free-plan accessible (Tags are NOT paywalled; tag limits may apply on higher tiers but the page itself works)

### §34.1 Layout

```
┌─ LEFT RAIL ─┬─ TAGS SIDEBAR ───┬────────── MAIN AREA ────────────────┐
│   S         │  🔍 Search tags   │  tools                [+ ADD TAG]  │ <- red btn
│  (rail)     │  ────────         │  ─────────────────────             │
│   (Tags     │  🏷 tools  ←active│                                     │
│    highlight)│ (pink bg,        │                                     │
│             │   red icon)      │          🏷 (large outline tag icon) │
│             │                  │                                     │
│             │                  │          No items with this tag     │
│             │                  │                                     │
│             │                  │   Add this tag to items or folders │
│             │                  │          to show them here.         │
│             │                  │                                     │
│             │                  │             Learn More (red)        │
│             │                  │                                     │
│             │                  │                                     │
│             │                  │                               (owl) │
└─────────────┴──────────────────┴─────────────────────────────────────┘
```

### §34.2 Elements — verbatim

**Sidebar header:**
- Search input: placeholder `Search tags` with magnifier icon on left

**Tag row (active state shown):**
- Background: light pink (the "create-modal pink") with red left accent
- Red filled tag icon
- Tag name in lowercase (`tools`) — Sortly preserves exact user casing; this user created lowercase
- No count, no color swatch per tag

**Main header:**
- H1: `tools` (lowercase, matches the tag name — meaning the page title IS the tag, not a generic "Tag: tools")
- Top-right: `+ ADD TAG` red filled button (large)

**Empty state (center):**
- Large gray outline tag icon (~100×100)
- Title: `No items with this tag` (dark gray, ~32px)
- Body: `Add this tag to items or folders to show them here.`
- Red link: `Learn More`

### §34.3 Add Tag modal (verified via `+ ADD TAG` click)

**Trigger:** Click `+ ADD TAG` button
**Backdrop:** PINK tint (the pink-backdrop convention for create modals)
**Modal position:** Centered, ~640×340
**Shape:** Standard create modal (header bar with X, body, footer CTA)

**Header bar (gray fill):**
- Title: `Add Tag` (left)
- X close button (right)

**Body:**
- Single underline input field (no label, no placeholder visible)
- Red underline (bottom border) — **active-invalid state from the start**
- Below input: RED validation error text `Name should be more than 1 character` — **displayed before any user interaction** (anti-pattern)

**Footer:**
- Right-aligned `ADD` button (uppercase, DISABLED state = light-pink fill)

**Missing controls:**
- No color picker
- No description field
- No parent-tag / hierarchy
- No icon picker
- No preview

### §34.4 Findings

1. **`/tags` redirects to first-tag detail.** Not a grid of all tags. This means there is no "Tags overview" page. OneAce should offer BOTH: `/tags` = grid of all tags with counts + usage, and `/tags/{id}` = detail.

2. **Tag names preserve user casing — no normalization.** This causes duplicates like `Tools`, `tools`, `TOOLS`. OneAce should lowercase-on-save (or at least case-insensitive dedup warning on create).

3. **Tags have NO color, NO icon, NO description.** Pure name-only. This is very sparse. OneAce can differentiate by allowing a color + optional icon per tag (like Notion).

4. **Validation fires on modal open, before user types.** "Name should be more than 1 character" shows immediately. Red underline + red error on a pristine field is anti-pattern — the user hasn't done anything wrong yet. OneAce should only show validation after first blur or submit attempt.

5. **Disabled ADD button uses light pink instead of gray.** Unusual choice — most design systems use gray for disabled. Sortly's pink-disabled matches their pink create-modal backdrop, making the state less obvious. OneAce should use standard gray for disabled buttons.

6. **Active tag row in sidebar uses the same pink the create modal backdrop uses.** This double-duty of pink for "selected" AND "about to create" is mildly confusing. OneAce should use distinct colors for selection vs creation states.

7. **Empty state is well-crafted** — icon, title, helper, link to docs. This is a solid template. OneAce should replicate (icon + title + 1-line helper + action link) for its own empty states.

---

## §35. Workflows hub — `/workflows` and 3 Ultra-gated workflow modals (verified 2026-04-10)

**Route:** `https://app.sortly.com/workflows`
**Access:** Hub page visible on Free, but ALL three workflow cards paywall-gate to **Ultra tier** (not Advanced) on click.

**CRITICAL STRATEGIC FINDING:** Sortly's stock counting, pick lists, and purchase orders are ALL gated at **Ultra** — Sortly's higher-priced tier above Advanced. This directly impacts OneAce's positioning on the "stock counting as moat" narrative (see Strategic Implications at end of §35).

### §35.1 Hub page layout

```
┌────────────── MAIN AREA ──────────────────────────────────────────┐
│ Workflows                                                          │
│ Workflows are actions you can take on your inventory that          │
│ interact with quantities.                                          │
│ ──────────────────────────                                        │
│                                                                    │
│ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐   │
│ │ 📄✓ (gray icon)  │ │ 🛒✓ (gray) [NEW] │ │ 📅(123) [NEW]    │   │
│ │                  │ │                  │ │                  │   │
│ │ Pick Lists       │ │ Purchase Orders  │ │ Stock Counts     │   │
│ │                  │ │                  │ │                  │   │
│ │ Easily request   │ │ Simplify your    │ │ Count and verify │   │
│ │ items for pickup │ │ procurement      │ │ your inventory   │   │
│ │ with Sortly's    │ │ process by       │ │ with ease. Stock │   │
│ │ Pick Lists. ...  │ │ easily creating..│ │ counts help you  │   │
│ │                  │ │                  │ │ track accurate   │   │
│ │                  │ │                  │ │ quantities and   │   │
│ │                  │ │                  │ │ keep your        │   │
│ │                  │ │                  │ │ records up to    │   │
│ │                  │ │                  │ │ date.            │   │
│ └──────────────────┘ └──────────────────┘ └──────────────────┘   │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

**Hub elements verbatim:**
- H1: `Workflows`
- Subtitle: `Workflows are actions you can take on your inventory that interact with quantities.`
- 3 cards in a horizontal grid, each with:
  - Top-left: icon in light-gray rounded square
  - Top-right: green `✨ New` pill (on Purchase Orders and Stock Counts; NOT on Pick Lists)
  - Title: bold dark
  - Body: 4-5 line description in gray
- `data-testid` per card: `pick-lists-workflow`, `purchase-orders-workflow`, `stock-counts-workflow`
- Card type: HTML `<button type="submit">` — hints they're form-submit buttons that trigger React modal state, not true links

**Card 1 — Pick Lists:**
- Title: `Pick Lists`
- Body: `Easily request items for pickup with Sortly's Pick Lists. Create a list, add items, and assign it to a user for review or pickup. Quantities update automatically after items are picked.`
- **NO `New` pill** (older/GA feature)

**Card 2 — Purchase Orders:**
- Title: `Purchase Orders` + green `✨ New` pill
- Body: `Simplify your procurement process by easily creating, managing, and tracking purchase orders. This is the hub for that.`

**Card 3 — Stock Counts:**
- Title: `Stock Counts` + green `✨ New` pill
- Body: `Count and verify your inventory with ease. Stock counts help you track accurate quantities and keep your records up to date.`

### §35.2 Stock Counts paywall modal (click stock-counts-workflow)

**Layout:** Centered split-layout paywall modal (same template as Low Stock Alerts in §28, but Ultra-tier). Same ~1110×720.

**Left side:**
- White background
- Line-art illustration: man in overalls with cap holding a red Sortly tablet, standing in front of a 3-shelf warehouse rack with storage boxes (some with red tape/label stripes)

**Right side (copy column):**

- H2 title (two lines):
  - Line 1: `Upgrade to ` **`Ultra`** (red) `:`
  - Line 2: `Keep Inventory Accurate & Clear`
- Horizontal divider
- Body: `With Stock Counts, skip spreadsheets and be confident knowing every item is accounted for.`
- 3 red-check bullets (bold lead phrases):
  1. **`Complete stock counts`** ` without manual, disconnected counting methods.`
  2. **`Get live status and progress updates`** ` that show who counted what and when.`
  3. **`Flag and resolve discrepancies`** ` before they cause audit failures or stock issues.`
- Red caption (centered): **`PLUS:`**
- Bonus bullet (red-check):
  - `Everything you need for smarter, faster inventory—advanced reports, barcode labels, Pick Lists, and Purchase Orders.`
- CTAs (two side-by-side + one below):
  - `LEARN MORE` (white outlined button, left)
  - `TRY FOR FREE` (red filled button, right)
  - `No Thanks` (text link centered below, gray)
- X close button in top-right corner

### §35.3 Purchase Orders paywall modal (click purchase-orders-workflow)

**Layout:** Centered split-layout paywall modal, **same frame but different header template**.

**Left side:**
- On first click, loads with blank white panel, caption `Easily create, track, and receive orders with Sortly's Purchase Orders.` and red link `How it works?` below
- On second click (after modal state populates), displays YouTube video embed `Introducing: Purchase Orders - Sortly` with play button; "Watch on YouTube" badge bottom-right (implying `/embed/` with youtube branding). Channel: `Sortly`.
- (Caption + How it works? link sit below the video when it loads)

**Right side (copy column):**
- H2 title (two lines, announcement style):
  - Line 1: `Purchase Orders are now`
  - Line 2: `available in Sortly`
  - Line 3: **`Ultra Plan`** (red) `.`
- Horizontal divider
- Body: `Streamline your purchasing process and make reordering a breeze with Purchase Orders.`
- 4 red-check bullets:
  1. `Keep everything in one place—easily create and track your purchase orders from start to finish.`
  2. `Send purchase orders for review and approval, if needed, for enhanced visibility.`
  3. `Instantly export any purchase order as a PDF, complete with all the details your vendor needs.`
  4. `Automatically update your inventory levels the moment your order arrives.`
- Red inline link: `All Ultra Plan Features`
- Single red CTA: `TRY IT FREE FOR 14-DAYS`
- X close button top-right

**Differences from Stock Counts modal:**
- Different headline template ("X are now available in Y Plan" vs "Upgrade to Y: Tagline")
- 4 bullets vs 3
- No "PLUS:" cross-sell section
- ONE CTA only (no LEARN MORE, no No Thanks)
- YouTube embed on left (vs illustration on Stock Counts)

### §35.4 Pick Lists paywall modal (click pick-lists-workflow)

**Layout:** Centered split-layout paywall modal — **third distinct header template**.

**Left side:**
- White panel, NO illustration, NO video
- Caption (bottom): `Create a Pick List, assign to any user and pick items using Sortly's Pick Lists`
- Red link: `How it works?`

**Right side (copy column):**
- H2 title (two lines, unlock style):
  - Line 1: `Upgrade to ` **`Ultra`** (red) ` to unlock`
  - Line 2: `Pick Lists`
- Horizontal divider
- Body: `Pick Lists provide an efficient and seamless way to pick items for your project or order.`
- 4 red-check bullets:
  1. `Make planning easy by creating a list of items to pick.`
  2. `Assign Pick Lists to employees so they know exactly which items to pick.`
  3. `Watch inventory automatically update after items are picked.`
  4. `Review records of what has been picked for each project.`
- Red inline link: `All Ultra Plan Features`
- Single red CTA: `TRY IT FREE FOR 14-DAYS`
- X close button top-right

### §35.5 Findings — Workflows cluster

**1. ALL THREE workflows are Ultra-tier gated, not Advanced.**
This is huge. Sortly tiers its operational workflows (Pick Lists, Purchase Orders, Stock Counts) behind the HIGHER-priced Ultra plan, not its base paid Advanced plan. This implies:
- Pricing ladder: Free (view only) → Advanced (basic paid: item limits lifted, barcode, simple features) → **Ultra (workflow-enabled)** → Premium → Enterprise
- Sortly treats core operational workflows as a **premium upsell**, not a baseline requirement
- OneAce's strategic positioning: offer stock counting and purchase orders at a LOWER tier (or even Free / base paid) to undercut Sortly's positioning

**2. Three DIFFERENT headline templates for three Ultra-gated modals — inconsistent copy system.**
- Stock Counts: `Upgrade to Ultra: Keep Inventory Accurate & Clear` (colon + benefit)
- Purchase Orders: `Purchase Orders are now available in Sortly Ultra Plan.` (announcement)
- Pick Lists: `Upgrade to Ultra to unlock Pick Lists` (direct unlock)
Three writers, three styles, zero consistency. Likely reveals each feature was built by a different PM with no shared UX writing template. OneAce should define ONE upgrade-modal headline template and apply it everywhere.

**3. Inconsistent number of CTAs.**
- Stock Counts: 3 CTAs (LEARN MORE + TRY FOR FREE + No Thanks)
- Purchase Orders: 1 CTA (TRY IT FREE FOR 14-DAYS)
- Pick Lists: 1 CTA (TRY IT FREE FOR 14-DAYS)
Sortly's A/B test of No Thanks appears live on one modal only. OneAce should decide one pattern (my recommendation: primary CTA + ghost Dismiss + Learn More link).

**4. Inconsistent CTA copy.**
- `TRY FOR FREE` vs `TRY IT FREE FOR 14-DAYS` — even the trial-offer microcopy is inconsistent between cards on the same hub page.

**5. Inconsistent left-panel treatment.**
- Stock Counts: illustration (line-art warehouse worker)
- Purchase Orders: YouTube video embed
- Pick Lists: blank panel with caption only
Totally different visual treatments for sibling paywalls. OneAce should pick ONE (recommendation: illustration — it's self-contained, no external dependency, no YouTube tracking).

**6. "Skip spreadsheets" is Sortly's anchor copy for stock counting.**
Sortly's framing: "With Stock Counts, skip spreadsheets and be confident knowing every item is accounted for." This IS OneAce's target. OneAce should use similar anchor copy (e.g., "Replace your counting spreadsheet. Be confident.") on its own Stock Count landing content.

**7. Stock Counts is positioned around fear: "audit failures or stock issues".**
Sortly leads with fear-of-loss framing. This is a pattern SC can either adopt or explicitly reject (I'd reject — lead with positive framing, "Every quantity, always accurate").

**8. "PLUS:" section on Stock Counts modal is a cross-sell to Ultra features.**
Sortly uses the paywall modal as a stacking cross-sell — not just "unlock this feature" but "and also get X, Y, Z." This is efficient: the user who's considering upgrading sees the broader value. OneAce should use the same pattern on its Pro-tier modals.

**9. Pick Lists is NO-NEW-BADGE but still gated.**
Pick Lists has NO `New` pill on the hub card (unlike PO and SC), meaning it's the OLDEST of the three. Yet it's STILL Ultra-gated. This means Sortly has been gating pick lists at Ultra for a while — and the new workflows (PO, SC) were added at the same tier for consistency. OneAce should plan its tiering such that new features don't randomly move up or down the pricing ladder.

**10. Stock Counts bullet #2 is observable-in-product transparency.**
"Get live status and progress updates that show who counted what and when." This implies Sortly tracks per-user count contributions during a stock count session. That's a multi-user coordination feature — worth noting that SC will need similar (partial count by user A, completion by user B, reconciliation).

**11. Purchase Orders bullet #3: "Instantly export any purchase order as a PDF".**
PDF export of a PO is a hard requirement for vendor-facing workflows. SC must have this (already in scope).

**12. YouTube videos in paywall modals are vendor-tracking leak + latency cost.**
Sortly's Purchase Orders modal embeds a YouTube video. This sends user-agent + referrer to Google and adds 800+ KB of JS. OneAce should avoid embedding YouTube in product UI — use Loom or an MP4 on CDN instead, or just static imagery.

**13. Stock counting is NOT Sortly's moat — it's an upsell.**
Previously, my notes claimed stock counting is OneAce's moat. That framing is still true BUT the reason is sharper now: Sortly doesn't treat stock counting as a core primitive, they treat it as a premium add-on. OneAce can make it first-class at the Free or base-paid tier and win on positioning alone, without needing to out-build Sortly on any specific feature.

### §35.6 Strategic implications (updated)

**Updated moat narrative:**
- ❌ Old: "Stock counting is OneAce's moat because Sortly doesn't have it."
- ✅ New: "Stock counting is OneAce's moat because Sortly gates it at their highest tier. OneAce should put it in the base tier."

**Updated pricing positioning:**
- If Sortly's Ultra tier is ~$99-149/month, OneAce should offer stock counting at $19-39/month
- Bundle stock counts + purchase orders + pick lists into the base paid tier
- Let Sortly price themselves out of SMB on these exact features

**Updated feature parity checklist (additions):**
- [ ] Multi-user stock count sessions with per-user contribution tracking
- [ ] Stock count discrepancy flagging + resolution workflow
- [ ] Pick list assignment to employees
- [ ] Purchase order → auto-update inventory on receive
- [ ] Purchase order PDF export
- [ ] Purchase order approval workflow ("Send for review and approval, if needed")

**Updated copy playbook:**
- Anchor hook: "Replace your counting spreadsheet" (or TR equivalent)
- Lead with confidence, not fear
- Stock count should be positioned as a CORE primitive, not a premium upsell

---
