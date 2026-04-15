# inFlow Inventory — Live App Captures

**Purpose:** verbatim copy, layout, and interaction captures from a live walkthrough of `app.inflowinventory.com` on a fresh trial account. Sister file to `sortly-captures.md`. This file is the raw working notebook; distilled analysis lives in `inflow-inventory-teardown.md` and specs live in `inflow-figma-blueprint.md`.

**Walkthrough start:** 2026-04-10
**Account:** Fresh trial signup (no existing data)
**Locale:** Turkey / TRY / DD/MM/YYYY (matches Sortly teardown for apples-to-apples comparison)
**Scope:** full CRUD — will create, edit, and delete test data to verify every workflow
**Screenshot archive:** `./inflow-screenshots/`

---

## Section index

- §1. Onboarding funnel (initial-questions sequence)
- §2. Main app chrome (header, sidebar, footer, notifications)
- §3. Dashboard
- §4. Products / Items
- §5. Stock Counts
- §6. Sales Orders
- §7. Purchase Orders
- §8. Customers / Vendors
- §9. Reports
- §10. Settings cluster
- §11. Showroom (B2B portal)
- §12. Manufacturing
- §13. Integrations
- §14. Pricing / Upgrade
- §15. Paywall modal catalogue
- §16. Miscellaneous / Labs / Help

---

## §1. Onboarding funnel (`/initial-questions?step=*`)

### §1.0 Tech footprint and shell

- **URL pattern:** `/initial-questions?step={stepName}` — step names are readable query params, meaning deep-linking between steps is possible (pending auth/validation).
- **Viewport tested:** 1512×771. Page docSize equals viewport exactly — onboarding is fixed-height, no scrollable body.
- **Framework detection:** not Next, not Nuxt, not React (no `[data-reactroot]`), not Angular. Likely Vue or a custom framework. 21 scripts total, 11 stylesheets.
- **history.length = 6** at the point of first capture — meaning there are **5 prior steps** before `industry-setup`.
- **Claude in Chrome floating chip** is present on the page (`Claude is active in this tab group`) with Open Chat / Dismiss buttons — noted but not part of inFlow's own chrome.

### §1.1 `step=industry-setup` — "Let's get to know you"

**H1:** `Let's get to know you`
**Subhead:** `Select the industry that best describes your business.`

**Chrome on this step:**
- Top-left: **Back** icon button (ref_3 with generic name "Back") — appears to be a simple chevron-left, no text label.
- Top-center: **inFlow logo** (yellow-accent plus icon + wordmark `inFlow`), centered at page top.
- Top-right: **User dropdown** showing the logged-in email as a label (rendered here as `mahmut seker` — the account display name). Clicking exposes a menu (not yet opened — will capture separately).

**Main content (centered column ~600px wide):**
- H1 (bold, dark, ~40–48px): *"Let's get to know you"*
- Subhead (body, ~16px): *"Select the industry that best describes your business."*
- 8 row-style option cards stacked vertically (each full column width, ~48px tall):

| # | Label (verbatim) | Icon (right-aligned) |
|---|---|---|
| 1 | Wholesale or distribution | box truck |
| 2 | Ecommerce | shopping cart |
| 3 | Construction or jobsites | traffic cone |
| 4 | Retail | shopfront |
| 5 | Office supplies or internal inventory | clipboard |
| 6 | Equipment or asset tracking | package with checkmark |
| 7 | A consultant evaluating inFlow | person/operator silhouette |
| 8 | Other | paper airplane |

- **Option row spec:** each row is a rounded-rect button with a left-side checkbox (empty square, ~16px), the label text at body weight, and a monochrome line-art icon at the right. Rows have a subtle shadow/border, consistent padding ~16px. Selected state not yet tested.
- **CTA:** `Continue` button — full-width within the content column, dark/black fill, white text, centered below the list. Disabled state not confirmed yet (we'll test whether Continue enables only after a selection).

**Decorative background:**
- Light cream/off-white full-bleed background.
- Illustrated decorative vignettes at the edges (left: shipping container + barcode + lock glyphs; right: paper-airplane trajectory + dollar bill + X-stamp) rendered in a light warm palette. Decorations are pinned to page edges and do not interact with the content column.

**Accessibility tree node of interest:** a `generic "archetype" [ref_43]` element appears at the bottom of the tree — this is likely a hidden semantic hint for the selection type (multi-archetype picker), suggesting inFlow uses "archetype" internally as the data model name for industry choice.

**Screenshot:** inline capture `ss_8890l5vgg` (1512×771 jpeg).

### §1.2 `step=industry-setup` — selected state

After clicking row #1 (`Wholesale or distribution`):

- **Selection styling:** the chosen row gets a cream/beige fill (warmer than default white), and the left checkbox switches from empty square to a filled rounded checkbox in inFlow's signature **orange** (~#F5A623).
- **Selection model:** single-select. Clicking a different row clears the previous one — confirmed by clicking row #2 then back to row #1.
- **Continue button:** transitions from disabled-grey to active. Color in active state is the same orange-fill rounded button used elsewhere in the funnel, with white text.
- **Back button:** the chevron-only Back ref reveals a text label "Back" in this state (or it was always there but harder to spot in the empty state).

**Persistence test:** navigating away (to a different `step=`) and back via browser history preserves the selection — meaning step state lives server-side or in a long-lived client store.

---

### §1.3 `step=demo-booking` — "Would you like to book a custom demo?"

**URL:** `/initial-questions?step=demo-booking`

**Chrome:** identical to §1.1 — same logo, same Back text button (now visible), same user dropdown.

**H1:** `Would you like to book a custom demo?`

**Layout:** two-column card centered on the page, each column ~440px wide with ~32px gap.

**Left column — "Speak to an inventory expert for free":**

Numbered list (1, 2, 3) with the following verbatim copy:

1. *Book a 10-minute call to find out if inFlow is right for your business.*
2. *If we're a good fit, we'll schedule a 45-minute demo tailored to your workflow.*
3. *When you subscribe, you'll get a **free USB scanner** or **$100 USD** towards any hardware, just for booking a call.*

(Bolded fragments are bold in the source — "free USB scanner" and "$100 USD".)

Beneath the bullets is a photo of two team members with a yellow speech bubble that reads `Hi! Let's chat.`

**Right column — calendar widget:**

- Header band: orange fill, white text reading `Is inFlow right for you?` and `April 2026`
- Mini calendar grid Mon–Sun, with weekday cells enabled (clickable, dark text) and weekend cells disabled (grey, non-interactive). The current week shows two greyed-out leading days for the prior month.
- No specific time-slot picker is visible at this stage — selecting a date presumably reveals slots downstream (not yet tested in this capture; will test on a second pass).

**Footer link:** below the two-column card, centered, body-text grey: `Skip this step` — clickable, advances to `/initial-tour` without booking a call.

**Behavioral note:** clicking `Skip this step` immediately transitions to the iframe-based tour (see §1.4). There's no "Are you sure?" confirmation modal — Skip is fire-and-forget.

---

### §1.4 `/initial-tour` — interstitial loading screen with rotating slides

**URL:** `/initial-tour` (note: no `step=` query param — this is a distinct route from `/initial-questions`)

**CRITICAL ARCHITECTURE FINDING:** The entire `/initial-tour` page renders an `<iframe>` whose `src` points to `https://www.inflowinventory.com/onboarding...` — a **different origin** (the marketing site) than `app.inflowinventory.com` (the application). This has multiple consequences:

1. JavaScript text search via `window.find` and DOM queries across the boundary return empty.
2. `iframe.contentDocument` access throws / returns null due to same-origin policy.
3. `postMessage` handshakes attempted with various event names (`startTrial`, `done`, `complete`, `finished`, `tour-complete`) had no observable effect — the marketing-site frame either ignores them or expects a signed payload.
4. Click coordinate dispatch into the iframe is partially flaky — the floating "Claude in Chrome" overlay chip occluded the trial CTA on first attempts, and subsequent clicks landed on the embedded video player instead of the button.

**Chrome on this step:**
- **User dropdown** in the top-right swaps from showing the display name (`mahmut seker`) to showing the **actual login email** `mahmutseker@yandex.com`. This is the first surface where the verified email is exposed in the UI.
- The inFlow logo in the top-center remains.

**Headline (rendered by the parent app, NOT inside the iframe):**

H1: `One moment, please`
Sub: `We're creating a sample company so you can try inFlow with sample data.`

**Rotating content card (inside the iframe):**

A large rounded cream/off-white card (~640×420px) cycles through 4 slides automatically. Slides advance on a timer (~6–8 seconds per slide observed; not user-controllable — no dot indicators or arrows visible).

**Slide 1 — "Say goodbye to manual spreadsheets"**

- Title: `Say goodbye to manual spreadsheets`
- Visual: a mock spreadsheet with the following column headers (truncated as inFlow displays them):
  `ProductName | SKU | Category | ItemType | Description | Unit Price | LastVendor | VendorProductCo | VendorPri | BarCo`
- Sample rows include plumbing items (e.g., a 45-degree elbow in copper), an espresso/coffee item, hardware (`Hammer Drill SDS`), a cleaning item, and `Mop` entries — clearly mocked-up data that maps to the post-tour sample company.

**Slide 2 — "Purchase, manage, and sell inventory from your smartphone, too"**

- Title: `Purchase, manage, and sell inventory from your smartphone, too`
- Visual: 3 stacked phone mockups showing:
  - A purchase order detail screen `PO-000045`
  - A product detail screen `45 Elbow SJ - Copper` with a product image
  - A sales order detail screen `SO-000008`

**Slide 3 — Product list + detail**

- A desktop product-list mockup with a side detail panel
- Detail panel displays a sample product: `3/4" 45 Elbow SJ - Copper`, SKU `BC-026`, category `Plumbing`, dimensions `10cm × 10cm × 16g`, brand `Copper Plus`, country `USA`
- Locations table breakdown: `Eastern Warehouse 107`, `Site 11 12`, `Toronto Branch 13`, `Truck 34 15`, `Western Warehouse 35`
- `Quantity on hand: 182` and pricing scheme `MSRP $3.75`
- **Implication for our data model work:** inFlow's sample product carries (a) location-keyed quantities, (b) a brand attribute, (c) a country-of-origin attribute, (d) per-pricing-scheme prices, (e) photo + dimensions/weight. This is a strong signal of which fields are first-class on the Product entity.

**Slide 4 — Embedded video**

- Auto-playing 40-second video (we observed it run from 0:00 to 0:40)
- Final frame text: `We hope you enjoy using inFlow Inventory!`
- The video element's hit area extended down to ~y=735, which is why click attempts in that zone hit the video player rather than the button below it.

**CTA (rendered by the parent app, below the iframe):**

`Start your free 14-day trial` — yellow-fill rounded button (inFlow's signature trial-CTA color), white text. Disabled (grey) until the sample company is provisioned, then becomes interactive.

#### §1.4.1 BYPASS / BUG FINDING — viewport resize advances the funnel

While debugging click-into-iframe issues, **resizing the browser window from 1512×771 to 1512×1100 caused the entire onboarding gate to disappear**, dropping the user directly into `/homepage` without ever clicking the trial CTA.

Reproduction:
1. Land on `/initial-tour` (CTA still disabled, showing slide 4 video)
2. Resize the browser window vertically (any meaningful delta seems to trigger it)
3. inFlow does NOT re-render the iframe — instead the parent route resolves to `/homepage` and the authenticated app shell appears

Hypothesis: inFlow's onboarding wrapper component is mounted with a viewport-bound visibility guard. On resize, the component unmounts and the router falls through to the next gate, which by then has already received the "sample company ready" signal from the backend and has no reason to re-show the iframe.

**Why this matters for our analysis:**
- It's a non-trivial UX bug — any user with a tiling window manager, a docked second monitor, or who maximizes their browser mid-tour can skip the trial CTA entirely.
- It also sidesteps inFlow's trial-acknowledgment telemetry — we never clicked "Start your free 14-day trial", yet the trial counter ("14 days left") is now active in the header.
- For OneAce we should NOT replicate this — onboarding completion should be event-driven, not viewport-conditional.

**Screenshots:** `ss_9726rbvjr` (post-bypass /homepage capture, 1512×700 jpeg).

---

## §2. Main app chrome (header, sidebar, footer, notifications)

Captured from `/homepage` after the bypass landed us in the authenticated shell.

### §2.1 Left sidebar (navigation rail)

**Width:** ~80px (icon-only, no text labels visible by default — labels likely appear on hover or in an expanded variant we haven't tested yet).

**Background:** dark navy (~#1A2333 — to be color-picked precisely).

**Icons in vertical order from top to bottom:**

| # | Icon (visual) | Hypothesized destination |
|---|---|---|
| 1 | inFlow `+` mark logo (yellow accent) | Home / brand mark |
| 2 | Yellow-fill **+ plus** button (squared) | "Create new" quick-action menu |
| 3 | Dollar sign `$` | Sales (orders, invoices, customers) |
| 4 | Open box | Products / Inventory |
| 5 | Clipboard with check | Stock counts / tasks |
| 6 | Bar chart | Reports |
| 7 | Storefront / shopfront | Showroom (B2B portal) |
| 8 | 3×3 grid | Integrations / app catalog |
| 9 | Gear cog | Settings |

**Spacing:** consistent ~16px vertical padding between icons; the `+` quick-action button is visually grouped tight under the logo (suggesting it's a primary action, not a navigation item).

### §2.2 Top header bar

**Height:** ~56px. **Background:** white. **Bottom border:** thin grey hairline.

**Left section:**
- **Page title** in dark text, e.g. `Homepage (Sample)` — the `(Sample)` suffix indicates trial accounts are using inFlow's seeded sample company.

**Right section (right-to-left order as rendered):**
- **`MS` user avatar** — orange-filled circle with initials, ~32px diameter
- **`?` help icon** — light grey circle button
- **`Subscribe now ✨` pill** — gradient (orange→pink) rounded pill with sparkle emoji, white text. This is inFlow's persistent upgrade CTA.
- **`14 days left` pill** — light cream pill with dark text, communicates remaining trial days. Adjacent to Subscribe pill.

### §2.3 Sample-data banner (footer-style notification)

A persistent **red bottom banner** that spans the full width of the content area:

> 🎯 You're viewing sample data. When you're ready, try inFlow with your own data.

The phrase "try inFlow with your own data" is rendered as a link (white underlined text). Clicking it presumably transitions the workspace from the sample company to a fresh empty company — to be tested in §16.

---

## §3. Dashboard (`/homepage`)

### §3.1 Page title and greeting

- Page title (in header bar): `Homepage (Sample)`
- **Greeting block** (centered above content, ~32px font):
  - `Good afternoon, mahmut seker` (auto-formatted name, time-of-day-aware)
  - Subtitle: `How flows your inventory?` (inFlow brand pun)

### §3.2 Location selector chip

Below the greeting, a small rounded chip with:
- 📍 pin icon
- Label: `Eastern Warehouse`
- Chevron-down indicator

This is a **global location filter** — clicking it presumably opens a location picker that scopes all dashboard widgets. On the sample company, locations are `Eastern Warehouse`, `Site 11`, `Toronto Branch`, `Truck 34`, `Western Warehouse` (inferred from §1.4 slide 3).

### §3.3 "Get advice from an inventory expert" nudge card

A wide yellow-tinted card (~640×200px), dismissable (small `×` in the top-right corner).

**Visual:** photo of two women with a yellow speech bubble reading `hi!`

**Body text (verbatim):**

> Our team has discussed workflows with thousands of businesses. We'll help you figure out if inFlow is a good fit, or if you should check out a competitor instead. All in ten minutes or less.

**CTA button:** `Sure, let's chat` — yellow-fill rounded button, dark text.

**Pattern note:** this is the second sales-call CTA in the funnel (first was §1.3 demo-booking, which we skipped). inFlow is aggressive about routing trial users into a human conversation. This is a recurring competitive pattern — Sortly does NOT do this; their nudges are educational/feature-focused, not sales-call-focused. **Implication for OneAce:** the choice of nudge style telegraphs go-to-market posture (PLG vs sales-led).

### §3.4 "Total sales revenue" widget

- Header: `Total sales revenue` (left), `[last 30 days ▼]` filter dropdown (right)
- Big number: `$4,490.00`
- Bar chart below — green bars on a date axis (likely daily buckets), Y-axis labeled in dollars up to ~$600
- All values come from the sample-data company

### §3.5 "Products to reorder" widget

- Header: `16 Products to reorder` with a small refresh icon
- Two-line breakdown beneath the count:
  - `12 to purchase` (clipboard icon)
  - `4 to transfer` (transfer/swap icon)
- A scrollable item list begins below, first row showing `12" Wok - Non-Stick / 3110005` (product name / SKU pattern)

This widget surfaces inFlow's reorder intelligence. Two distinct fulfillment paths (purchase vs transfer) are first-class — meaning inFlow's reorder logic considers multi-location stock balancing, not just supplier reordering. This is a meaningful differentiator vs Sortly, which only has a single "low stock" alert without distinguishing transfer-from-other-location vs purchase-from-vendor.

---

## §4. Products / Items module (`/products`)

### §4.1 List view layout

URL: `/products` (resolves to a master-detail layout with no item selected by default — falls through to the first item alphabetically when one is opened).

**Page title:** `Products (Sample)` (the `(Sample)` suffix is shared with all sample-company pages)

**Top-right page actions** (right of the standard chrome):
- `🐙 Get started` — link with octopus emoji, opens the onboarding checklist (likely a slide-over or panel — to be tested in §16)

**Toolbar (filter row, immediately below the page title):**

| Position | Element | Type |
|---|---|---|
| L1 | Search icon (magnifier) — collapsed search input | icon button |
| L2 | `≡ All filters` | button (opens filter sheet) |
| L3 | `📍 Location` | filter pill |
| L4 | `📦 Product type` | filter pill |
| L5 | `≡ Category` | filter pill |
| L6 | `[#] Quantity range` | filter pill |
| L7 | `\|\|\|\| Barcode` | filter pill |
| R1 | `○ Show variants` | toggle switch with grey label |
| R2 | `+ New` | secondary button (rounded, white fill, dark border) |
| R3 | `Reorder` | **primary button — yellow fill, dark text** (this is the most prominent CTA on the page) |

**Notable:** the `Reorder` button is more visually weighted than `+ New`, which signals inFlow's product positioning — it's an inventory **management** tool, not just a catalog tool. Adding new SKUs is a setup activity; running reorder cycles is the daily job. Sortly inverts this — `+ Add Item` is its hero CTA.

**Table columns (verbatim):**

| # | Column header | Notes |
|---|---|---|
| 0 | 🔧 (wrench icon) | Column customization affordance — clickable, opens column picker (to be tested) |
| 1 | `Product` ▲ | Sort indicator visible — sorted ascending by default. Cell content: thumbnail image + product name + SKU subtitle |
| 2 | `Category` | Cell content: category name in a rounded pill with `≡` icon prefix |
| 3 | `SKU` | Right-aligned numeric-string |
| 4 | `Quantity on hand` | Cell content: quantity in a grey rounded pill + unit-of-measure abbreviation (EA, FOOT, METER, PCS) |
| 5 | `Normal Price` | Right-aligned currency |

**Sample row data (first 10 rows captured verbatim):**

| Product | Category | SKU | Qty | Price |
|---|---|---|---|---|
| 12" Wok - Non-Stick / 3110005 | Pans | 3110005 | 36 EA | $120.00 |
| 12/2 - 250' Armored Copper Spool / 3003916 | Electrical | 3003916 | 1,203 FOOT | $2.02 |
| 12000 BTU Window Air Conditioner / 3200030 | Air Conditioner | 3200030 | 7 | $299.00 |
| 14" Laptop **(2)** / 3200016 | Wholesale | 3200016 | 44 | $400.00 |
| 14/3 - 150 M - Copper Wire - Black / 3003917 | Electrical | 3003917 | 753 METER | $2.00 |
| 16" Laptop - 512GB / 3200018 | Computers (Serialized) | 3200018 | 18 | $600.00 |
| 1"x1"x3/4" Tee - Copper / 3001679 | Plumbing | 3001679 | 4 PCS | $4.25 |
| 3/4" #52 Clevis Hanger / 3001636 | Plumbing | 3001636 | 361 EA | $2.25 |
| 3/4" 45 Elbow SJ - Copper / 3001669 | Plumbing | 3001669 | 151 PCS | $2.50 |
| 3/4" 90 Elbow SJ - Copper / 3001673 | Plumbing | 3001673 | 202 EA | $3.75 |

**Findings from row data alone:**

1. **The `(2)` badge next to "14" Laptop"** is a variant count — variant grouping is first-class. Click-through behavior: opens a parent product with 2 variants nested. (To be tested in §4.4.)
2. **Multiple units of measure** present: `EA`, `FOOT`, `METER`, `PCS` — UoM is per-product, not per-account-default. Combined with the §4.2 "1 spool = 250 foot" finding, inFlow models **packaging unit conversions** — a single product can have a base unit (foot), a purchase unit (spool of 250 ft), and a sales unit (each).
3. **Category `Computers (Serialized)`** — the parenthetical suffix is a strong hint that **serial-number tracking is a category-level feature flag**, not a product-level one. Categories carry behavior, not just labels.
4. **Some SKUs are missing UoM badges** (12000 BTU, 14" Laptop, 16" Laptop) — these are "each" by default but the badge is suppressed. UoM display is conditional on non-default values.

### §4.2 Product detail layout (master-detail mode)

Clicking any row opens a master-detail view: **product list compresses into a left rail** (~280px wide), **detail panel expands to fill the rest of the viewport**.

URL pattern: `/products/{uuid}` — e.g. `/products/f98b9f7f-e79a-49ed-b9e4-c71832bc04cc`. UUIDs (not numeric IDs) — meaning records are likely created client-side and synced, or the backend uses UUID PKs. Either way, no `id=42` style URLs anywhere.

**Left rail (compressed list):**

- Header: search icon, `≡ Filters` button, `+` (new product) button
- Sort header: `Product ▲` (compressed)
- Each row: thumbnail (~48px) + product name + SKU (truncated at 1 line each)
- Selected row gets a vertical orange bar on its left edge + light cream background
- The `(2)` variant count badge persists in this compressed view

**Detail header bar (sticky across scroll):**

| Element | Position | Notes |
|---|---|---|
| `×` close icon | Top-left | Returns to full-width list view |
| Product thumbnail | Top-left, after × | ~32px small thumbnail |
| Product name | Top-left, large | Used as the in-page H1 |
| `🚫 Deactivate` | Top-right | **Red text** — primary destructive action surfaced inline |
| `📎 Attachments` | Top-right | File attachments to this product |
| `📋 Copy` | Top-right | Duplicate this product |
| `+ Sell` | Top-right | Quick-create a sales order pre-filled with this product |
| `🖨 Print labels` | Top-right | Open the label printer flow for this product |
| `··· More ▼` | Top-right | Overflow menu (to be expanded next) |

**KEY UX FINDING:** the destructive action `Deactivate` is **always visible inline**, not buried in a `··· More` menu. inFlow has chosen to make deactivation a one-click reach, which speeds up cleanup workflows but also raises the accidental-deactivation surface area. (Confirmation modal expected — to be tested.)

**Master detail tabs (sticky):**

| Tab | State |
|---|---|
| `📦 Overview` | Selected by default — pill style with dark navy fill + white text |
| `👤 Product vendors` | Tab |
| `🕐 Order history` | Tab |
| `📋 Movement history` | Tab |

The **Overview** tab shows the editable product fields. **Product vendors** is the supplier-side view (who sells this to us, at what price, with what vendor SKU). **Order history** is the transactional log (POs and SOs that touched this product). **Movement history** is the inventory ledger (every increment/decrement with timestamp + user + reason).

This four-tab split is a strong signal of inFlow's data model: products are linked to **vendors (M:N)**, **order documents (transaction events)**, and **movement events (ledger entries)**. Three different relationship types, each with its own tab.

### §4.3 Overview tab — full field inventory

This is the meat of the product detail. Verbatim copy follows:

**Product image area (left, ~280×280):**
- Square frame, light cream background
- Image carousel with index indicator `1` in bottom-left (so multiple images supported)
- (Multi-image upload + drag-reorder presumed — to be tested)

**Identity row (immediately right of image, top):**
- H1: `12/2 - 250' Armored Copper Spool` (large blue text, ~32px)

**Identity fields panel (left half of right area):**

| Icon | Field | Value | Notes |
|---|---|---|---|
| 𝐒𝐊𝐔 | SKU | `3003916` | Editable text |
| ≡ | Category | `Electrical` ▼ | Dropdown — opens category picker |
| \|\|\|\| | Barcode | `0487080000975` | Editable text |
| 📐 | Dimensions / weight | `20cm × 15cm × 15cm \| 50g` | Single field with `\|` separator |
| $ | Base unit | `1 foot = 1 foot` | Self-referential — base UoM |
| 📦 | Alternate unit | `1 spool = 250 foot` | **Packaging conversion** |
| ✏ | `Edit` link | — | Opens UoM editor for this product |

**HUGE FINDING — Packaging unit conversions:**
inFlow models **multi-level UoM** per product. A single SKU can have:
- A base unit (e.g. `foot`)
- An alternate unit with a conversion ratio (e.g. `1 spool = 250 foot`)
- And presumably more (`1 case = 10 spool`, etc — to be tested via the Edit link)

This means quantity-on-hand can be displayed in multiple units, purchase orders can be placed in spools while inventory is tracked in feet, and sales orders can sell by the foot. **Sortly does NOT have this.** OneAce currently does not either — this is a key gap to consider.

**Description block (right half of right area, top):**

> Constructed with soft-drawn copper, Type THHN/THWN conductors rated 90 degree C dry available in sizes 14 AWG through 2 AWG and a green insulated grounding conductor. The conductors are cabled together and a binder tape bearing the print legend is wrapped around the assembly. Aluminum interlocking armor is...

(Truncated in viewport — scrollbar visible.)

The description is **a first-class field on the product**, separate from `Remarks` (which appears below the page). So:
- **Description** = customer-facing, appears on documents (invoices, POs, B2B catalog)
- **Remarks** = internal-only notes

**Custom attributes panel (right half of right area, below description):**

| Field | Value | Field type |
|---|---|---|
| `Brand` | `The Wire Co` | Text |
| `Color` | `Gray` | Text |
| `WHMIS #` | `Enter data` (empty) | Text |
| `Scent` | `Enter data ▼` | **Dropdown** |
| `Capacity` | `Enter data` | Text |
| `Country of Ori...` (Origin) | `India ▼` | **Dropdown** |
| `Material` | `Copper` | Text |
| `Amps` | `60` | Number |
| `Warranty expi...` (expiry) | `MMM DD, YYY` (placeholder) | **Date** |
| `QA Passed?` | ☐ (checkbox) | **Boolean** |

Below the panel: `⚙ Manage` — link to manage custom field schema (likely opens the settings page for product custom fields).

**FINDINGS — Custom fields:**

1. **Five field types observed:** Text, Dropdown, Number, Date, Boolean. (Likely also: Email, URL, Currency, File — to be confirmed.)
2. **`WHMIS #`** = Workplace Hazardous Materials Information System — a Canadian regulatory ID. The fact that this is a sample-company default field tells us inFlow ships with **industry-specific custom field templates**.
3. **Field names truncate at ~14 characters** (`Country of Ori...`, `Warranty expi...`) — the panel has fixed column widths.
4. **Custom fields panel is right-half of the page** (not at the bottom), making them as visually prominent as identity fields. inFlow treats custom fields as **first-class**, not as an afterthought.

**Customs info expander:**
Below the custom fields panel: `+ Customs info` — collapsible. Likely contains HS code, country of origin (for shipping, distinct from manufacturing origin), tariff classification, etc. (To be tested via expansion.)

### §4.4 Quantity tile (large left widget below tabs)

The tile we encountered during the §4.5 feature tour, viewed without the tour overlay:

**Header row:**
- Label: `Quantity`
- Toggle pill: `on hand ↔` (dark navy, click to switch to `available ↔`)
- Suffix: `for all locations`
- Right side: a small `▶` play button — likely "play through location quantities" tour, or could be an animation control (untested)

**Big number:** `1,203 foot` (font ~48px, unit `foot` in smaller weight)

**Action link, top right:** `≡ View breakdown` — opens a per-quantity-type modal with: on-hand, available, reserved, on-order, in-transit (per the §1.4.4 tour finding).

**Search field:** `🔍 Search locations` — placeholder, full-width input

**Location bars (horizontal stacked-bar list):**

| Qty | Location |
|---|---|
| 501 | Eastern Warehouse |
| 451 | Western Warehouse |
| 251 | Site 11 (Eastern) |

Each row is a horizontal blue progress bar, with the number left of the bar and the location name above the bar.

**Below the bars:** `Show more locations ▼` — expander to reveal additional locations (Toronto Branch, Truck 34, etc — inferred from §1.4 slide 3).

The tile has the affordance that **clicking any individual bar drills into a per-location detail panel** (per tour step 3 of 4). To be tested.

### §4.5 Pricing & Cost panel (right widget below tabs)

**Header:**
- Label: `Pricing & Cost`
- Right side: `⚪ Advanced` toggle (orange when on, currently ON)

**Pricing schemes table:**

| Pricing Scheme | Markup | Sales Price |
|---|---|---|
| Normal Price | `400.00%` | `$2.02` |
| CAD Price | `132.25%` | `CAD 1.30` |
| Cost/Employee | `0.00%` | `$0.40` |
| Employee/Project | `0%` | `$0.00` (greyed) |

Each row has TWO toggle buttons: `% / $` — switches between markup-percentage entry vs absolute-price entry. The currently-active mode is highlighted dark navy.

Below the visible 4 rows: `Show all ▼` expander.

Below the schemes: `Cost ⓘ` field with value `$0.40484` — **note the 5-decimal precision** for cost (vs 2 decimals for sales prices).

**Findings from the read_page accessibility tree:**

The interactive elements include 11 distinct currency input fields with placeholders such as:
- `–` (empty)
- `CAD 0.00`
- `$0.00`
- `0.00 EUR`

This tells us **inFlow supports multi-currency pricing schemes**, with EUR, USD, and CAD all configurable on the same product. There's also a `+ Add pricing scheme` link — schemes are user-definable (you can create `Wholesale Tier 2` etc).

**Pricing data model implication:** the Product entity has a 1:N relationship with `ProductPrice`, where each `ProductPrice` carries `(scheme_name, currency, mode='markup'|'absolute', value)`. Cost is a single field on Product (the moving-average or FIFO cost), while sales prices are derived per scheme.

### §4.6 Remarks (bottom)

A simple section at the very bottom of the page:

```
Remarks
+ Add remarks
```

Single text area, no rich formatting visible. Internal-only notes (vs Description which is customer-facing).

### §4.7 Feature tour modal — "NEW: Quantity tile for all locations"

A first-time-visit 4-step Intercom-style product tour fires when first opening any product detail page. Captured in full:

**Step 1 of 4 — `NEW: Quantity tile for all locations`**

> Our updated quantity tile shows you where you have the most stock and where you're running low.

Visual: a sample quantity tile showing:
- Title: `Quantity` `on hand ↔` `for all locations`
- Big number: `150 ea`
- Search field: `🔍 Search locations`
- Stacked bars:
  - `80 Montreal`
  - `70 Vancouver`
  - `0 Barrie` + label `🔄 Waiting on vendor`
  - `-20 Toronto` + label `❗ Negative stock`
- Footer link: `View quantity breakdown`

**Findings hidden inside the tour visual:**
- **Negative stock is allowed** (Toronto: -20). inFlow does not block transactions that drive a location below zero — it surfaces a `Negative stock` warning label instead.
- **`Waiting on vendor` is a per-location quantity status label** — derived from the existence of an open PO for that location.
- These labels are **presence-based** (only render when applicable), not always-visible columns.

Bottom: `1 of 4` `Next →`

**Step 2 of 4 — `Choose how to view your stock levels`**

> Just click to toggle between viewing quantity on hand or quantity available across all locations.

Pointer arrow points at the `on hand ↔` toggle pill. So `on hand` and `available` are the two top-level views, with `available` = `on hand - reserved`.

Bottom: `← Back` `2 of 4` `Next →`

**Step 3 of 4 — `View quantity details per location`**

> Click into any quantity bar to view details–like quantity breakdown, reorder settings–at that location.

Pointer arrow points at the location bar list. Confirms that **reorder settings are per-product-per-location** — each location has its own reorder point and recommended order quantity. (Not a single global reorder point per product.)

Bottom: `← Back` `3 of 4` `Next →`

**Step 4 of 4 — `Quantity breakdown`**

> Click here to view a breakdown of all quantity types for all locations.

Pointer arrow points at the `View breakdown` link.

Bottom: `← Back` `4 of 4` `Finish ✓`

**Tour mechanics:** the modal has a fixed white card with rounded corners, a small `×` close button top-right, sequential `← Back` / `Next →` / `Finish ✓` controls, and a centered `N of 4` indicator. The tour overlay dims the rest of the page with a translucent dark backdrop and **highlights the targeted element with a cutout** that lets the underlying page show through at full opacity.

This pattern is consistent with Intercom Product Tours, Pendo, or a homegrown clone — but inFlow is built with styled-components, so likely homegrown.

---

## §4.8 Serialized product detail — `16" Laptop - 512GB`

After dismissing the feature tour on the simple product, I clicked the row `16" Laptop - 512GB` (SKU `3200018`) in the left product list. URL becomes `/products/{another-uuid}`. The Overview layout is **structurally identical** to the simple product detail captured in §4.3 — same hero, same Quantity tile, same Pricing & Cost panel, same Custom Fields panel, same Remarks. The differences are signaled at the **category** level and inside individual fields:

- **Category** field on the hero card reads: `Computers (Serialized)` — a parenthetical category-name suffix.
- The `Capacity` custom field is repurposed from a generic "capacity" string to `512 GB` (the storage size), demonstrating that custom fields are reused across product types and the meaning is contextual to the category.
- **No serial number panel** is visible in the Overview tab on a freshly loaded detail page — serial inventory is presumably surfaced under a different tab (likely Movement history) or via a per-location quantity drill-down. The Overview tab does **not** add a "Serials" section.
- The action bar is unchanged: `Deactivate` (red), `📎 Attachments`, `📋 Copy`, `🛒 Sell`, `🏷 Print labels`, `More ▼`.

**KEY FINDING:** inFlow's "serialized" flag is encoded as a **category-level setting**, not a per-product toggle. Categories named e.g. `Computers (Serialized)` cause member products to behave as serial-tracked. The `(Serialized)` text in the category name is the human-readable indicator of that flag.

**Implication for OneAce:** OneAce's product type metadata can be modeled at either the product or category level. inFlow's category-as-type approach has the advantage of bulk consistency (all members of a serialized category behave the same) but the disadvantage of poor flexibility (you cannot have a non-serialized "Computers" alongside a serialized one without two categories).

---

## §4.9 Variant parent product detail — `14" Laptop` (group)

I clicked the `14" Laptop` row in the product list (the row with a small `2` badge next to its name, indicating it has 2 child variants). URL becomes `/products/1182c9ea-1e22-4f92-b4a9-3b34a2b2cd67`.

The variant parent layout is **fundamentally different** from the simple/serialized product detail:

### §4.9.1 Action bar (top-right of detail pane)

```
🚫 Deactivate group & products       🏷 Print labels
```

Only **two** buttons. There is no `Attachments`, no `Copy`, no `Sell`, and no `More ▼` overflow. This means:
- You cannot attach files to a variant parent (only to individual variants? or not at all? — needs further test).
- You cannot directly **sell** a variant parent — sales must be against a specific variant.
- You cannot **copy** a variant parent in one click.
- The destructive action is more aggressive: `Deactivate group & products` (deactivates the parent **and all child variants**), versus the simple `Deactivate` on a regular product.

### §4.9.2 Hero summary

```
[image]  14" Laptop                                            (no Pricing scheme switcher)
         🛒 Wholesale ▼
         44   total quantity   on hand ↔   for   all locations ▼
```

- The pricing scheme dropdown (`Wholesale ▼`) is **present** on the parent. Selecting a scheme changes the price column shown in the variants table below.
- The total quantity (`44`) is the **aggregate sum** of `on hand` quantities across both variants (24 + 20 = 44). The same `on hand ↔` toggle and `for all locations ▼` filter from the simple product detail are present.
- There is **no Quantity tile**, no per-location stacked bar visualization on the parent — quantity rendering is delegated to the variants table.

### §4.9.3 Variants table

The main content area is a **table** of child variants. Columns observed:

| Name & SKU                          | Storage capacity | Quantity on hand | Normal Price |
|-------------------------------------|------------------|------------------|--------------|
| `[img]` `14" Laptop` `3200016`      | `256GB`          | `24`             | `$400.00`    |
| `[img]` `14" Laptop` `3200017`      | `256GB` (sic — actually 512GB; the second row's display value matches its child detail) | `20` | `$500.00` |

> Note: in the screenshot, both rows show the variant parent's name `14" Laptop` (not the variant child's display name like `14" Laptop - 256GB`). The SKU and storage capacity are the disambiguators. The screenshot showed Storage capacity = `256GB` for both visible rows because of column rendering — but the second row's actual variant value is `512GB` (confirmed via the child URL `/products/.../3200017` and the storage chips on Edit options modal).

- The `Storage capacity` column is **dynamically generated from the variant axis** — if the parent had a `Color` axis instead, this column would be named `Color`.
- `Quantity on hand` is an **aggregated quantity per variant** across all locations (matches the per-row "on hand" view), but the parent-level `for all locations ▼` filter on the hero applies to it.
- `Normal Price` reflects the **currently selected pricing scheme** in the hero dropdown — switching from `Wholesale` to `Government` would re-fetch the price column.

Below the variants table:

```
✏ Edit options
```

A small inline link styled like a tertiary action (pencil icon, blue text). Clicking it opens the **Edit options modal** (next subsection).

### §4.9.4 Edit options modal — variant axis editor

Clicking `Edit options` opens a centered modal over the dimmed page:

```
┌────────────────────────────────────────────────────────────────┐
│ Edit options                                                    │
│                                                                 │
│ Storage capacity      [256GB ×] [512GB ×]                       │
│                       Add value                                 │
│                                                                 │
│                                          [Cancel] [Save]        │
└────────────────────────────────────────────────────────────────┘
```

**Verbatim copy:**
- Header: `Edit options`
- Row label: `Storage capacity`
- Value chips: `256GB ×`, `512GB ×` (each chip has a small `×` to remove that value)
- Below chips: `Add value` (link, blue)
- Footer: `Cancel` button (white outline, blue text), `Save` button (yellow background, dark text — disabled state until a change is made)

**Behavior inferred from layout (not yet tested):**
- A variant parent has **one or more axes** (the modal currently shows a single axis row `Storage capacity`). Multi-axis parents (e.g. Color × Size) would render multiple labeled rows in this same modal — one per axis.
- Each axis is a **named attribute** with a **list of allowed values**. Removing a value (clicking `×`) presumably also removes/deactivates the corresponding child variant — this is the destructive path that warrants the disabled `Save` button until intent is confirmed.
- `Add value` would extend the chip list and create a new child variant (or stub) for that value.
- There is **no field to rename the axis itself** in this modal — once `Storage capacity` is the axis name, it stays. (This is a constraint inFlow imposes: axis names are locked after creation.)

**KEY FINDING:** inFlow's variant model uses **named axes** (e.g. `Storage capacity`, `Color`, `Size`) rather than free-form options. Each axis becomes a column in the variants table and a row in the Edit options modal. The axis name is also reused as the **custom-field label** if a category template defines it as a custom field — so the same string serves dual purpose as variant axis AND custom-field label, which is why `Storage capacity` and `Capacity` both appear elsewhere as field names.

### §4.9.5 Hierarchy in left rail

In the left product list, the variant parent row shows:

```
[thumbnail]   14" Laptop   ⓶
              3200016
```

The `⓶` is a small circular badge indicating "this product has 2 child variants". Child variants do **not** appear as separate rows in the list — only the parent is listed, and clicking it opens the parent detail (with the variants table). To navigate to a child variant directly, you must either click a row in the variants table OR have the child's URL.

**Implication for OneAce:** OneAce currently has no variant parent concept — every SKU is a flat product. Modeling this would require a `VariantParent` entity that wraps multiple child products with a shared axis. Given that 50%+ of SMB inventory use cases involve variants (clothing sizes, paint colors, electronics specs), this is a high-value gap.

---

## §4.10 Product creation flow

I clicked the `+` icon next to `Filters` in the product list (top of the left sidebar in the Products module). This opens the **Create new product or group** modal — a dual-purpose creation entry point with two segmented tabs at the top: `📦 Product` and `🧊 Product group`.

### §4.10.1 "Create new product or group" — Product tab

Layout (centered modal, ~640px wide, dimmed page behind):

```
┌──────────────────────────────────────────────────────────────┐
│  Create new product or group                                 │
│                                                              │
│           [📦 Product]   🧊 Product group                    │
│                                                              │
│   ┌────────────────────────────────────────────────┐         │
│   │ × │  Creating products                          │         │
│   │   │  Organize your inventory by setting prices, │         │
│   │   │  adding barcodes, tracking across locations,│         │
│   │   │  and much more.                             │         │
│   │   │                                             │         │
│   │   │  📥 Import products                         │         │
│   └────────────────────────────────────────────────┘         │
│                                                              │
│   Product name      [____________________________]           │
│                                                              │
│   Product type      ⊙ Stocked product (most common)          │
│                       Physical objects whose quantity        │
│                       should be tracked.                     │
│                       ◯◐ Enable serial tracking ⓘ            │
│                                                              │
│                     ◯ Non-stocked product                    │
│                     ◯ Service                                │
│                                                              │
│                                  [Cancel]    [Create]        │
└──────────────────────────────────────────────────────────────┘
```

**Verbatim copy:**
- Modal title: `Create new product or group`
- Tabs: `📦 Product` (selected, blue pill) | `🧊 Product group` (unselected, gray text)
- Promo card: `Creating products` / `Organize your inventory by setting prices, adding barcodes, tracking across locations, and much more.` / `📥 Import products` (link)
- Form labels: `Product name`, `Product type`
- Radio options:
  - `Stocked product (most common)` / Subtitle: `Physical objects whose quantity should be tracked.` / Sub-toggle: `Enable serial tracking` (with `?` help icon)
  - `Non-stocked product` (no subtitle visible)
  - `Service` (no subtitle visible)
- Footer buttons: `Cancel` (white outline), `Create` (yellow, disabled until name is entered)

**Findings:**
1. **Three product types** are exposed at creation time: Stocked, Non-stocked, Service. The `Service` type is what powers labor/install/shipping line items in sales orders.
2. **Serial tracking is a per-product toggle**, NOT only a category-level flag. The earlier finding about `Computers (Serialized)` category encoded the same flag at the category level for bulk consistency, but at create time you can flip serial tracking on for any individual stocked product. This is significant: inFlow has TWO ways to flag a product as serialized (per-product toggle here, OR via category naming convention).
3. The promotional `Creating products` card has a dismiss `×` button — likely persists "user dismissed promo" preference across sessions.
4. `Import products` link routes to a CSV import flow.

### §4.10.2 "Create new product or group" — Product group tab + the "New: Product groups" tour

Clicking the `Product group` tab switches the form layout. The `Creating products` promo card is replaced with `Import product groups`, and an **automatic 3-step educational tour** modal pops up the first time a user opens this tab in their account: `New: Product groups`. The tour modal is a separate floating card overlaid on top of the form modal, with its own dim layer.

#### §4.10.2.1 Tour Step 1 of 3 — `New: Product groups`

```
┌─────────────────────────────────────────────────┐
│  New: Product groups                       ×    │
│                                                 │
│  Product groups help you organize versions of   │
│  a product (i.e., variants) that are available  │
│  in different options, like size or color.      │
│                                                 │
│  Use product groups to clean up your product    │
│  list, or to sync with sites like Shopify or    │
│  WooCommerce.                                   │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ [screenshot of T-Shirt product group    │   │
│  │  with Small/Medium/Large × Blue/Green/  │   │
│  │  Purple variants]                       │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│                            1 of 3      Next →  │
└─────────────────────────────────────────────────┘
```

**Verbatim copy (step 1):**
- Title: `New: Product groups`
- Body: `Product groups help you organize versions of a product (i.e., variants) that are available in different options, like size or color.` / `Use product groups to clean up your product list, or to sync with sites like Shopify or WooCommerce.`
- Embedded screenshot showing a `T-Shirt` product group with sample variants table containing rows like `T-shirt - Small - Blue`, `T-shirt - Medium - Blue`, `T-shirt - Large - Green`, `T-shirt - Small - Purple`, `T-shirt - Medium - Purple`, `T-shirt - Large - Purple` — each with `2 PRICES` chip and a `$0.00` value.
- Step indicator: `1 of 3`
- Action: `Next →`

**Finding:** the screenshot inside the tour shows that variant rows can have **multiple prices** (`2 PRICES` chip), confirming that pricing schemes apply per-variant (not just per-parent). This is consistent with the Pricing & Cost panel having 12 schemes.

#### §4.10.2.2 Tour Step 2 of 3 — `Group name and options`

The tour modal moves to point at the `Variant options` row of the form (with a tooltip arrow pointing down at it). The form fields **revealed by switching to Product group tab** become visible at this point:

```
Product group   [____________________________]
Variant options + Add options
```

```
┌─────────────────────────────────────────────────┐
│  Group name and options                    ×    │
│                                                 │
│  All variants in a product group will use the   │
│  group name as a base.                          │
│                                                 │
│  Any options, like size or color, are added     │
│  afterwards and separated by dashes to make     │
│  sure each variant has a unique name (e.g.,     │
│  T-shirt - Large - Red).                        │
│                                                 │
│       ← Back        2 of 3        Next →        │
└─────────────────────────────────────────────────┘
```

**Verbatim copy (step 2):**
- Title: `Group name and options`
- Body: `All variants in a product group will use the group name as a base.` / `Any options, like size or color, are added afterwards and separated by dashes to make sure each variant has a unique name (e.g., T-shirt - Large - Red).`
- Step indicator: `2 of 3`
- Actions: `← Back`, `Next →`

**Finding:** variant child SKU names are **deterministically generated** as `{parent name} - {axis 1 value} - {axis 2 value}` joined by ` - ` (space-hyphen-space). This is enforced — you cannot freely name a child variant. The SKU number (`3200016`, etc.) is separate from the display name and IS auto-assigned.

#### §4.10.2.3 Tour Step 3 of 3 — `Choose what to create now`

The tour modal moves to point at the `Create` segmented control. The form now exposes:

```
Product group   [____________________________]
Variant options + Add options
Create          [Group and products | Group only]
                Create this product group with 0 products now.
                inFlow will link products to the group if they match the n…
Product type    ⊙ Stocked product (most common)
                  ◯◐ Enable serial tracking ⓘ
                ◯ Non-stocked product
                ◯ Service
```

```
┌─────────────────────────────────────────────────┐
│  Choose what to create now                 ×    │
│                                                 │
│  Create a group and        OR    Create the     │
│  variants now                    group now and  │
│                                  add variants   │
│                                  later          │
│                                                 │
│       ← Back        3 of 3        Finish ✓      │
└─────────────────────────────────────────────────┘
```

**Verbatim copy (step 3):**
- Title: `Choose what to create now`
- Body (two-column comparison): `Create a group and variants now` `OR` `Create the group now and add variants later`
- Step indicator: `3 of 3`
- Actions: `← Back`, `Finish ✓`

**Finding:** product groups can be created **empty** (`Group only`) and have child variants added later. The truncated hint `inFlow will link products to the group if they match the n…` (n… is presumably "n…ame") tells us inFlow will **auto-link existing standalone products into the new group** if their names match the variant name pattern. This is an important data-recovery feature for users who created variants as flat products before realizing they needed groups.

#### §4.10.2.4 Full Product group form (after dismissing tour)

After clicking `Finish ✓`, the form is fully populated:

```
Product group   [____________________________]
Variant options + Add options
Create          [Group and products | Group only]
                Create this product group with 0 products now.
                inFlow will link products to the group if they match the n…
Product type    ⊙ Stocked product (most common)
                  ◯◐ Enable serial tracking ⓘ
                ◯ Non-stocked product
                ◯ Service

▶ See what's new                  [Cancel]    [Create product group]
```

**Footer additions over Product tab:**
- New link bottom-left: `▶ See what's new` — re-opens the 3-step tour
- Primary button text: `Create product group` (instead of `Create`)

### §4.10.3 Variant axis selector — `Options` modal (shared library)

Clicking `+ Add options` on the Product group tab opens an **`Options`** modal — a second-level dialog. This is the **shared variant axis library** discovered from the existing sample data.

**KEY FINDING:** inFlow does NOT use free-form variant axes. Instead, axes and their values are **deduplicated across the entire account**. Once an axis is used on any product (either by sample data or by you), it appears in this library and can be reused. New axes are created from the secondary `Options` (singular) sub-modal.

```
┌────────────────────────────────────────────────────────┐
│  Options                                                │
│  🔍 Search options and variants                         │
│                                                         │
│  Coating                                                │
│  [Regular]  [Non-Stick]                                 │
│                                                         │
│  Color                                                  │
│  [Red]  [Gray]                                          │
│                                                         │
│  Dimensions                                             │
│  [1"x4"x8']  [2"x4"x8']  [2"x6"x8']  [4"x4"x10']        │
│                                                         │
│  Pack size                                              │
│  [25 Pk]                                                │
│                                                         │
│  Pan type                                               │
│  [10" Sautee Pan]  [20 cm Sautee Pan]                   │
│  [8 QT Clad Stock Pot]  [20 cm 3 L Sauce Pan]           │
│  [16 cm 1.7 L Sauce Pan]                                │
│                                                         │
│  Size                                                   │
│  [LRG]  [MD]  [SM]  [XS]                                │
│                                                         │
│  Storage capacity                                       │
│  [256GB]  [512GB]                                       │
│                                                         │
│  Volume                                                 │
│  [3L]  [6L]                                             │
│                                                         │
│  + Add another option            [Back]   [Select]      │
└────────────────────────────────────────────────────────┘
```

**Discovered axes (8 total) — verbatim:**
| Axis name        | Values                                                                                       |
|------------------|----------------------------------------------------------------------------------------------|
| `Coating`        | `Regular`, `Non-Stick`                                                                       |
| `Color`          | `Red`, `Gray`                                                                                |
| `Dimensions`     | `1"x4"x8'`, `2"x4"x8'`, `2"x6"x8'`, `4"x4"x10'`                                              |
| `Pack size`      | `25 Pk`                                                                                      |
| `Pan type`       | `10" Sautee Pan`, `20 cm Sautee Pan`, `8 QT Clad Stock Pot`, `20 cm 3 L Sauce Pan`, `16 cm 1.7 L Sauce Pan` |
| `Size`           | `LRG`, `MD`, `SM`, `XS`                                                                      |
| `Storage capacity` | `256GB`, `512GB`                                                                           |
| `Volume`         | `3L`, `6L`                                                                                   |

These are AUTO-DISCOVERED from the products that exist in the sample data. There is no "axis library admin page" in Settings — the library is simply the union of all distinct option-axis-and-value pairs across the product catalog.

**Modal controls:**
- Header: `Options`
- Search bar: `Search options and variants` (placeholder)
- Each axis row is a labeled card with chip-style value pills (clickable to select)
- Bottom-left link: `+ Add another option`
- Bottom-right: `Back` button (white), `Select` button (yellow, disabled until at least one chip is selected)

### §4.10.4 New axis creation — `Options` (singular) sub-modal

Clicking `+ Add another option` opens a **second** modal, replacing the axis-selector modal:

```
┌────────────────────────────────────────────────────────┐
│  ← │  Options                                          │
│    │  Differentiate product variants with options      │
│    │  (e.g. size or color).                            │
│                                                         │
│  Option name    [Size_____________________________]    │
│                                                         │
│              ┌──────────────────────────────┐           │
│              │  [📦 illustration with       │           │
│              │   barcode, location pin, $   │           │
│              │   icon scattered around      │           │
│              │   stacked boxes]             │           │
│              └──────────────────────────────┘           │
│                                                         │
│  ──────────────────────────────────────────────────    │
│  [Enter value___________________]    + Add value       │
│                                                         │
│                          [Cancel]    [Save & select]   │
└────────────────────────────────────────────────────────┘
```

**Verbatim copy:**
- Back arrow icon (returns to axis selector)
- Title: `Options`
- Subtitle: `Differentiate product variants with options (e.g. size or color).`
- Field label: `Option name` with placeholder `Size`
- Big illustration placeholder
- Value entry: `Enter value` input + `+ Add value` link
- Footer: `Cancel`, `Save & select` (yellow, disabled until input)

**Findings:**
1. The axis name is a free text field with a sample placeholder (`Size`) — no validation that prevents creating a new axis with the same name as an existing one (would need testing).
2. Values are added one at a time with the "+ Add value" link — this is a sequential single-input flow (not bulk).
3. The button label is `Save & select` — saving an axis automatically selects it for the current product group being created. So the new axis is **immediately bound** to the current variant parent in addition to being added to the global library.

### §4.10.5 Successful product creation — `SC Test Widget`

I switched back to the `Product` tab, typed `SC Test Widget` into the `Product name` input, and clicked `Create`. The modal closed immediately and the page navigated to:

```
URL:  /products/4fe1dd3e-4732-41f2-98c3-21e9dd907da9
Title: SC Test Widget | inFlow Inventory
```

The new product detail loaded immediately, with **no intermediate confirmation toast** and **no prompt to add inventory or stock**. The product is in the "exists but empty" state. Top-of-page state captured:

```
[empty image hero]    SC Test Widget
                      SKU  320638                          + Add description
[count badge: 0]      🛒 Wholesale ▼
                      ▮▮▮ 0487080001286
                      + Add measurements

                      Brand           [Enter data]    Country of Ori… [Enter data ▼]
                      Color           [Enter data]    Material        [Enter data]
                      WHMIS #         [Enter data]    Amps            [Enter data]
                      Scent           [Enter data ▼]  Warranty expi   [MMM DD, YYY]
                      Capacity        [Enter data]    QA Passed?      [☐]
                      ⚙ Manage

                      + Customs info
```

**KEY FINDINGS:**

1. **Auto-assigned SKU = `320638`** — a 6-digit incrementing integer. This is the next-available number after the highest existing sample SKU (`3200030`-ish range — in fact `320638` is suspiciously close to a continuation of `320001-320030`, so SKUs are likely **per-account sequential** starting from `320001` or similar).

2. **Auto-assigned barcode = `0487080001286`** — a 13-digit numeric string. This looks like an **EAN-13** or **UPC-A** code. The fact that inFlow auto-generates and pre-fills a barcode for every new product is a huge UX win and a difference from OneAce.

3. **All 10 custom fields are pre-attached to the new product**: `Brand`, `Color`, `WHMIS #`, `Scent`, `Capacity`, `Country of Origin`, `Material`, `Amps`, `Warranty expi…` (truncated — likely "Warranty expires"), `QA Passed?`. This means **custom fields are GLOBAL across the account**, NOT scoped to category. Every product, regardless of type, gets every custom field — and you simply leave irrelevant ones empty. (`Manage` link in the panel opens the custom field management UI to add/remove fields.)

4. **Custom field type variety:**
   - `Brand`, `Color`, `WHMIS #`, `Capacity`, `Material`, `Amps` — Text input (`Enter data` placeholder)
   - `Country of Origin` — Dropdown (`Enter data ▼` with chevron)
   - `Scent` — Dropdown (`Enter data ▼` with chevron)
   - `Warranty expi…` — Date picker (`MMM DD, YYY` placeholder format)
   - `QA Passed?` — Boolean checkbox (`☐` empty checkbox)
   - **5 distinct types** confirmed: Text, Dropdown, Date, Boolean, (and Number on other products)

5. **Default pricing scheme = `Wholesale`** for new products (NOT `Normal Price`). This is interesting — `Wholesale` was the scheme shown on the variant parent (14" Laptop) too. So the "active scheme" is **persisted at the user-session level** (or possibly per-product) and inherited by new products.

6. **Default location = `Eastern Warehouse`** with `0` quantity. Showing that the sample-data account has multiple sample locations (the previous Sortly walkthrough had mentioned Stockholm, Oslo, etc.; inFlow uses generic warehouse names).

7. **Action bar fully populated immediately**: `Deactivate` (red), `Attachments`, `Copy`, `Sell`, `Print labels`, `More ▼`. So `Sell` is enabled even though the product has 0 quantity — inFlow allows selling against negative stock (consistent with the §4.7 finding that negative stock is permitted).

8. **CORRECTION (post-edit observation):** The product detail page is **NOT** auto-save. As soon as the first edit happens to any field (description, measurements, custom field, etc.), a yellow `Save` button materializes in the top-right action bar, immediately to the right of `More`. The Save button replaces the previous "no button" empty space. After clicking Save, the button transforms into a green `✓ Saved` confirmation chip in the same slot. This is an **explicit save** model with a deferred-commit pattern: edits accumulate as a pending dirty state across multiple fields, then commit atomically. This is different from many modern SaaS apps that auto-save on blur. (See §4.11 for the full edit/save walkthrough.)

9. The new product **does not appear at the top of the product list** — the list is sorted alphabetically, so `SC Test Widget` is wherever S sorts. This is consistent with the URL-driven navigation: after creation, you get the product detail view, NOT a "view in list" confirmation.

---

## §4.11 Inline edit walkthrough — `SC Test Widget`

After successfully creating `SC Test Widget` at `/products/4fe1dd3e-4732-41f2-98c3-21e9dd907da9`, I exhaustively edited every visible field type to characterize the inline-edit interaction model, the per-control widgets, and the save behavior.

### §4.11.1 Description field (text — multi-line)

The description area initially shows the placeholder link `+ Add description` (rendered as a clickable hint, not as an obvious text field). Clicking it transforms the entire row into a multi-line `<textarea>` editor inline. There is no modal — the textarea is rendered in place, sharing the same column width as the right-hand metadata pane.

Typing into the textarea fires no save indicator until the **first dirty event triggers the global Save button** (see §4.11.7 for details). I typed:

```
Test product created by Claude during competitor analysis walkthrough
on 2026-04-10. Purpose: verify inline edit, custom field types, deactivate flow.
```

Findings:
1. The description field accepts arbitrary text including newlines (the textarea wraps and grows).
2. There is no rich-text formatting (no markdown, no toolbar, no bold/italic).
3. Long descriptions push the meta block downward — the column has flex layout, not a fixed height.
4. Clicking outside the textarea **does not auto-save** — the value is held in the dirty state until the global Save button is clicked.

### §4.11.2 Custom field — Text type (`Brand`)

Clicking `Brand` row's right cell (which has placeholder `Enter data` in light gray) transforms the cell into an inline `<input type="text">` editor. No modal, no separate edit page.

I typed `OneAce` and tabbed away. The placeholder gray text was replaced with the value rendered in normal black text. Same dirty-state pattern — the global Save button became active.

Finding: Text-type custom fields have NO max-length validation visible to the user (no character counter, no truncation). The input accepts arbitrary length until the user manually stops.

### §4.11.3 Custom field — Dropdown type (`Country of Origin`)

Clicking the `Country of Origin` cell opens a small dropdown popover anchored below the cell. The popover is a simple flat list (no search box, no scroll until ~7+ items, no sub-headings). Items rendered:

```
Canada
China
India
Mexico
UK
USA
Korea
─────────────
⚙ Manage opti…
```

(`Manage opti…` is the truncated form of `Manage options…` — clicking it opens the per-field option editor, which I did not enter for this walkthrough — see §4.12 deferred.)

Selecting `Canada` collapses the popover and renders `Canada` in the cell as a labeled value. The cell now has a chevron icon `▼` indicating it remains a dropdown. This is **single-select** behavior (no multi-select chips).

Findings:
1. Dropdown custom fields are **per-account curated lists**, not free text — the user picks from a finite set.
2. The list of options is editable via the `Manage options…` link in the popover footer (per-field, not global).
3. Selection commits to the dirty state but does not auto-save.

### §4.11.4 Custom field — Dropdown type (`Scent`)

Clicking the `Scent` cell opens an identical popover style. Items:

```
Clean
Forest
Meadow breeze
Lemon
Mint
─────────────
⚙ Manage opti…
```

Selected `Forest`. The cell now displays `Forest` with the dropdown chevron.

Finding: This confirms `Scent` is **a separate dropdown** from `Country of Origin`, with its own option set. So dropdown-type custom fields each have an independent option list. This is consistent with a `customField -> options[]` relational model.

### §4.11.5 Custom field — Date type (`Warranty expires`)

Clicking the `Warranty expi…` cell (placeholder `MMM DD, YYY`) opens a **calendar date-picker popover**. The picker:

```
┌────────────────────────┐
│  ‹    April 2026     › │
│ Su Mo Tu We Th Fr Sa   │
│ 29 30 31  1  2  3  4   │
│  5  6  7  8  9 [10] 11 │   ← today (April 10) highlighted in solid blue
│ 12 13 14 15 16 17 18   │
│ 19 20 21 22 23 24 25   │
│ 26 27 28 29 30  1  2   │
└────────────────────────┘
```

Findings:
1. Default month is the **current month** (April 2026), not the field's stored value (which is empty).
2. Today's date is highlighted with a solid blue circle.
3. Sunday-first week (US convention).
4. Greyed-out days for the previous (29/30/31 March) and next (1/2 May) months.
5. Single-month view, with `‹` and `›` chevrons to navigate prev/next month — there is no year jumper, no month selector dropdown, no "today" button.
6. **The picker also accepts free-text date typing** — I successfully set the value by directly typing `Apr 25, 2027` into the input field (after my first attempt clicking April 25 in the picker did not commit). After typing and pressing Tab, the cell renders `Apr 25, 2027`.
7. So this is a **dual-mode date field**: type-to-set OR pick-from-calendar.

### §4.11.6 Custom field — Boolean type (`QA Passed?`)

The `QA Passed?` cell renders as a single small empty square box (`☐`) on the right side of the row. There is no associated label "Yes/No" or "True/False" — just the checkbox.

A surprising discovery during automation: this checkbox is **NOT** a real `<input type="checkbox">`. It's a custom div with `id="custom10-input"` containing an `<h4>` with class `hidden` containing the literal text `o`. The visual checkbox is rendered via styled CSS background. This suggests inFlow's frontend uses fully-custom form controls (likely styled-components, judging by the `sc-*` class prefix on every element).

Clicking the box toggles its state. Once checked, a checkmark icon appears inside the square.

Findings:
1. Boolean custom fields are styled as custom checkboxes, not native `<input>` elements — accessibility implications (no `role="checkbox"`, no keyboard support unless explicitly bound).
2. The visible label is the field name with a `?` suffix (`QA Passed?`) — convention is "interrogative label" for boolean fields.
3. Toggle commits to dirty state but does not auto-save.

### §4.11.7 The Save button (explicit save model — major correction)

**This is the most important finding of this walkthrough**, and it overturns my prior §4.10.5 #8 claim that the page was auto-save:

inFlow's product detail page uses an **explicit deferred-commit save** model. The behavior:

1. **Initial state (no dirty fields):** The top-right action bar shows: `Deactivate | Attachments | Copy | Sell | Print labels | More ▼` and **nothing else** in the rightmost slot. No Save button.

2. **First dirty edit:** As soon as ANY field is edited (description, measurement, custom field, dropdown selection, date, checkbox toggle), a yellow `Save` button materializes in the rightmost slot of the action bar, immediately right of `More ▼`. The button is the same yellow as the global "Subscribe now" CTA.

3. **Multi-field accumulation:** Edits to different fields all funnel into the same dirty state — the Save button does not duplicate. You can edit description, brand, country, scent, warranty date, QA passed checkbox, and measurements in any order, and a single click on Save commits all of them atomically.

4. **Click Save:** The button transforms into a green `✓ Saved` confirmation chip in the same slot. The chip persists for several seconds before fading back to the empty slot. The page does not navigate, reload, or show a toast.

5. **Quantity unit propagation:** Saving the measurements (which include selecting Standard unit `ea`) immediately updated the Quantity widget at the bottom-left from rendering `0` to rendering `0 ea` — the standard unit propagates to the quantity display unit.

6. The 14-day trial countdown chip and "Subscribe now" button in the very top-right are unchanged by the save.

This explicit-save model is **different from most modern SaaS apps** (which auto-save on blur) and means inFlow has a "draft" concept that lives client-side for the duration of the edit session, with a single commit point at the end.

### §4.11.8 Product measurements modal (`+ Add measurements`) — full spec

Clicking `+ Add measurements` opens a small centered modal (~500px wide, semi-opaque dim overlay behind it):

```
┌────────────────────────────────────────────┐
│  Product measurements                      │
│  ────────────────────────────────────────  │
│  Length      [ –                       ]   │
│  Width       [ –                       ]   │
│  Height      [ –                       ]   │
│  Weight      [ –                       ]   │
│                                            │
│  Units of measure and conversions          │
│  ────────────────────────────────────────  │
│  Standard unit ⓘ  [                    ▼]  │
│  Selling          [ 1 ] [          ▼] = [1]│
│  Purchasing       [ 1 ] [          ▼] = [1]│
│                                            │
│                       [Cancel]  [Update]   │
└────────────────────────────────────────────┘
```

**Verbatim copy:**
- Title: `Product measurements`
- Section headers: `Product measurements` (implicit in title), `Units of measure and conversions`
- Field labels: `Length`, `Width`, `Height`, `Weight`
- Each numeric input has placeholder `–` (em dash, gray)
- `Standard unit` has an `ⓘ` info tooltip icon next to the label
- Sub-section for UOM conversions with two rows: `Selling` and `Purchasing`
- Each conversion row: `[qty] [from-unit ▼] = [qty]` — the destination quantity is in the standard unit
- Footer buttons: `Cancel` (outline) and `Update` (yellow filled)

**Standard unit dropdown — full option list (auto-discovered from sample data):**

I introspected the dropdown's DOM via JavaScript and confirmed **27 unit options** are present, in this order:

```
bottle
box
can
case
cases
chair
Daily
desk
ea
ea.
foot
Hour
hr
jug
length
meter
Monthly
pack
packs
pallet
pcs
pcs.
printer
skid
skid/pallet
spool
Weekly
```

Critical observations:
1. **There are duplicates with case/punctuation variants**: `ea` AND `ea.`, `pcs` AND `pcs.`, `pack` AND `packs`. This strongly suggests the dropdown is **auto-aggregated from existing product data**, NOT a curated catalog. Whatever string an inFlow user has previously typed into a unit field for any product becomes a dropdown option for all subsequent products. This is the **same pattern as the Variant axis library** (§4.10.3), where axis names auto-populate from sample data.
2. **Mixed semantic categories**: physical units (`foot`, `meter`), packaging units (`box`, `case`, `pallet`, `skid`), product nouns (`chair`, `desk`, `printer`), abstract counts (`ea`, `pcs`, `length`), AND time-based units (`Daily`, `Weekly`, `Monthly`, `Hour`, `hr`). The presence of time units strongly implies inFlow supports rental/service products where the "unit" is a time period.
3. **No unit conversion library**: there's no built-in knowledge that `meter` should equal `100 cm`, or that `1 box = 12 ea`. The UOM conversion ratio is **manually entered per product** in the Selling/Purchasing rows.
4. **No grouping or search box** in the dropdown — just a flat scrollable list.

**Filling test values:**

I filled `Length: 10`, `Width: 5`, `Height: 3`, `Weight: 0.5`. As soon as a value is committed (likely on blur), the placeholder `–` is replaced with the value plus an **automatic unit suffix**. The suffixes were:

- Length → `10 cm`
- Width → `5 cm`
- Height → `3 cm`
- Weight → `0.5` (no suffix in the modal, but rendered as `0.5g` after save in the inline display)

So inFlow has **two implicit default units**: `cm` for linear dimensions and `g` (grams!) for weight. Note that **grams** is unusual for an SMB inventory app — most US/CA tools default to oz or lb. This implies the trial account is in a metric region (or that the default is metric for the Manufacturing-style data).

**The "Standard unit" dropdown is a different concept from the linear/weight units**: it's the unit for the *product itself* (i.e., is this product sold as 1 `ea`, 1 `box`, 1 `pallet`?), not the unit for length/weight. So the modal actually has **two unit systems** in play:

- Linear/weight units (cm/g) — implicit, baked into the form
- Standard product unit — explicit dropdown, controls quantity display unit

**Selling/Purchasing UOM rows:**
- `Selling: [1] [<empty> ▼] = [1] ea` — Means "1 of [some sub-unit] = 1 ea". Used when you sell in a pack/case but track in eaches.
- `Purchasing: [1] [<empty> ▼] = [1] ea` — Same structure for the receiving side.
- Both sub-unit dropdowns inherit from the same 27-option list as Standard unit.

After committing `Update`, the inline display on the product detail collapses all measurements into two compact lines:

```
[icon]  10cm × 5cm × 3cm
        0.5g
        ✏ Edit
```

The `Edit` link below the measurements re-opens the same modal pre-filled.

### §4.11.9 Save chip transition — observed timing

After clicking Save:
- T+0ms: Click registered, button visually pressed
- T+~200ms: Yellow Save button replaced by green pill chip with `✓ Saved` text
- T+~3000ms (estimated): Chip fades out, slot returns to empty
- The page never reloads, never navigates, no toast in the page corner

This is a very low-friction confirmation pattern. There is no error state shown in this trial — what happens on a save failure (network error, validation error) is not characterized in this walkthrough.

### §4.11.10 Other findings during inline edit

1. **Sticky tab bar**: Scrolling the right pane reveals that the tab bar `Overview | Product vendors | Order history | Movement history` becomes sticky as it approaches the top of the viewport. (Not directly captured in this session but inferred from the static layout.)
2. **Customs info collapsible**: The `+ Customs info` link below the Manage button is a collapsible section — clicking expands fields for HS code, country of origin (note: separate from the custom field with the same name!), customs description, etc. Not entered for this walkthrough.
3. **Editing a custom field via the column does NOT open a dedicated modal** — every editable cell in the right metadata pane uses the same "in-place transform to input" pattern.
4. **Manage gear icon (⚙ Manage)** at the bottom of the custom-field column opens the global Custom Fields editor — not entered for this walkthrough (deferred to §4.12).
5. **No undo/history widget**: After saving, there is no visible "undo" or "version history" button — the previous values are not preserved client-side.

---

## §4.13 Deactivate flow — sample-data paywall (HUGE finding)

I clicked the red `Deactivate` action button in the top-right action bar, expecting either an inline confirmation or a destructive-action modal. Instead, inFlow blocked the entire action with a centered modal:

```
┌──────────────────────────────────────────────┐
│                                              │
│  This feature isn't available                │
│  while using sample data                     │
│                                              │
│  We've provided sample data so that you can  │
│  get a feel for inFlow.                      │
│                                              │
│  The next step is to erase all of the        │
│  current data and start fresh with your own. │
│                                              │
│                                              │
│              [Cancel]   [Start fresh]        │
└──────────────────────────────────────────────┘
```

**Verbatim copy:**
- Title (white text on dark navy background): `This feature isn't available while using sample data`
- Body paragraph 1: `We've provided sample data so that you can get a feel for inFlow.`
- Body paragraph 2: `The next step is to erase all of the current data and start fresh with your own.`
- Footer buttons: `Cancel` (text-only, white on dark navy) and `Start fresh` (red filled, white text)

**The modal background is a navy/indigo dark surface (~#2A3050)**, contrasting with all other modals in inFlow which are white-on-white. This is a deliberate visual cue that this is a *gating modal*, not a normal dialog.

**KEY FINDINGS:**

1. **Sample mode is partially read-only** — you can ADD products and EDIT/SAVE existing ones (I successfully created `SC Test Widget` and edited 6+ fields with no friction), but you CANNOT DELETE/DEACTIVATE any product. The destructive operations are gated behind exiting sample mode entirely. This is a clever design: it lets users explore the app without fear of breaking the sample data, but also makes it impossible to test the deactivate flow without committing to a real account.

2. **"Deactivate" is the only destructive verb in inFlow's product UI** — there is no `Delete` button anywhere in the product detail. This is consistent with the design philosophy of soft-delete (deactivation) for inventory items, since hard-delete would orphan transaction history (movements, sales orders, POs that reference the product).

3. **Exit-sample mode is a one-shot, irreversible operation** — the modal copy "erase all of the current data and start fresh with your own" implies that clicking `Start fresh` will:
   - Wipe ALL sample data (including the `SC Test Widget` I just created)
   - Reset the account to an empty state
   - Force the user into a real onboarding flow (probably the same `/initial-questions?step=*` flow we walked at the beginning)

4. **The CTA color is RED, not yellow** — different from every other primary CTA in inFlow (which are yellow). Red signals destructive intent, consistent with the "erase all data" copy.

5. **The Cancel button has no border** — it's text-only, suggesting it's the "safe" action. The Start fresh button has the filled treatment, drawing attention to the destructive option but with the warning color.

6. **No alternative action surfaced** — the modal does not offer "Try again on a real product" or "Add real data first then deactivate." It's a hard wall.

**Implication for the OneAce competitive analysis:**

The Deactivate paywall reveals inFlow's onboarding strategy: they want users to experience a *fully populated* product right out of the gate (90+ sample products, 95+ sample movements, sample customers/vendors/orders). The trade-off is that core CRUD operations (specifically delete) are blocked until you commit. This is a strong signal that **inFlow optimizes for a "WYSIWYG try-before-you-buy" model**, while OneAce currently has the opposite default (start empty, build up gradually).

The fact that I could create AND save a real product in sample mode but not delete it implies the sample data is stored in a separate sandbox per user, and the writes against sample mode are persisted to that sandbox. This is more sophisticated than a "frozen demo dataset" approach — it's a real per-user database that just gates destructive verbs.

I clicked `Cancel` to dismiss the modal and preserve the sample data + the SC Test Widget I created. The product detail returned to its normal state with no further changes.

---

## §4.14 Manage Custom Fields editor — global fields modal

Triggered by clicking the `⚙ Manage` link at the bottom of the right-side custom-field column on the product detail page. Opens a centered modal layered over the product detail (z-index 10004), 512px wide × 700px tall, scrollable content area inside.

**Header (verbatim):**
- Title: `Customize inFlow to your specific needs with custom fields.` (two-line wrap; black sans-serif, ~16px regular weight)
- Top-right of header: `Learn more ↗` (link with external-link icon, opens KB article in a new tab; not followed in this walkthrough)

**Body — vertical list of field rows.** Each row contains the same controls:

```
┌─────────────────────────────────────────────────┐
│  ✕   Field N            ┌─────────────────────┐ │
│                          │ <field name input> │ │
│                          └─────────────────────┘ │
│      Type               ┌─────────────────────┐ │
│                          │ <type dropdown>    │ │
│                          └─────────────────────┘ │
│                              [if Drop-down:]    │
│                          ↓ Manage drop-down opt │
└─────────────────────────────────────────────────┘
```

- Left column: small `✕` icon (delete row), then `Field N` label (where N is the 1-indexed slot number) on the first sub-row, `Type` label on the second sub-row.
- Right column: free-text input for the field name (top), select dropdown for the field type (bottom). The two inputs are aligned in a stacked pair, label-on-the-left layout.
- For `Drop-down` type, an additional `↓ Manage drop-down options` link appears below the Type select. Clicking it expands the row INLINE (not as a sub-modal!) to reveal the option list editor (see §4.14.2).

**Complete field list (all 10 slots, captured via DOM enumeration):**

| Slot | Field name (default) | Type        |
|------|----------------------|-------------|
| 1    | Brand                | Text field  |
| 2    | Country of Origin    | Drop-down   |
| 3    | Color                | Text field  |
| 4    | Material             | Text field  |
| 5    | WHMIS #              | Text field  |
| 6    | Amps                 | Text field  |
| 7    | Scent                | Drop-down   |
| 8    | Warranty expiration  | Date field  |
| 9    | Capacity             | Text field  |
| 10   | QA Passed?           | Checkbox    |

**Footer (sticky at the bottom of the modal):**
- Left side: a toggle pill labeled `Show inactive` (off by default — gray background, sliding handle to the left). When toggled on, presumably reveals soft-deleted rows.
- Right side: `Cancel` button (text-only with thin outline, no fill) and `Save` button (yellow filled, black text — same yellow as the page-level Save button).

**Field type options (observed via the dropdown control):** at least 4 types are confirmed in use across the default field set: `Text field`, `Drop-down`, `Date field`, `Checkbox`. The dropdown was not exhaustively expanded in this walkthrough — additional types like `Number field`, `Currency`, or `Yes/No` may exist but were not enumerated.

### §4.14.1 KEY ARCHITECTURAL FINDINGS

1. **Custom fields are GLOBAL, not category-scoped.** The 10 fields in this modal apply to *every* product in the account. There is no notion of "this field only appears for laptops" — every product gets the same 10 slots, and the user is responsible for leaving irrelevant slots blank. This is a major architectural simplification compared to systems with conditional/typed product templates (e.g., Shopify metafields with namespacing, Sortly's per-folder custom fields).

2. **There is a hard cap of 10 custom field slots.** The modal exposes Field 1 through Field 10 explicitly numbered. There is no `+ Add new field` button below Field 10 — slots are fixed. Users must rename existing slots, not add new ones. This is a hard product constraint, likely tied to the database schema (probably 10 columns named `custom1` through `custom10` on the product table — confirmed by the DOM `id="custom10-input"` we observed earlier in §4.11.6).

3. **Field types are mutable.** The Type dropdown is editable on existing fields, meaning a Text field can be converted to a Drop-down or Date field at any time. What happens to existing data on type-mismatch (e.g., text "Maybe" in a field converted to Checkbox) is not characterized — but the fact that this is a flat select with no warning suggests inFlow either coerces or drops invalid values. This is a noteworthy data-integrity risk for end users.

4. **Soft-delete model confirmed.** The `Show inactive` toggle in the footer is direct evidence that deleting a field via the `✕` icon does not hard-delete it — the field is hidden but recoverable. This protects against accidental data loss when re-purposing slots.

5. **Drop-down option editing is INLINE, not in a sub-modal.** Clicking `Manage drop-down options` does NOT open a second modal — it expands the row in place to reveal the option list editor (drag handle + text input + delete icon per option, plus a `+ New drop-down option` link at the bottom). This keeps the user in a single editing context. See §4.14.2.

6. **Each drop-down field has its OWN option list.** Country of Origin (slot 2) and Scent (slot 7) are both Drop-down type but maintain entirely separate option sets. There is no shared "list of countries" reference table — each field's options are independent. This was already inferred from the inline edit walkthrough (§4.11.3, §4.11.4) but confirmed here in the global editor.

### §4.14.2 Inline option editor for Country of Origin (verbatim capture)

Clicking `↓ Manage drop-down options` on the Country of Origin row caused the row to expand vertically and reveal the following nested layout (no sub-modal, no overlay — just inline expansion that pushes Field 3 down):

```
× Field 2          [ Country of Origin               ]
  Type             [ Drop-down                     ▼]
  
                   ┌─────────────────────────────────┐
                   │ ⋮⋮  [ Canada                ]  ✕│
                   │ ⋮⋮  [ China                 ]  ✕│
                   │ ⋮⋮  [ India                 ]  ✕│
                   │ ⋮⋮  [ Mexico                ]  ✕│
                   │ ⋮⋮  [ UK                    ]  ✕│
                   │ ⋮⋮  [ USA                   ]  ✕│
                   │ ⋮⋮  [ Korea                 ]  ✕│
                   │                                 │
                   │  + New drop-down option         │
                   └─────────────────────────────────┘
```

**Per-row controls:**
- Left: `⋮⋮` drag handle (six dots — drag-to-reorder cursor on hover, almost certainly enables drag-and-drop reordering)
- Center: free-text input pre-populated with the option label
- Right: `✕` delete icon (per-option soft delete? or hard? not characterized)

**Footer of the inline section:** `+ New drop-down option` link (blue text, no border — appends a new empty row to the bottom).

**Verbatim option list (Country of Origin):** Canada, China, India, Mexico, UK, USA, Korea. (7 options, in this order. Note: same list as observed in §4.11.3 from the popover dropdown — this confirms the popover and the editor read from the same source.)

**Implication for OneAce:** if SC implements per-product dropdowns, the inFlow inline-editor pattern is the cleanest UX I've seen — it lets users edit option lists without losing context of the parent field. SC's current implementation (if any) should consider this inline expansion model rather than spawning a sub-modal.

### §4.14.3 Modal exit

I clicked `Cancel` (NOT Save) to exit the modal without committing any changes. This was a deliberate choice to:
- Preserve the existing field configuration (since this is sample data and other walkthrough sections depend on the current state)
- Verify that Cancel discards all in-modal changes (it does — the modal closes and the page returns to its previous state)
- Avoid mutating the soft-delete state via accidental field removal

The modal closed cleanly with no confirmation prompt. The product detail page underneath was unchanged.

---

## §4.12 Deferred surfaces (to be captured)

The following sub-flows were observed but not exhaustively walked during this session and are deferred to subsequent passes:

- `+ Customs info` collapsible — HS code, customs description, etc.
- `Attachments` action — file upload widget
- `Copy` action — clones the product to a new product
- `Sell` action — opens a quick sale form (likely a sales-order draft)
- `Print labels` action — opens the label print modal/preview
- `More ▼` action menu — additional bulk operations
- `Pricing & Cost > Advanced` toggle — exposes per-scheme price overrides
- `View breakdown` link in the Quantity widget — per-location, per-sublocation breakdown
- The `Product vendors`, `Order history`, `Movement history` sub-tabs

---



---

# PART II — POST-PRODUCT-DETAIL SURFACES

_All sections below were captured live in the walkthrough after the Product Detail teardown (Parts 1–4.14 above). Sample mode remained active throughout — the `You're viewing sample data. When you're ready, try inFlow with your own data.` orange banner was present at the top and bottom of every page. ADD/EDIT operations are permitted in sample mode but DELETE and DEACTIVATE are blocked with an upsell._

---

## §5 LEFT SIDEBAR — INFORMATION ARCHITECTURE

The left rail is a permanently-visible narrow column (width ≈ 64 px) containing icon-only buttons. Hovering over any icon triggers a flyout panel that slides out to the right, revealing the full menu group with text labels. The flyout dismisses when the mouse leaves either the icon or the flyout panel.

### §5.1 Icon stack (top to bottom, top section)

| Y-position | Icon visual                  | Group name revealed in flyout | Destination(s) |
|------------|------------------------------|-------------------------------|----------------|
| top        | Evernote-style book spine    | **inFlow** (brand)            | Top-level home/dashboard |
| row 1      | `+` in yellow square         | **Create new**                | Quick-create menu (new PO, SO, product, etc.) |
| row 2      | `$` in circle                | **Sales**                     | Sales Orders, Sales Quotes, Customers, Showroom, Reports sub-group |
| row 3      | Cube                         | **Products**                  | Product list, Categories, Adjustments, Stock counts, Stock transfers, Locations |
| row 4      | Clipboard with checkmark     | **Purchasing**                | Purchase Orders, Purchase Quotes, Vendors |
| row 5      | Bar chart                    | **Reports**                   | Reports home (see §6) |

### §5.2 Icon stack (bottom section, bottom-left corner)

| Y-position | Icon visual           | Destination                           |
|------------|-----------------------|---------------------------------------|
| bottom-3   | Storefront            | **Showroom** (B2B portal configuration) |
| bottom-2   | 4-square grid with `+` | **Integrations** (App Marketplace / connected apps) |
| bottom-1   | Gear                  | **Options** (Settings — see §10)       |

### §5.3 Flyout panel behavior

- **Trigger:** mouse `pointerenter` on an icon cell (DOM events dispatched synthetically via JS did not reliably reproduce the flyout — the real hover action via the browser pointer is required).
- **Transition:** slide-right enter animation, ~150–200 ms ease-out. No backdrop dim.
- **Z-index:** above the main content but below modals.
- **Dismissal:** `pointerleave` on both the icon and the flyout. Clicking anywhere in the main content area also dismisses.
- **Layout:** flyout is ~200 px wide, appears flush to the right edge of the sidebar rail. Rows are left-aligned text, ~40 px tall, with a thin hover highlight.

### §5.4 Complete flyout contents (captured via live hover)

**Products flyout:**
```
▸ Products
  Product list
  Product categories
  Adjustments
  Stock counts          ← §7
  Stock transfers
  Locations
```

**Sales flyout:**
```
▸ Sales
  Sales orders          ← §8
  Sales quotes
  Customers
  Showroom
```

**Purchasing flyout:**
```
▸ Purchasing
  Purchase orders       ← §9
  Purchase quotes
  Vendors
```

**Reports flyout:** see §6 — has its own dedicated page rather than a nested menu.

### §5.5 Gotchas encountered

- **Coordinate-based clicks on flyout rows fail** if the flyout has been summoned via synthetic events: the flyout disappears the moment the mouse moves to the text row because the synthetic `pointerenter` didn't set internal React state. Workaround: use the real `hover` browser action, capture screenshot, then click the row.
- **Direct navigation works** for known routes once discovered: `/stock-counts` (hyphen, plural) navigates successfully. `/stockcount` and `/stockcounts` both 404 with the whimsical message: *"This guitar doesn't exist. Not even on the internet."*

---

## §6 REPORTS MODULE

Reports is a dedicated top-level section reached via the bar-chart icon in the sidebar. The route is `/reports`.

### §6.1 Reports home — overall layout

- **Page title:** `Reports (Sample)`
- **Top-right chrome:** global `Get started` link, `14 days left` pill, `Subscribe now` yellow CTA, `?` help icon, `MS` user avatar (same as every other logged-in page).
- **Primary layout:** a grid of **report family cards**. Each card represents a category; badge in the top-right of the card shows the total number of sub-reports inside that category.
- **Total confirmed families:** 7 (Sales, Purchasing, Inventory, Manufacturing, Financial, B2B, Admin/Audit).
- **Total confirmed sub-reports:** 49 (sum of all family badge counts).

### §6.2 Report families (ASCII layout of the home grid)

```
┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│ Sales          (10)  │  │ Purchasing     ( 8)  │  │ Inventory      (11)  │
│ ─────                │  │ ─────                │  │ ─────                │
│ Customer activity,   │  │ PO summary,          │  │ Stock on hand,       │
│ Sales order summary, │  │ Vendor performance,  │  │ Movement ledger,     │
│ Sales profit,        │  │ Purchasing tax,      │  │ Stock count history, │
│ Payments received…   │  │ Vendor payments…     │  │ Reorder suggestions… │
└──────────────────────┘  └──────────────────────┘  └──────────────────────┘

┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│ Manufacturing  ( 6)  │  │ Financial      ( 5)  │  │ B2B            ( 4)  │
│ ─────                │  │ ─────                │  │ ─────                │
│ WO materials used,   │  │ Tax summary,         │  │ Showroom activity,   │
│ WO finished goods,   │  │ GL export,           │  │ Abandoned carts,     │
│ WIP cost,            │  │ COGS,                │  │ Customer catalogs,   │
│ Materials variance…  │  │ Inventory valuation… │  │ B2B order funnel…    │
└──────────────────────┘  └──────────────────────┘  └──────────────────────┘

┌──────────────────────┐
│ Admin / Audit  ( 5)  │
│ ─────                │
│ User action log,     │
│ Login history,       │
│ Integration sync log,│
│ Permission changes…  │
└──────────────────────┘
```

_Note: the exact sub-report names within each family are paraphrased above from the live hover-tooltip expansion. The 49-total count is verbatim from badge arithmetic but individual titles were not all transcribed._

### §6.3 "Report family" interaction pattern

Clicking a family card navigates to a secondary page showing the full list of sub-reports in that family as a left-aligned list with:

- Report name (bold)
- Short description (one line)
- `Run report` button on the right of each row

Selecting a sub-report opens a filter/parameter bar at the top (date range, location filter, product category filter, etc.) and below it a data grid that renders results once `Run` is clicked.

### §6.4 Key observations about Reports

1. **Parent-child cardinality.** Badges count sub-reports, not executions. A user with 0 reports run still sees `(11)` on Inventory.
2. **Multi-location reports are universal.** Every inventory/financial report observed exposes a location multi-select filter, consistent with inFlow's multi-location-by-default architecture.
3. **Exports.** Each run report has CSV + PDF export buttons in its top-right toolbar (captured but not clicked). This is the primary data-exfiltration surface.
4. **Audit log is first-class.** Admin/Audit is its own family with 5 sub-reports — inFlow treats observability as a shipped feature, not a hidden debug menu.

---

## §7 STOCK COUNTS MODULE

**Route:** `/stock-counts` (note the hyphen; plural only works with hyphen — see §5.5)

Stock counts in inFlow are modeled as a **parent count with one or more child count sheets**. The parent count aggregates state across sheets and tracks overall progress; each sheet is a physically-printable (or scannable) worksheet with its own state machine.

### §7.1 Stock counts list page

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│  Stock counts (Sample)                             [+ New stock count]  │
├─────────────────────────────────────────────────────────────────────────┤
│  [Search…]  [Status ▼]  [Location ▼]  [Date ▼]  [More filters]         │
├─────┬──────────────┬──────────┬────────────┬───────────────┬────────────┤
│ #   │ Count name   │ Status   │ Location   │ Sheets        │ Created    │
├─────┼──────────────┼──────────┼────────────┼───────────────┼────────────┤
│ SC-000001 │ Q4 cycle count       │ Completed    │ Main warehouse │ 3/3   │ 2025-12-01 │
│ SC-000002 │ Annual full count    │ In progress  │ All locations  │ 5/8   │ 2026-02-14 │
│ SC-000003 │ Electronics aisle    │ Completed    │ Main warehouse │ 1/1   │ 2026-03-20 │
│ SC-000004 │ ⏺ (auto next #)      │              │                │       │            │
└───────────┴──────────────────────┴──────────────┴────────────────┴───────┘
```

**Key columns:**
- `#` — document number, prefix `SC-` (configurable in Options → Global → Transaction numbers)
- `Count name` — free-text
- `Status` — enum: Open / In progress / Completed (see §7.3)
- `Location` — single location or "All locations"
- `Sheets` — `completed / total` fraction
- `Created` — date

**Top-right CTA:** `+ New stock count` (yellow button).

**Filters row:** Search by name, Status dropdown, Location dropdown, Date range, More filters (opens a side drawer with additional fields).

### §7.2 Stock count detail page

Navigation: click any row in the list → `/stock-counts/{id}`.

**Layout — header region:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Back    SC-000002 — Annual full count          Status: In progress   │
│                                                        [Actions ▼]      │
├─────────────────────────────────────────────────────────────────────────┤
│  Location: All locations                Created: 2026-02-14             │
│  Counted by: MS                         Completed: —                    │
│  Snapshot taken: 2026-02-14 09:00       Adjustments posted: —           │
└─────────────────────────────────────────────────────────────────────────┘
```

**Body — sheets list (tabular):**
```
┌─────┬─────────────────────┬────────────┬──────────────┬───────────────┐
│ #   │ Sheet name          │ Location   │ State        │ Products      │
├─────┼─────────────────────┼────────────┼──────────────┼───────────────┤
│  1  │ Aisle A — shelves   │ Main WH    │ COMPLETED    │ 42 items      │
│  2  │ Aisle B — bins      │ Main WH    │ IN PROGRESS  │ 31 items      │
│  3  │ Cold storage        │ Main WH    │ OPEN         │ 17 items      │
│  4  │ Overflow            │ Branch 02  │ OPEN         │ 0 items       │
│  5  │ …                                                                │
└─────┴─────────────────────┴────────────┴──────────────┴───────────────┘
   [+ Add sheet]
```

### §7.3 Sheet state machine (the moat)

Each sheet transitions through three explicit states:

```
  ┌──────┐   [Start counting]    ┌──────────────┐  [Complete and adjust]  ┌────────────┐
  │ OPEN │ ────────────────────> │ IN PROGRESS  │ ────────────────────>   │ COMPLETED  │
  └──────┘                       └──────────────┘                         └────────────┘
     │                                  │                                       │
     │                                  │                                       │
  Snapshot                        Count entry                             Adjustments
  taken but                       allowed (scan                           posted to GL
  no counts yet                   or manual)                              and locked
```

**Transition buttons observed:**
- **OPEN → IN PROGRESS:** `Start counting` button (primary yellow) at the top-right of the sheet detail.
- **IN PROGRESS → COMPLETED:** `Complete and adjust` button (primary yellow). Clicking triggers a confirmation modal showing the net adjustment (Δ = counted − on-hand) per line that will be posted as movement ledger entries.

**Parent count rollup logic:**
- Parent `Status = Open` while ALL sheets are Open.
- Parent `Status = In progress` if ANY sheet is In progress (or mixed).
- Parent `Status = Completed` only when ALL sheets are Completed.

### §7.4 Sheet detail page — line item layout

Navigation: click any sheet row → `/stock-counts/{countId}/sheets/{sheetId}`.

**Header:**
```
← Back    Sheet 2 — Aisle B — bins          State: IN PROGRESS
                                     [+ ADD products] [📷 SCAN]
                                     [Start counting] [Complete and adjust]
```

**Body — line item table:**
```
┌────────────┬─────────────────────┬──────────┬──────────┬────────┐
│ Product    │ Sublocation         │ Expected │ Counted  │ Δ      │
├────────────┼─────────────────────┼──────────┼──────────┼────────┤
│ Pan-Saute  │ Aisle B / Bin 03    │     24   │     22   │  -2    │
│ Pan-Saute  │ Aisle B / Bin 04    │     12   │     12   │   0    │
│ Shelf-Met  │ Aisle B / Bin 05    │      8   │      7   │  -1    │
│ …                                                                │
└────────────┴─────────────────────┴──────────┴──────────┴────────┘
```

**Key observations:**
- **ADD products** (plus icon) and **SCAN** (camera icon) are separate entry points — implying mobile/scanner-driven counting is a first-class flow (this is the Stockroom product's sweet spot).
- **Expected** is the snapshot quantity at the time the sheet was created (frozen) — not the live on-hand. This prevents cycle-count drift when concurrent movements occur.
- **Counted** is editable inline (number input).
- **Δ** auto-calculates. Non-zero values are highlighted (positive green, negative red — exact color not verified).
- **Sublocation** column is only shown if the location has sublocations enabled (see §10.3).

### §7.5 Architectural takeaways from Stock Counts

1. **Sheet-based counting is a moat.** The multi-sheet model enables parallel counting by different team members across different areas without merge conflicts. Each sheet is independent; only `Complete and adjust` posts to the ledger.
2. **Snapshot at sheet creation, not at count start.** This is subtle but important: it means a user can leave a sheet in OPEN state for days while other inventory activity continues, and the expected quantities are fixed at the moment the sheet was generated. OneAce currently does not model this.
3. **SCAN is a first-class button.** Scanning is not a power-user hidden feature — it's a yellow button at the same level as ADD. This signals inFlow's hardware-first positioning.
4. **No partial-post option.** You cannot post adjustments for some lines and leave others open — the sheet is all-or-nothing. This simplifies the state machine but forces users to finish a sheet before they benefit from its counts.

---

## §8 SALES ORDERS MODULE

**Route:** `/sales-orders` (hypothesis based on sibling routes; the live walkthrough navigated via the sidebar).

### §8.1 Sales orders list

Columns observed:
- `#` — prefix `SO-`, next number `SO-000026`
- `Customer` — customer name (linked to customer detail)
- `Status` — enum: Draft / Confirmed / Picked / Shipped / Invoiced / Paid (progressive)
- `Order date`
- `Total` — currency
- `Balance` — currency (remaining unpaid)
- `Location` — fulfilling location
- `Assigned to` — sales rep avatar

Top-right CTAs: `+ New sales order` and a dropdown for `New sales quote` (SQ-xxx).

### §8.2 Sales order detail — SO-000025 live capture

**Header region:**
```
← Back   SO-000025        Customer: [linked]      Location: Main warehouse
                          Status: Confirmed        Order date: 2026-04-08
                          [Actions ▼] [Email] [Print] [Save]
```

**Line items table (captured verbatim via text-node walker to defeat virtualization):**
```
┌─────┬───────────────────────────┬────┬──────┬────────┬──────────┐
│ #   │ Item                      │ Qty│ Unit │ Price  │ Subtotal │
├─────┼───────────────────────────┼────┼──────┼────────┼──────────┤
│  1  │ Pan-Saute 10"            │  4 │ ea   │  49.95 │   199.80 │
│  2  │ Bowl-Mixing Large         │ 12 │ ea   │   9.95 │   119.40 │
│  3  │ Knife-Chef 8"             │  2 │ ea   │  29.95 │    59.90 │
└─────┴───────────────────────────┴────┴──────┴────────┴──────────┘
```

**Tabs observed along the top of the detail body:**
- `Order` (active)
- `Documents` — generated PDFs (quote, order, invoice, packing slip)
- `Payments` — payment records
- `History` — activity log for this order

**Footer totals panel (right rail):**
```
Subtotal         379.10
Discount          0.00
Tax (1)          30.33
─────────────────────
Total            409.43
Paid            409.43
Balance           0.00
```

**Crucially: single tax rate.** Sales orders expose ONE tax slot (`Tax (1)`) — this is a key contrast with Purchase orders (§9.3).

### §8.3 Actions dropdown contents

Observed items:
- `Duplicate order`
- `Convert to quote`
- `Cancel order`
- `Email PDF`
- `Print packing slip`
- `Generate invoice`
- `Record payment`
- `Delete` (disabled in sample mode)

---

## §9 PURCHASE ORDERS MODULE

**Route:** `/purchase-orders` (inferred from sidebar link target).

### §9.1 Purchase orders list

Columns observed:
- `#` — prefix `PO-`, next number `PO-000027`
- `Vendor` — vendor name (linked)
- `Status` — enum: Draft / Issued / Partially received / Received / Closed
- `Order date`
- `Expected date` — a field that SO does NOT have
- `Total` — currency
- `Location` — receiving location

Top-right CTAs: `+ New purchase order` and a secondary `+ New purchase quote` (PQ-xxx, next `PQ-000002`).

### §9.2 Purchase order detail — PO-000005 live capture

**Header region:**
```
← Back   PO-000005        Vendor: [linked]       Location: Main warehouse
                          Status: Issued          Order date: 2026-03-22
                          Expected: 2026-04-15    Received: —
                          [Actions ▼] [Email] [Print] [Save]
```

**Line items table:**
```
┌─────┬────────────────────┬────┬──────┬──────────┬──────────┬──────────┐
│ #   │ Item               │ Qty│ Unit │ Expected │ Received │ Subtotal │
├─────┼────────────────────┼────┼──────┼──────────┼──────────┼──────────┤
│  1  │ Raw aluminum sheet │ 50 │ kg   │    50    │    30    │   450.00 │
│  2  │ Copper wire roll   │ 20 │ roll │    20    │    20    │   180.00 │
└─────┴────────────────────┴────┴──────┴──────────┴──────────┴──────────┘
```

Note the **expected vs. received** columns — PO has two quantity fields per line that support partial receiving. SO has a single `Qty` column. This is a fundamental line-model difference.

### §9.3 DUAL-TAX model (major architectural finding)

The PO footer totals panel shows **two tax slots** rather than one:

```
Subtotal         630.00
Discount           0.00
State Tax        37.80    (6%)
Gov't Tax        12.60    (2%)
Extra costs      25.00    ← freight/duty/etc.
─────────────────────
Total            705.40
```

**Implications:**
- Purchase orders support jurisdictions with layered taxes (state + federal, PST + GST, etc.).
- Sales orders use a single tax rate. This asymmetry is unusual and suggests inFlow's data model for PO and SO differ in the tax sub-structure.
- The `Extra costs` line ties to the Costing options modal (§10.2): extra costs are allocated to received inventory using one of three strategies (proportional to price / weight / volume), affecting the landed cost on the movement ledger.

### §9.4 Receiving workflow

Clicking `Actions ▼` → `Receive items` on a PO with Status = Issued:
- Opens a receiving drawer pre-populated with Expected quantities.
- Each line has a `Received` numeric input.
- Confirming posts movement ledger entries (positive quantities, source = vendor).
- If any line has `Received < Expected`, the PO transitions to `Partially received`; else `Received`.
- A subsequent partial receive can bring the PO to `Received` by filling the remainder.

---

## §10 SETTINGS / OPTIONS CLUSTER

**Route:** `/options/{subtab}`

Options is organized as a tabbed page with 9 subtabs:

```
┌─ Global ─┬─ Inventory ─┬─ Orders ─┬─ Integrations ─┬─ Showroom ─┬─ Stockroom ─┬─ Account ─┬─ Team ─┬─ Personal ─┐
```

Subtabs are visually highlighted with a yellow pill background when active. The sample-mode orange banner appears top and bottom of every subtab.

### §10.1 Options — Global subtab (`/options/global`)

Single full-width card at the top:
- **Company details** — address, tax ID, logo upload, contact info.

Below, a 2-column layout:

**Left column — `⚙ Preferences`:**
- **Currency and exchange rates** — see modal in §11.3
- **Dimensions and weight** — see modal in §11.4
- **Costing options** — see modal in §11.1 (the big one)
- **Close transactions** — see modal in §11.2

**Right column — `✎ Customization`:**
- **Custom fields** — see modal in §4.14 above (10-slot editor)
- **Transaction numbers** — see modal in §11.5
- **Rename fields** — see modal in §11.6

### §10.2 Options — Inventory subtab (`/options/inventory`)

2-column layout.

**Left column:**
- **Locations** — modal in §11.7
- **Product categories** — category tree editor
- **Adjustment reasons** — modal in §11.8
- **Picking options** — modal in §11.9
- **Variants** — modal in §11.10 (KEY FINDING)
- **Units of measure** — UoM list

**Right column:**
- **Labels** / `Create` label template
- **Barcode types:**
  - **Internal barcodes** — Manage, Print
  - **Licensed barcodes** — GS1 partnership info (Amazon/Walmart compatible)
  - **Buy barcodes** ↗ — external link

### §10.3 Options — Orders subtab (`/options/orders`)

**Left column:**
- **Pricing schemes** — create/manage multiple pricing schemes (tiered pricing, customer-specific)
- **Taxing schemes** — create/manage tax schemes assigned to orders
- **Payment terms** — modal in §11.11
- **Payment methods** — list of accepted payment methods
- **Carriers** — shipping carrier list

**Right column:**
- **Documents** — layout/content customization for invoices, quotes, packing slips (Document Designer)
- **Email Designer** — email template customization
- **Shipping** — Powered by `easypost` — buy/print shipping labels, track shipments
- **inFlow Pay** — Worldline/Bambora integration for Visa/Mastercard/Amex (US/Canada only)

### §10.4 Options — Account subtab (`/options/account`)

This is ALSO the paywall / upgrade page when the `Subscribe now` button is clicked (see §12).

**Top banner:**
```
┌───────────────────────────────────────────────────────────────┐
│ 1 MEMBERS                                  Current trial     │
│ Your trial expires on [April 25, 2026 6:59am]                 │
│                                             inFlow Inventory  │
│ Trial day 1 of 14                                             │
│                                   Switch to inFlow Mfg → →    │
└───────────────────────────────────────────────────────────────┘
```

Below the banner is the tier selector and feature matrix (§12).

### §10.5 Options — other subtabs (surfaced but not fully traversed)

- **Integrations** — catalog of 95+ connectors (same data as the public marketing page)
- **Showroom** — B2B portal on/off, catalog config, Showroom Pro upsell
- **Stockroom** — mobile-scan app config, Smart Scanner pairing
- **Team** — team member list, roles, invites
- **Personal** — current user profile, password change, notifications

---

## §11 MODAL LIBRARY (VERBATIM CAPTURES)

_Each modal below was opened from the Options subtabs listed in §10. Layouts captured via live screenshot; content transcribed verbatim where possible._

### §11.1 Costing options modal

**Open path:** Options → Global → Costing options

**Layout:** 1-column. Title "Costing options". Description text at top. Two radio groups below.

```
┌──────────────────────────────────────────────────────────┐
│  Costing options                                         │
│                                                          │
│  Select your preferred costing method. This determines   │
│  how inFlow calculates the cost of goods sold.           │
│                                                          │
│  Costing method                                          │
│  (•) Moving average                                      │
│  ( ) Manual                                              │
│  ( ) First in, first out (FIFO)                          │
│  ( ) Last in, first out (LIFO)                           │
│                                                          │
│  Extra cost allocation                                   │
│  When receiving inventory, how should extra costs        │
│  (freight, duty, etc.) be allocated to line items?       │
│                                                          │
│  (•) Proportional to price                               │
│  ( ) Proportional to weight                              │
│  ( ) Proportional to volume                              │
│                                                          │
│                                        [Cancel] [Save]   │
└──────────────────────────────────────────────────────────┘
```

**This answers Open Question #1 from the teardown:** costing method is **user-configurable** with 4 options. Default (in sample) is Moving average + Proportional to price.

### §11.2 Close transactions modal

**Open path:** Options → Global → Close transactions

```
┌──────────────────────────────────────────────────────────┐
│  Close transactions                                      │
│                                                          │
│  Choose whether transactions can be changed after        │
│  fulfillment.                                            │
│                                                          │
│  (•) Do not close transactions                           │
│  ( ) Close transactions after  [  ] day(s)               │
│  ( ) Close transactions before [Date picker]             │
│                                                          │
│                                        [Cancel] [Save]   │
└──────────────────────────────────────────────────────────┘
```

### §11.3 Currency and exchange rates modal

```
┌──────────────────────────────────────────────────────────┐
│  Currency and exchange rates                             │
│                                                          │
│  Home currency:  US Dollar ($)   [Change]                │
│                                                          │
│  Automatic exchange rates                                │
│  POWERED BY  [OpenExchangeRates logo]                    │
│  Updated daily                                           │
│                                                          │
│  [+ Add custom exchange rate]                            │
│                                                          │
│                                        [Cancel] [Save]   │
└──────────────────────────────────────────────────────────┘
```

### §11.4 Dimensions and weight modal

```
┌──────────────────────────────────────────────────────────┐
│  Dimensions and weight                                   │
│                                                          │
│  Dimensions [Imperial (in, ft) ▼]                        │
│  Weight     [Imperial (oz, lb)  ▼]                       │
│                                                          │
│                                        [Cancel] [Save]   │
└──────────────────────────────────────────────────────────┘
```

### §11.5 Transaction numbers modal (SEVEN rows)

```
┌──────────────────────────────────────────────────────────┐
│  Transaction numbers                                     │
│                                                          │
│  Document        Prefix    Next number    Suffix         │
│  Sales order     [SO-]     [000026]       [     ]        │
│  Sales quote     [SQ-]     [000002]       [     ]        │
│  Purchase order  [PO-]     [000027]       [     ]        │
│  Purchase quote  [PQ-]     [000002]       [     ]        │
│  Stock count     [SC-]     [000004]       [     ]        │
│  Stock adjustment[SA-]     [000064]       [     ]        │
│  Stock transfer  [ST-]     [000012]       [     ]        │
│                                                          │
│                                        [Cancel] [Save]   │
└──────────────────────────────────────────────────────────┘
```

**Key observation:** 7 distinct transaction document types, each with configurable prefix/next-number/suffix. The current live next-numbers reveal activity level in the sample account (SO > PO > SA > ST > SC > SQ ≈ PQ).

### §11.6 Rename fields modal (i18n / label customization table)

**Open path:** Options → Global → Rename fields

```
┌──────────────────────────────────────────────────────────┐
│  Rename fields                                           │
│                                                          │
│  Customize the text shown on screen and in documents.    │
│                                                          │
│  Default text         Custom text                        │
│  ─────────────────    ──────────────                     │
│  &Sales Reps          [                ]                 │
│  Add sublocation      [                ]                 │
│  Billing Address      [                ]                 │
│  Carrier              [                ]                 │
│  Contact              [                ]                 │
│  Contact Name         [                ]                 │
│  Customer             [                ]                 │
│  CUSTOMER             [                ]                 │
│  … (many more rows, scrollable)                          │
│                                                          │
│  [Reset all]                         [Cancel] [Save]     │
└──────────────────────────────────────────────────────────┘
```

**Implication:** inFlow exposes a flat string-table of every UI label as a customization surface. This is simultaneously a poor-man's i18n system AND a white-label/re-terminology feature (change "Customer" → "Client", "Sales rep" → "Account exec"). The `&` prefix on `&Sales Reps` is a menu-mnemonic hint (the letter after `&` becomes the keyboard shortcut).

### §11.7 Locations modal

```
┌──────────────────────────────────────────────────────────┐
│  Locations                                               │
│                                                          │
│  [x] Break locations down into sublocations              │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ # │ Location name      │ Address         │  ⋮     │ │
│  │ 1 │ Main warehouse     │ 123 Main St     │  ⋯     │ │
│  │ 2 │ Branch 02          │ 456 Oak Ave     │  ⋯     │ │
│  │ 3 │ Retail store       │ 789 Elm Blvd    │  ⋯     │ │
│  │ 4 │ Offsite overflow   │ 321 Pine Rd     │  ⋯     │ │
│  │ 5 │ Vehicle #1 (truck) │ (mobile)        │  ⋯     │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  [+ Add location]                                        │
│  [ ] Show deactivated                                    │
│                                                          │
│                                        [Cancel] [Save]   │
└──────────────────────────────────────────────────────────┘
```

**KEY FINDING:** `Break locations down into sublocations` is a **toggleable global feature**, not always-on. Turning it off removes the Sublocation column from count sheets, product detail breakdowns, and movement ledger rows. Turning it on creates a new nested entity type (Sublocation) that lives under Locations.

### §11.8 Adjustment reasons modal

```
┌──────────────────────────────────────────────────────────┐
│  Adjustment reasons                                      │
│                                                          │
│  Reasons that can be attached to stock adjustments.      │
│  System reasons cannot be edited or deleted.             │
│                                                          │
│  🔒 Integration import       [system — disabled]         │
│  🔒 Disassembly              [system — disabled]         │
│     Correction               [ Edit ] [ × ]              │
│     Internal usage           [ Edit ] [ × ]              │
│     Write-Off                [ Edit ] [ × ]              │
│                                                          │
│  [+ Add reason]                                          │
│  [ ] Show deactivated                                    │
│                                                          │
│                                        [Cancel] [Save]   │
└──────────────────────────────────────────────────────────┘
```

**Architectural split:** System reasons (owned by inFlow, used by integrations and internal features) are locked. User reasons are editable and soft-deletable.

### §11.9 Picking options modal

```
┌──────────────────────────────────────────────────────────┐
│  Picking options                                         │
│                                                          │
│  Choose what inFlow should prioritize during picking.    │
│                                                          │
│  (•) The default sublocation, then sublocations in       │
│      alphabetical order                                  │
│  ( ) The default sublocation, then sublocations with     │
│      the highest quantity                                │
│  ( ) Non-default sublocations with the lowest            │
│      quantities, then the default sublocation            │
│                                                          │
│                                        [Cancel] [Save]   │
└──────────────────────────────────────────────────────────┘
```

**Observation:** Picking sophistication is limited to three heuristics selectable globally. There is no per-product override, no wave/batch picking, no zone picking. This answers Open Question #4 from the teardown: **picking sophistication is intentionally minimal** — inFlow targets SMB operators who want a good default, not WMS power users.

### §11.10 Variants modal (KEY FINDING)

**Open path:** Options → Inventory → Variants

**Layout:** searchable list of "option groups", each containing "variants" (values). Clicking the → arrow on a group expands it inline for value editing (same pattern as §4.14.2 Custom fields inline editor).

```
┌──────────────────────────────────────────────────────────┐
│  Variants                                                │
│                                                          │
│  [🔍 Search options and variants]                        │
│                                                          │
│  × Coating                                          →    │
│    [Regular] [Non-Stick]                                 │
│                                                          │
│  × Color                                            →    │
│    [Red] [Gray]                                          │
│                                                          │
│  × Dimensions                                       →    │
│    [1"x4"x8'] [2"x4"x8'] [2"x6"x8'] [4"x4"x10']          │
│                                                          │
│  × Pack size                                        →    │
│    [25 Pk]                                               │
│                                                          │
│  × Pan type                                         →    │
│    [10" Sautee Pan] [20 cm Sautee Pan]                   │
│    [8 QT Clad Stock Pot] [20 cm 3 L Sauce Pan]           │
│    [16 cm 1.7 L Sauce Pan]                               │
│                                                          │
│  × Size                                             →    │
│    [LRG] [MD] [SM] [XS]                                  │
│                                                          │
│  × Storage capacity                                 →    │
│    [256GB] [512GB]                                       │
│                                                          │
│  × Volume                                           →    │
│    [3L] [6L]                                             │
│                                                          │
│  [+ Add another option]                                  │
│                                                          │
│                                        [Cancel] [Save]   │
└──────────────────────────────────────────────────────────┘
```

**DATA MODEL INFERRED:**

```
Option (e.g., "Color")
 ├── Variant (value) "Red"
 ├── Variant (value) "Gray"
 └── …

Product (e.g., "Pan-Saute")
 ├── uses Option "Pan type"
 ├── uses Option "Size"
 └── SKU matrix = cartesian(Pan type, Size) per product
```

- **Options are GLOBAL.** One "Color" option, shared across all products. Adding a new color value is a single global action, not per-product.
- **Variants are global values.** "Red" is a single value belonging to "Color", not duplicated per product.
- **Each product opts IN to the options it uses.** A product decides which options apply to it. A cartesian expansion produces the SKU matrix.
- **Contrast with OneAce:** SC currently models variants as flat SKU rows with per-row attributes. inFlow's two-level model (global options → product opt-in → cartesian) is more normalized. This is a significant architectural lead for inFlow in apparel/fashion/retail verticals.

### §11.11 Payment terms modal (from Orders subtab)

```
┌──────────────────────────────────────────────────────────┐
│  Payment terms                                           │
│                                                          │
│  Set up payment terms to automatically generate payment  │
│  due dates for sales and purchase orders. You can assign │
│  these terms at the customer and vendor level.           │
│  Learn more ↗                                            │
│                                                          │
│  Payment terms name       Days due                       │
│  ─────────────────────    ─────────                      │
│  × [Due on receipt   ]    [ 0]                           │
│  × [Net 10           ]    [10]                           │
│  × [Net 15           ]    [15]                           │
│  × [Net 30           ]    [30]                           │
│  × [Net 45           ]    [ 0]   ← note: Net 45 / 0 bug? │
│  × [Net 60           ]    [60]                           │
│                                                          │
│  [+ Add payment term]                                    │
│                                                          │
│  [ ] Show deactivated                  [Cancel] [Save]   │
└──────────────────────────────────────────────────────────┘
```

**Oddity:** the "Net 45" row shows `0` in the Days due column. This may be sample-data noise, or may indicate the value wasn't set during sample seed. Flagging as a data quality observation, not a feature.

---

## §12 PAYWALL / UPGRADE SURFACE

**Route:** `/options/account` (also reachable by clicking the `Subscribe now` yellow pill in the top-right global chrome).

### §12.1 Trial status banner

```
┌──────────────────────────────────────────────────────────┐
│  1 MEMBERS                                               │
│                                          Current trial   │
│  Your trial expires on                                   │
│   [April 25, 2026 6:59am]                inFlow Inventory│
│                                                          │
│  Trial day 1 of 14                                       │
│                                Switch to inFlow Mfg → →  │
└──────────────────────────────────────────────────────────┘
```

**Observations:**
- Trial length: 14 days (not 7, not 30).
- Account is already tracking "1 MEMBERS" count for billing.
- The `Switch to inFlow Manufacturing` link is right-aligned and reveals that the Inventory and Manufacturing SKUs share an account shell but are mutually-exclusive subscriptions at the account level.

### §12.2 Hero and toggle

```
┌──────────────────────────────────────────────────────────┐
│     ✦                                                 ✦  │
│           Inventory and order control                   │
│              without spreadsheets                        │
│                                                          │
│   [🔍]             [$]             [||||]                │
│   Track inventory  Buy and sell    Design and print      │
│   in real time     from one        your own barcode      │
│   from any device  system          labels                │
│                                                          │
│            ┌──────────────────┬──────────┐               │
│            │ Annual  Save 20% │ Monthly  │               │
│            └──────────────────┴──────────┘               │
└──────────────────────────────────────────────────────────┘
```

**Toggle default:** Annual (with "Save 20%" badge) is selected; Monthly is the alternate. A 20% annual discount is standard-issue for SaaS.

### §12.3 Tier cards (Annual pricing)

Three visible side-by-side tiers. The middle tier has a yellow-tinted background + ribbon:

```
┌─────────────────┐  ╔═════════════════╗  ┌─────────────────┐
│      ✦          │  ║    ✦ MOST POPULAR ║  │     ✦           │
│                 │  ║                   ║  │                 │
│ Entrepreneur    │  ║ Small Business    ║  │ Mid Size Plan   │
│ Plan            │  ║ Plan              ║  │                 │
│                 │  ║                   ║  │                 │
│ Starts at       │  ║ Starts at         ║  │ Starts at       │
│                 │  ║                   ║  │                 │
│   129 USD/mo.   │  ║   349 USD/mo.     ║  │   699 USD/mo.   │
│                 │  ║                   ║  │                 │
│ billed annually │  ║ billed annually   ║  │ billed annually │
│                 │  ║                   ║  │                 │
│ [Subscribe now] │  ║ [Subscribe now]   ║  │ [Subscribe now] │
└─────────────────┘  ╚═══════════════════╝  └─────────────────┘
```

A fourth (Enterprise) card appears below the tier row with a `Contact Sales` CTA instead of a price:

```
┌──────────────────────────────────────────────────────────┐
│  Need a scalable solution for a large organization?     │
│                            │  Inventory locations        │
│                            │    Unlimited                │
│     [Contact Sales]        │                             │
│                            │  Onboarding package         │
│                            │    Required one-time cost,  │
│                            │    499 USD                  │
│                            │                             │
│                            │  (extras: Serial numbers,   │
│                            │   Premium database, SSO)    │
│                            │                             │
│                            │  ★ Optional Smart Scanner   │
│                            │     (sold separately)       │
└──────────────────────────────────────────────────────────┘
```

### §12.4 Feature matrix (excerpt — Entrepreneur / Small Business / Mid Size)

| Feature               | Entrepreneur | Small Business | Mid Size |
|-----------------------|--------------|----------------|----------|
| Team members          | 2            | 5              | 10       |
| View-only access      | ✗            | +5 viewers     | +10 viewers |
| Sales orders/yr       | 1,200        | 12,000         | Unlimited |
| Integrations          | 1            | 3              | 5        |
| Inventory locations   | 1 (no sub)   | Unlimited      | Unlimited |
| User access rights    | ✗            | ✓              | ✓ Advanced |
| API Access            | ✗            | ✗              | ✓        |
| Showroom              | ✗            | ✓              | ✓ Showroom Pro |
| Single sign-on (SSO)  | ✗            | ✗              | ✓        |
| Technical support     | ✓            | ✓              | ✓ Expanded |

**Plan add-ons row (each tier shows a toggle to add extras):**

| Add-on              | Entrepreneur | Small Business | Mid Size |
|---------------------|--------------|----------------|----------|
| Extra team member   | +59 USD/mo   | +49 USD/mo     | +39 USD/mo |

**Implication:** per-seat price DECREASES with tier, incentivizing larger teams to land at higher tiers. This is a classic tier-based pricing ladder.

### §12.5 Onboarding section (below the tier table)

```
                           ONBOARDING
                    Set yourself up for success
     Your dedicated Customer Success Manager (CSM) will help you
              find the best workflow for your business.

┌──────────────────────────────────────────────────────────┐
│ Personalized    │  Your CSM will learn about your        │
│ onboarding      │  business goals and customize an       │
│                 │  implementation plan for you. You'll   │
│                 │  get reports on progress and next      │
│                 │  steps.                                │
│                 │                                        │
│                 │  After onboarding your CSM will        │
│                 │  continue to work with you as your     │
│                 │  dedicated contact for workflow or     │
│                 │  account questions.                    │
└──────────────────────────────────────────────────────────┘
```

**Takeaway:** onboarding is positioned as a value-add, not as friction. The $499 one-time onboarding fee (Enterprise tier) is framed around CSM-led implementation, not a barrier. Sample-mode users see this as aspiration, not a gate.

---

## §13 POST-CAPTURE SYNTHESIS — ARCHITECTURAL TAKEAWAYS

These are the insights most relevant to OneAce's competitive positioning. See `inflow-inventory-teardown.md` §12 (Open Questions answered) and §14 (Strategic implications) for the full narrative version.

1. **Costing method is configurable, not hardcoded.** 4 methods (Moving avg, Manual, FIFO, LIFO) + 3 extra-cost allocation strategies. SC ships with moving average only; this is a feature gap for any customer who has accountant-driven costing requirements.

2. **Variants are a two-level global model.** Option → Variant → per-product opt-in → cartesian SKU matrix. SC's flat-SKU approach is simpler but less normalized. Apparel and multi-size SKUs at scale are a known weakness on the SC side.

3. **Sublocation is a toggle.** Not all customers want bins/aisles. inFlow lets you turn the whole feature off globally. SC should consider the same graceful-degrade pattern rather than forcing the hierarchy.

4. **Stock counts are sheet-based with per-sheet state machines.** Snapshot-at-creation (not at count-start) is the subtle but important trick that enables parallel counting without merge conflicts. SC's current single-count model is sufficient for small ops but will fail at multi-person warehouse counts.

5. **PO dual tax, SO single tax.** Unusual asymmetry — PO supports layered taxes (state + gov't) that SO does not. SC has single tax on both; a PO-side enhancement is cheap and would close a compliance gap for multi-jurisdiction vendors.

6. **10-slot hardcoded custom fields.** Global, not per-category. Soft-deletable. Types mutable after creation. SC's model is similar in spirit; the "max 10" is a smart simplification SC could learn from (SC currently has no cap, which creates schema bloat).

7. **Rename Fields is a full string-table customization layer.** This is i18n + white-labeling + terminology flexibility rolled into one. SC does not expose this today; it's a lightweight way to differentiate for customers with non-English or industry-specific vocabularies.

8. **Picking is intentionally minimal.** 3 global heuristics, no overrides, no wave/batch. inFlow is NOT trying to be a WMS. SC should not either — any investment in picking is chasing a customer segment inFlow has already decided to abandon.

9. **Audit is first-class.** Admin/Audit is its own reports family with 5 sub-reports. SC has movement history but no dedicated audit surface. This is table-stakes for compliance-sensitive buyers.

10. **Sample mode is a partial-permission scheme, not a full sandbox.** ADD and EDIT work; DELETE and DEACTIVATE don't. This is a clever trial mechanism that lets users feel productive without risking the sample data's coherence. SC's trial mode is a full sandbox — consider the inFlow middle-ground.

