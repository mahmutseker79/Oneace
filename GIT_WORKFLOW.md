# Git Workflow — OneAce Next.js Port

This document is the exact runbook for getting the `oneace-next/` scaffold onto
GitHub as a long-lived `next-port` branch, opening a draft PR against `main`,
and iterating on it through Sprint 0 → Sprint 16.

> **Why this lives in a markdown file and not a git commit:** the port was
> scaffolded inside a sandboxed environment that cannot finalize `git` writes.
> Run the commands below **from your local machine** where your SSH key, GPG
> signing, and GitHub identity already work.

---

## 0. Fast path — use the pre-built bundle (RECOMMENDED, updated 2026-04-11)

Sprint 0 through Sprint 15 plus **Sprint 16** are already committed in a
portable git bundle at:

```
oneace-next/oneace-next-port-v0.16.0-sprint16.bundle
```

This bundle contains:

- **40 commits** — 8 Sprint 0 + 1 docs + Sprints 1..16 (each = 1 feature
  commit + 1 runbook commit)
- **Branch:** `next-port`
- **Tags (annotated):**
  - `v0.1.0-sprint1` — Sprint 1 complete (items, warehouses, categories)
  - `v0.2.0-sprint2` — Sprint 2 complete (stock movement ledger + item detail)
  - `v0.3.0-sprint3` — Sprint 3 complete (stock counts + variance reconcile)
  - `v0.4.0-sprint4` — Sprint 4 complete (CSV import wizard + bulk action)
  - `v0.5.0-sprint5` — Sprint 5 complete (suppliers + purchase orders + receive flow)
  - `v0.6.0-sprint6` — Sprint 6 complete (live dashboard + low-stock report + PO-from-reorder)
  - `v0.7.0-sprint7` — Sprint 7 complete (settings + team management + Sprint 5 cleanup)
  - `v0.8.0-sprint8` — Sprint 8 complete (barcode scanner + item lookup)
  - `v0.9.0-sprint9` — Sprint 9 complete (CSV exports + stock-value report)
  - `v0.10.0-sprint10` — Sprint 10 complete (global header search)
  - `v0.11.0-sprint11` — Sprint 11 complete (header org switcher + active-org cookie)
  - `v0.12.0-sprint12` — Sprint 12 complete (supplier performance report + CSV)
  - `v0.13.0-sprint13` — Sprint 13 complete (create-another-organization flow)
  - `v0.14.0-sprint14` — Sprint 14 complete (movements date-range + type filter)
  - `v0.15.0-sprint15` — Sprint 15 complete (purchase-order status + supplier + PO-number filter)
  - `v0.16.0-sprint16` — Sprint 16 complete (filter-aware PO CSV export)

Older bundles (`oneace-next-port.bundle`,
`oneace-next-port-v0.1.0-sprint1.bundle` ... `oneace-next-port-v0.16.0-sprint16.bundle`)
are kept around only because the sandbox cannot delete files from the mount
— always use the latest versioned one.

Instead of running all the manual commits in section 1.4, just restore the
bundle into a fresh clone. This skips 300+ lines of manual git surgery.

```bash
# From your local machine, in an empty working directory:
cd ~/code
git clone https://github.com/mahmutseker79/oneace.git oneace-port-workspace
cd oneace-port-workspace

# Pull in the bundle (path wherever you synced the sandbox folder to)
git fetch /path/to/SimplyCount/oneace-next/oneace-next-port-v0.16.0-sprint16.bundle \
          next-port:next-port

# Also pull all sixteen sprint tags
git fetch /path/to/SimplyCount/oneace-next/oneace-next-port-v0.16.0-sprint16.bundle \
          refs/tags/v0.1.0-sprint1:refs/tags/v0.1.0-sprint1 \
          refs/tags/v0.2.0-sprint2:refs/tags/v0.2.0-sprint2 \
          refs/tags/v0.3.0-sprint3:refs/tags/v0.3.0-sprint3 \
          refs/tags/v0.4.0-sprint4:refs/tags/v0.4.0-sprint4 \
          refs/tags/v0.5.0-sprint5:refs/tags/v0.5.0-sprint5 \
          refs/tags/v0.6.0-sprint6:refs/tags/v0.6.0-sprint6 \
          refs/tags/v0.7.0-sprint7:refs/tags/v0.7.0-sprint7 \
          refs/tags/v0.8.0-sprint8:refs/tags/v0.8.0-sprint8 \
          refs/tags/v0.9.0-sprint9:refs/tags/v0.9.0-sprint9 \
          refs/tags/v0.10.0-sprint10:refs/tags/v0.10.0-sprint10 \
          refs/tags/v0.11.0-sprint11:refs/tags/v0.11.0-sprint11 \
          refs/tags/v0.12.0-sprint12:refs/tags/v0.12.0-sprint12 \
          refs/tags/v0.13.0-sprint13:refs/tags/v0.13.0-sprint13 \
          refs/tags/v0.14.0-sprint14:refs/tags/v0.14.0-sprint14 \
          refs/tags/v0.15.0-sprint15:refs/tags/v0.15.0-sprint15 \
          refs/tags/v0.16.0-sprint16:refs/tags/v0.16.0-sprint16

# Verify
git log --oneline next-port                # should show 40 commits
git tag -l                                 # should include all sixteen sprint tags

# Push to GitHub
git push -u origin next-port
git push origin v0.1.0-sprint1 v0.2.0-sprint2 v0.3.0-sprint3 v0.4.0-sprint4 \
               v0.5.0-sprint5 v0.6.0-sprint6 v0.7.0-sprint7 v0.8.0-sprint8 \
               v0.9.0-sprint9 v0.10.0-sprint10 v0.11.0-sprint11 v0.12.0-sprint12 \
               v0.13.0-sprint13 v0.14.0-sprint14 v0.15.0-sprint15 \
               v0.16.0-sprint16
```

### What Sprint 16 added (v0.16.0-sprint16)

- **`src/app/(app)/purchase-orders/export/route.ts`** — new
  `GET /purchase-orders/export` route mirroring the Sprint 14
  movements export. Re-uses `parsePurchaseOrderFilter` /
  `buildPurchaseOrderWhere` so the CSV the user downloads matches
  the filter on the /purchase-orders screen row-for-row. 14-column
  layout (PO number, status, currency, supplier, destination
  warehouse, ordered/expected/received/cancelled ISO timestamps,
  line count, aggregate ordered qty, aggregate value as
  `Decimal(12,2)` stringified, notes, created-by). Row cap 2,000
  unfiltered / 10,000 filtered — lower than movements (5k/20k)
  because each row aggregates line data and we'd rather bound
  the per-PO fan-out.
- **`/purchase-orders` page** — Export CSV button added next to
  "New purchase order"; `buildExportHref` composes the same three
  filter axes into the query string so the button deep-links
  into a filtered CSV if the user already narrowed on screen.
  Uses the shared `t.common.exportCsv` label (no new i18n).

### What Sprint 15 added (v0.15.0-sprint15)

- **`src/app/(app)/purchase-orders/filter.ts`** — URL-driven filter
  parser mirroring the Sprint 14 movements pattern. Three axes:
  `status` validated against `Object.values(PurchaseOrderStatus)`
  (typo in URL degrades to "no filter" instead of 500),
  `supplier` passed through as an opaque id capped at 64 chars
  (the outer query is already org-scoped so a cross-org guess
  returns zero rows), and `q` as a trimmed, 64-char-capped
  substring against `poNumber` (`contains`, case-insensitive —
  stays index-friendly via the existing `(organizationId,
  poNumber)` unique index). Exports `parsePurchaseOrderFilter`,
  `buildPurchaseOrderWhere`, `hasAnyFilter`.
- **`/purchase-orders` page rewrite** — wires the parser, loads
  the full active-supplier list independently of the PO filter
  so the dropdown stays usable as you narrow (otherwise the
  dropdown would shrink and you'd lose the ability to broaden).
  Conditional row cap (200 unfiltered / 500 filtered), count line
  + truncation notice, split empty states for "filter matched
  nothing" vs "no POs at all". The "add a supplier first" empty
  state is preserved as an early return.
- **`PurchaseOrdersFilterBar` client component** — PO-number
  `<input type="search">` with a leading `Search` icon, status
  `<Select>` with `__all__` sentinel, supplier `<Select>` with
  its own `__all__` sentinel. Submits via `router.push` (pure
  read state). Clear button only appears when a filter is active.
- **i18n** — 14 new keys on `t.purchaseOrders.filter`
  (`heading`, `poNumberLabel`, `poNumberPlaceholder`,
  `statusLabel`, `statusAll`, `supplierLabel`, `supplierAll`,
  `apply`, `clear`, `resultCount`, `resultCountUnfiltered`,
  `truncatedNotice`, `emptyFilteredTitle`, `emptyFilteredBody`).

### What Sprint 14 added (v0.14.0-sprint14)

- **`src/app/(app)/movements/filter.ts`** — strict parser for
  `from` / `to` (`YYYY-MM-DD` → UTC start/end of day) and `type`
  (validated against the `StockMovementType` Prisma enum via
  `Object.values(...)`). Rejects 2026-02-30-style month overflow
  through a round-trip check. Inverted ranges (`from > to`) return
  an "impossible id" where clause instead of throwing, so a stale
  URL degrades to empty instead of 500. Exports
  `parseMovementFilter`, `buildMovementWhere`, `hasAnyFilter`, and
  the `MovementSearchParams` / `MovementFilter` types.
- **`/movements` page rewrite** — wires the parser into the server
  component, bumps the row cap from 200 (unfiltered) to 500
  (filtered), and renders a new `<MovementsFilterBar>` above the
  table. Shows a per-filter count line + a truncation notice when
  the row count equals the cap. Empty states are split: unfiltered
  still shows the "record your first movement" CTA, filtered shows
  "no matches for this filter" with a different body. Export
  button's href carries the current filter as query params so the
  CSV matches the on-screen view.
- **`MovementsFilterBar` client component** — two native
  `<input type="date">` fields (always speak `YYYY-MM-DD` on the
  wire) cross-referenced via `min` / `max` so the native date
  picker can't pick an impossible range to begin with, plus a
  Select for type with a `__all__` sentinel ("All types"). Submits
  via `router.push` (not server action — filtering is read state,
  the URL is the source of truth); JS-side guard blocks `from > to`
  before submit as UX polish. "Clear" button only appears when a
  filter is actually active.
- **`/movements/export` CSV route** — parses the same filter out
  of the request URL, applies `buildMovementWhere`, and bumps the
  row cap from 5,000 (unfiltered) to 20,000 (filtered). Filtered
  callers have already told us what window they want, so they can
  pull much more.
- **i18n** — 13 new keys on `t.movements.filter` (`heading`,
  `fromLabel`, `toLabel`, `typeLabel`, `typeAll`, `apply`, `clear`,
  `activeLabel`, `resultCount`, `resultCountUnfiltered`,
  `truncatedNotice`, `emptyFilteredTitle`, `emptyFilteredBody`,
  `invalidRange`).

No schema changes. Pure read-path + URL state.

### What Sprint 13 added (v0.13.0-sprint13)

- **`createOrganizationAction` server action** in
  `src/app/(app)/organizations/actions.ts` — validates name length
  (2..80), slugifies with up-to-5-random-suffix retry on collision,
  creates the Organization with a nested Membership write (role
  `OWNER`, current user) so there's no intermediate state where the
  org exists without a membership for its creator, flips the
  `oneace-active-org` cookie to the new id inside the same request
  that wrote it, and `revalidatePath("/", "layout")` so every
  server component re-reads on next navigation. Mirrors the logic
  in the first-org signup route at
  `src/app/api/onboarding/organization/route.ts` but as a server
  action so the client form can await it inside `useTransition`.
- **`/organizations/new` page + form** — dedicated route
  (`src/app/(app)/organizations/new/page.tsx` +
  `create-org-form.tsx`) with a Card-wrapped single-input form that
  calls the server action and on success does
  `router.push("/dashboard")` + `router.refresh()`. The route still
  goes through `requireActiveMembership()` so a user with zero
  memberships still bounces to `/onboarding` — this page is only
  for creating an *additional* org, not the first one.
- **OrgSwitcher refactor** — dropped the read-only-badge branch for
  single-org users. The switcher now always renders a `<Select>` so
  the "Create new organization…" action is visible from day one,
  not only after the user belongs to 2+ orgs. A
  `CREATE_SENTINEL = "__create__"` `SelectItem` appears at the
  bottom behind a `SelectSeparator`; on change to the sentinel we
  revert the controlled value (so the trigger keeps showing the
  active org) and `router.push("/organizations/new")`. We
  deliberately do NOT flip the cookie on the sentinel click — the
  cookie flip happens inside `createOrganizationAction` once the
  org actually exists.
- **Header + layout plumbing** — `HeaderLabels` gains
  `organizationCreate`, the layout passes it from
  `t.organizations.switcherCreateLabel`, and the Header forwards
  it to `<OrgSwitcher createLabel={...} />`.
- **i18n** — 9 new keys on `t.organizations.*`:
  `switcherCreateLabel`, `errors.{nameTooShort, nameTooLong,
  createFailed}`, and `create.{metaTitle, heading, subtitle,
  nameLabel, namePlaceholder, nameHelper, submit, cancel,
  creating}`.

Why a dedicated page and not an inline dialog: a page-level URL
lets users bookmark/share the flow, avoids a modal-inside-layout
context where the submitting form lives inside the very header
that renders the switcher that opened it, and mirrors the
`/onboarding` flow users already know from first-org signup.

### What Sprint 12 added (v0.12.0-sprint12)

- **`/reports/suppliers` page** — new App Router server component
  that rolls up every active supplier's purchase order activity into
  five metrics: total POs (all statuses), open POs
  (`SENT` + `PARTIALLY_RECEIVED`), received value
  (sum of `receivedQty × unitCost` across all lines), on-time rate
  (% of `RECEIVED` POs where `receivedAt <= expectedAt`), and average
  lead time in calendar days (ordered → received, `Math.round`,
  `RECEIVED` only). Rows sort by received value desc; three KPI cards
  on top (total received, total POs with open count, supplier count);
  per-supplier table links name to `/suppliers/{id}`.
- **Currency caveat** — POs carry their own `currency` string;
  the report shows totals in the region currency, and an italic
  mixed-currency notice appears when any PO uses a non-region
  currency OR a single supplier mixes currencies. This is the same
  lower-bound honesty pattern Sprint 9's stock-value report uses.
- **Scope boundaries documented in the file header** — CANCELLED
  POs count toward *total* (you may still care that supplier X
  cancels a lot) but not lead time; DRAFT counts toward total but
  not open; `expectedAt`-less POs contribute to volume but not
  on-time rate; lead time uses `Math.round` calendar days (finance
  cares about "6 vs 14 days", not "6.3"). These choices are
  intentional and called out in the comment header so a future
  change doesn't need to re-litigate them.
- **CSV export at `/reports/suppliers/export`** — same seven columns
  as the on-screen table, but on-time rate and avg lead time are
  emitted as **empty cells** (not `0` and not `"—"`) when there are
  zero eligible samples. Downstream analysts can then distinguish
  "this supplier is actually 0% on-time" from "not enough data to
  know", which is the question that prompted the design. Received
  value is fixed-point 2 decimals, lead time 1 decimal, rows sort
  by received value desc.
- **i18n** — new `t.reports.supplierPerformance` namespace in
  `en.ts` with 20 keys (headings, subtitle, back link, empty state,
  three KPI labels, mixed-currency caveat, detail heading, six
  column headers, `notAvailable` dash, `daysSuffix` format). All
  user-visible text goes through it.
- **Reports hub tile** — `/reports/page.tsx` adds a third tile
  (after low-stock and stock-value) using the `Truck` lucide icon
  and pulling its title + description from the new i18n namespace.

### What Sprint 11 added (v0.11.0-sprint11)

- **Active-org cookie + session update** — `src/lib/session.ts` now
  exports `ACTIVE_ORG_COOKIE` and `requireActiveMembership()` reads
  it, validates against the caller's own memberships, and falls back
  to the oldest membership when the cookie is missing or stale.
  Wrapped in React `cache()` so layout + page share one DB hit.
- **`switchOrganizationAction`** (`src/app/(app)/organizations/
  actions.ts`) — server action that re-validates membership ownership
  on every switch (so a stale cookie from a just-removed user can't
  grant one-frame access), sets the cookie with a 1-year `maxAge` and
  `sameSite: "lax"`, and `revalidatePath("/", "layout")` so every
  server component re-reads on next navigation.
- **`OrgSwitcher` component** (`src/components/shell/org-switcher.tsx`)
  — renders a read-only badge when the user only belongs to one org
  (no dropdown affordance when there's nothing to pick) and a proper
  Select with a Building2 icon otherwise. Calls the action inside
  `useTransition`, then `router.refresh()` to stay on the current URL
  — switching orgs should show the same page for the other org, not
  bounce to the dashboard.
- **Header + layout rewired** — `Header.tsx` now takes `organizations`
  + `activeOrganizationId` props in place of the static
  `organizationName` badge; `(app)/layout.tsx` maps memberships to
  switcher options and passes them through.
- **i18n** — new `t.organizations.errors.{invalidId, notAMember}`
  namespace in `en.ts`.

Note: organization deletion / danger zone is intentionally deferred —
the cascade surface is large and risks regressions across every other
sprint. Sprint 11 ships only the read-path half of multi-tenancy.

### What Sprint 10 added (v0.10.0-sprint10)

- **`/search` server route** — new App Router page that reads `?q=` from
  `searchParams`, runs three parallel Prisma `findMany` queries scoped to
  the active organization (items, suppliers, warehouses), and renders the
  results grouped into three cards with inline metadata (on-hand sum,
  barcode, category for items; contact line for suppliers; code + city
  for warehouses). Minimum query length is two characters, and each
  section caps at 25 results with a truncation notice so nobody wonders
  why their 40th match is missing.
- **Header wiring** — `src/components/shell/header.tsx` is now an actual
  search form instead of a decorative input. The field is controlled,
  bound to the URL via `useSearchParams`, re-syncs on back/forward
  navigation, URL-encodes the submitted query, and pushes to
  `/search?q=…`. Empty / whitespace-only submits are ignored client-side.
- **Match surface** — items match on `name`, `sku`, `barcode`, and
  `description`; suppliers match on `name`, `code`, `contactName`, and
  `email`; warehouses match on `name`, `code`, and `city` (archived
  warehouses are filtered out). All matches are case-insensitive via
  Prisma's `mode: "insensitive"`.
- **i18n** — new `t.search` namespace in `en.ts` covering metadata,
  heading, subtitle, both empty states (no query yet / no matches),
  per-section headers, item/supplier/warehouse meta labels with
  placeholder interpolation, truncation notice, and the warehouse
  "Default" badge.

### What Sprint 9 added (v0.9.0-sprint9)

- **`src/lib/csv.ts`** — minimal RFC 4180 CSV serializer with a UTF-8
  BOM (Excel on Windows plays nicely), an explicit column spec so
  header text and order are independent of row field names, and a
  `csvResponse` helper that returns a ready-to-use `Response` with the
  right `Content-Type` + `Content-Disposition` headers. Intentionally
  non-streaming: our reports are small, bounded, and handing back a
  single body is simpler than wiring up a `ReadableStream`.
- **`/items/export`** — flat item snapshot with category, preferred
  supplier, on-hand / reserved aggregates across all warehouses, cost
  + sale + currency, reorder point / qty, and status. Mirrors the
  `/items` list view one-to-one.
- **`/movements/export`** — last 5,000 stock movements with signed
  direction column, item + warehouse lookups, optional destination
  warehouse for transfers, reference / note / created-by columns.
- **`/reports/low-stock/export`** — CSV of every ACTIVE item whose
  on-hand is at or below its reorder point, sorted by shortfall
  descending. Logic mirrored exactly from the on-screen report so
  numbers match.
- **New `/reports/stock-value` report** — at-cost rollup of on-hand
  inventory, grouped by warehouse. Shows three KPI cards (total value,
  total units, distinct items), a warning line for items missing a
  cost price (they're excluded from the total so the user knows
  they're looking at a lower bound), and a per-warehouse detail table
  sorted by value descending. Aggregate totals use the organization's
  region currency; individual rows use the item's own currency so
  mixed-currency orgs don't silently get coerced.
- **`/reports/stock-value/export`** — one row per (item × warehouse)
  where on-hand > 0, fixed-point cost and value columns.
- **Export CSV buttons** wired onto `/items`, `/movements`,
  `/reports/low-stock`, and the new `/reports/stock-value`; the
  reports hub page (`/reports`) now lists both reports.
- **i18n:** `common.exportCsv` + a full `reports.stockValue` namespace
  in `en.ts` covering metadata, headings, KPI labels, missing-cost
  warning, column headers, and the empty-state copy.

### What Sprint 8 added (v0.8.0-sprint8)

- **Barcode scanner** (`/scan`) — client component using the BarcodeDetector
  Web API (Chrome, Edge, Android) with a graceful "not supported" fallback
  for Safari and Firefox. Runs an environment-facing camera stream through
  a `requestAnimationFrame` loop throttled to ~6 FPS, auto-stops on first
  successful detection, and supports EAN-13/8, UPC-A/E, Code-128, Code-39,
  QR, and ITF formats. A manual entry card lets users type/paste a barcode
  or SKU when the camera API isn't available.
- **Lookup action** — `lookupItemByCodeAction` does an OR-match on
  `barcode` or `sku` within the current organization and returns the item
  with all per-warehouse stock levels plus aggregate on-hand/reserved
  totals. Found/not-found results render distinct cards; not-found deep-
  links to `/items/new?barcode=<code>` for fast SKU creation from an
  unknown scan.
- **Item form deep-link** — `ItemForm` accepts a `defaultBarcode` prop and
  the `/items/new` page reads `?barcode=` from searchParams so the barcode
  field comes pre-filled when the user clicks "Create item" from a
  not-found scan result.
- **Dashboard quick-action** — the header row on `/dashboard` gains a Scan
  shortcut so the most common entry point for warehouse staff is one click
  from the home screen.
- **i18n** — `scan` namespace in `en.ts` covering camera states, manual
  entry, found/not-found result cards, and per-warehouse level table
  columns.

### What Sprint 7 added (v0.7.0-sprint7)

- **Settings page** (`/settings`) — three cards wired to real server actions:
  - **Organization profile**: edit name + URL slug, with slug regex validation
    and P2002 conflict mapping; plan shown read-only; gated to OWNER/ADMIN.
  - **Locale picker**: Select of all 8 supported languages writing the
    `oneace-locale` cookie (1-year maxAge) and triggering a layout revalidate.
  - **Region picker**: Select of all 7 supported regions showing currency +
    time zone for the current pick, writing the `oneace-region` cookie.
- **Users page** (`/users`) — team management for OWNER/ADMIN roles:
  - Team list sorted by role (OWNER → VIEWER) then join date, with the current
    user flagged via a "You" badge.
  - Invite-by-email flow that looks up an existing user, creates a membership,
    and returns friendly errors for P2002 (already member) / unknown email.
  - Inline role change via a Select with guardrails: non-owners cannot
    promote anyone to OWNER, the last OWNER cannot be demoted, and the active
    user cannot change their own row.
  - Remove-member flow in an AlertDialog: blocks self-removal, blocks removing
    the last OWNER, and refreshes the list on success.
- **Sprint 5 cleanup** finally landed: the item form has a `preferredSupplier`
  Select (unblocking the Sprint 6 low-stock supplier grouping), and the PO
  detail page surfaces a cancel button wired to the existing
  `cancelPurchaseOrderAction`.
- **Validation** — two new schemas in `src/lib/validation/`:
  `organization.ts` (name + slug) and `membership.ts` (invite + role update).
- **i18n** — `settings` and `users` namespaces added to `en.ts`, covering
  all labels, help text, error messages, and role descriptions.

### What Sprint 6 added (v0.6.0-sprint6)

- **Live dashboard** (`/dashboard`) — 4 live KPI cards (total items, stock
  value at cost, low-stock count, active stock counts), all linking to their
  drill-downs; low-stock top-5 table; recent activity table with last 6
  stock movements; quick-action row. All data pulled via one 8-way
  `Promise.all` against Prisma — no fetches to internal routes.
- **Reports hub** (`/reports`) — small index page built to host future
  reports; currently lists the low-stock report.
- **Low-stock report** (`/reports/low-stock`) — org-wide view of every
  item whose on-hand quantity is at or below its reorder point (items with
  `reorderPoint = 0` are opted out). Grouped by **preferred supplier**,
  sorted most-urgent-first by shortfall, with a "Create PO for this
  supplier" button on every group that routes to
  `/purchase-orders/new?supplier=X&items=a,b,c`.
- **PO prefill from query params** — `/purchase-orders/new` now reads
  `supplier` + `items` from the URL, resolves items org-scoped, and
  prefills the form with the supplier selected and one line per item
  using each item's `reorderQty` (fallback `1`). Closes the full
  reorder loop: **see a low-stock item → one-click new PO → receive it
  → stock goes back up**.
- **Sidebar** — Reports (`BarChart3`) nav item landed (between purchase
  orders and users).
- **i18n** — `dashboard` namespace rewritten for live copy, new
  `reports.lowStock` namespace in `src/lib/i18n/messages/en.ts`.

> **Note on history:** the bundle's `next-port` branch has no common ancestor
> with `main` because the port is a full replacement of the Vite source, not
> an incremental patch. GitHub will show "no common history" on the draft PR —
> that's expected and correct. The merge at MVP launch will be handled with
> `--allow-unrelated-histories` or by force-replacing `main`. Decide at launch.

After pushing, open the draft PR following section 1.5 below.

If the bundle is missing or corrupt, fall back to the manual runbook in
section 1.

---

## 1. One-time setup (do this once)

### 1.1 Copy the scaffold into your local clone

Assuming you already have `github.com/mahmutseker79/oneace` cloned locally at
`~/code/oneace` and the sandbox folder `oneace-next/` copied next to it:

```bash
cd ~/code/oneace

# Make sure you're on a clean main, up to date with origin
git checkout main
git pull --ff-only origin main

# Tag the current Vite/Figma template as an immortal reference
git tag -a v0-figma-template -m "Figma export — Vite + React + shadcn template (pre-port)"
git push origin v0-figma-template
```

### 1.2 Create and switch to the port branch

```bash
git checkout -b next-port
```

### 1.3 Drop the scaffold into the repo

The scaffold lives at `SimplyCount/oneace-next/` in the sandbox. From your
local machine, pull that directory into the repo root **in place of** the Vite
source. The Next.js port is a **full replacement**, not a sibling.

```bash
# From the repo root (~/code/oneace), after checking out next-port:

# 1. Remove the Vite shell (the UI layer we're porting FROM)
rm -rf src/ index.html vite.config.ts vite-env.d.ts tsconfig.json \
       tsconfig.app.json tsconfig.node.json package.json package-lock.json \
       postcss.config.mjs eslint.config.js

# 2. Copy the Next.js scaffold on top
#    (replace the source path with wherever you synced the sandbox folder)
rsync -av --exclude node_modules --exclude .next --exclude tsconfig.tsbuildinfo \
      /path/to/sandbox/SimplyCount/oneace-next/ ./

# 3. Sanity check — should show Next.js scaffold files
ls -la
cat package.json | head -20
```

> **Heads up:** the sandbox folder contains a partially-initialized `.git`
> directory with a stuck index lock. Make sure `rsync` does **not** copy it. The
> `--exclude .git` flag is belt-and-suspenders; the command above already
> excludes it implicitly because we're running from the destination repo root.
> If you see any `.git/` files from the sandbox sneak in, delete them with
> `rm -rf .git/index.lock` (yours, not the sandbox's).

### 1.4 First commit on `next-port`

Break the scaffold into logical commits so the draft PR reads like a story.

```bash
# Commit 1 — tooling & config
git add .gitignore .env.example biome.json next.config.ts postcss.config.mjs \
        tsconfig.json package.json package-lock.json
git commit -m "Sprint 0: Next.js 15 + Tailwind 4 + Biome tooling

- Next.js 15.1.3 App Router, React 19, TypeScript 5.7 strict
- Tailwind 4 via @tailwindcss/postcss
- Biome 1.9 replaces ESLint + Prettier
- noUncheckedIndexedAccess enabled
- .env.example documents Neon + Better Auth + Resend + Sentry + PostHog"

# Commit 2 — Prisma schema + database layer
git add prisma/ src/lib/db.ts
git commit -m "Sprint 0: Prisma schema + multi-tenant foundation

- Organization, Membership with OWNER/ADMIN/MANAGER/MEMBER/VIEWER roles
- Better Auth tables (User, Session, Account, Verification)
- Plan enum (FREE/PRO/BUSINESS)
- Singleton PrismaClient via globalThis to survive HMR in dev"

# Commit 3 — Better Auth + session helpers + middleware
git add src/lib/auth.ts src/lib/auth-client.ts src/lib/session.ts \
        src/middleware.ts src/app/api/auth
git commit -m "Sprint 0: Better Auth email/password + route guards

- Better Auth 1.1.9 with Prisma adapter
- Session helpers: getCurrentSession, requireSession, requireActiveMembership
- Middleware public-path allowlist with /login?redirect=... pattern
- Auth API route: /api/auth/[...all]"

# Commit 4 — i18n scaffold (the rule: no Turkish anywhere)
git add src/lib/i18n/
git commit -m \"Sprint 0: i18n + region scaffold (English default, 8 locales)

- SUPPORTED_LOCALES: en (default), es, de, fr, pt, it, nl, ar (RTL)
- SUPPORTED_REGIONS: US, GB, EU, CA, AU, AE, SG with currency + locale
- Cookie-first detection (oneace-locale, oneace-region) with
  Accept-Language fallback and React cache wrappers
- Non-English catalogs fall through to English until translations ship
- getDirection() drives the <html dir> attribute for Arabic RTL\"

# Commit 5 — shell + theme tokens + full shadcn primitive set
git add src/app/globals.css src/components/ui/ src/components/shell/ \
        src/lib/utils.ts
git commit -m "Sprint 0: App shell + theme tokens + shadcn primitives

- globals.css: 200+ design tokens ported verbatim from src/styles/
- 23 shadcn/ui primitives — full Sprint-1-ready set:
  alert, alert-dialog, avatar, badge, button, card, checkbox,
  dialog, dropdown-menu, form, input, label, popover, scroll-area,
  select, separator, sheet, skeleton, sonner, table, tabs,
  textarea, tooltip
- Sidebar (10 nav items) + Header — thin hand-written versions,
  real ports from the Vite repo land in Sprint 1 feature work
- formatCurrency/formatNumber accept locale + currency
- slugify uses NFKD normalization (no Turkish-specific replacements)"

# Commit 6 — auth + app routes
git add src/app/layout.tsx src/app/page.tsx \
        \"src/app/(auth)\" \"src/app/(app)\" src/app/api/onboarding
git commit -m "Sprint 0: Auth + dashboard routes with i18n dictionary

- / → session-based redirect (login | onboarding | dashboard)
- (auth) layout: split-screen brand panel, all copy from dictionary
- /login, /register forms with labels prop pattern
- /onboarding org creation, POST /api/onboarding/organization
  with Zod validation + slug collision retry
- (app) layout: sidebar + header + main
- /dashboard: 4 KPI placeholders + Sprint 0 welcome card,
  stock value formatted via region.currency"

# Commit 7 — CI pipeline
git add .github/workflows/ci.yml
git commit -m "Sprint 0.5: GitHub Actions CI (typecheck + biome + build)

- ci.yml: check job runs pnpm typecheck, pnpm lint (biome),
  prisma validate, prisma generate
- build job: next build smoke with fake env vars to catch
  build-time regressions without needing a real database
- concurrency group cancels superseded runs on the same ref
- Triggers on push + pull_request for main and next-port"

# Commit 8 — documentation
git add README.md SETUP.md PORT_CHECKLIST.md GIT_WORKFLOW.md
git commit -m "Sprint 0: README, SETUP, PORT_CHECKLIST, GIT_WORKFLOW

- README: tech stack overview, i18n section, contribution flow
- SETUP: step-by-step local env setup, Neon + Prisma + Better Auth
- PORT_CHECKLIST: done (Sprint 0) vs parked work per sprint
- GIT_WORKFLOW: this file"
```

### 1.5 Push and open a draft PR

```bash
git push -u origin next-port

gh pr create \
  --base main \
  --head next-port \
  --draft \
  --title "Next.js 15 port — long-lived integration branch" \
  --body "$(cat <<'EOF'
## Summary

Long-lived integration branch for the Vite → Next.js 15 port. Tracks
Sprint 0 through MVP Launch (Sprint 12, target 2026-07-03).

**This PR will stay open until MVP.** Each sprint pushes additional commits.
Merge back to `main` happens at launch, once:

- [ ] All 12 sprint checklists are done (see `PORT_CHECKLIST.md`)
- [ ] Playwright e2e suite is green on CI
- [ ] Vercel preview deploy passes manual smoke test
- [ ] Design review confirms 1:1 visual parity with the Figma source

## Sprint 0 status

- [x] Next.js 15.1.3 scaffold + Biome + Tailwind 4
- [x] Prisma schema (Organization, Membership, Better Auth)
- [x] Better Auth email/password
- [x] App shell (Sidebar + Header) wired to dictionary
- [x] i18n scaffold (8 locales, 7 regions, English default)
- [x] /login /register /onboarding /dashboard flows
- [x] 23 shadcn primitives (full Sprint 1 feature-work unblock)
- [x] `pnpm typecheck` → EXIT 0
- [x] CI: typecheck + biome check + prisma validate + next build smoke
- [ ] Vercel preview deploy with Neon dev branch attached *(next)*

## Out of scope for this PR

Reference-only files from the Vite era (design-spec, 01-sikayet-beklenti
analizi, feature-matrix.xlsx) stay on `main` unchanged — this branch only
touches the buildable app source.

## How to review

Check out locally:

```bash
git fetch origin
git checkout next-port
pnpm install
cp .env.example .env.local   # fill in DATABASE_URL, DIRECT_URL, BETTER_AUTH_SECRET
pnpm prisma migrate dev --name init
pnpm dev
```

Smoke test: register → onboarding → dashboard should complete in under 30 seconds.
EOF
)"
```

---

## 2. Day-to-day workflow (every sprint)

During each sprint, keep pushing commits to `next-port`. The draft PR updates
automatically. Push at least once per day so Vercel previews and CI catch
regressions early.

```bash
git checkout next-port
git pull --ff-only origin next-port

# ... do work ...

pnpm typecheck
pnpm biome check .

git add -p              # review hunks before committing
git commit -m "Sprint 2: ItemForm + server action"
git push
```

### 2.1 Pulling emergency fixes from `main`

If a hotfix lands on `main` that you need on the port branch (unlikely but
possible — e.g. a README typo a beta user complained about):

```bash
git checkout next-port
git fetch origin
git merge origin/main     # prefer merge over rebase on a shared branch
git push
```

### 2.2 Keeping PR hygiene

- **Never force-push** `next-port` once the draft PR is open. Collaborators
  (even just future-you) will rely on the commit history for context.
- **Squash only at merge time.** When merging to `main` at MVP launch, use
  "Create a merge commit" — the sprint-by-sprint history is the project log.
- **Run `pnpm typecheck && pnpm biome check .` before every push.** The CI we
  add in Sprint 0.5 will enforce this, but catching it locally is faster.

---

## 3. Milestone tags

Tag each sprint boundary so we can diff Sprint 3 vs Sprint 5, etc. Push tags
immediately after the sprint-closing commit.

```bash
git tag -a sprint-0-complete -m "Sprint 0 done: scaffold + auth + shell + i18n"
git push origin sprint-0-complete
```

Planned tags:

| Tag | Marks |
|---|---|
| `v0-figma-template` | The pre-port Vite state of `main` (step 1.1) |
| `sprint-0-complete` | End of Apr 20 — scaffold + auth + i18n |
| `sprint-1-complete` | End of Apr 27 — Item/Warehouse/Category CRUD |
| `sprint-3-complete` | End of May 11 — Moat 1 (barcode UX) |
| `sprint-5-complete` | End of May 25 — Moat 2 (offline stock count) |
| `sprint-7-complete` | End of Jun 8 — Moat 4 (PO + suppliers) |
| `sprint-11-complete` | End of Jul 2 — beta-ready |
| `v1.0.0` | Jul 3 — MVP launch (merged to `main`) |

---

## 4. Merging at MVP launch

On `2026-07-03`, once all Sprint 12 boxes are ticked:

```bash
git checkout main
git pull --ff-only origin main
git merge --no-ff next-port -m "Merge next-port: OneAce v1.0.0 — Next.js rewrite"
git tag -a v1.0.0 -m "OneAce MVP launch"
git push origin main --tags
```

After the merge lands, delete the `next-port` branch on GitHub (the history is
preserved on `main` and in the `v1.0.0` tag):

```bash
git push origin --delete next-port
git branch -D next-port
```

---

## 5. If something goes wrong

**"Accidentally committed to `main`."**
```bash
git checkout main
git reset --soft HEAD~1    # undoes the commit, keeps changes staged
git stash
git checkout next-port
git stash pop
git commit -m "..."
```

**"Forgot `.env.local` in a commit."**
```bash
git rm --cached .env.local
git commit -m "Remove .env.local from tracking"
# Then rotate any secrets that leaked
```

**"Need to start over cleanly."** Worst case: delete the local clone, re-clone,
re-checkout `next-port` from origin. The branch on GitHub is the source of truth.
