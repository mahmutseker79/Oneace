# Sortly — Competitor Teardown

**Analysis date:** 2026-04-10
**Analyst:** Claude (Cowork mode) with live exploration of https://app.sortly.com
**Demo account:** Mahmut (Free plan, seat-limited)
**App version observed:** v10.107.0-R216.0.0
**Scope:** Web app only (iOS/Android apps not evaluated directly, but referenced via upgrade-plan copy and Sage assistant)
**Sister document:** `inflow-inventory-teardown.md` (same folder). OneAce is at ~50% parity with inFlow; this file does the same reconstruction-grade walk for Sortly so the SC roadmap can be prioritised against both competitors at once.
**Figma-ready blueprint:** `sortly-figma-blueprint.md` (same folder) contains the full per-screen specification — every page, every field, every button, every menu, every modal, every flow — designed to be consumed directly by a Figma designer or a dev implementing a clone. This teardown file stays focused on analysis and roadmap; the blueprint file stays focused on implementation specs.

---

## 1. Positioning in one paragraph

Sortly is a visual-first, SMB-friendly inventory app built around photo-driven item cards, folder trees, and mobile barcode scanning. Compared to inFlow, it is lighter on ERP muscle (no manufacturing, no B2B portal, weaker sales fulfilment) and much heavier on "pretty, mobile-friendly asset tracking." Its sweet spot is non-technical teams that want to photograph their stuff, stick a QR on it, and know where it is: field service vans, schools, film/TV prop rooms, construction sites, medical practices, small warehouses. The product is monetised aggressively via a freemium gate (100 items / 1 seat / 1 custom field on Free) and a four-tier ladder up to Enterprise. It now bundles three workflow verbs on top of the item catalogue — **Stock Counts**, **Pick Lists (NEW)**, and **Purchase Orders (NEW)** — which is where it overlaps most directly with OneAce.

---

## 2. Information architecture

### 2.1 Global chrome
Every authenticated page is wrapped in the same three-region shell:

- **Top-left logo** linking to `/dashboard`.
- **Left icon rail** (primary nav, 7 entries + upgrade + utility cluster). Entries are all icon-first with a text label beneath, giving the rail a ~72 px width. Icons are monochrome with an accent color on hover/active.
- **Main content region** (white card background).
- **Right-side Sortly Sage panel** (AI assistant, persistent on every page — see §11).
- **Top-right utility cluster** inside the rail footer: Product News (megaphone), Help (question mark), Notifications (bell, with `Alt+T` shortcut), Settings (gear).
- **Footer-of-page version string** `Version: v10.107.0-R216.0.0` appears on every screen — a nice honesty signal.

### 2.2 Primary navigation (left rail)
URL paths were pulled directly from the accessibility tree, so this list is authoritative:

| # | Label | Path | Notes |
|---|---|---|---|
| 1 | Dashboard | `/dashboard` | Home screen with usage widgets |
| 2 | Items | `/items` | Folder/item browser (tree view) |
| 3 | Search | `/advanced-search` | Powerful multi-filter query builder |
| 4 | Tags | `/tags` | Manage colour-coded tags |
| 5 | Workflows | `/workflows` | **"New"** badge — Pick Lists, POs, Stock Counts |
| 6 | Reports | `/reports` | 6 canned report types |
| 7 | Labs | `/labs` | **"Beta"** badge — opt-in experimental features |
| 8 | Upgrade Plan | `/upgrade-plan` | Gold CTA tile pinned near bottom |
| 9 | Product News | `.` (modal/popover) | Frill changelog widget |
| 10 | Help | (modal) | Likely deep-links to docs + Sage |
| 11 | Notifications | (panel) | `Alt+T` shortcut |
| 12 | Settings | (panel → 13 settings routes) | See §2.3 |

The "New" badge on Workflows and the "Beta" badge on Labs are deliberate growth-marketing breadcrumbs: they want returning free users to click into monetisation surfaces.

### 2.3 Settings panel
Clicking the gear opens a full settings column (not a drawer — it occupies the main content region with its own sub-nav list on the left). The full Settings sidebar is:

| Section | Path | Notes |
|---|---|---|
| User Profile | `/user-profile` | First/Last/Email/Phone/Job Function/Job Title + Change Password + Linked Accounts (Google, Apple ID) |
| Preferences | `/user-preferences` | UI locale / display prefs |
| Company Details | `/company-details` | Company info + general settings (Country, Currency, Timezone, Date format) |
| Addresses | `/company-addresses` | Multiple business addresses, search + "New Address" button |
| Plan & Billing | `/billing-info` | Current plan, usage meters, payment methods, payment history |
| User Access Control | (modal/gated) | Manage seats, roles |
| Custom Fields | `/manage-custom-attributes/node` | 12 field types (§4) |
| Units of Measure | `/manage-units` | Paid — redirects to `/user-profile` on Free |
| Manage Alerts | `/manage-alerts` | Paid — redirects to `/user-profile` on Free |
| Bulk Import | `/import` | 4-step wizard (§5) |
| Feature Controls | `/feature-controls` | Paid feature toggles (e.g. "Return to Origin") |
| Create Labels | (button, opens modal) | QR/barcode label designer |
| Public API (beta) | `/public-api` | Paid — redirects to `/user-profile` on Free |
| Slack | `/integrations/slack` | Ultra-plan |
| Microsoft Teams | `/integrations/teams` | Ultra-plan |
| QuickBooks Online | `/integrations/quickbooks` | Premium-plan |

The Settings surface is the single most revealing screen in the app — it basically documents every adjacent paid capability at once. If you want a lightning-fast read on the product's scope, open the gear.

---

## 3. Dashboard
The dashboard is a low-density "welcome" screen for the Free tier: a big greeting, a "Getting started" checklist (add your first item, add a folder, invite a teammate, set up a label), and a compact usage meter. Sage occupies ~25% of the horizontal space on the right with six canned prompts:
- "How to add items?"
- "How to create Invoices?"
- "How to upgrade?"
- "How to print barcode labels?"
- "How to set up my inventory?"
- "How to import?"

There is **no chart, no trend, no value-over-time** on the Free dashboard. That's a deliberate gap — the real dashboards sit behind Reports and Insights, which are paid. In the OneAce roadmap context, this is notable: SC's Insights engine (valuation trends, low-stock signal, activity over time) is a direct competitive differentiator even against a $74/mo Ultra Sortly plan.

---

## 4. Items model

### 4.1 Folder/item tree
`/items` is a grid of folder cards (with item thumbnails composited on the card). Folders are recursive — click into a folder and you get `/folder/{id}/content` which shows the same grid pattern again, plus items. The demo had three seed folders:
- **Main Location** (id 108282915)
- **Storage Area** (id 108282916)
- **Truck** (id 108282917)

Each folder card shows item count in the corner. Two display modes toggle at the top-right of the list: **Grid** and **List/Table**. Grid shows photo-first cards (the product's signature look); List shows a denser row view.

Top-right of the Items screen surfaces four actions:
- **Add Item** (primary button, blue)
- **Add Folder** (secondary)
- **Bulk Import** (link to `/bulk-item-import`)
- **History** (link to `/activity-history`) and **Trash** (`/trash`)
- A search box scoped to "Search All Items"
- A "Group Items" toggle (collapses duplicates with the same Sortly ID into rollups)

### 4.2 Item detail view
Opening an item (observed on item `hghhh`, id 108282918, SID `SOED8T0001`) shows a two-column layout:
- **Left column (60%)**: Large photo carousel with +/− quantity buttons immediately below the image, the item name as an H1, and the quantity display as a prominent numeric with unit.
- **Right column (40%)**: Field stack — Sortly ID (auto-generated), Price, Barcode/QR, Notes, and any custom fields the user has added.
- **Action row above the photo**: Edit, Move, Export (PDF item sheet), Chart/Insights (gated), and an overflow menu.
- **Activity timeline** at the bottom: a reverse-chronological feed of every edit with user avatar, timestamp, and human-readable diff.

### 4.3 Item edit form
The edit form (`/item/{id}/edit`) is a single long column with these built-in fields:
- **Name** (required, text)
- **Photo** (multi-photo upload, drag/drop, camera-capture on mobile)
- **Quantity** + **Unit** (numeric + unit selector)
- **Price** (currency, inherits company currency — observed as TRY)
- **Minimum level** (for low-stock alerts)
- **Tags** (multi-select, chip UI)
- **Sortly ID / SID** (auto-generated, editable)
- **Barcode / QR code** (text + scan button that opens the webcam)
- **Notes** (long text)
- **Custom fields** (slot into the form at the bottom)
- **Folder** (move/location)

No `Cost` vs `Sell price` split on the Free tier item card — just a single `Price` field. (Sortly has two-sided pricing but it's gated behind the Advanced plan.)

### 4.4 Sortly ID (SID)
Every item gets an auto-generated alphanumeric ID like `SOED8T0001`. This is separate from the barcode and is used as the stable handle for imports and the API. Users can search by SID from the Advanced Search screen.

---

## 5. Custom Fields
The single most important paid surface in Sortly. Opening `/manage-custom-attributes/node` presents two UX layers: a **Suggested Fields** picker (Step 1) and then a **Choose Field Type** grid of **12 custom types**. Every row below was verified by clicking the card and reading the live preview + hint copy.

### 5.1 The Create Custom Field flow
Clicking "Add Custom Field" from the Custom Fields settings page opens a two-step modal. Free-plan state at the top shows: *"You can add 1 custom field on the Free plan."* with a `View plans` link and a `0 of 1 custom field added. Upgrade to get more custom fields` meter on the underlying list page. The list page itself has an `Show on item page:` selector defaulting to **Populated Fields** (the alternative presumably being **All Fields**).

Step 1 opens on a **Suggested Fields** picker — six preset templates designed to get first-time users over the blank-page problem without needing to understand type semantics:

| Template | Type it becomes | Use case hinted |
|---|---|---|
| Serial Number | Small Text Box | Per-item tracking ID |
| Model/Part Number | Small Text Box | SKU-adjacent identifier |
| Purchase Date | Date | Depreciation / warranty start |
| Expiry Date | Date | Food, pharma, chemicals |
| Product Link | Web Link | Vendor reorder URL |
| Size | Small Text Box | Clothing / packaging |

A `Back to suggested fields` link plus a `+ Create your own field` entry drop the user into the second layer: the full 12-type grid.

### 5.2 Verified 12 custom field types (corrects speculative list)

| # | Type | Free? | Hint copy (verbatim from modal preview) | Limits / Notes |
|---|---|---|---|---|
| 1 | **Small Text Box** | ✅ | *"(eg. Serial Number, Manufacturer Name, Customer ID, etc.)"* | Character Limit **190** |
| 2 | **Large Text Box** | ✅ | *"(eg. Address, Status, Instructions, Notes, Details, etc.)"* | Character Limit **4000** |
| 3 | **Round Number** | ✅ | *"numbers without decimals - eg. Quantity, Count, etc."* | Integer only |
| 4 | **Decimal Number** | ✅ | *"numbers with decimals - eg. Cost, Selling price, Measurements like Area, Length, etc."* | Float |
| 5 | **Checkbox** | ✅ | *"Yes or No status - eg. Damaged, Repaired, Lent, Sold, etc."* | Boolean |
| 6 | **Dropdown** | ✅ | *"(Allows to select one option from a list)"* | **Options limit 250** — single-select, not multi-select |
| 7 | **Date** | ✅ | *"eg. Expiry Date, Purchase Date, etc."* | Drives Ultra-tier "date-based notifications" when combined with Manage Alerts |
| 8 | **Scanner** | ✅ | *"Scan and connect additional barcodes or QR codes"* | **Secondary-barcode field** (see §5.3) |
| 9 | **Phone Number** | ✅ | *"eg. (123) 350 - 2345, +9144235423"* | Formatted tel input |
| 10 | **Web Link** | ✅ | *"eg. https://www.google.com"* | URL only — no separate display label |
| 11 | **Email** | ✅ | *"eg. mail@example.com"* | Formatted email input |
| 12 | **File Attachment** | ❌ | *(Clicking this card immediately triggers the Ultra-plan upgrade modal — see §8)* | **Ultra-gated**, confirmed live |

**Free plan cap:** **1 custom field total** across the account (not per item type — one account-wide slot). Advanced: 5. Ultra: 10. Premium: 20. Enterprise: Unlimited.

**Corrections to initial guesses:** Earlier scans of Sortly's marketing pages implied `Formula`, `Multi-select`, and `Rating` custom field types. The live walkthrough confirms **none of those exist**. Sortly does not ship a formula / computed field, does not ship a true multi-select (Dropdown is single-select with a 250-option cap), and does not ship a 1–5 stars rating type. This is important because SC's formula and multi-select types are now confirmed unique capabilities against Sortly.

### 5.3 The Scanner field type is a big deal
Hidden inside the 12 types is a **Scanner** field, described as *"Scan and connect additional barcodes or QR codes."* This is not the item's primary barcode — every Sortly item already has a primary barcode/QR in its built-in fields — this is a **secondary barcode custom field**, meaning a single item can carry multiple scan identifiers (manufacturer UPC + internal asset tag + container ID, etc.). For SC, this is an area of meaningful gap: SC's custom field types do not currently include a first-class "scannable" type that triggers the camera on mobile. Adding a `Scanner` field type would be cheap (reuse the existing scan modal from stock count) and would immediately close this gap.

### 5.4 OneAce parity check
| Dimension | OneAce | Sortly |
|---|---|---|
| Number of types | More (incl. Formula, Multi-select) | 12 |
| Free-tier cap | Generous | **1 field total** |
| Formula / computed | ✅ | ❌ |
| Multi-select | ✅ | ❌ (Dropdown is single) |
| Secondary barcode / Scanner type | ❌ | ✅ |
| File attachment on Free | ❓ | ❌ (Ultra) |
| Character limits exposed in UI | ❓ | ✅ (190 / 4000 / 250 options) |

Net: SC wins on breadth (Formula + Multi-select + free attachments if shipped), Sortly wins on the Scanner type. Adding a Scanner field type to SC is the highest-ROI custom-fields follow-up.

---

## 6. Bulk Import
`/import` is a **4-step wizard** displayed as a top stepper:
1. **Import method** — choose between **Quick Import** (recommended for new users — CSV/XLSX into a single folder, "1 minute") and **Advanced Import** (Sortly template, multi-folder, multi-variant, imports folders themselves).
2. **Upload file** — drag-drop CSV/XLSX.
3. **Map fields** — column-to-field mapping grid.
4. **Review** — preview diffs before committing.

Quick vs Advanced is a smart UX call — it means first-time users can't get stuck in column mapping purgatory.

---

## 7. Advanced Search
`/advanced-search` is a multi-criteria filter builder with a left filter panel and a live results grid on the right. Filters available (all composable):

- **Folders** — multi-select across the full folder tree, with an "All Folders" toggle
- **Name** — free-text contains
- **Quantity** — Min / Max or Exact value, scoped to a Unit (or "Any Units")
- **Min Level** — show items at/above/below their min level
- **Price (TRY)** — Min / Max or Exact, currency inherits from company
- **Quantity Alerts** — show items with active quantity alerts
- **Date Alerts** — pick a date-type custom field then filter (overdue, due soon, expired)
- **Tags** — multi-select
- **Sortly ID (SID)** — multi-select
- **Barcode / QR code** — text or scan
- **Notes** — text
- **Custom filters** — any custom field becomes a filter
- **Summaries** — "Group items with the same Sortly ID" (rolls up duplicates across folders)

Results panel supports column sort, saved searches (paid), and bulk-export to CSV/PDF. This is a genuinely strong piece of the product and arguably the most defensible thing Sortly ships.

---

## 8. Workflows (THE OVERLAP WITH ONEACE)

`/workflows` bundles three action-oriented flows:

### 8.1 Stock Counts
*"Count and verify your inventory with ease. Stock counts help you track accurate quantities and keep your records up to date."*

**Correction vs the initial reading:** Stock Counts is **not** free — clicking the Stock Counts card on `/workflows` on a Free account triggers a dedicated Ultra upgrade modal (verified live). The modal content is worth quoting in full because it reveals Sortly's own internal pitch for the feature:

> **Headline:** Upgrade to Ultra: Keep Inventory Accurate & Clear
> **Subhead:** With Stock Counts, skip spreadsheets and be confident knowing every item is accounted for.
>
> - **Complete stock counts** without manual, disconnected counting methods.
> - **Get live status and progress updates** that show who counted what and when.
> - **Flag and resolve discrepancies** before they cause audit failures or stock issues.
>
> **PLUS:** Everything you need for smarter, faster inventory — advanced reports, barcode labels, Pick Lists, and Purchase Orders.
>
> **CTAs:** `LEARN MORE` · `TRY FOR FREE` · `No Thanks`

Three things stand out in this copy. First, Sortly's own value framing is *"live status and progress updates that show who counted what and when"* — which is the "multi-user in-flight count" pattern, not the "double-blind count" pattern. Second, they lead with *"skip spreadsheets"* which tells you who they're converting: SMBs running stock counts in Excel today. Third, the `PLUS` section bundles Stock Counts with Pick Lists, POs, barcode labels, and advanced reports into a single Ultra-tier sell — they do not try to sell each workflow separately.

Feature scope (inferred from the upsell copy + upgrade-plan tier comparison):
- Single-count mode only (no true double-blind)
- Count by folder (route selection by subtree)
- Barcode scan to count (mobile)
- Live "who counted what when" progress
- Variance/discrepancy surfacing at the end
- Adjustment entries posted to the activity history

**Critical SC gap analysis (unchanged):** Sortly does *not* offer true double-blind counting, does *not* appear to expose the 6 count types OneAce supports (cycle, full, spot, blind, double-blind, directed), and does *not* do explicit route optimisation across a warehouse. Sortly's stock count is a thin multi-user wrapper over "edit quantity with a scanner." **OneAce's stock-counting engine is still the single strongest competitive moat** against both Sortly *and* inFlow — and now we also know that Sortly charges $74/mo for a feature SC ships as free core.

### 8.2 Pick Lists (NEW)
*"Easily request items for pickup with Sortly's Pick Lists. Create a list, add items, and assign it to a user for review or pickup. Quantities update automatically after items are picked."*

Ultra-plan feature. This is effectively a lightweight internal fulfilment / kitting workflow. It replaces what would otherwise be a "sales order → pick → ship" flow with a much simpler "request → assign → pick → decrement."

**SC gap:** SC has nothing here today. This is a small-shaped but frequently-requested capability and would be cheap to add — maybe 1–2 phases of work. Worth adding to the roadmap behind the insights engine.

### 8.3 Purchase Orders (NEW)
*"Simplify your procurement process by easily creating, managing, and tracking purchase orders. This is the hub for that."*

Ultra-plan feature. Gives you a PO entity with a supplier, line items, expected-receive quantities, and a receive action that posts to inventory.

**Routing observation:** Navigating to `/purchase-orders` directly on a Free account does **not** show a paywall modal — it silently redirects to `/items`. This is a deliberate UX choice: Sortly treats "try to reach a paid route directly" as a bounce event and returns the user to their safe home screen rather than confronting them with a upsell wall. The paywall only appears if the user clicks the PO card *from inside* the Workflows page. This is the same pattern as `/units-of-measure`, `/manage-alerts`, and `/public-api` — they all silently redirect on Free. It's a subtle but consistent growth-loop choice: **paywalls only fire on intentional surface discovery, not on URL-probing.** SC should consider the same pattern.

**SC gap:** SC has no PO object today. The inFlow teardown flagged this as a Phase 41-58 roadmap item; Sortly makes the same point — **POs are the #1 missing sales/buy-side verb** in SC.

---

## 9. Reports
`/reports` offers 6 canned reports. Each has its own filter panel and can be exported to CSV/PDF. Saved reports + report subscriptions (email delivery) are paid.

| Report | Purpose |
|---|---|
| Activity History | All user changes to items, folders, tags — audit trail |
| Inventory Summary | Quantity, value, location at a glance |
| Transactions | All inventory movements/updates/deletions |
| Item Flow | Quantity fluctuations over time with flexible filters |
| Move Summary | Folder-to-folder movements in a time frame |
| User Activity Summary | Per-user action counts |

Reports are mostly tabular. There is **no narrative/insight layer** — Sortly gives you numbers, not sentences. That gap is exactly what OneAce's Insights engine fills.

---

## 10. Labs (Beta)
`/labs` is an opt-in experimental features board. Currently one feature is listed:
- **Threads** (alpha, disabled by default) — *"Keep conversations threaded to your inventory."* This is inventory-anchored team chat, basically. It's marked "alpha" meaning Sortly is still gauging demand.

Inventory-threaded chat is an interesting idea; it competes with the Slack/Teams integrations by eliminating the round-trip.

---

## 11. Sortly Sage (AI assistant)
Sage is a right-sidebar AI assistant that persists on every page. It opens with:
> "Hi Mahmut! I'm Sage, your Sortly assistant. Here are a few common questions I can answer."

Six seed prompts (already quoted in §3). A text input at the bottom: "Type your question here…" with a send button. Disclaimer: "Sortly Sage can make mistakes. Please verify critical details."

Sage is scoped to **documentation/FAQ answers**, not data manipulation. It does not (as far as could be tested on the Free plan) take actions on inventory — it is a help chatbot, not an agent. This is a meaningful contrast with where SC could go: an SC agent that can *actually* run stock counts, open POs, and answer "how much did we lose to shrinkage last month?" would be a real leap beyond what Sage does.

---

## 12. Integrations
Three first-party integrations, each with its own marketing-style landing page inside Settings:

| Integration | Plan | Scope |
|---|---|---|
| **Slack** | Ultra | Realtime notifications to a Slack channel on: Create item, Update item, Move item, Delete item, Update quantity |
| **Microsoft Teams** | Ultra | Same event list as Slack |
| **QuickBooks Online** | Premium | Sync QBO account, send POs to QBO, send invoices to QBO |

Each page ends with a "Try it free for 14-Days" CTA — every integration is effectively a paid plan funnel.

**No Zapier / Make / n8n / webhooks / public REST API** visible on the Free or even Ultra/Premium tiers. Webhooks + API access are **Enterprise-only** per the pricing page. This is a hard monetisation lever; for OneAce, offering a free-tier public API / webhooks would meaningfully differentiate.

**SC parity check:** SC already ships Slack and Teams notifications (confirmed from the inFlow teardown). The QBO integration is genuinely absent from SC and would require meaningful work.

---

## 13. Pricing & packaging

Sortly runs a four-tier paid ladder plus Enterprise. Pulled directly from `/upgrade-plan`:

| Plan | Price (yearly) | Users | Items | Custom Fields | Headline features |
|---|---|---|---|---|---|
| **Free** | $0 | 1 | 100 | 1 | Basic items, folders, photos, quantity edits |
| **Advanced** | **$24/mo** ($288/yr) | 2 | 500 | 5 | All Free + unlimited QR labels + low-stock alerts + low-stock reports + customizable user access + all units unlocked + custom branding |
| **Ultra** (★ Most Popular) | **$74/mo** ($888/yr) | 5 | 2,000 | 10 | All Advanced + saved reports + **date-based alerts** + unlimited barcode labels + user activity summary + move summary + item flow reports + 3rd-party scanner support + **Purchase Orders** + Slack + MS Teams + **Pick Lists** |
| **Premium** | **$149/mo** ($1,788/yr) | 8 | 5,000 | 20 | All Ultra + **QuickBooks Online** + report subscriptions + customizable role permissions + priority email support |
| **Enterprise** | Custom | 12+ | 10,000+ | Unlimited | All Premium + dedicated CSM + **API access** + **Webhooks** + **SSO** + limited-access seats + **multi-account access** + team trainings + guided inventory setup |

Marketing copy: "Save 50%" on yearly (first year of new subs only; 20% thereafter). Monthly pricing is presumably 2x.

**Packaging insights for SC:**
1. **The 100-item Free cap is aggressive.** It turns Free into a trial, not a tier. SC should think carefully about whether 100 items or "time-limited unlimited" is better.
2. **Custom field count is the main monetisation axis** (1 → 5 → 10 → 20 → ∞). SC already undercuts this.
3. **Ultra is where the money is.** Slack/Teams/POs/Pick Lists/date alerts are all paywalled at $74/mo. SC ships several of these free, which is a pricing story, not just a product story.
4. **API/webhooks are Enterprise-only.** This is the single biggest lock-in against dev-savvy SMBs. A free-tier REST API in SC would be a differentiation wedge.
5. **Seat counts are small** (1 / 2 / 5 / 8 / 12+). This tells you Sortly's median customer is a field-service team of <10.

---

## 14. Company Details (Free account observed)

The Company Details page exposes general settings that reveal Sortly's localisation model:
- **Country:** Turkey (the demo account's setting)
- **Currency:** TRY (auto-inherited from country)
- **Timezone:** EST (separate from country — interesting choice)
- **Date format:** European (DD/MM/YYYY)

Sortly supports a full currency list and every timezone, so it's i18n-ready at the data level, but the UI itself is English-only. This is notable because **the demo user is explicitly Turkish and had to work in an English UI** — a localisation gap that OneAce could exploit in Turkey/MENA/EU markets.

---

## 15. OneAce ↔ Sortly head-to-head

| Capability | OneAce | Sortly | Winner |
|---|---|---|---|
| **Stock counting** (6 types, double-blind, directed routes) | ✅ Full | ⚠️ Single-count only | **SC** |
| **Insights engine** (narrative, trend, anomaly detection) | ✅ | ❌ Reports only | **SC** |
| **Custom fields** (type breadth, free-tier caps) | ✅ Many types, generous | ⚠️ 12 types, 1-field free cap | **SC** |
| **Expiration / date-based tracking** | ✅ Native | ⚠️ Paid (Ultra) via date custom field | **SC** |
| **Slack / Teams notifications** | ✅ Free | ⚠️ Paid (Ultra) | **SC** |
| **Folder/tree organisation** | ✅ | ✅ | Tie |
| **Photo-first item cards** | ⚠️ Text-first | ✅ Industry-leading | **Sortly** |
| **Mobile barcode scanning** | ✅ | ✅ | Tie |
| **QR label generator** | ⚠️ Basic | ✅ Dedicated Create Labels tool | **Sortly** |
| **Advanced Search** (13+ composable filters) | ⚠️ Basic | ✅ Excellent | **Sortly** |
| **Activity history / audit trail** | ✅ | ✅ | Tie |
| **Purchase Orders** | ❌ | ✅ (Ultra) | **Sortly** |
| **Pick Lists / internal fulfilment** | ❌ | ✅ (Ultra) | **Sortly** |
| **Invoicing / sales fulfilment** | ❌ | ⚠️ Via QBO sync | **Sortly** (weak) |
| **QuickBooks Online integration** | ❌ | ✅ (Premium) | **Sortly** |
| **Public REST API** | ❓ | ❌ Enterprise-only | **(opportunity)** |
| **Webhooks** | ❓ | ❌ Enterprise-only | **(opportunity)** |
| **AI assistant** | ❓ | ⚠️ Sage (docs only, not an agent) | **(opportunity)** |
| **Multi-language UI** | ⚠️ | ❌ English only | **(opportunity)** |
| **Inventory threading / team chat** | ❌ | ⚠️ Labs alpha | **(opportunity)** |
| **Multiple business addresses** | ❓ | ✅ | ? |
| **User Access Control / role perms** | ❓ | ✅ (Premium) | ? |
| **Units of Measure management** | ✅ | ✅ (Advanced+) | Tie |
| **Bulk import (wizard UX)** | ❓ | ✅ Quick + Advanced modes | **Sortly** |
| **Return-to-Origin move shortcut** | ❌ | ⚠️ Ultra feature toggle | **Sortly** |

**Rough parity score against Sortly:** SC is at ~**65% parity**, notably higher than against inFlow (~50%), because Sortly is a thinner product. The main gaps are: **Purchase Orders, Pick Lists, QBO, photo-centric UX polish, advanced-search filter breadth, and the Create Labels designer.**

---

## 16. Recommended SC roadmap additions (derived from this teardown)

Ordered by highest ROI (impact ÷ effort):

1. **Purchase Orders v1** — supplier, line items, receive action. Already flagged in inFlow teardown. Sortly confirms this is the single most-requested sales/buy-side verb. **Phase 41-44 candidate.**
2. **Pick Lists / internal fulfilment** — request → assign → pick → decrement. Small-shaped. Uses existing item + quantity primitives. **Phase 45 candidate.**
3. **Advanced Search filter parity** — SC needs at least these filter types: Folders, Quantity range, Min level, Price range, Date alerts by custom field, Tags, SID, Barcode, Notes, Custom filters, plus a "Group by SID" summary mode. **Phase 46-47.**
4. **Scanner custom field type** — secondary-barcode field that triggers the existing camera scan modal on focus. Cheap (1 day of work, reuses the stock-count scanner primitive), directly closes a Sortly-specific gap, and unlocks multi-identifier items (manufacturer UPC + internal asset tag + container code). **Phase 47.5.**
5. **Photo-centric item card mode** — alternate grid view where the photo is the hero. Cheap, high perceived-quality lift. **Phase 48.**
6. **Create Labels designer** — dedicated QR/barcode label layout tool with multiple templates. Sortly sells this at Advanced ($24/mo). **Phase 49.**
7. **Quick-import wizard (4 steps, single-folder mode)** — SC likely has import; adding the "Quick vs Advanced" split makes first-run dramatically better. **Phase 50.**
8. **Templated UpsellModal component + suggested-fields picker UX** — Sortly's paywall modals all share one layout; SC would benefit from a single `UpsellModal` primitive instanced per gated feature *and* the two-step "Suggested Fields → Custom" picker pattern for custom fields. Both are copy-paste wins. **Phase 50.5.**
9. **QBO integration** — OAuth flow + push POs/invoices. Sortly gates this at $149/mo. Only worth doing once POs ship. **Phase 51-53.**
10. **Public REST API + webhooks on a generous tier** — Sortly gates these at Enterprise only. If SC puts them on a mid-tier (or even free), that's a real wedge. **Phase 54-55.**
11. **AI agent that actually operates** — Sage is a docs bot. An SC agent that can run stock counts, open POs, and answer "what drove last month's shrinkage" is a real differentiator. **Phase 56+.**
12. **Multi-language UI (TR, DE, ES, FR)** — Sortly is English-only. SC is already cross-platform; localisation is a quick marketing story. **Phase 57+.**
13. **Inventory-threaded chat (Threads clone)** — matches Sortly Labs Alpha. If SC wants to flank Sortly before they ship it, a simple comment thread pinned to each item/folder is a few weeks of work. **Phase 58+.**

---

## 17. Narrative observations (non-feature)

- **Upgrade prompts are relentless but not sleazy.** Gated features redirect to `/user-profile` silently rather than showing a paywall — this is a subtle choice that makes Free feel like a working product and lets the user discover missing capabilities organically via the settings sidebar. SC could adopt the same pattern.
- **Sage is everywhere but does very little.** The AI assistant is a persistent right panel that consumes ~25% of horizontal real estate yet can only answer FAQs. Either commit to making it agentic or hide it behind a button.
- **"New" and "Beta" badges are used for growth marketing.** Workflows has "New" next to it in the sidebar to draw attention to Pick Lists/POs. Labs has "Beta." These are free clicks and SC should use them too.
- **The 100-item Free cap turns Free into a 1-day trial.** Once the user adds their 101st item they're forced to upgrade. This is a business-model choice more than a product one. SC's approach (implied by prior notes: generous Free) is more sustainable for SMB word-of-mouth growth.
- **No manufacturing, no B2B portal, no e-commerce.** Sortly has consciously stayed out of the ERP adjacencies that inFlow charges for. This confirms SC should pick *one* axis (counting + insights + fulfilment) rather than trying to parity both competitors simultaneously.
- **The settings sidebar is the product tour.** If you want to know what Sortly sells, open the gear. Thirteen rows, each one a story. SC should audit its own settings and ask "does every row earn its place as a mini product pitch?"

---

## 17.1 UX / UI brief (visual language and interaction patterns)

This section summarises Sortly's surface-level design grammar, distilled from the full walk:

**Colour system.** A single red primary (roughly `#D24C52`, used for the left rail background and primary CTAs), neutral greys for cards and borders, a muted teal-ish accent for "New" badges, and a muted green for status indicators. No dark mode. The red-only rail is distinctive — it's the first thing the eye lands on and it carries the brand.

**Typography.** Sans-serif throughout (looks like Nunito or Poppins). Strong weight contrast: section titles are heavy, body copy is light. Field labels are small-caps-adjacent — uppercase or near-uppercase. The price / quantity displays on item cards are bumped to 1.5–2x body size to make the numbers the hero.

**Density.** Low. Sortly is a *spacious* product — lots of white space, generous padding on cards, 24–32 px gutters between elements. This is a deliberate contrast with the ERP-dense UIs of inFlow and NetSuite. The cost is that information-dense tasks (reports, advanced search results) feel sparse; the benefit is that a non-technical field worker on an iPad can hit the right targets without mis-tapping.

**Photo-first cards.** Folder cards composite item thumbnails as a mosaic on the card face; item cards are 60% photo, 40% text. This is Sortly's signature look and the single hardest thing to replicate without an asset pipeline. The "NEW" corner badge pattern (small coloured pill top-right of the card) is used both for freshly-added items and for gated new features — a nice dual-use pattern.

**Paywall modal grammar.** Every Ultra paywall uses the same structural skeleton — centered dark-backdrop modal, bold red headline, red checkmark bullets, primary red CTA, optional "No Thanks" link — but **the copy and layout layer above that skeleton drifts noticeably between sibling modals.** See §20.1 for the correction: the three workflow paywalls on `/workflows` (Stock Counts, Purchase Orders, Pick Lists) use three different headline templates, three different left-panel treatments (illustration, YouTube embed, blank), two different bullet counts, and two different CTA row shapes. SC should still build one `UpsellModal` primitive — but learn from Sortly's drift and enforce the primitive as a single component so feature teams cannot re-roll their own copy variants.

**Left rail pattern.** Primary nav is vertical icon rail with text labels beneath each icon (not a hover tooltip — the label is always visible in a smaller font). This is an iPad-first pattern: thumb-reachable, self-documenting, no hover dependency. Icons are line-drawn, monochrome, with red accent on active.

**Right-side AI panel.** Sage consumes ~25% of horizontal real estate on every screen (roughly 360px out of 1485). It's collapsible (owl icon in the bottom-right), but opens by default. This is an opinionated choice that signals "Sortly is an AI product now" without requiring Sage to actually do much.

**Empty states.** Every empty state pairs a line-art illustration with a one-sentence hint and a primary CTA. Examples observed: Custom Fields empty state (*"You don't have any custom fields. Click Add Custom Field to get started!"*), Tags empty state, 404 page (*"Oops! Something went wrong / Page not found"* with a question-mark-on-box illustration).

**Form inputs.** Rounded 4–6 px radius, grey border, red border on focus. Date fields trigger a calendar picker. Dropdowns are native-ish custom components with a small chevron. Validation errors appear as red helper text below the field (not as a toast).

**Badges.** Three badge styles observed: `New` (green pill with sparkle icon), `Beta` (neutral pill), `Alpha` (neutral pill). They're used on the nav rail and on workflow cards to draw attention to monetisation surfaces.

**Version string in footer.** `Version: v10.107.0-R216.0.0` appears in the footer of most pages — a small honesty signal and a useful debugging handle. SC's footer carries a commit SHA which serves the same function.

**Accessibility gaps observed.** Several modals have close buttons that sit outside the main screenshot bounds (1551 px at a 1485 px viewport), indicating the modal assumes a min-width >1485. Not a hard breakage at desktop, but would hurt on smaller laptops. Scanner/barcode input fields lack visible focus rings in some flows. No reduced-motion toggle found. Keyboard-nav to the left rail works (`Tab` → rail), but the rail items don't expose their routes on focus — a screen-reader user would hear button labels only.

---

## 17.2 Verified Settings subpages (free plan)

The following Settings subpages were loaded directly and verified live:

**`/user-profile`** — Personal Information block with these fields: First Name, Last Name, Email, Phone Number, Job Function (dropdown, placeholder *"Enter your Job Function"*), Job Title (dropdown, placeholder *"Select your Job Title..."*). Change Password block with Current Password + New Password + a primary `Save Changes` button. Linked Accounts block with two rows: **Google** (status: "Not Connected", action: `Link`) and **Apple ID** (status: email shown as `7ky5j4b2d6@privaterelay.appleid.com`, action: `Unlink`). Footer: `Version: v10.107.0-R216.0.0`. No MFA/2FA toggle exposed on the Free plan.

**`/preferences`, `/account-settings/preferences`, `/user-preferences`** — None of these URL guesses resolved; all returned the app's 404 page (*"Oops! Something went wrong — Page not found"*). The actual URL is likely behind a tab-based state rather than a first-class route, which means the Preferences subpage cannot be deep-linked to. This is a minor UX smell (direct URL = broken) but a common pattern in tab-nav apps.

**`/manage-custom-attributes/node`** — Custom Fields page. Full layout: left sidebar with 13 Settings subpages + 3 integration items, right main region with the `Add Custom Field` button (top-right red CTA), free-plan meter (*"You can add 1 custom field on the Free plan."* / *"0 of 1 custom field added."* / *"Upgrade to get more custom fields"*), a `Show on item page:` dropdown (default `Populated Fields`), and the empty state *"You don't have any custom fields. Click Add Custom Field to get started!"* with a `How to Create Custom Fields?` link below.

**`/workflows`** — three equal-width cards (Pick Lists | Purchase Orders `New` | Stock Counts `New`). Each card has a line-art icon top-left, a title H3, a 3-line description, and fills the full card as a clickable button. Clicking Pick Lists, Purchase Orders (sometimes), or Stock Counts triggers the Ultra paywall modal (see §17.1 for the templated structure). Interestingly, repeated clicks on the same card within a short window sometimes do **not** re-trigger the modal — it appears to debounce. SC should note this as a user-friction risk (if the modal dismisses silently, the user may think the click is broken).

**`/reports`** — sidebar + 6 report cards. Report cards are differently styled from workflow cards: they're narrower, taller, and have an UPGRADE PLAN banner above the grid when gated features are present. Clicking any gated report triggers the generic Reports Ultra upgrade modal.

**`/labs`** — single feature listed: **Threads** (ALPHA, Disabled). A `Stage` filter dropdown with three options (Alpha / Beta / Experimental) and a `Status` filter dropdown with two options (Enabled / Disabled) sit above the feature list. The two filter dropdowns imply that Sortly has a multi-feature Labs pipeline internally, they just haven't shipped more than one publicly yet.

**`/items`, `/advanced-search`, `/tags`, `/activity-history`, `/trash`** — all verified earlier in the walk; see §2 and §4.

---

## 17.3 Frontend stack signals

Technical footprints observed in the page source and network:

- **Google Tag Manager:** `GTM-MNGM5RF` (primary) + `GTM-WNCKPZF` (Google Optimize experiment container, with a 4-second async-hide flicker-prevention window — a common A/B testing pattern).
- **Google Analytics (Universal):** `UA-49456419-8` — note: this is UA, not GA4. Either Sortly is dual-tracking or hasn't fully migrated to GA4, which is slightly unusual in 2026.
- **Frill widget** (product changelog & feature requests): container initialised with key `ffd43d1f-cac8-4d30-abcb-9cd28cab6284`, loaded dynamically from `widget.frill.co/v2/container.js`. The Product News badge in the nav showed "10" unread items during the walk, so the Frill changelog is actively maintained.
- **App version string:** `v10.107.0-R216.0.0` — format suggests a marketing version (`10.107.0`) coupled to a build train (`R216.0.0`), which is a Rails-ish / Capistrano-ish convention.
- **Single-page app framing:** Navigation between routes is client-side (no full reload), suggesting React or similar. Page titles change but the nav chrome doesn't remount.
- **Barcode library:** The barcode preview inside the Scanner custom field shows a real generated Code 128 / EAN-style barcode (`188114771211`), meaning Sortly has a client-side barcode renderer shipped. Likely `bwip-js` or similar.
- **No webhooks / public API surface** visible at any of the paid tiers we could reach — confirmed Enterprise-only.

---

## 18. Open questions / not yet verified

These were either gated behind a paid plan, would have required demo data, or were simply not reachable in the time budget:

- **User Access Control** detail (roles, seat management UX) — gated
- **Units of Measure** CRUD flow — gated (redirected to /user-profile)
- **Manage Alerts** — gated
- **Create Labels** designer — not opened
- **Public API** docs surface — gated
- **Notifications bell panel** contents — covered in §31 of captures.md
- **Product News** Frill widget contents — iframe-based, inconsistent-open behaviour documented in §31
- **Activity History** (`/activity-history`) full view — covered in the captures.md walk
- **Trash** (`/trash`) restore flow — ✅ **covered in §33 of captures.md + §20.4 of this teardown**
- **Item detail Chart/Insights button** — gated on Free
- **Move item** action behaviour (single and bulk) — not tested
- **Export item sheet** (PDF) — not tested
- **Add Item** form as opened via the top button — the add button appeared to not open a modal on click during this session (may be a dropdown intercepted by the nav scroll, or needs a second interaction)
- **Bulk Import wizard Steps 2–5** — only Step 1 captured; follow-up in §23.3 of captures.md
- **`/upgrade-plan?extendedTable=true`** pricing variant — deep-link not verified
- **`/feature-controls`** higher-tier features — gated on Free
- **Mobile app feature parity** — not tested at all; Sortly's mobile scan UX is historically the strongest part of the product
- **Sage agentic capabilities** — only seed prompts were visible; asking "Create an item called X" was not tested

If SC wants a deeper dive on any of these, the demo account is still live and most of these are one-click follow-ups.

---

## 19. Sources
- Live demo account at https://app.sortly.com
- Pricing page at https://app.sortly.com/upgrade-plan
- Integration marketing pages at `/integrations/{slack,teams,quickbooks}`
- Custom field picker at `/manage-custom-attributes/node`
- Existing sister document `docs/competitor-analysis/inflow-inventory-teardown.md` used for cross-reference and parity framing

---

## 20. Addendum — Trash / Tags / Workflows deep-dive (2026-04-10)

This addendum captures findings from a second traversal pass that focused on the three surfaces that were either unopened or only skimmed in the first pass: `/trash`, `/tags` (with Add Tag modal), and `/workflows` with all three Ultra-gated modals opened in turn. Full verbatim copy and ASCII layouts live in §33-§35 of `sortly-captures.md`; this section is the analysis distillate. **Several earlier claims in this teardown are corrected here.**

### 20.1 Corrected finding — Workflow paywalls are NOT identical templates

§17.1 originally stated: *"Every Ultra paywall follows the same three-block template … the modals are identical in structure across Pick Lists, Stock Counts, File Attachment custom field, Reports, and Purchase Orders."* **This is wrong.** Opening all three workflow modals in a single session from the same `/workflows` hub revealed **three distinct sub-templates** on sibling cards:

| Card | Headline template | Left panel | Bullet count | CTA row |
|---|---|---|---|---|
| **Stock Counts** | `Upgrade to Ultra: {benefit}` | Illustration | 3 bullets + `PLUS:` cross-sell | `LEARN MORE` · `TRY FOR FREE` · `No Thanks` (3 CTAs) |
| **Purchase Orders** | `{Feature} are now available in Sortly Ultra Plan.` | **YouTube embed** (product video) | 4 bullets, no cross-sell | `TRY IT FREE FOR 14-DAYS` (1 CTA) |
| **Pick Lists** | `Upgrade to Ultra to unlock {feature}` | **Blank / no illustration** | 4 bullets, no cross-sell | `TRY IT FREE FOR 14-DAYS` (1 CTA) |

Three sibling paywalls on the same hub page use **three different headline templates, three different left-panel treatments, two different bullet counts, two different CTA row shapes, and a cross-sell pattern on only one of them**. This is not a templated upsell — it is evidence of a fragmented UX-writing and design process, where each workflow team shipped their own modal rather than sharing a primitive. The *structural skeleton* (centered modal, red accent, checkmark bullets, dark backdrop) is consistent; everything above the skeleton drifts.

**Why this matters for SC:** SC's `UpsellModal` component should be a **true primitive** — headline, optional sub, 3–5 bullets, optional cross-sell, CTA row — so that every feature team instances the same layout. Sortly's drift is the bad example to learn from. (See §17.1 for the original templated-modal observation, which is correct for the *skeleton* but wrong for the *copy layer*.)

### 20.2 Corrected finding — ALL THREE workflows gate at Ultra, not a mixed tier

§8.1–§8.3 already caught that Stock Counts, Pick Lists, and Purchase Orders are Ultra-gated, but the broader narrative in §16 treated each as a separate gap. Seeing the three modals back-to-back clarifies a stronger point: **Sortly treats operational workflows as its single most valuable upsell bundle.** The Stock Counts modal's `PLUS:` cross-sell literally bundles *"advanced reports, barcode labels, Pick Lists, and Purchase Orders"* into one $74/mo ask. All operational verbs — count, pick, order — are behind the same price point, which means for a buyer who wants *any* of them, the cost of getting all three is zero.

**Strategic implication for SC pricing:** SC's current price band ($19-39/mo range) is roughly **half** of Sortly Ultra ($74/mo yearly, higher monthly). If SC ships all three verbs + insights + the 6 stock-count types on a single mid-tier, SC is not competing on feature parity — it is competing on **feature unbundling vs bundled premium**. That is the sharper narrative the go-to-market should lead with, because the buyer doing the math is choosing between "pay $74/mo at Sortly for everything above the catalogue" and "pay ~$30/mo at SC for the same operational surface plus stronger counting."

### 20.3 Corrected moat narrative — Stock counting is a moat because Sortly PRICES it high, not because Sortly LACKS it

§8.1 and §16 originally framed stock counting as SC's moat because *"Sortly does not offer true double-blind counting / 6 count types / directed routes"* — which is still true as a feature-depth argument. The second traversal sharpens this: **Sortly has stock counting, but it is their top-tier feature ($74/mo Ultra).** The moat is therefore not *feature presence* (Sortly has a stock count product) but *price-to-feature ratio*: SC ships a deeper stock-count engine at half the price.

Rewrite the moat talk track as: *"Stock counting is the centerpiece of OneAce because our closest comparable (Sortly) charges $74/mo for a single-count-only version of it. SC ships 6 count types including double-blind at a mid-tier price."*

### 20.4 New findings — Trash (`/trash`)

Verbatim layout and hover states in §33 of `sortly-captures.md`. Analysis:

1. **No `Delete Forever` action** — hover states only expose a `Restore` button. Items remain in Trash indefinitely (or until some hidden retention policy fires). **This is a safety gap SC should not replicate:** a user who wants to actually remove sensitive inventory from their account has no path. SC should offer both `Restore` and `Delete Forever` with a confirm dialog that surfaces the retention/audit implications.
2. **No bulk action toolbar** — Trash rows cannot be multi-selected; restoring 50 items means 50 clicks. This is a meaningful ergonomic gap on an audit-sensitive surface.
3. **Folder cards and item cards use different thumbnail colour coding** — folder cards get the folder accent, item cards fall back to a generic photo placeholder. It is a subtle visual hierarchy cue worth borrowing.
4. **Filter icon click had no observed response** — either dead code or a hidden panel. Documented as a UX smell.
5. **TR locale DD/MM/YYYY confirmed** — the `Deleted at` column honours the user's `/company-details` date format setting. Sortly's i18n is correct at the data layer even though the UI is English-only.

### 20.5 New findings — Tags (`/tags` and Add Tag modal)

Verbatim in §34 of `sortly-captures.md`. Analysis:

1. **Tags have no colour, icon, or description** — Sortly's tag object is just `{name}`. The earlier C.9 blueprint speculated a 12-colour swatch picker; **that is wrong** — the Add Tag modal exposes only a single `Name` text field. This has been corrected in §C.9 of the blueprint.
2. **Pink backdrop on the Add Tag modal confirms the create-modal convention** — pink dim for create, dark dim for paywall. Every create modal in Sortly uses the same pink wash; every upsell uses the dark wash. SC should adopt the same visual grammar so users learn "pink = I'm making something, dark = they want my money" at a glance.
3. **Validation-on-open anti-pattern** — the Add Tag modal shows the `Name is required` error state before the user has typed anything, because the field defaults to empty and the validator fires on mount. This is a classic "angry empty form" pattern; SC should defer validation until first blur or submit.
4. **Lowercase H1 matches tag name verbatim** — the Tag detail page's H1 is literally the lowercase tag string, not a title-cased "Tag: Foo". Small but distinctive.
5. **Empty state pattern** — when a tag has no items, the detail page shows a line-art illustration + one sentence + CTA. Matches the §17.1 empty-state grammar.
6. **Redirect to first tag after deletion** — deleting the currently-viewed tag redirects to the first tag in the list rather than back to `/tags`. Feels abrupt; a toast + stay-on-list would be gentler.
7. **No tag merge / rename-in-place / bulk untag** — Sortly tags are basically a filter-friendly label and nothing more.

### 20.6 Feature parity checklist additions (supplements §15 head-to-head)

Based on the three new surfaces, add these rows to the SC-vs-Sortly head-to-head:

| Capability | OneAce | Sortly | Winner |
|---|---|---|---|
| **Tag metadata richness** (colour, icon, description) | ❓ | ❌ name-only | **(opportunity)** |
| **Multi-user in-flight count with live progress** | ✅ (planned / shipped) | ✅ (Ultra) | Tie |
| **PO approval workflow** | ❌ | ⚠️ unverified | **follow-up** |
| **PO PDF export** | ❌ | ⚠️ unverified | **follow-up** |
| **Pick list employee assignment** | ❌ | ✅ (Ultra) | **Sortly** |
| **Delete Forever from trash** | ❓ | ❌ | **(opportunity — safety gap in Sortly)** |
| **Bulk restore from trash** | ❓ | ❌ | **(opportunity)** |
| **Pink-backdrop create / dark-backdrop upsell visual grammar** | ❓ | ✅ | **(opportunity)** |

### 20.7 Roadmap delta (supplements §16)

Two items added, one item re-prioritised:

- **New 16.14 — `Delete Forever` + bulk-restore in Trash.** Sortly's trash is a one-way street with no purge. Small shaped, high audit-confidence win. **Phase 46 candidate.**
- **New 16.15 — Tag metadata (colour / icon / description).** Sortly's tags are name-only; a richer tag object is a cheap but visible differentiator. **Phase 48 candidate.**
- **Reprioritisation of 16.8 (`UpsellModal` primitive):** bump from *"copy-paste win"* to *"before you ship Insights pricing."* Sortly's drifting modal copy is evidence that once feature teams start making their own upsell surfaces, the primitive becomes expensive to retrofit.

---

## 21. Changelog

- **2026-04-10** — Initial teardown (§1-§19) drafted from live walkthrough.
- **2026-04-10 (later)** — Added §20 Addendum after second traversal of `/trash`, `/tags`, and `/workflows` (all 3 Ultra modals). Corrected §17.1 claim that paywall modals are identical templates; corrected §C.9 blueprint speculation that tags have a 12-colour picker; sharpened moat narrative from "Sortly lacks stock counting" to "Sortly prices stock counting at Ultra."
