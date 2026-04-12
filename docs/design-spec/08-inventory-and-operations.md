# Inventory & Operations

Everything in the product that isn't a stock count — items, locations,
movements, and the order lifecycles that feed them. This chapter is the
catch-all for the "rest of the ERP" and exists mainly to declare what stays
cut for MVP.

## Items

### Item entity

`items` table columns that matter for UX:

- `id` (ULID), `sku` (unique per org), `name`, `description`
- `unitOfMeasure` (ea, kg, L, m, etc.)
- `barcode` (nullable, unique per org where present)
- `categoryId` (POST-MVP), `tags` (text[])
- `trackSerialNumbers` (bool, POST-MVP)
- `trackBatches` (bool, POST-MVP)
- `reorderPoint`, `reorderQuantity` (POST-MVP)
- `defaultCostCents`, `defaultPriceCents` (POST-MVP)

### Screens

| #  | Route                           | Status    | Notes                                  |
| -- | ------------------------------- | --------- | -------------------------------------- |
| 1  | `/items`                        | **BUILT** | List + search                          |
| 2  | `/items/new`                    | MVP       | Create form                            |
| 3  | `/items/[id]`                   | MVP       | Detail w/ on-hand by location          |
| 4  | `/items/[id]/edit`              | MVP       | Edit form                              |
| 5  | `/items/import`                 | MVP       | CSV import with column mapping         |
| 6  | `/items/[id]/history`           | POST-MVP  | Per-item movement log                  |
| 7  | `/items/[id]/forecast`          | POST-MVP  | Demand + reorder projection            |
| 8  | Mobile item detail              | MVP       | Read-only at MVP                       |

### Item list (`/items`) — BUILT

- Columns: SKU (mono), Name, Unit, On hand (summed), Updated, row action
  menu.
- Search: `ilike` on sku, name, barcode. Debounced 200ms.
- Empty state per [`05-onboarding-activation.md`](./05-onboarding-activation.md).
- Row click → `/items/[id]`.
- Create button in header (hidden if no `item.write`).

Post-MVP additions:

- Filter chips by category, tag, stock level.
- Bulk actions: tag, archive, move to category, export selected.
- Save-view presets per user.
- Column visibility toggle.

### Item detail (MVP)

Sections, top to bottom:

1. **Header row** — name, SKU pill, actions (Edit, Archive, Print label).
2. **Key meta card** — unit, barcode, category, tags.
3. **On-hand by location card** — table with columns Location, On hand,
   Reserved (POST-MVP), Available. Sum row at bottom.
4. **Recent movements card** — last 10 movements referencing this item.
   "See all" link → `/movements?item=:id`.
5. **Photos** (POST-MVP) — up to 6, first is default.
6. **Notes** (POST-MVP) — free-text, audit-logged.

### Item create / edit (MVP)

- Plain form, not a modal. Multi-field = page, per UX principle #anti-pattern.
- Required: SKU, name, unit.
- Optional: barcode, description, tags (chip input).
- "Initial stock" accordion: location dropdown + quantity input. On submit,
  this posts a `movement` of type `adjustment` with the entered qty and a
  note "Initial stock from item create".

### CSV import (MVP)

- Upload file → parse client-side with PapaParse.
- Preview table: first 20 rows with detected columns.
- Column mapping: dropdowns per column to map to OneAce fields (SKU, name,
  unit, barcode, on-hand).
- Validation: duplicate SKUs, missing required fields, invalid units.
- Submit posts batch via `trpc.items.bulkCreate`.
- Progress indicator: rows imported / total, live-updated.
- Result screen: count created, count failed, CSV of errors to download.

POST-MVP:

- Background job for imports > 5k rows.
- "Update existing" mode by SKU match.
- Multi-file queue.
- Direct Google Sheets / Excel online integration.

## Categories, tags, and attributes (POST-MVP)

Cut for MVP because:

- We have no data on what taxonomy users want.
- Tags cover 80% of categorization needs with zero schema design.
- Category trees with inheritance are deceptively expensive to build well.

When we add them, the model is:

- Flat `categories` table with nullable `parentId` (adjacency list).
- Items belong to 0 or 1 category.
- Tags are free-form per-org, deduped on creation.
- Custom attributes (item-level key/value) come even later.

## Locations

### Location entity

`locations` table columns:

- `id`, `name`, `code`, `kind` (`warehouse | store | bin | virtual | in_transit`)
- `parentId` (nullable — for bins inside warehouses)
- `address` (POST-MVP)
- `default` (bool — one per kind per org)

### Screens

| #  | Route                | Status    | Notes                                  |
| -- | -------------------- | --------- | -------------------------------------- |
| 1  | `/locations`         | **BUILT** | Flat list at MVP                       |
| 2  | `/locations/new`     | MVP       | Create dialog or page                  |
| 3  | `/locations/[id]`    | MVP       | Detail w/ stock by item                |
| 4  | Location tree view   | POST-MVP  | Nested bins under warehouse            |
| 5  | Location map overlay | POST-MVP  | Geographic placement                   |

### Location list (BUILT)

- Columns: Name, Code, Kind badge, Item count (derived), Row actions.
- No filters at MVP. Sort by name ascending.
- Default warehouse pinned to top with a "Default" chip.

### Location detail (MVP)

- Header: name, kind badge, code, edit button.
- Address card (POST-MVP, hidden at MVP).
- Stock by item card: table with SKU, Name, On hand, sorted by on-hand desc.
- Recent movements card: last 10 movements for this location.

## Movements (the ledger)

Movements are the single source of truth for stock levels. Every stock
change — receipts, shipments, adjustments, count reconciliation — posts a
movement. On-hand is always derived, never stored.

### Movement types

From `MOVEMENT_TYPES` enum:

| Type                       | Sign | Posted by                       | MVP? |
| -------------------------- | ---- | ------------------------------- | ---- |
| `receipt`                  | +    | Manual, receiving flow          | MVP  |
| `shipment`                 | −    | Manual, sales fulfillment       | MVP  |
| `adjustment`               | +/−  | Manual                          | MVP  |
| `count-adjustment`         | +/−  | Stock count reconcile           | BUILT|
| `reserve`                  | −    | Sales order (soft)              | POST |
| `release`                  | +    | Sales order cancel              | POST |
| `purchase-order`           | +    | PO receipt                      | POST |
| `purchase-order-cancelled` | −    | PO cancel                       | POST |
| `transfer-out`             | −    | Location transfer               | POST |
| `transfer-in`              | +    | Location transfer               | POST |

### Screens

| #  | Route                | Status    | Notes                                  |
| -- | -------------------- | --------- | -------------------------------------- |
| 1  | `/movements`         | **BUILT** | List, filter by type/loc/item          |
| 2  | `/movements/new`     | MVP       | Manual adjustment form                 |
| 3  | `/movements/[id]`    | POST-MVP  | Row detail (most data is in the list)  |
| 4  | Bulk adjustment UI   | POST-MVP  | Import adjustments via CSV             |

### Movement list (BUILT)

- Columns: When (relative), Type chip, Item (SKU + name), Location, Qty
  (signed, colored), Ref, Note.
- Filters: Type dropdown, Location dropdown, Item search.
- URL-driven filters: `?type=...&location=...&item=...&ref=...`.
- Pagination: 50 rows per page, Next/Prev, "Jump to page" POST-MVP.
- CSV export: current filter set, POST-MVP.

### Manual adjustment (MVP)

- Form fields: Item (search-select), Location (select), Quantity (signed
  integer, −/+ buttons for clarity), Reason (required text), Note
  (optional).
- Submits a movement of type `adjustment`.
- Warning if the adjustment would bring on-hand below zero: "This will make
  on-hand negative. Are you sure?" — allowed with confirmation because
  negative stock is legitimate in audit recovery scenarios.
- After submit: toast "Adjustment posted", redirect to movements list with
  the new row visible at top.

## Purchase orders (POST-MVP)

Full spec deferred. Outline only:

- Suppliers CRUD.
- PO lifecycle: `draft → submitted → acknowledged → partial → received → closed`,
  with `cancelled` as a terminal.
- PO line items with expected qty, cost, due date.
- Receiving flow: scan-based on mobile, bulk on web.
- Partial receipts post individual movements per PO line.
- Supplier performance reports.

Why POST-MVP:

- The moat is counting, not procurement. Launching with counts + a CSV
  export is enough.
- Procurement workflows are highly customer-specific; we need customer
  conversations to design them right.
- Building this in-house delays MVP by ~8 weeks.

## Sales orders (POST-MVP)

Same reasoning. Outline:

- Customers CRUD.
- SO lifecycle: `draft → confirmed → picking → packed → shipped → delivered`,
  with `cancelled` and `returned` as terminals.
- Pick lists generated per SO or batched across SOs.
- Packing confirmation + shipment creation.
- Integration with carriers (much later).

## Transfers (POST-MVP)

- From location / To location.
- Status: `draft → in_transit → received`.
- Writes two movement rows linked by `transferId` on the metadata.
- In-transit stock is visible in a dedicated report.

## Reports (MVP v1)

Three reports ship at MVP:

### R1 — Stock on hand

- Table: SKU, Name, Unit, Total on hand, Per-location columns (dynamic).
- Filter: Location, Category (POST-MVP), Has stock only (checkbox).
- Export: CSV button.

### R2 — Variance history

- Table: Count name, Methodology, Completed at, Counted items, Matched,
  Over, Under, Net variance.
- Each row clickable → stock count detail.
- Filter: date range, methodology.
- Export: CSV.

### R3 — Movement summary

- Table: Date (day), Type, Count of movements, Net qty.
- Group by day or week.
- Filter: date range, type, location.
- Export: CSV.

POST-MVP v2 reports:

- Valuation (requires costing — WAC or FIFO).
- Turnover / velocity.
- Aging analysis.
- ABC classification.
- Reorder suggestions.
- Custom report builder.

## Item adjustment shortcuts (POST-MVP)

Quick actions on item detail pages:

- "Receive stock" → pre-fills a `receipt` movement.
- "Ship stock" → pre-fills a `shipment` movement.
- "Move stock" → transfer between locations.
- "Write off" → adjustment with preset reason codes (damaged, expired, etc.).

These all become forms that boil down to a movement insert. Not a feature —
a UX affordance for frequent-enough operations.

## Label printing (POST-MVP)

- Label designer with templates (small / large / shelf / pallet).
- Variable mapping: SKU, name, barcode, price, QR code.
- Print via browser printer or direct-to-Zebra via web-USB.

Explicitly not doing:

- Thermal printer driver bundles.
- Avery-style multi-up spreadsheet labels.

## Audit log (MVP)

Admin-only. Single read-only list page:

- Columns: When, User, Action, Entity, Details.
- Filters: action type, user, entity type, date range.
- No detail page; expand-in-row for JSON diff.
- Retention: 90 days at MVP, configurable POST-MVP.

## Settings (MVP)

Minimal at MVP. Single page with:

- Organization name + logo upload (POST-MVP).
- Currency (read-only for now, fixed at org creation).
- Default location assignment.
- Time zone.
- Member email preferences (future home for notification settings).

POST-MVP:

- Webhooks.
- API keys.
- Custom fields.
- Numbering schemes (PO/SO/invoice number formats).
- Data export (full org dump).
- Data deletion (right-to-be-forgotten).

## Out of MVP (explicit list)

Everything not marked BUILT or MVP in this chapter is explicitly cut for
the 2026-07-03 release. This is the binding scope list for Inventory &
Operations. Adding anything to MVP requires a scope-change decision logged
in [`10-mvp-cutline.md`](./10-mvp-cutline.md).
