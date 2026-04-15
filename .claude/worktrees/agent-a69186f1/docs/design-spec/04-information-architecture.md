# Information Architecture

## Goal

Navigation has to survive three stress tests simultaneously:

1. A mobile counter who wants to scan and record in three taps.
2. A desktop inventory controller who jumps between items, movements, and
   counts twenty times an hour.
3. An owner who opens the app once a week for the P&L and never wants to
   see warehouse plumbing.

Three very different jobs mapped to one hierarchy. The IA below resolves the
conflict with **role-aware visibility** (same tree, pruned per role) and
**device-specific shells** (different chrome, same destinations).

## Global hierarchy

Top-level sections, in order. Every section has a stable URL under the web
app and a direct entry point on mobile unless marked "Web only".

| #  | Section         | Web route           | Mobile?       | MVP status | Notes                                                  |
| -- | --------------- | ------------------- | ------------- | ---------- | ------------------------------------------------------ |
| 1  | Home / Dashboard| `/` (dashboard root)| Home tab      | **BUILT**  | Welcome card for now; KPI widgets Post-MVP             |
| 2  | Items           | `/items`            | Items tab     | **BUILT**  | Catalog — search, detail, edit                         |
| 3  | Locations       | `/locations`        | Menu → list   | **BUILT**  | Warehouses, stores, bins, virtual                      |
| 4  | Movements       | `/movements`        | Menu → list   | **BUILT**  | Full ledger, filter by type/location/item              |
| 5  | Stock counts    | `/stock-counts`     | Counts screen | **BUILT**  | The moat — list, create, detail, reconcile             |
| 6  | Purchase orders | `/purchase-orders`  | POST-MVP      | POST-MVP   | Suppliers + PO lifecycle                               |
| 7  | Sales orders    | `/sales-orders`     | POST-MVP      | POST-MVP   | Customers + fulfillment                                |
| 8  | Reports         | `/reports`          | Reports tab   | MVP        | Stock-on-hand, variance history, movement summary      |
| 9  | Scanner         | —                   | Scan tab      | MVP        | Mobile-native. Web has no scanner.                     |
| 10 | Admin           | `/admin/*`          | Menu only     | MVP        | Members, roles, audit log, settings                    |
| 11 | Billing         | `/billing`          | Menu only     | POST-MVP   | Subscription + invoices                                |

## Web shell

### Sidebar (primary nav) — BUILT

`components/sidebar.tsx`. Fixed 240px wide at `lg+`, collapses to icon rail
(56px) between `md` and `lg`. Hidden on mobile (below `md`).

Items, in order:

1. **Items** (`Boxes` icon, `item.read`)
2. **Locations** (`MapPin` icon, `location.read`)
3. **Movements** (`ScrollText` icon, `movement.read`)
4. **Stock counts** (`ClipboardList` icon, `stockcount.read`)
5. **Purchase orders** — MVP — (`Truck` icon, `purchase_order.read`)
6. **Sales orders** — MVP — (`ShoppingCart` icon, `sales_order.read`)
7. **Reports** — MVP — (`BarChart` icon, role: owner/admin/member)
8. **Admin** — MVP — (`Settings` icon, `org.admin` or specific admin perms)

Below the nav: sync indicator (mobile-primary but also web for parity),
collapse button, version string.

### Top bar — BUILT

`components/top-bar.tsx`. Full-width at `md+`. Contains:

- **Left:** logo + current org name (tappable to open org switcher).
- **Center (desktop only):** global search input (MVP — stub at first, wired
  to real search index POST-MVP).
- **Right:** sync status dot, notifications bell (POST-MVP), user menu
  (profile, sign out).

Height is fixed at 56px. Never scrolls with content. The top bar is the only
chrome element that survives page transitions.

### Contextual sub-navigation

Sections with multiple sub-views get a **tabbed sub-header** under the page
title. No nested sidebar. Keeps nav flat and scannable.

| Section        | Sub-nav tabs (MVP)                              | POST-MVP tabs                          |
| -------------- | ----------------------------------------------- | -------------------------------------- |
| Items          | All items                                       | Categories / Tags / Alerts / Bundles   |
| Movements      | All / Adjustments / Count adjustments           | Transfers / PO receipts / Returns      |
| Stock counts   | In progress / Closed                            | Assigned to me / Review / Discrepancies|
| Reports        | Stock on hand / Variance / Movements            | Valuation / Turnover / Aging / Custom  |
| Admin          | Members / Roles / Audit log / Settings          | Webhooks / API keys / Integrations     |

**Design rule.** A sub-tab ships only if the page behind it is real. We'd
rather surface fewer tabs with working pages than many tabs with empty
"coming soon" screens.

## Mobile shell

### Bottom tab bar (MVP)

Five tabs, order is fixed (no customization):

1. **Home** — daily briefing + shortcuts to active counts
2. **Items** — catalog search, item detail (read-only at MVP)
3. **Scan** — the big camera button, centered and raised
4. **Counts** — list + active count entry
5. **Menu** — everything else (movements list, settings, sign out, help)

Height 56pt + safe-area. The center Scan tab is a 64pt elevated circle so it
reads unambiguously as the primary action. Pressed state = ring + haptic
(iOS only).

### Drawer (MVP)

Pushed from the `Menu` tab. Non-modal: tapping a row navigates and closes
the drawer in a single gesture. Items:

- Movements list
- Locations list (read-only)
- Switch organization
- Settings
- Help / feedback
- Sign out

### Tablet navigation

Between `tablet-p` and `tablet-l` (640–1023px), the sidebar collapses to the
icon rail and the bottom bar disappears. At `tablet-l+` the full sidebar
returns. Single shell, three responsive states.

## Global quick actions

A floating action button or quick-action sheet is a liability (covers data,
steals thumb real estate) unless the action is clearly the primary one for
the screen. MVP adds exactly one global quick action: **Scan**, and only on
mobile. Everything else must route through an in-context button on the
relevant page.

POST-MVP candidates (behind flag):

- "New count" from mobile counts tab — currently a secondary button
- "Log adjustment" from movements page — modal with item picker
- "Receive PO" from home — after POs ship

## Global search

### MVP behavior

`Ctrl/Cmd+K` opens a command palette (web) or header search (mobile).
Results are grouped by entity, max 5 per group, with a "see all" link that
navigates to the section-filtered list.

| Group       | Match fields                | Max | Row example                            |
| ----------- | --------------------------- | --- | -------------------------------------- |
| Items       | SKU, name, barcode          | 5   | `SKU-0001 · Widget blue · 32 on hand`  |
| Locations   | name, code                  | 3   | `WH-01 · Main warehouse`               |
| Stock counts| name, id suffix             | 3   | `Q2 cycle — bin A · in_progress`       |
| Movements   | reference, note             | 3   | `Ref INV-2024 · shipment · -5`         |

Keyboard navigation arrow keys; `Enter` opens; `Esc` closes. The palette is
stateless — no recent history at MVP.

### POST-MVP extensions

- Recent items (per-user, local).
- Fuzzy match (currently prefix/substring only).
- Result previews on hover.
- Full-text search on movement notes + item descriptions.
- Cross-org search (for owners who manage multiple orgs).

## Contextual entry points

Every entity in the product must be reachable by at least two paths — one
via the primary nav, one via a cross-link from a related entity. This
guarantees no entity lives at a dead end.

| Entity         | Primary path              | Cross-link from                             |
| -------------- | ------------------------- | ------------------------------------------- |
| Item           | `/items`                  | Movements row, count entry, reports         |
| Location       | `/locations`              | Item detail "on-hand by location" section   |
| Stock count    | `/stock-counts`           | Movement referenced by count-adjustment type|
| Movement       | `/movements`              | Item detail "recent movements", count detail|
| Member         | `/admin/members`          | Audit log row, count entry attribution      |
| Role           | `/admin/roles`            | Member detail                                |

## Breadcrumbs

Web desktop and tablet only. Always show the current section + current
entity name, nothing deeper. No dropdown shortcuts. No auto-collapse.

Example: `Stock counts / Q2 cycle — bin A`

Mobile does not use breadcrumbs — the back button is the contract.

## URL conventions

- Plural resource, kebab-case: `/stock-counts`, `/purchase-orders`.
- Detail at `/:resource/:id` with no trailing slash.
- Sub-action at `/:resource/:id/:verb` (`/stock-counts/[id]/reconcile`).
- Filters in query string: `?state=in_progress&location=WH-01`.
- Never put org slug in URL — org is resolved via header + active state.
  This keeps URLs shareable within an org, unshareable across orgs (a
  feature, not a bug).

## Deep link targets

Links that the product guarantees will always resolve (so they're safe to
paste in Slack, Linear, email):

- `/items/:sku-or-id`
- `/stock-counts/:id`
- `/stock-counts/:id/reconcile`
- `/movements?ref=:referenceId`

All other routes are "internal" and may change.

## Role-aware visibility

The hierarchy is the same for every role. What changes is *which entries are
visible* and *which are read-only*. The nav filter runs against the
`PERMISSION_KEYS` enum. Spec for which key gates what lives in
[`09-role-based-access.md`](./09-role-based-access.md).

Rules:

1. A nav entry is hidden entirely if the user has none of the `.read`
   permissions for that section.
2. A nav entry is shown but CTA buttons inside are hidden if the user has
   `.read` but not `.write`.
3. Admin section is hidden entirely unless the user has at least one of
   `member.manage`, `role.manage`, `billing.manage`, `org.admin`, or
   `audit_log.read`.
4. No "locked" rows with padlocks. If you can't use it, you don't see it —
   this reduces visual noise far more than it reduces discoverability.

## 3-tap rule verification

Frequent workflows, measured from cold app open:

| Action                      | Mobile taps | Desktop clicks | Notes                                   |
| --------------------------- | ----------- | -------------- | --------------------------------------- |
| Start a new count           | 2           | 2              | Counts tab → New count                  |
| Scan an item                | 1           | n/a            | Scan tab                                |
| See low-stock list          | 2 (POST)    | 2 (POST)       | Reports tab → Low stock (POST-MVP page) |
| Post a manual adjustment    | 3           | 3              | Movements → New → submit                |
| See movement history        | 2           | 1              | Menu → Movements (or sidebar click)     |

All five stay within the 3-tap budget at MVP. No design change needed.

## Transitions and state preservation

- Navigation between sibling tabs preserves their individual scroll state.
- Filters persist within a session via URL params; cleared on new session.
- A pressed back button from a detail view returns to the list at the same
  scroll position, not the top.
- Pending form state on any detail page shows a confirmation dialog before
  navigation.

## Out of scope for MVP

The following nav patterns were in the original Figma prompt but are
explicitly cut:

- **Command-K mega menu with action verbs** ("add item", "receive PO") —
  POST-MVP, depends on a real action registry.
- **Customizable nav order** — not shipping configuration UI for nav.
- **Role-based dashboards** — Home is identical for every role at MVP.
- **Multi-level breadcrumb with jump-to-ancestor dropdown** — unnecessary at
  our depth (never more than 2 levels deep).
- **Context switcher for warehouses within an org** — location is a filter,
  not a scope. Stays query-string.
