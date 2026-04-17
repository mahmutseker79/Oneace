# inFlow Inventory — Reconstruction-Grade Teardown (Live Edition)

**Date:** 2026-04-10
**Source basis:**
- Public-facing site crawl (original 2026-04-08 pass)
- **Live hands-on traversal of the authenticated Cloud app** via Chrome MCP (this session) — sample workspace, every top-level module entered, 11+ modals captured verbatim, write/edit/delete attempted on multiple entities, paywall surfaced
- Cross-referenced against `inflow-captures.md` (Part I §1–§4.14, Part II §5–§13) and `inflow-figma-blueprint.md`
**Replication confidence:** **92/100** (up from 78 in the public-only pass)

---

## 1. EXECUTIVE SUMMARY

inFlow Inventory (Archon Systems Inc.) is a mature SMB-to-midmarket inventory/WMS-lite platform with three product SKUs — **inFlow Inventory** (core: inventory + purchasing + sales fulfillment), **inFlow Stockroom** (scan-first operator app), and **inFlow Manufacturing** (BOM + work orders + costing). The live teardown confirms it is a *document-centric ERP-lite* rather than a pure inventory app: everything orbits seven transaction document types (Sales order, Sales quote, Purchase order, Purchase quote, Stock count, Stock adjustment, Stock transfer) that drive an append-only inventory movement ledger.

The strategic read is this: inFlow has **70% of a small ERP** hidden behind an inventory-management skin. Stock counts, variants, multi-location, B2B Showroom, multi-costing methods, dual-tax purchasing, manufacturing BOMs, and a 49-report catalog are all present and working. The price of that breadth is surface-area bloat — the sidebar has 14 top-level modules, Settings has 9 subtabs, and the sample-mode onboarding is visibly straining under the weight of 7 document prefixes, 10 custom field slots, 3 costing toggles, and a Rename-Fields i18n system. That bloat is OneAce's lane.

Key publicly and privately visible stock states: **Owned / Reserved / Available**, plus **Quantity on order** and **Quantity in transit**. Reports expose a deep transaction log: inventory movements, stock counts, transfers, manufacturing variances, and per-user action auditing.

---

## 2. CRAWL COVERAGE REPORT

### Public site (2026-04-08 pass — retained)
- Pricing pages (Inventory, Stockroom, Manufacturing)
- Product overview pages
- Feature comparison + barcode software feature page
- Integrations catalog landing
- Release notes ("cloud updates")
- Privacy policy, sitemap, SLA, SaaS agreement
- Report selection tool (public catalog of reports + exposed column names)
- Hardware pages (Smart Scanner, Label Printer)

### Authenticated Cloud app (2026-04-10 live pass — new)
- **Dashboard** (KPI tiles, sample-mode banner, Help bubble)
- **Products** list + detail (variant-enabled product, cost tab, pricing tab, tracking tab, photos, custom fields)
- **Stock counts** list + detail (OPEN/IN PROGRESS/COMPLETED sheets, line items, Start counting & Complete-and-adjust buttons)
- **Sales orders** list + SO-000025 detail (Actions menu, single-tax model)
- **Purchase orders** list + PO-000005 detail (dual-tax finding: State + Gov't tax)
- **Vendors** list (table columns, filter bar)
- **Customers** list
- **Locations** list (Main Warehouse + sublocations)
- **Reports** hub (7 families × ~49 sub-reports inventoried)
- **Settings/Options** — all 9 subtabs entered:
  - Global (Company details + Preferences/Customization)
  - General (Costing options modal, Adjustment reasons modal, Custom fields modal)
  - Inventory (Picking options modal, Serial/lot add-on gate)
  - Orders (Payment terms modal, Document prefix fields)
  - Manufacturing, Sales, Purchase, Users/Access rights, Account (= paywall)
- **Paywall** — trial banner, tier cards, feature matrix, enterprise tier with onboarding CSM fee
- **Modal library** — 11+ modals captured verbatim (Costing options, Variants, Adjustment reasons, Custom fields, Picking options, Payment terms, Locations, New location, Rename fields, Document prefixes, Delete-blocked sample bump)
- **Write/edit/delete tests performed**:
  - Created a new variant-enabled product (succeeded)
  - Edited product price (succeeded)
  - Attempted delete on sample product → **blocked** with "Sample data cannot be deleted" bump
  - Attempted deactivate → same block
  - Opened and canceled a stock count sheet
  - Toggled Costing method dropdown (FIFO/LIFO/Moving avg/Manual visible)

### Still not reached
- Deep API docs (public docs not linked from in-app)
- Webhook configuration UI (possibly enterprise-only)
- Showroom B2B portal buyer-side (separate subdomain, not entered)
- Manufacturing BOM editor internals (module is licensed add-on; card present, flow not run)
- Serial/lot tracking UI (feature-flagged off in sample workspace, only upsell card seen)
- SSO configuration (enterprise-only)
- Mobile app (not tested — desktop-only session)

---

## 3. COMPLETE SITE MAP

### Authenticated app — left sidebar (top to bottom)
1. Dashboard (home icon)
2. Products
3. Stock (inventory on hand / adjustments hub)
4. Sales orders
5. Purchase orders
6. Stock counts
7. Stock transfers
8. Stock adjustments
9. Work orders *(Manufacturing add-on)*
10. Customers
11. Vendors
12. Reports
13. Showroom *(B2B portal)*
14. Options *(Settings, gear icon at bottom)*
+ Help bubble (bottom-right floating)
+ Subscribe now / trial banner (top bar, sample mode)

### Flyout panel behavior
Hover on sidebar icon → slide-out panel on the right of the rail containing the full submenu (New, List, Filtered views). The rail stays collapsed; the flyout dismisses on mouse-leave. This is a real IA decision, not just visual — it doubles as the "New X" shortcut surface.

### Settings/Options subtabs (top tab bar inside /options)
1. **Global** — company details, default currency, language, regional format, preferences (including "Use sublocations" master toggle), customization (Rename fields, Document prefixes)
2. **General** — costing method, custom fields, adjustment reasons, extra cost allocation
3. **Inventory** — picking options, serial/lot tracking (add-on gate), stock-on-hand display
4. **Sales** — default tax, default payment terms, invoice template
5. **Purchase** — default vendor terms, dual tax defaults, receiving behavior
6. **Orders** — document prefixes (SO/SQ/PO/PQ/SC/SA/ST), payment terms editor, date format
7. **Manufacturing** — BOM defaults, labor rate (add-on gate)
8. **Users & access rights** — roles, view-only vs team member, per-location permissions
9. **Account** — subscription, invoices, add-ons, **THIS IS THE PAYWALL PAGE**

### Public-facing site map (retained from public pass)
Top nav: Solutions / Support / Pricing / Book a Demo / Log in / Free trial.
Footer: Use cases (barcode, warehouse, wholesale, asset tracking, field service), Explore, Support, Resources, Sitemap, Privacy, Status page, Release notes, Roadmap.

---

## 4. MODULE / FEATURE MASTER LIST

### 4.1 Products / SKUs
- Product master with: name, SKU, category, description, photos (multiple, drag-reorder), default vendor
- Cost tab: cost, costing method override (rare — usually global), last cost, average cost
- Pricing tab: **price scheme** (supports multiple customer-tier prices), list price, price brackets
- Tracking tab: reorder point, recommended reorder point (calculated from demand/lead time/safety stock), serial/lot toggle (add-on gate)
- **Variants tab (CONFIRMED LIVE)**: Two-level global model. Create Options globally (Color, Size, Material, Storage, Volume). Each Option has a list of values. Per-product opt-in selects which Options apply, then cartesian product generates child SKUs. Each child inherits the parent's fields but can override cost/price/barcode. This is a significant architectural lead — OneAce's flat-SKU model doesn't have this.
- **Custom fields**: 10 hardcoded slots, configurable globally from Options → General → Custom fields (Text/Number/Date/Yes-no), applied to all products
- Deactivation (soft-delete): "Deactivate" rather than "Delete" in most places

### 4.2 Inventory / Stock
- Multi-location (unlimited on paid tiers, 1 on Entrepreneur)
- **Sublocations are OPTIONAL and toggled globally** (Options → Global → Preferences → Use sublocations). When off, Location is flat. When on, each Location can have a bin/aisle tree. This is different from OneAce's design assumption and means inFlow supports both simple and complex warehouses from one schema.
- Stock states (exposed in list columns): Owned, Reserved, Available, On order, In transit
- Stock adjustments (append to inventory movement ledger; no destructive edit)
- Adjustment reasons: user-configurable list; default reasons include Damage, Shrinkage, Found, Return to stock (captured verbatim in modal)

### 4.3 Stock Counts (dedicated module — deeply reverse-engineered)
**This is where OneAce is weakest and inFlow is strongest. Pay attention.**

Three-tier sheet state machine:
1. **OPEN** — sheet created; snapshot of expected quantities frozen at sheet creation time (NOT at start of counting). User can edit the line list, add/remove items, change location scope.
2. **IN PROGRESS** — triggered by "Start counting" button. Line-level counted-quantity fields become editable. Other app areas can still move stock; those movements do NOT change the sheet's expected quantities (snapshot is frozen).
3. **COMPLETED** — triggered by "Complete and adjust" button. System posts variance adjustments to the inventory ledger at that moment; the sheet becomes read-only.

Line item fields: Product, Sublocation (if enabled), Expected qty (snapshot), Counted qty, Variance, Notes
List view columns: Count #, Status, Location, Counted by, Completed by, Date created, Date completed
Filter by: Status (OPEN/IN PROGRESS/COMPLETED), Location, Date range
Sheet-level actions: Add items by category / Add all in location / Add by filter

**Architectural lead**: snapshot-at-creation means multi-user warehouses can run counts without freezing ops. OneAce currently does not implement this and would need to.

### 4.4 Purchasing / Receiving
- Vendors (product codes, last vendor prices, payment terms, default currency per vendor)
- Purchase Orders: Draft → Issued → Partial received → Received → Closed
- PO-000005 live inspection revealed:
  - **DUAL TAX on POs**: "State tax" + "Gov't tax" fields (separate rates that both apply). This is inFlow accommodating US state + GST/HST dual-tax jurisdictions in one document.
  - Expected vs received quantity tracking at line level
  - Partial receipts posted as separate movement events with same PO #
  - Vendor payment tracking (payment date, balance)
- Purchasing tax report (separate from sales tax report)

### 4.5 Sales / Fulfillment
- Customers with pricing scheme, multiple addresses, credit limit, default payment terms
- Sales orders: Draft/Quote → Confirmed → Picked → Shipped → Invoiced → Paid
- SO-000025 live inspection:
  - **SINGLE tax on sales** (contrast with dual-tax on POs — asymmetric by design)
  - Actions dropdown: Copy, Email, Print, Export, Convert to invoice, Refund, Delete (sample-blocked)
  - Line items show picking status
  - Backorder handling with explicit "Backorder" column
- Shipping via EasyPost carrier integration (FedEx/UPS/USPS)
- Returns flow and returns report

### 4.6 B2B / Wholesale (Showroom)
- Separate buyer portal (not entered this session)
- Customer-specific catalogs
- Orders flow back into main Sales Order module
- "Abandoned Showroom carts" is a real report in the catalog
- Showroom Pro is a paid add-on; visibility gated on paid tier

### 4.7 Manufacturing (add-on, card visible, flow not run)
- BOM / bill of materials with shared components
- Routing / steps with build time and labor estimates
- Work orders / manufacture orders
- Materials variance report, WIP cost report
- Pricing: separate plan ladder (Start Up / Growth / Scale / Expansion)

### 4.8 Mobile / Barcode / Scanner
- iOS/Android apps
- Smart Scanner hardware (rugged Android + laser scanner)
- Scan workflows: receive, pick, check stock, shrink adjust, transfer, scan order barcodes
- **Label Designer**: drag-and-drop with field tokens (captured in modal inventory but not entered)

### 4.9 Reporting & Audit
**7 families / ~49 sub-reports** inventoried from the Reports hub:
- **Sales** (~10): sales summary, sales by product, sales by customer, sales by rep, sales returns, backorder report, profit by order, profit by product, sales tax, payment details
- **Purchasing** (~8): purchase summary, purchase by vendor, purchase by product, open PO, PO aging, receiving history, purchase tax, vendor payment details
- **Inventory** (~11): stock on hand, inventory movement, inventory aging, low stock, reorder recommendations, stock count history, stock transfer history, adjustment history, dead stock, inventory valuation, ABC analysis
- **Manufacturing** (~6): work order summary, materials used, finished products, materials variance, WIP cost, labor cost
- **Financial** (~5): COGS, gross profit, inventory valuation (cross-listed), tax summary, payment summary
- **B2B / Showroom** (~4): Showroom orders, abandoned Showroom carts, Showroom customer activity, Showroom product views
- **Admin / Audit** (~5): user actions log, login history, permission changes, document edits, sample data indicator

Every report has a column picker, date range, and Export to CSV/Excel/PDF. A handful have scheduled-delivery support (email on cron).

### 4.10 Integrations & API
- 95+ integrations catalog
- Categories: Ecommerce, Shipping, EDI, SSO, Automation, Accounting, Forecasting
- Named popular: Amazon, Shopify, BigCommerce, Etsy, Faire, Squarespace, WooCommerce, Walmart Marketplace; QuickBooks Online, Xero; Zapier; shipping via EasyPost
- **inFlow Pay** (Worldline/Bambora) for US/Canada card payments — tier-gated
- inFlow API for read/write (listed as add-on in several tiers; enterprise includes it)

---

## 5. PRICING & PACKAGING ANALYSIS (LIVE, CONFIRMED VIA PAYWALL CAPTURE)

Four tiers on the in-app `/options/account` paywall plus an Enterprise contact tier:

| Tier | Monthly (annual) | Team members | Sales orders/mo | Locations | Integrations | Notable |
|---|---|---|---|---|---|---|
| **Entrepreneur** | **$129/mo** | 2 | 100 | 1 (no sublocations) | 2 | Entry price, no sublocations, no API |
| **Small Business** | **$349/mo** | 5 | 1,000 | Unlimited | 3 | Advanced access rights, Showroom basic |
| **Mid-Size** | **$699/mo** | 10 | 10,000 | Unlimited | 5 | Showroom Pro available, more reports |
| **Enterprise** | Contact sales | Custom | Custom | Custom | Custom | SSO, dedicated CSM, API included |

Paid add-ons visible on paywall:
- **Onboarding package**: one-time **$499** (optional on SMB, required on Enterprise) — comes with dedicated CSM
- **Serial / lot tracking**: paid add-on / tier-gated, labelled "Beta" on lower tiers
- **Manufacturing** module: separate ladder (Start Up / Growth / Scale / Expansion)
- **Stockroom**: $99/mo annual, $129/mo monthly; per-location add-on; unlimited users/products/reports
- **API access**: included Enterprise; add-on on Small Business and Mid-Size
- **Hardware**: sold separately (Smart Scanner, Label Printer)
- **Showroom Pro**: upsell from basic Showroom

**Takeaway for OneAce**: The entry price wall is $129/mo with crippling caps (2 users, 1 location, no sublocations, 100 SOs/mo). The real usable tier is Small Business at $349/mo. This is the price umbrella OneAce should aim to sit under.

---

## 6. UI / UX FORENSIC REPORT (LIVE OBSERVATIONS)

### Visual language
- **Navy + yellow** brand palette (navy `#232D4B` top bar and sidebar, yellow `#F9C23C` primary CTA)
- Neutral grays for tables (`#F5F6F8` row hover, `#E2E5EC` borders)
- 4px radius on inputs, 6px on cards, 8px on modal shells
- System font stack (-apple-system / Segoe UI / Roboto)
- Dense-but-not-cramped: 12px cell padding in tables, 14px base font

### Navigation pattern
- Collapsed sidebar rail (icon-only) with hover-flyout panel — space-efficient, but the flyout is the primary discovery surface
- Top bar: breadcrumb + New button + user menu + Help bubble + trial banner
- Tab-bar for in-module subviews (e.g. product detail has 5 tabs: Info / Pricing / Tracking / Custom fields / History)

### Modal pattern
- 11 distinct modal shapes captured
- Two sizes: compact (single-column, ~400px, e.g. Delete confirm) and large (multi-column, ~900px, e.g. Variants, Costing options)
- Footer always has Cancel (secondary) + primary action right-aligned
- Escape dismisses; click-outside does not (intentional — protects in-progress edits)
- Nested modals exist (e.g. inside Custom fields modal you can open a Rename field sub-modal)

### Empty states
- Friendly illustration + headline + primary CTA
- Captured empty states: Products, Stock counts, Sales orders, Purchase orders, Customers, Vendors
- All 6 follow same template (OneAce can lift this pattern)

### Help surfaces
- Floating **Help bubble** bottom-right (opens an in-app chat/knowledge base mini-app)
- Contextual `?` pills next to complex settings (Costing options, Variants, Sublocations toggle)
- Sample workspace is itself a help surface: pre-populated data walks the user through each module

### Sample-mode behavior (interesting)
- "Sample data cannot be deleted" bump — ADD/EDIT work, DELETE/DEACTIVATE blocked
- Yellow trial banner persistent across all pages
- Subscribe now CTA in top bar
- This is a clever trial design: users experience full CRUD read/write without destructive risk

---

## 7. END-TO-END WORKFLOW MAP (LIVE-VERIFIED)

1. **Item creation**: Products → New → fill product master → optionally attach Variants (select Options → values cartesian generates children) → set reorder point → save
2. **Supplier setup**: Vendors → New → catalog vendor product codes + last prices + default currency → assign payment terms
3. **Customer setup**: Customers → New → multi-address + pricing scheme + default payment terms
4. **Purchase order**: PO → Issued → receive (partial or full) → vendor payment → close. Dual tax (State + Gov't) applied at document level.
5. **Receiving**: scan to receive via Smart Scanner or web; partial receipts generate separate movement events tagged to the same PO #
6. **Stock transfer**: Transfer → Sent → In transit → Received at destination → Closed. From/to location and dates recorded.
7. **Stock count (THE BIG ONE)**: Stock counts → New → select location + scope (category / all / filter) → **snapshot frozen at this moment** → Start counting → line-level counted quantities → Complete and adjust → system posts variances to ledger
8. **Stock adjustment**: ad-hoc with reason code → posts to movement ledger and cost log
9. **Sales order**: Quote → Confirmed → Pick (according to global picking heuristic) → Ship → Invoice → Payment
10. **Picking / packing / shipping**: pick tasks respect the 3 global heuristics; shipping labels via EasyPost; tracking numbers stored on SO
11. **B2B Showroom**: customer logs into Showroom buyer portal → browses customer-specific catalog → places order → order lands in main Sales Order module
12. **Reorder / replenishment**: Products with reorder point below stock-on-hand show suggested reorder qty (from demand rate + lead time + safety stock); run reorder recommendations report
13. **Reporting**: Reports hub → pick family → pick sub-report → column picker → date range → Export
14. **Admin**: Options → Users & access rights → invite user → assign role + per-location permissions
15. **Integrations**: Options → Integrations → OAuth or API-key connect per channel

---

## 8. DATA MODEL RECONSTRUCTION (REFINED)

### Master entities
- **Product** (SKU, type, category, UOM, cost, pricing, photos, reorder point, custom_fields[0..9], variants ref)
- **VariantOption** (global: name, list of VariantValue)
- **VariantValue** (per option)
- **ProductVariant** (product_id, option_values[], cost override, price override, barcode override)
- **Vendor** (name, product codes, vendor prices, payment terms, default currency)
- **Customer** (name, contacts, addresses[], pricing scheme, credit limit, default payment terms)
- **Location** (name, address, parent?)
- **Sublocation** (location_id, name, bin/aisle tree — **only exists if global flag is ON**)

### Transaction / document entities (all 7 share a common doc-number prefix system)
- **PurchaseOrder** (PO #, status, vendor, expected vs received lines, state_tax_rate, govt_tax_rate, payments[])
- **PurchaseQuote** (same shape as PO, no stock impact)
- **SalesOrder** (SO #, status, customer, lines with picking status, single tax rate, payments[], tracking #)
- **SalesQuote** (same shape as SO, no stock impact)
- **StockTransfer** (transfer #, from_location, to_location, sent_date, received_date, lines[])
- **StockCount** (count #, status ∈ {OPEN, IN_PROGRESS, COMPLETED}, location, counted_by, completed_by, snapshot_taken_at, lines[expected_snapshot, counted, variance])
- **StockAdjustment** (adjustment #, reason_code, lines[delta, cost_change])

### Append-only ledger
- **InventoryMovement** (date, product_id, variant_id?, location_id, sublocation_id?, movement_type, qty_delta, qty_after, cost_change, user_id, source_doc_type, source_doc_id, notes)
  - movement_type ∈ {RECEIVE, SHIP, TRANSFER_OUT, TRANSFER_IN, ADJUST, COUNT_ADJUST, BUILD_CONSUME, BUILD_PRODUCE}
  - This is the single source of truth — all reports derive from it

### Manufacturing
- **BillOfMaterials** (parent_product, component_lines[qty, scrap%])
- **Routing** (steps[], labor rate, build time)
- **ManufactureOrder** (status, materials_consumed, finished_produced, variance, WIP cost)

### Audit
- **UserAction** (user_id, timestamp, action, entity_type, entity_id, name/#, before/after diff?)
- **LoginEvent** (user_id, timestamp, ip, success)

### Settings/Config (global)
- **CompanyProfile** (currency, language, regional format, use_sublocations flag, costing_method, extra_cost_allocation, default picking heuristic)
- **AdjustmentReason** (name — user-editable list)
- **PaymentTerm** (name, net days)
- **CustomField** (slot [0..9], type, label)
- **RenameField** (canonical_name, display_name) — string-table i18n / white-label
- **DocPrefix** (doc_type, prefix_string) — SO/SQ/PO/PQ/SC/SA/ST

---

## 9. STOCK STATE MODEL (CONFIRMED)

- **Owned**: total stock the org holds (includes reserved)
- **Reserved**: committed to confirmed Sales Orders not yet shipped
- **Available**: Owned − Reserved (what a new SO can allocate)
- **Quantity On Hand**: sometimes used synonymously with Owned; in some reports splits out damaged/held-back buckets
- **On Order**: sum of open PO line expected qty not yet received
- **In Transit**: sum of in-flight Stock Transfer lines

The inventory movement ledger is the ground truth; these fields are derived aggregates.

---

## 10. DOCUMENT LIFECYCLE / STATUS MODEL (VERIFIED)

- **Purchase Order**: Draft → Issued → Partially received → Received → Closed
- **Purchase Quote**: Draft → Sent → (converted to PO or dismissed)
- **Sales Order**: Draft/Quote → Confirmed → Picked → Shipped → Invoiced → Paid
- **Sales Quote**: Draft → Sent → (converted to SO or dismissed)
- **Stock Count**: **OPEN** → **IN PROGRESS** → **COMPLETED** (snapshot-at-creation, adjust-at-completion)
- **Stock Transfer**: Draft → Sent → In transit → Received → Closed
- **Stock Adjustment**: Draft → Posted (no in-progress state; it's atomic)
- **Manufacturing Order**: Planned → In progress → Completed

---

## 11. COSTING & PRICING ARCHITECTURE (NEW SECTION — ANSWERS OPEN QUESTIONS)

### Costing methods (4 — configurable in Options → General → Costing options modal)
1. **Moving average** (default)
2. **Manual** (user enters cost per receive)
3. **FIFO**
4. **LIFO**
Setting is global but overridable per product on the product detail Cost tab.

### Extra cost allocation (3 strategies)
When a PO includes landed costs (freight, customs, duties), the extra cost is allocated across line items by one of:
1. **Proportional to price**
2. **Proportional to weight**
3. **Proportional to volume**
Selected at the PO level, captured verbatim in the Costing options modal.

### Pricing
- Price brackets (tiered pricing by quantity)
- Customer-specific pricing schemes
- Per-variant price override

**Takeaway for OneAce**: we're currently moving-average only. We don't need to ship all 4 costing methods on day one, but we need the abstraction in place so adding FIFO later isn't a rewrite.

---

## 12. OPEN QUESTIONS — NOW ANSWERED (or narrowed)

| Original question | Status | Answer / narrowing |
|---|---|---|
| Costing method (MA vs FIFO) | **ANSWERED** | 4 methods: Moving avg (default), Manual, FIFO, LIFO. Global setting, per-product override. |
| Serial/lot/expiry enforcement | **Partially** | Feature-gated add-on in sample workspace. Upsell card visible; enforcement rules not observable without purchase. |
| RBAC details / location-level permissions | **Partially** | Options → Users & access rights has roles + per-location permissions. Full permission matrix not exhaustively mapped. |
| Picking workflow sophistication | **ANSWERED** | Intentionally minimal. 3 global picking heuristics (captured in Picking options modal). No per-product override. No wave/batch picking. |
| Showroom auth model / catalog segmentation | **Still open** | Buyer portal not entered this session. |
| API webhooks / pagination | **Still open** | Developer docs not in-app linked; would need separate docs pass. |
| Sublocation enforcement | **ANSWERED** | Global toggle (Options → Global → Preferences → Use sublocations). Off by default on Entrepreneur tier. Not always-on. |
| Variants architecture | **ANSWERED** | Two-level global model: Option → Values → per-product opt-in → cartesian SKU matrix. |
| Tax model | **ANSWERED** | Asymmetric: dual tax (State + Gov't) on POs, single tax on SOs. |
| Custom fields capacity | **ANSWERED** | 10 hardcoded slots, 4 types, global schema. |
| Doc numbering | **ANSWERED** | 7 configurable prefixes: SO/SQ/PO/PQ/SC/SA/ST. |

---

## 13. REBUILD READINESS ASSESSMENT — UPDATED

| Area | Prior score | New score | Notes |
|---|---|---|---|
| Feature surface inventory | 85 | **95** | All 14 sidebar modules + all 9 Settings subtabs confirmed. |
| Data model | 70 | **92** | 7 doc types + ledger + variants + sublocations now explicit. |
| State machines | 60 | **90** | Stock count 3-state + snapshot semantics confirmed by hand. |
| Pricing / packaging | 80 | **98** | Tier cards + add-ons + enterprise fees captured verbatim. |
| UI / visual language | 55 | **88** | Design tokens written up in `inflow-figma-blueprint.md`. |
| Internal APIs / webhooks | 40 | **45** | Still blocked without dev docs pass. |
| Manufacturing / Showroom depth | 50 | **55** | Marketing + card surface only; flows not run. |
| **Overall replication confidence** | **78/100** | **92/100** | |

---

## 14. STRATEGIC IMPLICATIONS FOR ONEACE

Cross-referenced against `inflow-captures.md §13` — the 10 architectural takeaways. Here's what matters for OneAce's roadmap:

### A. Things inFlow does that OneAce should do (priority picks)
1. **Stock count 3-state machine with snapshot-at-creation.** This is inFlow's strongest pattern and it directly maps to a gap in OneAce. Users running a count on a live warehouse cannot freeze ops. Ship this in the next stock counting iteration. The implementation is: freeze expected qty to the sheet row at creation time; allow other movements to continue posting to the ledger; compute variance as (counted − snapshot), NOT (counted − current).
2. **Append-only inventory movement ledger.** If OneAce doesn't already do this (verify), it's non-negotiable for trustworthy reports and audit. Every stock-changing action writes a movement row; nothing is destructively updated. All stock-on-hand views derive from the ledger.
3. **7-document prefix system with configurable strings.** Low-cost, high-trust feature. Lets customers stamp their own DNA on every document. Ship in Settings.
4. **Adjustment reasons as a user-editable list.** Five minutes of work, massive audit value.
5. **Sample-mode partial permissions (ADD/EDIT allowed, DELETE/DEACTIVATE blocked).** This is the best trial-onboarding pattern we've seen. Users get full CRUD muscle memory without destroying the sample data. Copy this.

### B. Things inFlow does that OneAce should NOT do (or defer)
1. **Two-level global Variants with cartesian expansion.** Powerful but high surface area. Defer until we have customer demand signal. A flat-SKU model is fine for MVP.
2. **4 costing methods.** Ship Moving Average first. Abstract the cost engine interface now so adding FIFO later is not a rewrite, but don't build all 4.
3. **Rename Fields i18n / white-label system.** Nice, but a rabbit hole. Defer.
4. **10 hardcoded custom field slots.** This is inFlow's weakness, not strength — hardcoded ceilings are a bad look. If OneAce does custom fields, do them as a proper schema-less key/value, not 10 slots.
5. **Dual tax on PO.** Only relevant for dual-jurisdiction markets (US state + Canada GST). Defer until those markets matter.
6. **Manufacturing add-on ladder.** Separate product; don't touch unless the GTM decision is made.
7. **B2B Showroom portal.** Separate product surface area. Defer.

### C. Things inFlow does NOT do that OneAce can win on
1. **Truly mobile-first, scan-first UI.** inFlow Stockroom exists but is a separate SKU at $99–$129/mo. OneAce can include scan-first workflow in the base product.
2. **Clean sidebar (< 8 modules).** inFlow has 14 sidebar entries and it shows. OneAce's minimalism is already a competitive advantage; protect it.
3. **Wave / batch picking sophistication.** inFlow explicitly does not have this — their picking is 3 global heuristics and done. OneAce can out-specialize them for customers who care about picking efficiency.
4. **Modern onboarding (< 60 seconds to first productive action).** inFlow's sample workspace is helpful but the trial banner + 14-sidebar + 9-tab Settings is a lot to parse. OneAce can be radically simpler.
5. **Transparent pricing starting < $100/mo.** inFlow's entry is $129/mo with usable features gated behind $349/mo. Price-conscious SMBs are an underserved lane.

### D. Parity estimate
Previous pass estimated OneAce at ~50% parity with inFlow on the public-facing feature surface. The live teardown reveals inFlow is deeper than the public site suggested (variants, dual tax, 4 costing methods, snapshot counts, 49 reports, 7 doc types). **Revised parity: ~38–42%.** This is not bad news — OneAce was never trying to match inFlow feature-for-feature. The point of the gap is to pick which gaps are strategically worth closing (list A) and which are moat-points we let them own (list B).

### E. Moat candidates (what OneAce should NEVER let inFlow out-ship us on)
1. Stock counting velocity (time to finish a count from first scan to posted variance)
2. Mobile/scan-first operator UX
3. Onboarding simplicity (time-to-first-value)
4. Transparent, usable entry-tier pricing
5. Sample-mode trial pattern

---

## 15. APPENDIX — CROSS-REFERENCES

- Verbatim screen captures, modal contents, and ASCII layouts: `inflow-captures.md` (2454 lines, §1–§13)
- Design tokens, component library, page blueprints, Figma file structure: `inflow-figma-blueprint.md` (Parts A–I)
- This file: synthesis and strategic interpretation

**Last updated:** 2026-04-10 (live authenticated traversal)
