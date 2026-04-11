# Vite → Next.js Port Checklist

Source: `github.com/mahmutseker79/oneace` (Vite + React + shadcn)
Target: `oneace-next/` (Next.js 15 App Router + RSC)

Per ADR-001, the **UI layer is preserved 1:1** and only the **shell (routing / build)** changes.

## Completed (Sprint 0)

### Setup
- [x] Next.js 15.1.3 scaffold (`next.config.ts`, `tsconfig.json`, `postcss.config.mjs`)
- [x] React 19 + TypeScript strict + `noUncheckedIndexedAccess`
- [x] Tailwind 4 + PostCSS plugin
- [x] Biome 1.9 (instead of ESLint + Prettier)

### Theme
- [x] `src/index.css` → `src/app/globals.css` (200+ lines of CSS variables)
- [x] All light + dark CSS variables
- [x] Stock status colors (critical / low / normal / high / excess)
- [x] Count status colors (pending / in-progress / completed / variance / approved / rejected)
- [x] Scanner, connectivity, PO colors
- [x] `@theme inline` + `@layer base` typography

### shadcn/ui Primitives (8 / 40+)
- [x] `button.tsx` (variants + sizes + asChild)
- [x] `card.tsx` (+ header / title / description / content / footer)
- [x] `input.tsx` (uses the input-background token)
- [x] `label.tsx`
- [x] `separator.tsx`
- [x] `badge.tsx`
- [x] `avatar.tsx`
- [x] `lib/utils.ts` (cn, slugify, formatCurrency, formatNumber)

### Shell (hand-written; real port lands in Sprint 1)
- [x] `shell/sidebar.tsx` — 10 navigation items, English via i18n dictionary
- [x] `shell/header.tsx` — search + bell + avatar sign-out

### i18n
- [x] `lib/i18n/config.ts` — `SUPPORTED_LOCALES`, `SUPPORTED_REGIONS`, RTL list
- [x] `lib/i18n/messages/en.ts` — English dictionary (canonical)
- [x] `lib/i18n/index.ts` — `getMessages`, `getLocale`, `getRegion`, `getDirection`, `format`
- [x] Root layout emits `lang` + `dir` dynamically from the request locale
- [x] Every existing route pulls copy from the dictionary — no hardcoded strings

### Auth & Data
- [x] Prisma schema (Organization, Membership, User, Session, Account, Verification)
- [x] Better Auth server (`lib/auth.ts`) + React client (`lib/auth-client.ts`)
- [x] Session helpers (`lib/session.ts`): `getCurrentSession`, `requireSession`, `requireActiveMembership`
- [x] Middleware (`src/middleware.ts`) — public path allowlist + `/login?redirect=...`
- [x] API route: `/api/auth/[...all]` (Better Auth handler)
- [x] API route: `/api/onboarding/organization` (Zod validation + slug retry)

### Pages
- [x] `/` — session-based redirect
- [x] `/login` + login-form
- [x] `/register` + register-form
- [x] `/onboarding` + onboarding-form
- [x] `/dashboard` — 4 KPI placeholders + Sprint 0 welcome card
- [x] `(auth)/layout.tsx` — split-screen brand panel
- [x] `(app)/layout.tsx` — sidebar + header + main

### Validation
- [x] `pnpm typecheck` → `EXIT: 0`

### CI
- [x] `.github/workflows/ci.yml` — typecheck + biome check + prisma validate + next build smoke

---

## Sprint 1 Primitives (ported 2026-04-11, ahead of sprint)

Ported in advance so Sprint 1 feature work lands directly on a complete UI primitive set.

- [x] `alert.tsx`
- [x] `alert-dialog.tsx` *(added `@radix-ui/react-alert-dialog`)*
- [x] `checkbox.tsx` *(added `@radix-ui/react-checkbox`)*
- [x] `dialog.tsx`
- [x] `dropdown-menu.tsx`
- [x] `form.tsx` (react-hook-form + zod resolver pattern)
- [x] `popover.tsx`
- [x] `scroll-area.tsx`
- [x] `select.tsx`
- [x] `sheet.tsx`
- [x] `skeleton.tsx`
- [x] `sonner.tsx` (toast adapter — `next-themes`-aware)
- [x] `table.tsx`
- [x] `tabs.tsx`
- [x] `textarea.tsx`
- [x] `tooltip.tsx`

### Still to port in Sprint 1
- [ ] `command.tsx` (⌘K palette — parked until Sprint 2, needs `cmdk` dep)

---

## Sprint 1 Feature Port List (Apr 21–27)

### Layout Components (real versions from the github repo)
- [ ] `AppSidebar.tsx` — collapsible, tooltips, full icon set
- [ ] `AppHeader.tsx` — org switcher, notification panel, user menu
- [ ] `BottomNavigation.tsx` — mobile only, used by Moat 3

### Business Views (Sprint 1 scope)
- [x] `views/ItemsView.tsx` → `app/(app)/items/page.tsx` + data-fetching RSC (2026-04-11)
- [x] `views/WarehousesView.tsx` → `app/(app)/warehouses/page.tsx` (2026-04-11)
- [x] `forms/ItemForm.tsx` — client component, Server Actions + `useTransition`, i18n via labels prop
- [x] `forms/WarehouseForm.tsx` — same pattern, default-warehouse invariant enforced in `actions.ts`
- [x] Minimal `views/CategoriesView.tsx` → `app/(app)/categories/page.tsx` (inline create form)
- [ ] `ItemsTable.tsx` — plain `<Table>` MVP shipped 2026-04-11; swap to TanStack in Sprint 2 for sort/filter/column toggle

### Clean-up
- [ ] `components/AnalyticsView.tsx` + `components/analytics/AnalyticsView.tsx` — **duplicate**, keep one
- [ ] `vite.config.ts`, `vite-env.d.ts`, `index.html` — unused under Next
- [ ] Any SPA-only router code (`react-router-dom`) — replaced by the App Router

---

## Sprint 5 — Suppliers + Purchase Orders + Receive flow (shipped 2026-04-11)

Tagged `v0.5.0-sprint5`. The procure-to-stock path is live.

- [x] Prisma: `Supplier`, `PurchaseOrder`, `PurchaseOrderLine`, status enum,
      `Item.supplierId` (preferred supplier, nullable)
- [x] Zod schemas: `supplier.ts`, `purchase-order.ts` (input + receive + line)
- [x] Suppliers CRUD — list/new/edit, active/inactive, FK-safe delete
- [x] Purchase Orders CRUD — list/new/edit/detail with auto-generated PO
      numbers (`PO-000001`) and P2002 retry for concurrent-writer races
- [x] Dynamic line items with stable `crypto.randomUUID()` keys + live total
- [x] Prerequisite-guard chain on `/purchase-orders/new` (supplier →
      warehouse → items)
- [x] Status state machine: DRAFT/SENT editable; RECEIVED/CANCELLED
      terminal; edit page redirects out if status is terminal
- [x] Mark-sent action (DRAFT → SENT) with single-purpose button
- [x] Receive flow (`/purchase-orders/[id]/receive`) — transactional
      `db.$transaction`: create `RECEIPT` StockMovement, upsert StockLevel,
      increment `receivedQty`, recompute PO status, stamp `receivedAt`,
      per-line overflow protection
- [x] i18n: `suppliers` + `purchaseOrders` namespaces in `en.ts`
- [x] Sidebar: Suppliers (`Truck`) nav item
- [x] Verified clean: `prisma validate` + `tsc --noEmit` + `biome check .`

### Still to port (deferred post-Sprint-5)

- [ ] Item form `preferredSupplierId` field (schema exists; UI defers to
      Sprint 6 alongside replenishment hints)
- [ ] PO cancel action surfaced as a detail-page button (server action
      exists but no UI affordance yet)
- [ ] PO print / email (waits on the email template track in Sprint 10)

---

## Sprint 6 — Live dashboard + Low-stock report + PO-from-reorder (shipped 2026-04-11)

Tagged `v0.6.0-sprint6`. The full reorder loop is live: see what's low →
one-click new PO prefilled from the supplier → receive it → stock goes
back up.

- [x] `/dashboard` rewritten with live data — 8-way `Promise.all` pulling
      active/archived item counts, stock levels + cost for stock value,
      warehouse count, low-stock items, open/in-progress stock counts,
      last 6 stock movements
- [x] 4 live KPI cards (total items / stock value / low stock / active
      counts) all wrapped in `<Link>` → drill-downs
- [x] Top-5 low-stock table on the dashboard with "View all" to the full
      report
- [x] Recent activity table on the dashboard with last 6 stock movements
      and signed quantities (`direction * quantity`)
- [x] Quick actions row: low-stock report + receive stock
- [x] `/reports` — reports index hub (card grid, ready for more entries)
- [x] `/reports/low-stock` — grouped by preferred supplier (alphabetical,
      "no supplier" last), shortfall-sorted table per group, per-supplier
      "Create PO" button that routes to
      `/purchase-orders/new?supplier=X&items=a,b,c`
- [x] `/purchase-orders/new` — reads `supplier` + `items` query params,
      resolves items org-scoped, validates supplier belongs to org, builds
      a `PurchaseOrderPrefill` with one line per item using its
      `reorderQty` (fallback `1`) — `PurchaseOrderForm` accepts the new
      optional `prefill` prop
- [x] Sidebar: Reports (`BarChart3`) nav item between purchase-orders and
      users
- [x] i18n: `dashboard` namespace rewritten, `reports` namespace added
      with `lowStock` subnamespace in `en.ts`
- [x] Verified clean: `prisma validate` + `tsc --noEmit` + `biome check .`

### Still to port (deferred post-Sprint-6)

- [x] Item form `preferredSupplierId` field — **shipped in Sprint 7**
- [ ] Stock-value over time (waits on a price-snapshot table)
- [ ] Supplier performance report (lead time, fill rate) — needs
      richer received/ordered history

---

## Sprint 7 — Settings + Team management + Sprint 5 cleanup (shipped 2026-04-11)

Tagged `v0.7.0-sprint7`. Fills the biggest remaining UX holes in the sidebar
(`/settings` and `/users` were 404s) and clears the Sprint 5 cleanup items
that were blocking the Sprint 6 low-stock report from being fully useful.

- [x] `/settings` page with three cards: organization profile, locale picker,
      region picker — all wired to real server actions
- [x] `updateOrganizationProfileAction` — zod-validated name + slug, P2002
      conflict mapped to a friendly field error, gated to OWNER/ADMIN
- [x] `setLocaleAction` / `setRegionAction` — cookie writes (1-year maxAge,
      lax sameSite) + `revalidatePath("/", "layout")` so the new locale /
      region renders on the very next request
- [x] `LocalePicker` — Select of all 8 supported locales, shows "saved" on
      success, reverts on failure
- [x] `RegionPicker` — Select of all 7 supported regions with a live
      currency + time-zone readout
- [x] `/users` page with a role-sorted member table (OWNER → VIEWER), the
      current user badged as "You", and a createdAt column formatted via
      the active region's `numberLocale`
- [x] `InviteForm` — looks up the user by email, creates a membership,
      handles P2002 (already a member) and unknown-email as field errors
- [x] `MemberRow` — inline role change Select + AlertDialog remove button;
      all mutations routed through `updateMemberRoleAction` /
      `removeMemberAction`
- [x] Guardrails: last-OWNER cannot be demoted or removed; non-OWNERs
      cannot promote anyone to OWNER; the active user cannot change their
      own row or remove themselves
- [x] Item form gains a `preferredSupplierId` Select (with a `None` option)
      wired through the `itemInputSchema` and both create/update actions
- [x] PO detail surfaces a `CancelPoButton` client component using the
      AlertDialog primitive, wired to the existing
      `cancelPurchaseOrderAction` — visible for DRAFT/SENT/PARTIALLY_RECEIVED
- [x] New validation schemas: `organization.ts` (name + slug),
      `membership.ts` (invite + role update)
- [x] i18n: `settings` and `users` namespaces in `en.ts`
- [x] Verified clean: `prisma validate` + `tsc --noEmit` + `biome check .`

### Still to port (deferred post-Sprint-7)

- [ ] Invitation tokens / email flow (MVP uses "user must already exist";
      full pending-invitation flow needs an `Invitation` model + mailer)
- [ ] Organization switcher in the header (multi-org memberships exist in
      the schema but `requireActiveMembership` always picks the oldest)
- [ ] Organization delete / "danger zone" card on `/settings`
- [ ] Stock-value over time + supplier performance (still blocked on
      price-snapshot table and richer received/ordered history)

---

## Sprint 8 — Barcode scanner + item lookup (shipped 2026-04-11)

Tagged `v0.8.0-sprint8`. Closes the `/scan` 404 in the sidebar and lights up
the first Moat-1 capability from the competitor teardown. Scanning is the
number-one workflow for warehouse staff, so this unlocks the "stand at the
shelf with a phone" use case that's the whole reason for the PWA bet.

- [x] `/scan` page with camera card + manual entry card side-by-side on
      desktop, stacked on mobile
- [x] Feature-detect `BarcodeDetector` via `globalThis` cast — falls back
      to an "unsupported" alert + manual input on Safari and Firefox
- [x] `getUserMedia({video: {facingMode: {ideal: "environment"}}})` with
      clean teardown on unmount and on successful scan
- [x] Detection loop throttled to ~160 ms (≈6 FPS) via `performance.now()`
      to avoid burning battery while still feeling instant
- [x] Supports EAN-13 / EAN-8 / UPC-A / UPC-E / Code-128 / Code-39 / QR /
      ITF; falls back to no-args constructor if the browser rejects the
      format list
- [x] `lookupItemByCodeAction` — OR-matches `barcode` or `sku` within the
      active org, returns the item with all per-warehouse `stockLevels`
      and aggregate on-hand / reserved totals
- [x] Found card — name + SKU + barcode, on-hand / reorder point
      side-by-side, status badge, per-warehouse stock level list,
      "View item" button deep-linking to `/items/[id]`
- [x] Not-found card — displays the queried value and a "Create item"
      button that deep-links to `/items/new?barcode=<code>`
- [x] `ItemForm` accepts a `defaultBarcode` prop; `/items/new` reads
      `?barcode=` from searchParams so create-from-scan pre-fills the field
- [x] Dashboard quick-action row gains a Scan shortcut (leftmost button)
- [x] `initialQuery` deep-link: `/scan?barcode=<code>` or `/scan?sku=<code>`
      kicks off a lookup immediately without requiring camera access
- [x] i18n: `scan` namespace added to `en.ts` covering camera states,
      manual entry, found / not-found results, and result card copy
- [x] Verified clean: `prisma validate` + `tsc --noEmit` + `biome check .`

### Still to port (deferred post-Sprint-8)

- [ ] Offline PWA shell + service worker for the `/scan` route (today
      everything still requires an active connection; true on-the-shelf
      scanning needs offline lookup via Dexie + a seeded item cache)
- [ ] Batch scan mode (continuous scanning that appends to a list, for
      stock counts and bulk receive) — follows the offline shell
- [ ] Quantity-adjust inline from the scan result (add 1, remove 1) so
      warehouse staff can update stock without navigating to item detail
- [ ] Scan history / recent scans list (in-browser only, backed by
      localStorage or Dexie once offline lands)
- [ ] Full ZXing-wasm fallback for Safari and Firefox (BarcodeDetector is
      Chromium-only today; most real-world users will be on iOS Safari)

---

## Sprint 9 — CSV exports + stock-value report (shipped 2026-04-11)

Tagged `v0.9.0-sprint9`. Lights up the "take your data with you" story
from the competitor teardown: Sortly locks exports behind Ultra, inFlow
buries them under a submenu. OneAce puts Export CSV buttons next to
every major list and report by default.

- [x] `src/lib/csv.ts` — RFC 4180 serializer with UTF-8 BOM, explicit
      column spec, `csvResponse()` route-handler helper, `todayIsoDate()`
      filename suffix; intentionally non-streaming for MVP
- [x] `/items/export` — flat item snapshot (category, supplier, on-hand
      and reserved aggregates, pricing, status)
- [x] `/movements/export` — last 5,000 stock movements with signed
      direction, item + warehouse lookups, created-by attribution
- [x] `/reports/low-stock/export` — mirrors on-screen report, shortfall-
      sorted, flat (no grouping)
- [x] `/reports/stock-value` — new report grouped by warehouse, three
      KPI cards (total value / units / distinct items), missing-cost
      warning when items lack a cost price, per-warehouse detail table
- [x] `/reports/stock-value/export` — one row per (item × warehouse)
      where on-hand > 0, fixed-point cost + value columns
- [x] Export CSV buttons on `/items`, `/movements`, `/reports/low-stock`,
      `/reports/stock-value`
- [x] `/reports` hub lists both reports (low-stock + stock-value)
- [x] i18n: `common.exportCsv` + `reports.stockValue.*` namespace in
      `en.ts`
- [x] Verified clean: `prisma validate` + `tsc --noEmit` + `biome check .`

### Still to port (deferred post-Sprint-9)

- [ ] Xlsx export variants (build on the same column spec — most users
      will want both .csv and .xlsx; Excel with UTF-8 BOM mostly works
      but formulas and column types don't survive the round-trip)
- [ ] PDF "one-pager" variants of the reports for emailed snapshots
      (needs a PDF generator — see `pdf` skill)
- [ ] Stock-value report filters (by category, status, warehouse
      subset) — currently shows every ACTIVE item with a positive level
- [ ] Historical stock-value over time (blocks on a cost-snapshot
      table — today's cost prices aren't versioned)
- [ ] Movement export date-range filter via searchParams (today it's
      "last 5,000", good enough for MVP but not for a 3-year-old org)
- [ ] Export audit log (who downloaded what and when) — part of the
      broader audit-log scope still on the board

## Sprint 10 — global header search (shipped 2026-04-11)

Tagged `v0.10.0-sprint10`. Wires the previously-dead search input in the
app header into a working unified search across items, suppliers, and
warehouses. Picked for Sprint 10 because it's a user-visible win, needs
zero schema changes, and kills a visible dead-UI element.

- [x] `src/app/(app)/search/page.tsx` — server component reading `?q=`
      from `searchParams`, three parallel Prisma OR-queries (items,
      suppliers, warehouses) scoped to the active org
- [x] Minimum query length of 2 characters; per-section cap of 25 with
      truncation notice
- [x] Items match on name, SKU, barcode, description; suppliers on
      name, code, contactName, email; warehouses on name, code, city
      (archived excluded); all case-insensitive via `mode: "insensitive"`
- [x] Three result cards (Items / Suppliers / Warehouses) with inline
      metadata (on-hand sum, barcode, category for items; contact line
      for suppliers; code + city + Default badge for warehouses)
- [x] Two empty states: "type to start searching" and "no matches for
      <query>"
- [x] Header search input (`src/components/shell/header.tsx`) converted
      to a controlled form bound to `useSearchParams`; submit URL-encodes
      the query and `router.push("/search?q=...")`; `useEffect` re-syncs
      the field on back/forward navigation
- [x] i18n: full `t.search` namespace in `en.ts` with placeholder
      interpolation for query/count/limit/warehouse/supplier meta
- [x] Verified clean: `prisma validate` + `tsc --noEmit` + `biome check .`

### Still to port (deferred post-Sprint-10)

- [ ] Purchase order search (PO number, supplier, status) — blocked
      on a cheap way to index the ephemeral "draft/open/received"
      state without duplicating the PO list page
- [ ] Movement / stock count search — the append-only ledger is
      unlikely to be looked up by free text; users will filter by
      item or warehouse, which is already doable from those pages
- [ ] Search-as-you-type with a debounced popover — server form
      submit is fine for MVP and avoids a client bundle
- [ ] Saved searches / recent searches (needs a per-user row in the
      DB, deferred to the post-MVP personalization sweep)
- [ ] Full-text ranking via Postgres `tsvector` + GIN indexes — the
      current `contains` scan is fine at < 10k items per org, but at
      100k the plan is to migrate to a generated `searchVector`
      column populated on Item/Supplier/Warehouse write

## Sprint 11 — header organization switcher (shipped 2026-04-11)

Tagged `v0.11.0-sprint11`. Completes the read-path half of multi-
tenancy: the app had full support for multiple memberships in the
schema since Sprint 0, but no UI for switching between them — every
session silently picked the oldest membership. Sprint 11 wires the
real switcher.

- [x] `src/lib/session.ts` — export `ACTIVE_ORG_COOKIE`, update
      `requireActiveMembership()` to read the cookie + validate it
      against the user's memberships, fall back to the oldest, and
      return `memberships` alongside the active one so the header
      can populate its dropdown from the same query
- [x] Wrapped `requireActiveMembership` in React `cache()` so the
      layout + page share a single DB round-trip per request
- [x] `src/app/(app)/organizations/actions.ts` —
      `switchOrganizationAction(organizationId)` re-validates the
      caller owns a membership in the target, sets the cookie
      (1-year `maxAge`, `sameSite: "lax"`), and
      `revalidatePath("/", "layout")`
- [x] `src/components/shell/org-switcher.tsx` — new client
      component, read-only badge when there's only one org, Select
      with Building2 icon otherwise; calls the action inside
      `useTransition` then `router.refresh()` to stay on the same URL
- [x] `src/components/shell/header.tsx` — accept `organizations` +
      `activeOrganizationId` props, render `<OrgSwitcher>` in place
      of the old static badge
- [x] `src/app/(app)/layout.tsx` — pass memberships → options mapping
- [x] `t.organizations.errors.{invalidId, notAMember}` i18n added
- [x] Verified clean: `prisma validate` + `tsc --noEmit` + `biome check .`

### Still to port (deferred post-Sprint-11)

- [ ] Danger zone in `/settings`: organization delete (OWNER only,
      cascading delete behind an AlertDialog with typed confirmation
      — deferred because the cascade surface is wide and risks
      regressions in every other sprint)
- [ ] Create-another-organization flow from the header switcher
      (today only `/onboarding` creates the very first org)
- [ ] Per-org default locale / region override (currently the locale
      and region cookies are per-browser, not per-org)
- [ ] Offline PWA shell + service worker (Moat 1 — true on-shelf
      scanning)
- [ ] Invitation tokens + email flow (Sprint 7 team management needs
      the target user to already exist)
- [ ] Audit log (compliance) — Prisma model + read-path UI + the
      plumbing in every write action

---

## Sprint 12 — supplier performance report (shipped 2026-04-11)

Tagged `v0.12.0-sprint12`. Rounds out the reports hub with the
per-supplier roll-up procurement teams ask for when they pick up
the phone. No schema changes — pure read-path work on top of the
PO model shipped in Sprint 5.

- [x] `src/app/(app)/reports/suppliers/page.tsx` — five metrics per
      supplier (total POs, open POs, received value, on-time rate,
      avg lead time), three KPI cards on top, mixed-currency caveat
      when any PO uses a non-region currency, per-supplier table
      sorted by received value descending, supplier name links to
      `/suppliers/{id}`
- [x] `src/app/(app)/reports/suppliers/export/route.ts` — CSV export
      with the same seven columns; on-time rate + avg lead time
      emitted as empty cells (not `0`, not `"—"`) when there are no
      eligible samples so analysts can distinguish "actually 0%" from
      "not enough data"; received value fixed-point 2dp, lead time 1dp
- [x] `src/app/(app)/reports/page.tsx` — reports hub tile added
      (Truck icon, title + subtitle from new i18n namespace)
- [x] `t.reports.supplierPerformance` i18n namespace (20 keys:
      headings, KPI labels, table columns, empty state, mixed-currency
      caveat, `notAvailable` dash, `daysSuffix`)
- [x] Scope boundaries documented in the page file header —
      CANCELLED POs count toward total but not lead time/on-time;
      DRAFT counts toward total but not open; `expectedAt`-less POs
      contribute to volume but not on-time rate; `Math.round` calendar
      days for lead time (MVP noise tolerance)
- [x] Verified clean: `prisma validate` + `tsc --noEmit` + `biome check .`

### Still to port (deferred post-Sprint-12)

- [ ] Historical stock-value + supplier-performance time series
      (needs price/rate snapshots — a new `PriceSnapshot` table and a
      cron job; deferred until there's a story for "as of date")
- [ ] PO search (PO number / supplier / status filters on a dedicated
      `/purchase-orders?q=` route — blocked on a cheap status index)
- [ ] xlsx / pdf export variants for every report (currently CSV only
      — users with spreadsheet add-ons can open CSV directly)
- [ ] Movement date-range filter (currently ledger shows all-time)
- [x] Per-supplier drill-down page showing the underlying POs ranked
      by value and lead-time outlier — shipped as Sprint 34, see below
- [ ] Audit log (compliance) — unchanged from post-Sprint-11 deferral
- [ ] Offline PWA shell + service worker (Moat 1)
- [ ] Invitation tokens + email flow

---

## Sprint 13 — create-another-organization flow (shipped 2026-04-11)

Tagged `v0.13.0-sprint13`. Closes out the multi-tenancy story
Sprint 11 half-shipped: users can now create additional orgs from
the header switcher, not only via the first-org `/onboarding` route.

- [x] `createOrganizationAction` in
      `src/app/(app)/organizations/actions.ts` — name validation
      (2..80), slugify + 5-retry, nested membership write
      (`role: OWNER`), cookie flip in the same request, layout
      revalidate
- [x] `/organizations/new` page + `CreateOrgForm` client component
      (Card-wrapped single-input form, `useTransition`, error
      surface, `router.push("/dashboard") + router.refresh()` on
      success)
- [x] `OrgSwitcher` refactor — always renders a Select now (dropped
      the read-only badge for single-org users), `CREATE_SENTINEL`
      item at the bottom behind a `SelectSeparator`, on sentinel
      select reverts value + `router.push("/organizations/new")`
- [x] `HeaderLabels.organizationCreate` plumbed from
      `t.organizations.switcherCreateLabel` through the app layout
- [x] 9 new i18n keys on `t.organizations.*` (switcher create label,
      three new errors, nine create-flow strings)
- [x] Verified clean: `prisma validate` + `tsc --noEmit` + `biome check .`

### Still to port (deferred post-Sprint-13)

- [ ] Per-org default locale / region override (still browser-level)
- [ ] Danger zone / organization delete (cascade surface still wide)
- [ ] Audit log (compliance)
- [ ] Offline PWA shell + service worker (Moat 1)
- [ ] Invitation tokens + email flow (Sprint 7 team management
      still needs target users to already exist)
- [ ] All items from post-Sprint-12 deferred list (unchanged)

---

## Sprint 14 — movements date-range + type filter (shipped 2026-04-11)

Tagged `v0.14.0-sprint14`. Cuts the "ledger is too noisy" complaint
by letting users scope the stock-movement view (and its CSV export)
to a date window and/or movement type. Pure read state, no schema
changes — filter lives in the URL so it's bookmarkable and the
server page reads it back out of `searchParams`.

- [x] `src/app/(app)/movements/filter.ts` — strict filter parser
      shared by the page and the CSV export route. Dates gated by
      `^\d{4}-\d{2}-\d{2}$` regex + manual UTC parse + round-trip
      check (rejects `2026-02-30`-style month overflow); type
      validated against `Object.values(StockMovementType)`.
      `buildMovementWhere` returns an impossible-id clause when
      `from > to` so a stale URL degrades to empty results instead
      of a 500
- [x] `movements/page.tsx` rewrite — conditional row cap (200
      unfiltered, 500 filtered), count line + truncation notice,
      split empty states (filter-active vs pristine), export button
      href carries the same filter query, `searchParams: Promise`
      shape for Next 15
- [x] `MovementsFilterBar` client component — two `<input type="date">`
      with cross-referenced `min`/`max`, type `Select` with
      `__all__` sentinel (empty string rejected by primitive),
      `router.push` submit (not a server action — pure read state),
      client-side `from > to` guard as UX polish over the server
      defense
- [x] `/movements/export` route accepts the same filter via query
      string, re-uses `parseMovementFilter(Promise.resolve(...))`,
      row caps bumped to 5 000 unfiltered / 20 000 filtered so a
      filtered caller can pull a real window
- [x] 14 new i18n keys on `t.movements.filter.*` (heading, from/to
      labels, type label + "All types", apply/clear, active label,
      two result-count variants, truncated-notice, empty-filtered
      title/body, invalid-range)
- [x] Verified clean: `prisma validate` + `tsc --noEmit` + `biome check .`

### Still to port (deferred post-Sprint-14)

- [ ] Per-org default locale / region override (still browser-level)
- [ ] Danger zone / organization delete (cascade surface still wide)
- [ ] Audit log (compliance)
- [ ] Offline PWA shell + service worker (Moat 1)
- [ ] Invitation tokens + email flow
- [ ] Movements filter: warehouse + item scope (the two remaining
      natural axes on the ledger — held back until a user actually
      asks; the date/type cut already removes 90% of the noise)
- [ ] All items from post-Sprint-13 deferred list (unchanged)

---

## Sprint 15 — purchase-order filter bar (shipped 2026-04-11)

Tagged `v0.15.0-sprint15`. Clears the post-Sprint-6 deferred item
"PO search" — users can now find a specific PO by number, status,
or supplier instead of scrolling the all-time list. Same URL-
driven filter pattern as Sprint 14.

- [x] `src/app/(app)/purchase-orders/filter.ts` — three-axis parser
      (`status` validated against `Object.values(PurchaseOrderStatus)`,
      `supplier` as opaque id capped at 64 chars, `q` as trimmed
      64-char substring match on `poNumber` via `contains`
      insensitive). Shares the parseFn/buildWhere/hasAnyFilter
      shape with `movements/filter.ts`
- [x] `purchase-orders/page.tsx` rewrite — conditional row cap
      (200 unfiltered / 500 filtered), count line + truncation
      notice, split empty states (filter-active vs pristine),
      full active-supplier list loaded independently of the PO
      filter (so the supplier dropdown stays usable as you narrow)
- [x] `PurchaseOrdersFilterBar` client component — `<input
      type="search">` with leading Search icon for PO number,
      status Select + supplier Select each with their own
      `__all__` sentinel, `router.push` submit, Clear button only
      rendered when `hasFilter`
- [x] 14 new i18n keys on `t.purchaseOrders.filter.*`
- [x] Verified clean: `prisma validate` + `tsc --noEmit` + `biome check .`

### Still to port (deferred post-Sprint-15)

- [ ] PO CSV export (filter-aware like the movements export)
- [ ] Per-org default locale / region override
- [ ] Danger zone / organization delete
- [ ] Audit log
- [ ] Offline PWA shell + service worker
- [ ] Invitation tokens + email flow
- [ ] Warehouse + item scope on the movements filter
- [ ] All items from post-Sprint-14 deferred list (unchanged)

---

## Sprint 16 — filter-aware purchase-order CSV export (shipped 2026-04-11)

Tagged `v0.16.0-sprint16`. Completes the Sprint 15 filter story
by letting users pull their narrowed PO list into a spreadsheet.
Mirrors the Sprint 14 movements-export pattern so the filter
helper module pays off a second time.

- [x] `src/app/(app)/purchase-orders/export/route.ts` — 14-column
      `GET /purchase-orders/export` CSV, re-uses
      `parsePurchaseOrderFilter` + `buildPurchaseOrderWhere`,
      aggregates `lines` into `totalQuantity` and `totalValue`
      (the latter `.toFixed(2)` so spreadsheets don't re-introduce
      FP noise on `Decimal(12,2)` data), row cap 2 000 unfiltered /
      10 000 filtered (lower than movements because each row
      carries aggregated line data)
- [x] `/purchase-orders` page — Export CSV button + `buildExportHref`
      helper so the button deep-links the current filter state
      into the CSV. Uses the shared `t.common.exportCsv` label
      (no new i18n keys needed)
- [x] Verified clean: `prisma validate` + `tsc --noEmit` + `biome check .`

### Still to port (deferred post-Sprint-16)

- [ ] Per-org default locale / region override
- [ ] Danger zone / organization delete
- [ ] Audit log
- [ ] Offline PWA shell + service worker
- [ ] Invitation tokens + email flow
- [ ] Warehouse + item scope on the movements filter
- [ ] Reports xlsx/pdf export variants (CSV only today)
- [ ] All items from post-Sprint-15 deferred list (unchanged)

---

## Sprint 17 — movements warehouse filter (shipped 2026-04-11)

Tagged `v0.17.0-sprint17`. Closes half of the post-Sprint-14
"warehouse + item scope" deferred item: movements can now be
narrowed to a specific warehouse, with correct TRANSFER-both-sides
semantics. Item scope stays deferred — a flat `<Select>` over
10 k+ items is the wrong UX; that axis needs a dedicated
substring-style design pass.

- [x] `src/app/(app)/movements/filter.ts` — extended
      `MovementFilter` with `warehouseId` + `rawWarehouse`,
      `MovementSearchParams` with `warehouse`, added
      `parseWarehouseId` (opaque pass-through, 64-char cap — the
      outer org-scoped query neutralises cross-org guesses).
      `buildMovementWhere` uses `where.OR = [{ warehouseId },
      { toWarehouseId }]` so filtering by warehouse X includes
      both outgoing and *incoming* transfers. Prisma composes
      the OR under the implicit outer AND so it layers cleanly
      on top of an active `type` filter.
- [x] `MovementsFilterBar` — fourth column: warehouse
      `<Select>` with a `__all__` sentinel, grid template grew
      from `1fr_1fr_1fr_auto` to `1fr_1fr_1fr_1fr_auto`, clear
      button also resets the warehouse value.
- [x] `/movements` page — loads warehouses via `Promise.all`
      alongside the ledger query, `isArchived: false`, NOT
      filtered by the active filter (so a narrowed view doesn't
      make the selected warehouse vanish from the dropdown and
      strand the user). `buildExportHref` now carries
      `warehouse` into the CSV route — no changes to the export
      handler needed because `parseMovementFilter` reads it.
- [x] i18n — two new keys on `t.movements.filter`
      (`warehouseLabel`, `warehouseAll`). `truncatedNotice` and
      `emptyFilteredBody` copy refreshed to mention the new
      warehouse axis.
- [x] Verified clean: `prisma validate` + `tsc --noEmit` + `biome check .`

### Still to port (deferred post-Sprint-17)

- [ ] Item-scope axis on the movements filter (needs
      substring search design, not a flat Select)
- [ ] Per-org default locale / region override
- [ ] Danger zone / organization delete
- [ ] Audit log
- [ ] Offline PWA shell + service worker
- [ ] Invitation tokens + email flow
- [ ] Reports xlsx/pdf export variants (CSV only today)
- [ ] All items from post-Sprint-16 deferred list (unchanged)

---

## Sprint 18 — movements item-substring filter (shipped 2026-04-11)

Tagged `v0.18.0-sprint18`. Closes the other half of the
post-Sprint-14 "warehouse + item scope" deferred item — item
scope ships as a substring-search `q` axis (sku / name / barcode
`contains` insensitive), not a flat `<Select>`. Layers on top of
Sprint 17's warehouse axis without clobbering `where.OR`.

- [x] `src/app/(app)/movements/filter.ts` — added `q` / `rawQ`
      to `MovementFilter`, `q` to `MovementSearchParams`,
      `parseQuery` (trim + 64-char cap, mirrors Sprint 15 PO
      filter shape). `buildMovementWhere` emits a relation
      filter `where.item = { OR: [sku, name, barcode
      contains insensitive] }` — because this lives on
      `where.item` and NOT on the top-level `where.OR`, it
      composes cleanly with Sprint 17's TRANSFER warehouse OR
      under Prisma's implicit outer AND. `hasAnyFilter` counts
      `q` as active when non-empty.
- [x] `MovementsFilterBar` — full-width `<input type="search">`
      above the date/type/warehouse grid row, `Search` icon
      absolutely-positioned on the left (`pl-9`), `maxLength={64}`
      to match the server cap. Clear button resets it.
- [x] `/movements` page — passes `initialQ` through to the
      filter bar and extends `buildExportHref` to carry `q` in
      the query string so the Export CSV button deep-links the
      item search along with the existing axes.
- [x] `/movements/export` route — now reads `warehouse` and `q`
      out of the request URL. **Fix for a Sprint 17 oversight**:
      the export route was still only reading from/to/type, so
      the Sprint 17 warehouse axis silently dropped when
      exporting. `filterActive` widened so the 5k → 20k row-cap
      bump kicks in for pure item/warehouse-scope exports too.
- [x] i18n — 2 new keys on `t.movements.filter` (`itemLabel`,
      `itemPlaceholder`). `emptyFilteredBody` updated to
      mention the item search.
- [x] Verified clean: `prisma validate` + `tsc --noEmit` + `biome check .`

### Still to port (deferred post-Sprint-18)

- [ ] Per-org default locale / region override
- [ ] Danger zone / organization delete
- [ ] Audit log
- [ ] Offline PWA shell + service worker
- [ ] Invitation tokens + email flow
- [ ] Reports xlsx/pdf export variants (CSV only today)
- [ ] Full-text ranking via Postgres `tsvector` (current
      `contains` scan is fine to ~10k items per org;
      migrate at 100k)
- [ ] All items from post-Sprint-17 deferred list (unchanged)

---

## Sprint 19 — per-org default locale + region (shipped 2026-04-11)

Tagged `v0.19.0-sprint19`. Closes the "per-org default locale /
region override" item from the post-Sprint-18 deferred list.
First schema change since Sprint 13 (create-another-org flow) —
adds two nullable columns to `Organization` and requires a
`db:push` after pulling.

**Design decision — layered resolver, not cookie overwrite.**
The user's explicit cookie always wins. The org default is a
DB-backed fallback layer inside `getLocale` / `getRegion`, not a
side effect of the org switch that mutates the user's cookie —
a polyglot operator can keep their own interface in one language
regardless of which org they're viewing.

- [x] `prisma/schema.prisma` — added nullable `defaultLocale
      String?` and `defaultRegion String?` columns to
      `Organization` with a comment explaining `null` means
      "no override, fall through to Accept-Language / platform
      default". Regenerated Prisma client.
- [x] `src/lib/session.ts` — new `getActiveOrgPreferences()`
      helper. Reads `oneace-active-org` cookie, queries org
      defaults, returns `{ defaultLocale, defaultRegion } | null`.
      Wrapped in React `cache()` so `getLocale` + `getRegion`
      together trigger at most one DB query per request.
      Unauthenticated-safe — any error (no cookie context,
      deleted org, DB blip) returns `null` so the marketing
      shell / login pages can't be crashed by the resolver.
- [x] `src/lib/i18n/index.ts` — resolver rewrite. `getLocale`
      now has four tiers: user cookie → org default →
      Accept-Language → `DEFAULT_LOCALE`. `getRegion` has three
      tiers: user cookie → org default → `DEFAULT_REGION_CODE`.
      Inline priority-order comments reference Sprint 19.
- [x] `updateOrgDefaultsAction` — OWNER/ADMIN gated server
      action. Empty string = clear override (null), non-empty
      validated against `SUPPORTED_LOCALES` /
      `SUPPORTED_REGIONS`. `revalidatePath('/', 'layout')` so
      every server component re-reads on next navigation.
- [x] `OrgDefaultsForm` client component — two `<Select>`s with
      a `__platform__` sentinel for the "Platform default"
      option (can't use `""` as a Radix Select value — collides
      with placeholder state), maps sentinel to `""` on submit.
- [x] Settings page — full-width `Card` below Region & currency,
      gated on the existing `canEditOrg` check. Fetches
      `defaultLocale` / `defaultRegion` alongside the existing
      org `findUnique`.
- [x] i18n — 12 new keys on `t.settings.orgDefaults.*` (heading,
      description, helpText explaining users can still override,
      three labels, saved, and four error variants).
- [x] Verified clean: `prisma validate` + `tsc --noEmit` + `biome check .`
- [x] **Deployment note**: run `npm run db:push` after pulling
      to add the two new columns. No migration file because
      this project uses `db:push`.

### Still to port (deferred post-Sprint-19)

- [ ] Danger zone / organization delete
- [ ] Audit log
- [ ] Offline PWA shell + service worker
- [ ] Invitation tokens + email flow
- [ ] Reports xlsx/pdf export variants (CSV only today)
- [ ] Full-text ranking via Postgres `tsvector` (current
      `contains` scan is fine to ~10k items per org;
      migrate at 100k)
- [ ] All items from post-Sprint-18 deferred list (unchanged
      aside from the locale/region override now being shipped)

---

## Sprint 20 — invitation tokens + accept flow (shipped 2026-04-11)

Tagged `v0.20.0-sprint20`. Closes the "user must already exist"
friction point from Sprint 7's team management flow and the
"invitation tokens + email flow" item from the post-Sprint-19
deferred list. Second schema change on `next-port` (after Sprint 19)
— adds the new `Invitation` model and requires a `db:push` after
pulling.

**Design decision — capability tokens, not signed JWTs.** The token
is a random 32-byte (256-bit) url-safe base64 string, opaque on the
server. We keep the row in the DB and enforce state through it
(pending → accepted / revoked / expired), which buys us three
things that a signed JWT wouldn't: (1) server-side revocation is
just a `revokedAt` stamp, (2) the pending-invitations UI can list
outstanding invites directly, and (3) the audit trail lives in the
same row so "revoked by X at Y" is straightforward post-MVP.

**Design decision — no email delivery (MVP).** `inviteMemberAction`
returns the URL to the admin who pastes it into whatever channel
they already use (email, Slack, WhatsApp). This defers the email
sender + deliverability + DKIM/SPF setup until post-MVP without
blocking multi-user onboarding. The invite-form success card has
a first-class "Copy link" button so the workflow is not painful.

- [x] `prisma/schema.prisma` — added `Invitation` model with
      `id`, `organizationId`, `email`, `role`, `token @unique`,
      `invitedById`, `expiresAt`, `acceptedAt`, `acceptedById`,
      `revokedAt`, `createdAt`. Named relations
      `InvitationsSent` / `InvitationsAccepted` on `User`.
      `@@index([organizationId])`, `@@index([email])`.
      `(organizationId, email)` deliberately **not** unique so
      that "revoke + reissue" works without deleting history.
      Regenerated Prisma client.
- [x] `src/lib/invitations.ts` — new file. Exports
      `INVITATION_TTL_DAYS = 14`, `generateInvitationToken()`,
      `buildInvitationUrl(token)` (reads `NEXT_PUBLIC_APP_URL`),
      `defaultInvitationExpiry()`, and the shared
      `classifyInvitation()` function + `InvitationStatus` type
      used by both the accept page and the pending-invitations
      query filter.
- [x] `src/app/(app)/users/actions.ts` — rewrote `inviteMemberAction`
      to create an `Invitation` row and return
      `{ invitationId, inviteUrl, expiresAt }` instead of
      performing a direct `Membership` insert. Preserved guards:
      OWNER/ADMIN only, OWNER-only-can-invite-OWNER, existing-
      membership check, existing-live-invite check (rejects
      duplicates).
- [x] `revokeInvitationAction` — new. OWNER/ADMIN gated. Stamps
      `revokedAt`, leaves the row. Idempotent on already-revoked.
      Refuses if the invite is already accepted.
- [x] `acceptInvitationAction` — new. Calls `requireSession()`
      (not `requireActiveMembership`, because the user might not
      be a member yet). Uses `classifyInvitation()` for state
      checks, enforces email match
      (`session.user.email.trim().toLowerCase() === invite.email`)
      as the load-bearing guard. Runs an atomic `$transaction`
      to create membership + stamp invite. Handles the already-
      a-member edge by stamping the invite only.
      `revalidatePath("/users")` + `revalidatePath("/", "layout")`.
- [x] `src/app/(auth)/invite/[token]/page.tsx` — server component
      with a full state machine (not-found / accepted / revoked
      / expired / unauthenticated / wrong-email / ready). Renders
      under the existing `(auth)` layout. Deliberately **does
      not** redirect unauthenticated users — shows invite details
      before prompting sign-in.
- [x] `AcceptInviteButton` client component — `useTransition` +
      inline success card with "Go to dashboard" link. Doesn't
      auto-navigate so mobile users can screenshot confirmation.
- [x] `InviteForm` rewrite — success state renders the invite URL
      inside a read-only `<input>` with a Copy button
      (`navigator.clipboard.writeText`, falls back gracefully
      when clipboard API is blocked). Help copy includes invitee
      email + expiry timestamp.
- [x] Pending invitations card on `/users` — new `Card` between
      invite form and members table, gated on `canManage`. Filter
      mirrors `classifyInvitation`. `InvitationRow` client
      component uses the existing `AlertDialog` pattern from
      `MemberRow` for revoke confirmation.
- [x] i18n — removed dead `t.users.invite.errors.userNotFound`,
      added `alreadyInvited`, revised description / success /
      linkHeading / linkHelp / copy / copied. New
      `t.users.invitations.*` block for the pending-invitations
      card. New top-level `t.invitePage.*` block (36 keys)
      covering the accept-page state machine.
- [x] Verified clean: `prisma validate` + `tsc --noEmit` + `biome check .`
- [x] **Deployment note**: run `npm run db:push` after pulling
      to add the `Invitation` table and its indexes. No migration
      file because this project uses `db:push`.

---

## Sprint 21 — organization delete / danger zone (shipped 2026-04-11)

Tagged `v0.21.0-sprint21`. Closes the "organization delete / danger
zone" item from the post-Sprint-11 deferred list — Sprint 11 shipped
the multi-tenancy read path (header switcher + active-org cookie)
and explicitly deferred the destructive half. No schema changes;
pure app-layer work on top of the cascade machinery that has been
quietly waiting for a trigger since Sprint 0.

**Design decision — OWNER only, not ADMIN.** Every other gated
settings action (`updateOrganizationProfileAction`,
`updateOrgDefaultsAction`) uses the OWNER/ADMIN tuple. Deleting
is different: irreversible, destroys every user's data in the
tenant, and revokes access for every teammate. Scoping it one
tier tighter keeps the operation away from the "I'm an admin,
I can do anything" muscle memory.

**Design decision — typed confirmation against the slug, not
the display name.** Slug is ASCII-only and has no spaces, so the
echo check is stable on mobile keyboards and across locales.
Display names can contain diacritics, emoji, or punctuation
that would break re-typing for a non-owner (even though only
OWNER reaches the dialog).

**Design decision — target org comes from `requireActiveMembership`,
never from the client.** The action doesn't accept an org id
parameter. The *currently active* organization from the server-
side membership is what gets deleted, which closes a CSRF-style
attack where a crafted form from a hostile page could trick a
signed-in OWNER into deleting a different tenant they happen
to own.

**Design decision — post-delete redirect routes around
`/onboarding`.** If the user still has memberships, navigate to
`/` (which falls through to the next active org via the updated
cookie). If this was their only org, navigate straight to
`/organizations/create` — the onboarding welcome flow would be
the wrong place to land on a fresh empty account after a delete.

- [x] **Cascade audit (no schema changes).** Every org-owned
      relation on `Organization` already declares
      `onDelete: Cascade`: `Membership`, `Invitation`, `Warehouse`,
      `Category`, `Item`, `StockLevel`, `StockMovement`,
      `StockCount`, `CountSnapshot`, `CountEntry`, `Supplier`,
      `PurchaseOrder`, `PurchaseOrderLine`. A single
      `db.organization.delete` wipes everything in one
      transaction. `Category.parent` is a self-reference with
      `onDelete: SetNull` but the children themselves cascade
      from the org, so it's safe. Better-Auth tables (`User`,
      `Session`, `Account`, `Verification`) are not org-owned
      and survive — the deleting user stays signed in.
- [x] `src/app/(app)/settings/actions.ts` — new
      `deleteOrganizationAction(confirmation: string)`. OWNER-only
      guard. `confirmation.trim() !== membership.organization.slug`
      returns `reason: "mismatch"`. Single
      `db.organization.delete({ where: { id: targetOrgId } })`
      inside try/catch. Post-delete, writes the next active-org
      cookie (oldest remaining membership) or clears it when none
      remain. Returns `{ ok: true, nextPath }` with the post-
      delete landing path. Added `ACTIVE_ORG_COOKIE` import from
      `@/lib/session`. Also appended a new `DeleteOrganizationResult`
      type.
- [x] `src/app/(app)/settings/danger-zone-card.tsx` — new client
      component. `<Card className="border-destructive/50 lg:col-span-2">`,
      `<AlertTriangle>` icon, consequences rendered as a bulleted
      list from `labels.consequences`. `AlertDialog` opens on the
      destructive CTA; slug-echo `<Input>` drives
      `clientSideMatches = confirmation.trim() === organization.slug`
      which gates the confirm button. `handleOpenChange` resets
      `confirmation` + `error` on close. `handleConfirm` awaits
      `deleteOrganizationAction(confirmation)` inside a
      `useTransition`, sets `open: false`, then calls
      `router.push(result.nextPath)` followed by `router.refresh()`.
      Destructive confirm button uses
      `bg-destructive text-destructive-foreground hover:bg-destructive/90`.
- [x] `src/app/(app)/settings/page.tsx` — added `DangerZoneCard`
      import. New `canDeleteOrg = membership.role === "OWNER"`
      const with a comment explaining the OWNER-tighter-than-
      ADMIN rationale. Rendered `<DangerZoneCard>` at the bottom
      of the grid gated on `canDeleteOrg`, passing
      `{ name, slug }` for the org and the full `labels` object
      from `t.settings.dangerZone`.
- [x] `src/lib/i18n/messages/en.ts` — new `t.settings.dangerZone.*`
      block: `heading`, `description`, `consequences` (5-string
      array), `deleteCta`, `confirmTitle`, `confirmBody` (uses
      `{org}` placeholder), `confirmInputLabel` and
      `confirmInputPlaceholder` (both use `{slug}` placeholder),
      `confirmMismatch`, `confirmCta`, `deleting`, and an `errors`
      subtree with `forbidden`, `mismatch`, `deleteFailed`.
- [x] Verified clean: `prisma validate` + `tsc --noEmit` + `biome check .`
- [x] **No schema changes, no `db:push` required.** Pure app-
      layer work.

---

## Sprint 22 — PWA foundation (shipped 2026-04-11)

Tagged `v0.22.0-sprint22`. Starts chipping at the MVP-blocker
offline story. Deliberately narrow scope: this sprint makes
OneAce **installable** and ships a **friendly offline fallback
page**. It does NOT cache business data or implement offline
writes — both are deferred to later PWA sprints with proper
conflict-resolution design.

**Design decision — hand-written service worker, no Workbox.**
Workbox would drag a bundler-plugin config change AND hide
lifecycle details (install / activate / skipWaiting / claim)
that I'd rather have visible while the offline data story is
still being designed. `public/sw.js` is ~180 lines with three
explicit fetch strategies and no magic. When we're ready to
layer on IndexedDB sync + background queue, knowing exactly
where and how the SW handles each request class is worth the
extra lines. Migrating to Workbox is a one-sprint swap later
if we decide to; the reverse direction is much harder.

**Design decision — three-tier fetch strategy, no business
data caching.** Navigation requests go network-first → fall
back to `/offline`. `/_next/static/*` hashed assets are
cache-first (safe, effectively immutable). Everything else
is stale-while-revalidate. **Everything under `/api/*`,
`/_next/data/*`, and all non-GET requests is bypassed
entirely** — the SW never interposes on auth or data writes.
Caching RSC payloads or API responses without a proper sync
layer would leak auth state between sessions and create
impossible-to-reason-about stale data. That work belongs in
its own sprint(s).

**Design decision — SW mounted only from `(app)` layout.**
The `(auth)` layout (login, register, invite accept) does NOT
register the SW. Auth flows must always hit the network fresh;
an offline fallback during sign-in would be worse than useless
(the user would see a cached form with no way to actually
authenticate). Restricting the mount point to the post-auth
shell guarantees the SW only activates for users who have
already signed in successfully at least once.

**Design decision — capture `beforeinstallprompt` on mount
even though no UI uses it yet.** Chrome fires that event once
per page load and then silently swallows it if nobody calls
`preventDefault()` in time. Parking the deferred prompt on
`window.__oneaceInstallPrompt` on mount preserves the ability
to wire a first-party "Install app" button in a later sprint
without forcing a reload.

**Design decision — offline page is a build-time static
route.** `src/app/offline/page.tsx` uses
`export const dynamic = "force-static"`, calls no DB helpers,
reads no cookies, uses `getMessages()` with its graceful
no-request-context fallback. Rendered to plain HTML at
`next build`, safe for the SW to precache, renders identically
whether the user has ever been signed in or not.

- [x] `public/manifest.webmanifest` — name/short_name/description
      pulled from brand constants, `display: "standalone"`,
      `id`/`start_url`/`scope` all `/`, `theme_color: "#0f172a"`
      + `background_color: "#fdfcfb"` aligned with the existing
      CSS variables, portrait orientation hint, business +
      productivity categories, full icon set (SVG any + 192/512
      PNG any + 512 PNG maskable).
- [x] `public/icon.svg` — simple brand mark (dark slate card,
      triangle + base block) generated from the brand tokens.
- [x] `public/icon-192.png`, `icon-512.png`,
      `icon-maskable-512.png`, `apple-touch-icon.png` — PNG
      rasters generated from the same design via PIL, sized
      for Android adaptive icons and iOS home-screen pinning.
- [x] `public/sw.js` — hand-written service worker. Three fetch
      strategies (network-first navigation, cache-first
      `/_next/static/*`, stale-while-revalidate everything else).
      Bypasses `/api/*`, `/_next/data/*`, non-GET, cross-origin.
      `CACHE_VERSION` gates eviction on `activate()`. `message`
      listener accepts `{ type: "SKIP_WAITING" }`. Precache list
      covers `/offline`, manifest, and icon assets.
- [x] `src/components/pwa/sw-register.tsx` — `"use client"`
      registrar. Production-only, SW-capability-gated, deferred
      to `requestIdleCallback` (with a 1200ms setTimeout fallback)
      so registration never competes with first-paint. Captures
      `beforeinstallprompt` + parks it on the window for a
      future install-button UX.
- [x] Mounted `<SwRegister />` from `src/app/(app)/layout.tsx`
      (post-auth shell only). `(auth)` layout deliberately
      untouched.
- [x] `src/app/offline/page.tsx` — server component,
      `force-static`, no DB helpers, no cookie reads. Wi-Fi-off
      icon + localized copy + retry CTA pointing at `/` +
      install tip. Precached by the SW.
- [x] `src/app/layout.tsx` — added `metadata.manifest`,
      `appleWebApp` (capable + title + default status bar style),
      and the icons bundle (SVG + 192/512 PNG + apple-touch-icon).
      Left the existing `viewport.themeColor` light/dark pair
      alone; it already matches the manifest background color.
- [x] i18n — new `t.offline.*` block: `metaTitle`, `iconLabel`,
      `title`, `description`, `retryCta`, `tip`.
- [x] Verified clean: `prisma validate` + `tsc --noEmit` + `biome check .`
- [x] **No schema changes, no new npm dependencies.**

---

## Sprint 23 — PWA Sprint 2: items read cache (shipped 2026-04-11)

Tagged `v0.23.0-sprint23`. First data-aware offline feature on top
of the Sprint 22 foundation. Ships a **read-only IndexedDB cache
of the items list**, scoped per (org, user), written on every
successful page render. Still-live-when-online; the cache is a
crash-survival copy, not yet a read source.

**Design decision — Dexie as the IndexedDB wrapper.** The design
spec calls out WatermelonDB for the Expo mobile app, and Dexie is
the web-native analog: same store-and-index model, tiny
(~30 kB gzipped), zero build config, and a `version()`/
`upgrade()` migration protocol that matches how we already think
about Prisma schema drift. We can rip it out for a different
offline story later without touching any business code because
the entire API surface lives behind `src/lib/offline/`.

**Design decision — replace-on-write, not merge.** Every
successful render of the items page overwrites the scoped rows in
a single rw transaction. A merge protocol would require
tombstones and a sync log we don't have yet, and until we do,
replace-on-write is the only correct semantics: a server-side
delete is instantly reflected, nothing can linger. Fresh snapshot
= source of truth. The real merge story is PWA Sprint 4+ when we
add offline writes.

**Design decision — scope on (orgId, userId), not just orgId.**
Shared laptops with multiple OneAce users are a real pattern
(warehouse managers, shift handoffs). Keying rows on a composite
tuple ensures an `orgId`-scoped clear happens any time the user
changes, preventing row visibility from leaking across login
sessions.

**Design decision — read cache only, no offline reads yet.** The
items page still hits Postgres when online. Serving *from* Dexie
when the navigation fetch fails needs the `(app)` layout to be
offline-aware (skip `requireActiveMembership` in a fallback
path), which is a significantly bigger change and deserves its
own sprint. This sprint is the data-plane substrate; the route-
plane work comes next.

**Design decision — snapshot is an already-serialized prop, not
a second fetch.** The server component builds
`ItemSnapshotRow[]` from its Prisma query (Decimal → string,
onHand pre-summed across stock levels) and hands it to the client
bridge. No second network round-trip, no client-side DB query,
no divergence between what the user sees and what gets cached.
The bridge uses refs for the hot props and a short signature
string as the effect key so unrelated parent re-renders don't
thrash IndexedDB.

**Design decision — banner copy is conservative.** "Offline
catalog" reads as a feature even when the user is online. The
amber warning variant only fires in the one genuinely bad state:
browser is offline AND no snapshot exists. Every other state is
quiet muted-grey text. This keeps the status row invisible to
95% of users 95% of the time.

- [x] `src/lib/offline/db.ts` — Dexie v1 schema with four stores
      (`items`, `warehouses`, `categories`, `meta`). Every
      domain row carries `orgId` + `userId`. Lazy singleton
      via `getOfflineDb()`, SSR-safe (returns `null` when
      `window` or `indexedDB` is missing). Indexes on
      `orgId` and status/category for future query flexibility.
      `OFFLINE_DB_VERSION` constant exported so future migration
      blocks can reference it without string drift.
- [x] `src/lib/offline/items-cache.ts` —
      `writeItemsSnapshot` (single rw transaction: delete
      scoped rows → bulkPut new rows → put meta row),
      `readItemsSnapshot` (returns empty result, never null,
      so call sites have a single render path), and
      `formatSyncedAgo` (thin `Intl.RelativeTimeFormat`
      wrapper with a `toLocaleString` fallback). Every write
      is silently resilient: IndexedDB quota / aborted
      transactions / unavailable browsers all return `false`
      and the UI keeps working.
- [x] `src/components/offline/items-cache-sync.tsx` —
      `"use client"` bridge. Takes the pre-serialized snapshot
      as a prop, writes on idle (`requestIdleCallback` with a
      `setTimeout` fallback for Safari), uses refs + a
      signature-string effect key to avoid re-running on
      unrelated parent re-renders, cancellable.
- [x] `src/components/offline/items-cache-banner.tsx` —
      Four-state status row under the heading: online+fresh,
      online+never-synced, offline+cached, offline+empty.
      Reacts to window `online`/`offline` events so it
      switches live. Counts in the offline-cached state so
      the user can see how much data they still have access
      to.
- [x] `src/app/(app)/items/page.tsx` — builds
      `ItemSnapshotRow[]` from the Prisma query (Decimal
      price → string, onHand pre-summed), renders banner
      under the heading and `<ItemsCacheSync>` at the bottom
      of the layout div. Scope pinned to
      `(membership.organizationId, session.user.id)`.
- [x] `src/lib/i18n/messages/en.ts` — new
      `offline.cacheStatus.*` block with five keys:
      `onlineFresh`, `onlineStale`, `offlineCached`,
      `offlineEmpty`, `neverSynced`.
- [x] `dexie@4.4.2` added as a runtime dependency
      (package.json + package-lock.json).
- [x] Verified clean: `prisma validate` + `tsc --noEmit` + `biome check .`
- [x] **No schema changes.**

## Sprint 24 — PWA Sprint 3: picklist caches + static /offline/items (shipped 2026-04-11)

Tagged `v0.24.0-sprint24`. Extends Sprint 23's items-only cache to
cover **warehouses + categories picklists** (data plane) and ships
a **`force-static` `/offline/items` route** that reads directly
from Dexie (route plane), precached by the service worker so a
cold-start offline navigation can land on real business data
without any auth, cookies, or DB round-trips.

**Design decision — picklist caches mirror items-cache exactly.**
Rather than abstracting over "caches" with a generic helper, each
cache gets its own file (`warehouses-cache.ts`,
`categories-cache.ts`) with the same replace-on-write semantics,
the same `(orgId, userId)` scoping, and the same silent-false
fallback on IndexedDB failure. This is deliberate: three files
with 80% overlap is easier to read and change than one
type-parameterized helper, and the overlap will shrink as each
cache accumulates domain-specific concerns (e.g., a category tree
rebuild helper that warehouses don't need).

**Design decision — PicklistCacheSync dispatches on a
discriminator string, not a writer function.** The first draft
took a `writer` callback prop; it crashed at RSC-boundary
serialization because client-component props can only be
functions if they're Server Actions. The fix is a
`{ table: "warehouses" | "categories" }` discriminated union
that lets the client component import both writers directly and
dispatch in-process. Reuses the Sprint 23 ref + signature-string
pattern so biome's `useExhaustiveDependencies` stays quiet.

**Design decision — `/offline/items` is `force-static`.** The
`(app)` layout calls `requireActiveMembership()` which needs a
live DB connection and cookies — both of which are gone the
moment the user is offline. A sibling route tree rooted at
`/offline/` bypasses the layout entirely and stays auth-free,
DB-free, and cookie-free. Because the server component never
hits anything dynamic, Next.js prerenders it at build time and
the service worker precaches the resulting HTML during install.
Cold-start navigation while offline can now reach a real UI
instead of the SW fallback-only page.

**Design decision — viewer picks the most-recently-synced
snapshot.** Multiple users may share a browser; each can have
their own `(orgId, userId)` snapshot in the meta table. Sorting
by `syncedAt` descending and taking the first row is the right
behavior for the "I was just looking at this before the network
dropped" use case. This is documented inline as safe because the
cache is always written *before* logout, so a future user who
hasn't logged in yet can't see someone else's data through this
path. Login-aware snapshot selection is PWA Sprint 4+ territory
once we have a proper offline auth story.

**Design decision — server builds the labels, client reads
Dexie.** `/offline/items/page.tsx` calls `getMessages()` once on
the server, assembles an `OfflineItemsViewLabels` plain object,
and passes it to the client viewer. The client never imports any
i18n machinery — all it does is open Dexie, read the newest
snapshot, sort rows by `name.localeCompare(locale)`, and render a
four-state machine (loading / empty / error / ready). Keeps the
client bundle small and keeps the precachable HTML localized.

**Design decision — no `/offline/warehouses` or
`/offline/categories` viewers this sprint.** The items catalog is
the one stock-operator-critical screen. Adding two more viewers
would triple the precache surface for two screens that are rarely
consulted on their own. The picklist caches are staged now so
future sprints (scan-into-stock-count, offline quick-count) can
consume them without another data-plane sprint.

- [x] `src/lib/offline/warehouses-cache.ts` — mirror of
      `items-cache.ts`. Exports `WarehouseSnapshotRow` (the
      serializable input shape), `WarehouseSnapshotScope`,
      `writeWarehousesSnapshot` (single rw transaction: delete
      scoped rows → bulkPut → put meta row), and
      `readWarehousesSnapshot`. Silent-false fallback on any
      IndexedDB failure.
- [x] `src/lib/offline/categories-cache.ts` — same structure
      for categories. `CategorySnapshotRow` carries only
      `id / name / parentId`; the tree is rebuilt client-side
      from the parentId pointers when a future consumer needs
      it.
- [x] `src/lib/offline/db.ts` — `CachedWarehouse` now holds the
      real Prisma columns (`code` non-nullable; `city`, `region`,
      `country` nullable; `isDefault` bool) instead of the Sprint
      23 placeholder shape. Schema version unchanged (still v1)
      because no stores or indexes were touched.
- [x] `src/components/offline/picklist-cache-sync.tsx` — generic
      `"use client"` bridge dispatched by a
      `table: "warehouses" | "categories"` discriminator.
      Uses `useRef` for the hot props and a signature-string
      effect key so unrelated parent re-renders don't thrash
      IndexedDB. `void signature;` inside the effect body so
      biome's `useExhaustiveDependencies` sees the signature
      as a real dependency.
- [x] `src/app/(app)/warehouses/page.tsx` — builds
      `WarehouseSnapshotRow[]` from the Prisma query and
      mounts `<PicklistCacheSync table="warehouses">` after
      every successful render. Scope pinned to
      `(membership.organizationId, session.user.id)`.
- [x] `src/app/(app)/categories/page.tsx` — same pattern with
      `CategorySnapshotRow[]`. Only `id`, `name`, `parentId`
      are cached — the tree structure is reconstructable on
      the client.
- [x] `src/components/offline/offline-items-view.tsx` —
      `"use client"` viewer. On mount: open Dexie, pull every
      meta row where `table === "items"`, sort by `syncedAt`
      desc, read the scoped items rows, sort them by
      `name.localeCompare(labels.locale)`, render a read-only
      table with SKU / name / category / stock / status. Four
      states: loading, empty (Dexie unavailable OR no meta
      row), error (exception during read), ready. Safe under
      SSR — the effect only runs client-side and bails out if
      `getOfflineDb()` returns null.
- [x] `src/app/offline/items/page.tsx` — server component
      with `export const dynamic = "force-static"`.
      `generateMetadata` sets the title and
      `robots: { index: false, follow: false }`. Calls
      `getMessages()` once, packs every `OfflineItemsViewLabels`
      field into a plain object, and renders `<OfflineItemsView>`.
      Imports nothing from the DB or auth helpers.
- [x] `public/sw.js` — `CACHE_VERSION` bumped to
      `oneace-sw-v2` (so the old precache is evicted on
      activate) and `PRECACHE_URLS` now includes
      `/offline/items`. Install still uses `cache: "reload"`
      to bypass any HTTP cache, and a partial precache still
      lets the worker activate (the `.catch(() => {})` per-URL
      is unchanged).
- [x] `src/app/offline/page.tsx` — adds a primary CTA linking
      to `/offline/items` so users landing on the SW fallback
      page have a one-click path to their cached catalog. Old
      retry and tip copy unchanged.
- [x] `src/lib/i18n/messages/en.ts` — new `offline.items.*`
      block (20 keys) + top-level `offline.viewCachedItemsCta`
      for the /offline page link. All copy English-only per
      the i18n rule; future locales extend en.ts, they don't
      fork it.
- [x] Verified clean: `prisma validate` (with dummy
      DATABASE_URL/DIRECT_URL env vars to satisfy the CLI) +
      `tsc --noEmit` + `biome check .` (161 files, no errors).
- [x] **No schema changes.** No new runtime dependencies.

## Sprint 25 — PWA Sprint 4 Part A: offline write queue substrate (shipped 2026-04-11)

Tagged `v0.25.0-sprint25`. Introduces the **Dexie-backed pending-ops
store, queue API, replay runner, and depth banner** that every
future offline write operation will ride on. Deliberately ships
**no concrete op handler** — Sprint 26 will wire the first real
operation (stock counts) onto this substrate. The reason for the
two-sprint split is that the substrate design locks in what every
offline op will look like forever, so getting the shape right
matters more than shipping the first op.

**Design decision — substrate only, no first op wired.** The
dispatcher registry in `offline-queue-runner.tsx` is intentionally
empty. The seam is a `DISPATCHERS: Record<string, OpDispatcher>`
map keyed by `opType` string; Sprint 26 will register its handler
at that seam without touching the runner itself. This keeps the
queue primitives independently verifiable (tsc + biome pass with
zero ops registered) and means the first vertical slice in Sprint
26 is a pure add, not a refactor.

**Design decision — idempotency key is the op id.** Every enqueue
stamps a `crypto.randomUUID()` at creation time and the server
action for each op **must** honor it. Without this contract, a
flaky network can double-apply a stock adjustment, which is the
exact failure mode the queue is supposed to prevent. Documented at
the top of `queue.ts` so whoever adds the first dispatcher in
Sprint 26 can't miss it.

**Design decision — Dexie schema v2 additive only.** `db.ts` is
bumped to `OFFLINE_DB_VERSION = 2` with a new `pendingOps` store
indexed on `id` (primary), `[orgId+userId+status]` (compound for
queue scans), plain `status`, and `createdAt`. The v1 block is
preserved verbatim — Dexie replays every version on open, so
editing a prior version block would corrupt any browser that
already upgraded. History comment documents which sprint added
which version so the next schema change doesn't repeat the lesson.

**Design decision — status lifecycle with explicit `in_flight`.**
Rows move `pending → in_flight → succeeded | failed`, and
`markOpInFlight` is a Dexie transaction that only transitions rows
**still** in `pending`. This is the cross-tab coordination story:
two tabs can both try to drain the same queue, but whichever
transaction writes first claims the row, the other one gets `null`
and moves on. `releaseInFlight` resets stuck `in_flight` rows at
runner startup because a previous tab may have crashed
mid-dispatch.

**Design decision — failures are retryable unless the dispatcher
says otherwise.** `markOpFailed` takes a `retryable: boolean` flag.
`retryable: true` resets status to `pending` so the next drain
picks it up (the common case — network glitches, 503s).
`retryable: false` leaves the row in `failed` for a future review
UI (Sprint 26+). Errors are truncated to 500 chars so one bad
stack trace can't bloat the DB. Unknown opTypes are non-retryable
— a typo or stale op from a removed dispatcher should stay visible
in the banner, not spin forever.

**Design decision — banner polls on a 3s interval.** Dexie has no
row-change events and adding a Dexie live-query layer just for
this banner is overkill at Sprint 25 scale. A 3-second
`setInterval` using `countOps` (which walks the compound index
once per status rather than deserializing payloads) keeps the
banner responsive enough and costs effectively nothing. A real
live-query subscription is on the PWA Sprint 5+ shopping list.

**Design decision — runner triggers on `online`, `visibilitychange`,
and mount; single-flight guarded.** The three triggers cover the
three ways a stale queue becomes drainable: network returns, tab
becomes foreground, fresh page load. A `drainingRef` boolean acts
as a single-flight guard so a rapid burst of events doesn't spawn
parallel drains. The runner is a headless `"use client"` component
that returns `null` — it has no UI, it only orchestrates.

- [x] `src/lib/offline/db.ts` — schema v2. Adds
      `CachedPendingOpStatus` (`"pending" | "in_flight" |
      "succeeded" | "failed"`) and `CachedPendingOp` interface
      (id, orgId, userId, opType, payload, status, createdAt,
      updatedAt, attemptCount, lastError). New `pendingOps!:
      Table<CachedPendingOp, string>` on the class.
      `this.version(2).stores(...)` block preserves every v1
      store and adds `pendingOps: "id, [orgId+userId+status],
      status, createdAt"`. History comment at the top of the
      file documents v1 (Sprint 23) vs v2 (Sprint 25).
- [x] `src/lib/offline/queue.ts` — full queue API. Exports
      `PendingOpScope`, `EnqueueOpInput`, and functions
      `enqueueOp` (stamps `crypto.randomUUID()` id + timestamps
      + `status: "pending"`), `listOps` (filter by statuses,
      sorted FIFO by `createdAt`), `countOps` (walks compound
      index once per status, avoids payload deserialization),
      `markOpInFlight` (transaction-gated, only transitions
      `pending`), `markOpSucceeded`, `markOpFailed` (with
      `retryable` flag, error truncated to 500 chars),
      `releaseInFlight` (unstick crashed-tab rows at startup),
      and `clearSucceededOps` (janitor, default 5 min TTL).
      Every function returns a sentinel (`null` / `false` /
      `[]` / `0`) on any IndexedDB failure so the caller never
      has to wrap in try/catch.
- [x] `src/components/offline/offline-queue-runner.tsx` —
      headless `"use client"` component. Exports
      `DispatcherResult` (`"ok" | "retry" | "fatal"`) and
      `OpDispatcher` types. `DISPATCHERS` registry intentionally
      empty — the Sprint 26 seam. Uses `useRef` for
      `scopeRef`, `dispatchersRef`, and a `drainingRef`
      single-flight guard. Triggers: `online` event,
      `visibilitychange` (on foreground), and a one-shot mount
      drain. Calls `releaseInFlight` at mount. Unknown opType
      and dispatcher throws are both marked non-retryable.
      Returns `null` (no DOM).
- [x] `src/components/offline/offline-queue-banner.tsx` — the
      visible half. `"use client"` with
      `useState<QueueCounts>`. 3s `setInterval` polling via
      `countOps`. Three visible states: muted-grey
      "{count} waiting to sync" when pending+online, amber
      "{count} queued offline" when pending+offline, destructive
      "{count} failed to sync" for any failed rows. Completely
      invisible when there is nothing pending and nothing
      failed — 95% of users 95% of the time should never see
      it. Listens to `online`/`offline` events for the amber
      flip. Uses lucide icons `CloudUpload`, `CloudOff`,
      `TriangleAlert`.
- [x] `src/app/(app)/layout.tsx` — mounts both components.
      Builds `queueScope = { orgId: membership.organizationId,
      userId: session.user.id }` once and passes it to
      `<OfflineQueueRunner>` (headless, near the top of the
      tree) and `<OfflineQueueBanner>` (above `<main>`, under
      `<Header>` so it reads as a header-adjacent status row).
- [x] `src/lib/i18n/messages/en.ts` — new `offline.queue.*`
      block with the three banner templates
      (`pendingOnline: "{count} waiting to sync"`,
      `pendingOffline: "{count} queued offline"`,
      `failed: "{count} failed to sync"`). All English; future
      locales extend en.ts.
- [x] Verified clean: `prisma validate` (with dummy
      DATABASE_URL/DIRECT_URL env vars) + `tsc --noEmit` +
      `biome check .` (164 files, no errors).
- [x] **No Prisma schema changes.** No new runtime dependencies
      (Dexie was already in the tree from Sprint 23).

---

## Sprint 26 — PWA Sprint 4 Part B: first offline op (movement create) (shipped 2026-04-11)

Tagged `v0.26.0-sprint26`. Wires the **first concrete op**
(`movement.create`) onto the Sprint 25 queue substrate. From this
sprint onward, a user can create a stock movement while offline:
the form stamps an idempotency key, tries the direct server action
first, and on any transport failure enqueues to Dexie so the
runner can replay it when connectivity returns. Server-side
idempotency is enforced by a compound unique constraint
(`organizationId`, `idempotencyKey`) so a replay can never
double-apply a ledger entry.

This is deliberately **movement-create only**, not stock counts.
Movement create is the simplest single-transaction vertical slice
and already has an established form surface, so it's the right
place to prove the substrate end-to-end. Stock counts have
multi-row session state that deserves its own sprint — they're
still on the PWA Sprint 4 line item but will ship as a follow-on
(Sprint 27+).

**Design decision — idempotency via compound unique index, not a
separate table.** `StockMovement.idempotencyKey String?` +
`@@unique([organizationId, idempotencyKey])`. Three benefits:
(1) atomic with the insert — no race window between key-store and
movement-create; (2) nullable column means the legacy online
fast-path (no key) still writes without exercising the constraint;
(3) P2002 on duplicate gives the "replay hit" branch for free.
The alternative — a separate `IdempotencyKey` table joined at
write time — would need its own transaction boundary and would
leave a narrow window where a crash between "key written" and
"movement written" would wedge the queue forever.

**Design decision — pre-check the index before opening the
transaction.** `writeMovement` does a `findUnique` on
`(organizationId, idempotencyKey)` before the `$transaction`. If
the key already has a row, return `alreadyExists` immediately —
one indexed SELECT instead of a failed INSERT + rollback. The
P2002 branch in the catch block is still load-bearing because two
tabs can race between the pre-check and the insert, but the
common "replayed successful op" case never touches the rollback
path.

**Design decision — shared `writeMovement` helper, two callers.**
Refactored the Sprint 14 FormData `createMovementAction` to
delegate to a new internal `writeMovement(args)` helper that's
also called by the new `submitMovementOpAction`. Both callers go
through the same transaction body — same membership guards, same
stockLevel upserts, same constraint handling — so the legacy
online fast-path and the new JSON+idempotent path can never
diverge. The helper returns a `WriteMovementOutcome` discriminated
union so each caller maps it to its own result shape
(`ActionResult` vs `MovementOpResult`).

**Design decision — `submitMovementOpAction` never throws.** The
action wraps `requireActiveMembership` in try/catch (auth failures
become non-retryable), uses `safeParse` for validation (validation
errors become non-retryable), and catches all DB errors into a
structured `MovementOpResult` discriminated union. This is
load-bearing for the dispatcher: an unhandled throw would be
caught by the runner's outer try/catch and marked non-retryable,
which would be *wrong* for transient DB issues. Every error path
explicitly picks `retryable: true | false` instead.

**Design decision — form always enqueues with the same idempotency
key that was used for the direct attempt.** The form generates
the key **once**, before any network attempt. If the direct
`submitMovementOpAction` call fails (transport throw, `retryable:
true` from the server, or `navigator.onLine === false`
pre-flight), the fallback `enqueueOp` uses the *same* key. This
guarantees that if the direct call actually made it through the
server but the response got lost, the queued replay will hit the
unique index and resolve to the original row — not create a
duplicate. Without this single-key discipline, a flaky network is
a double-post waiting to happen.

**Design decision — non-retryable errors in the direct path do
NOT enqueue.** A validation error, missing item, or membership
denial is not going to succeed on replay. Enqueueing it would
just create a stuck row that loops until the queue is manually
drained. The form shows the error inline with field-level
messages, and the user can correct the input and resubmit. Only
retryable / transport errors fall through to the queue.

**Design decision — dispatcher module is pure client code, no
`"use client"` directive.** `src/lib/offline/dispatchers/movement-
create.ts` imports the Server Action directly. Next.js lifts
Server Actions to an RPC boundary at build time, so any client
module can import and call them without being a React component.
The dispatcher has no JSX, no hooks, no state — it's just a plain
async function that maps `MovementOpResult` kinds to
`DispatcherResult` kinds. Keeping it framework-free makes it
trivially testable with a vitest spy on the action.

**Design decision — registration is one import + one map entry in
the runner.** The Sprint 25 substrate shipped `DISPATCHERS` as an
empty `Record<string, OpDispatcher>` for exactly this moment.
Sprint 26 adds:
`import { MOVEMENT_CREATE_OP_TYPE, dispatchMovementCreate } from "@/lib/offline/dispatchers/movement-create";`
and
`const DISPATCHERS = { [MOVEMENT_CREATE_OP_TYPE]: dispatchMovementCreate };`
No changes to the drain loop, no changes to the banner, no
changes to the queue API. Every future op lands the same way.

- [x] `prisma/schema.prisma` — `StockMovement.idempotencyKey
      String?` nullable column + `@@unique([organizationId,
      idempotencyKey])`. Comment inline documents the Sprint 26
      purpose. Validated with `prisma validate` (dummy env
      vars). Prisma client regenerated via tmp-directory
      workaround because the sandboxed filesystem blocks `unlink`
      on the existing generated files — cloned prisma/ to /tmp,
      generated there, `cat`-overwrote each file in place.
- [x] `src/lib/validation/movement.ts` — new
      `movementOpPayloadSchema = z.object({ idempotencyKey:
      z.string().uuid(...), input: movementInputSchema })` and
      `type MovementOpPayload = z.infer<...>`. Used by both the
      form (producer), the dispatcher (consumer re-validating
      what came out of Dexie), and the server action
      (authoritative parse).
- [x] `src/app/(app)/movements/actions.ts` — refactored. New
      internal `writeMovement(args)` helper does the transactional
      work for both legacy FormData and new JSON paths. New
      `submitMovementOpAction(payload)` server action is the
      JSON+idempotent entry point — never throws, returns
      `MovementOpResult` discriminated union. Legacy
      `createMovementAction` kept as a thin wrapper for
      backwards compat. `MovementOpResult` explicitly carries
      `retryable: boolean` so the dispatcher can decide the
      correct queue verdict.
- [x] `src/lib/offline/dispatchers/movement-create.ts` — NEW.
      Exports `MOVEMENT_CREATE_OP_TYPE = "movement.create"`,
      `buildMovementCreatePayload` (co-located producer-side
      schema parse), and `dispatchMovementCreate: OpDispatcher`.
      The dispatcher defensively re-parses
      `op.payload as unknown` against
      `movementOpPayloadSchema` — a malformed row from a stale
      client is a fatal failure (would loop forever otherwise),
      not a transient one. Transport throws map to retry.
- [x] `src/components/offline/offline-queue-runner.tsx` —
      registers the first dispatcher. Imports the op type and
      handler, populates `DISPATCHERS` with a single entry.
      Top-of-file doc block updated from "Sprint 25 substrate"
      to "Sprint 25 substrate, Sprint 26 wires the first
      concrete dispatcher". No changes to the drain loop, the
      triggers, the single-flight guard, or any other logic.
- [x] `src/app/(app)/movements/movement-form.tsx` — rewritten.
      New `scope: MovementFormScope` prop (`{ orgId, userId }`).
      `buildInput(form)` constructs a typed `MovementInput`
      directly (no more FormData path). `generateIdempotencyKey`
      uses `crypto.randomUUID()` with a Math.random RFC4122 v4
      fallback for odd test environments. `handleSubmit` does the
      try-direct-then-enqueue flow with a `navigator.onLine
      === false` pre-flight, inline field-error display, and a
      `CloudOff` icon in the pending button when the user is
      offline. `enqueueAndNavigate(idempotencyKey, input)` helper
      calls `enqueueOp` then `router.push/refresh`; on enqueue
      failure (Dexie unavailable), surfaces the original error
      instead of falsely claiming queued.
- [x] `src/app/(app)/movements/new/page.tsx` — plumbs the new
      `scope={{ orgId: membership.organizationId, userId:
      session.user.id }}` prop and the new
      `submittingLabel`/`queuedLabel` label fields from
      `t.movements.offlineSubmitting`/`t.movements.offlineQueued`.
      Destructures `session` out of `requireActiveMembership`
      alongside `membership`.
- [x] `src/lib/i18n/messages/en.ts` — adds
      `t.movements.offlineQueued` ("Movement queued — will sync
      when you're back online.") and
      `t.movements.offlineSubmitting` ("Saving…"). All English;
      future locales extend en.ts.
- [x] Verified clean: `prisma validate` (with dummy
      DATABASE_URL/DIRECT_URL env vars) + `tsc --noEmit` +
      `biome check src` (158 files, no errors).
- [x] **No new runtime dependencies.** Zod, Dexie, and Prisma
      were all already in the tree. The one schema change is
      additive + nullable and was pushed via `prisma db:push`
      workflow (no migration file).

---

## Sprint 27 — PWA Sprint 4 follow-on: stock-count offline session (shipped 2026-04-11)

Tagged `v0.27.0-sprint27`. Wires the **second concrete op**
(`countEntry.add`) onto the Sprint 25 queue substrate. This is
OneAce's Flutter moat going offline-first: a warehouse counter
walking bins on a phone with flaky reception can now record
entries continuously without losing a scan when the cell tower
blinks. The form stamps an idempotency key, tries the direct
server action first, and on any transport failure drops the
entry into the Dexie queue so the runner replays it when
connectivity returns.

The sprint deliberately targets ONLY `addCountEntryAction` — the
hot path a counter hits hundreds of times per shift. Create,
cancel, and complete remain online-only because they're rare
admin actions that don't need offline resilience and carry
cross-table state (snapshot inserts, ledger adjustment posts)
that would dramatically expand the queue contract if replayed.

**Design decision — mirror the Sprint 26 pattern exactly.** The
stock-count offline story uses the same four moving parts:
compound unique `(organizationId, idempotencyKey)` on the write
table; shared `writeCountEntry` helper called from both the
legacy FormData action and the new JSON-op action; dispatcher
module that re-validates the payload it pulled out of Dexie;
form that stamps a UUID once and reuses it for both the direct
attempt and the fallback enqueue. Copying the substrate keeps
every future op (stock count create, invite accept, etc.)
landing the same way and makes the dispatcher registry the one
place new ops get wired.

**Design decision — `writeCountEntry` lives inline in
`actions.ts`, not a new `lib/` module.** The helper has one
caller outside the legacy path (the new `submitCountEntryOpAction`
in the same file), is tightly coupled to the count state
machine, and doesn't benefit from being pulled to `lib/`. If a
third caller appears (e.g. bulk import) it will get lifted.
Same reasoning as Sprint 26's `writeMovement`.

**Design decision — entry-form's prop renamed from `scope` to
`rows` for the cartesian list, and a new `scope: EntryFormScope`
prop carries `{ orgId, userId }`.** The Sprint 3 entry form
already had a `scope` prop holding the flat `(item × warehouse)`
cartesian from the count snapshots. Sprint 27 needs a separate
`{ orgId, userId }` pair for the offline queue, so the cartesian
list was renamed to `rows` and `scope` repurposed. Consistent
with `MovementFormScope` in Sprint 26 so a future refactor can
factor a common `OfflineFormScope` type without needing to
reconcile naming.

**Design decision — after save, reset qty + note but keep
itemId.** The Sprint 3 online form already did this; Sprint 27
preserves it across both the online-ok and queued branches so
the counter's muscle memory works identically in both modes.
Resetting the whole form on every scan would add a click per
bin in a workflow where counters hammer the same SKU across
dozens of warehouse locations.

**Design decision — Dexie session-state cache is NOT in this
sprint.** The current implementation requires the counter to be
online at navigation time to load the count detail page — only
the *submit* action is offline-safe. Caching the open count +
snapshot rows + entry log in Dexie so a counter can navigate to
an in-progress count while offline is a larger piece of work
that belongs in Sprint 29 (the `/offline/stock-counts` viewer),
where it can share the same Dexie store design and be tested
as one coherent offline-navigation story. Sprint 27's scope
stops at "the submit button works offline" on purpose.

- [x] `prisma/schema.prisma` — `CountEntry.idempotencyKey
      String?` nullable column + `@@unique([organizationId,
      idempotencyKey])`. Comment inline documents the Sprint 27
      purpose. Validated with `prisma validate` (dummy env
      vars). Prisma client regenerated via the same tmp-schema
      workaround as Sprint 26 — copy `prisma/schema.prisma` to
      `prisma/schema.tmp.prisma`, rewrite its `output` to a
      `/tmp` path, `prisma generate --schema=…`, then
      `cat`-overwrite each file in `src/generated/prisma/`.
      `prisma/schema.tmp.prisma` cannot be unlinked in the
      sandbox so it's truncated to 0 bytes and added to
      `.gitignore`.
- [x] `src/lib/validation/stockcount.ts` — new
      `countEntryOpPayloadSchema = z.object({ idempotencyKey:
      z.string().uuid(...), input: addEntryInputSchema })` and
      `type CountEntryOpPayload = z.infer<...>`. Reuses
      `addEntryInputSchema` verbatim so there is exactly one
      source of truth for what a valid count entry looks like.
- [x] `src/app/(app)/stock-counts/actions.ts` — refactored.
      New `writeCountEntry(args)` internal helper handles the
      transactional work (count lookup, state guard, scope
      check, pre-check idempotency index, transaction with
      OPEN → IN_PROGRESS transition, P2002 race fallback) and
      is called by both the legacy FormData
      `addCountEntryAction` and the new JSON-op action. New
      `submitCountEntryOpAction(payload)` never throws,
      returns `CountEntryOpResult` with explicit
      `retryable: boolean`. Does NOT revalidate on the replay
      branch (`alreadyExists`) to avoid cache churn when a
      replay just reports an already-successful op.
- [x] `src/lib/offline/dispatchers/count-entry-add.ts` — NEW.
      Exports `COUNT_ENTRY_ADD_OP_TYPE = "countEntry.add"`,
      `buildCountEntryAddPayload` (colocated producer-side
      schema parse), and `dispatchCountEntryAdd: OpDispatcher`.
      Defensively re-parses `op.payload` against
      `countEntryOpPayloadSchema`. A malformed row from a stale
      client is fatal (would loop forever). Transport throws
      map to retry.
- [x] `src/components/offline/offline-queue-runner.tsx` — adds
      the second entry to `DISPATCHERS`. One import + one map
      row. Comment updated to note that Sprint 27 adds
      `countEntry.add` alongside the Sprint 26 `movement.create`.
      Zero other changes to the runner.
- [x] `src/app/(app)/stock-counts/[id]/entry-form.tsx` —
      rewritten. New props: `scope: EntryFormScope` (orgId,
      userId), `rows: ScopeOption[]` (renamed from the old
      `scope` prop). `generateIdempotencyKey` uses
      `crypto.randomUUID()` with the same RFC4122 v4 fallback.
      `handleSubmit` does the try-direct-then-enqueue flow
      with `navigator.onLine === false` pre-flight.
      `enqueueAndReset` enqueues under
      `COUNT_ENTRY_ADD_OP_TYPE` and resets the form without
      navigating away (counter stays on the detail page). The
      submit button shows a `CloudOff` icon when offline, and
      the "queued" label replaces the normal submit label
      while offline so the counter knows what to expect.
- [x] `src/app/(app)/stock-counts/[id]/page.tsx` — destructures
      `session` out of `requireActiveMembership`, renames the
      local `scope` variable to `scopeRows`, passes
      `scope={{ orgId, userId }}` and `rows={scopeRows}` to
      `<EntryForm>`, and adds
      `submittingLabel`/`queuedLabel` to the labels object
      from the new i18n keys.
- [x] `src/lib/i18n/messages/en.ts` — adds
      `t.stockCounts.offlineSubmitting` ("Saving…") and
      `t.stockCounts.offlineQueued` ("Entry queued — will
      sync when you're back online."). All English; future
      locales extend en.ts.
- [x] `.gitignore` — adds `prisma/schema.tmp.prisma` so the
      sandbox-unremovable temp file used for Prisma
      regeneration doesn't pollute the tree.
- [x] Verified clean: `prisma validate` (dummy env vars) +
      `tsc --noEmit` + `biome check src` (159 files, no
      errors after one formatter auto-fix pass on the
      dispatcher import and the entry-form single-line
      collapses).
- [x] **No new runtime dependencies.** The sprint adds zero
      npm packages. The one schema change is additive +
      nullable and was pushed via `prisma db:push` workflow
      (no migration file).

---

## Sprint 28 — PWA Sprint 5: background sync + update-prompt + Install button (shipped 2026-04-11)

Tagged `v0.28.0-sprint28`. Three deliberately-small PWA
conveniences, none of which change business data or server
behavior, all of which round out the Sprint 22 foundation:

1. **Background Sync wakes the queue runner when no tab is
   foregrounded.** The browser (Chrome/Edge/Opera) fires a
   `sync` event on the SW when it decides connectivity is back;
   our SW broadcasts `{ type: "BACKGROUND_SYNC" }` to every
   controlled client and the runner listens for it and drains.
2. **"New version available" banner.** When a new SW finishes
   installing and a controller is already live, a small banner
   slides in at the top of the app shell. Clicking "Reload"
   posts `{ type: "SKIP_WAITING" }` to the waiting worker and
   listens for `controllerchange` before doing a hard reload
   so the page is served by the new SW.
3. **First-party Install button.** The `beforeinstallprompt`
   handler that Sprint 22 parked on `window.__oneaceInstallPrompt`
   now has a consumer: a small "Install app" button in the
   shell. The button reads the parked handle on mount and also
   subscribes to `beforeinstallprompt` directly so a fresh
   event from a bfcache restore still surfaces.

**Design decision — the SW broadcasts, clients drain.** The
drain path reads Dexie and calls Server Actions. Dexie inside
the SW would create a second writer we don't want, and Server
Actions don't work from the SW context at all. The SW's only
job for Background Sync is to broadcast a wake-up message;
the runner (which already has its single-flight guard and its
Dexie row-claiming discipline from Sprint 25) handles the
actual drain. On browsers without Background Sync (Safari,
Firefox), the SW listener simply never fires and the runner's
existing `online` / `visibilitychange` / mount-drain triggers
cover everything — graceful degradation with no special cases.

**Design decision — the tag name is shared via a const, not
duplicated.** `QUEUE_DRAIN_SYNC_TAG = "oneace-queue-drain"`
lives in `src/lib/offline/queue.ts` and is mirrored in
`public/sw.js` as a top-of-file constant. A rename here would
require a matching rename in the worker; this is documented
inline so a future me doesn't accidentally break the contract.

**Design decision — `registerBackgroundSync` is
fire-and-forget, called from `enqueueOp` on the success path.**
The Dexie row is the source of truth for the pending op; a
failed sync registration (browser without the API, quota
pressure, a transient SW error) must never roll back the
enqueue. The call is `void sw.ready.then(...).catch(() => {})`
so nothing downstream awaits it.

**Design decision — the update prompt is a banner, not a
toast.** Toasts auto-dismiss; missing this one would leave the
user stuck on an old shell until manual reload, which defeats
the point of the prompt. The banner sits above the content,
stays put until the user makes a choice, and has an explicit
"Later" button so dismissing is also a choice.

**Design decision — suppress the update prompt on first
install.** Checking `navigator.serviceWorker.controller`
before showing the banner avoids a confusing "new version
available" message on a user's very first page load, where the
installing worker is installing because there was no SW
yesterday — not because there's an update. Without the
controller check, Chrome fires `installed` on the first SW
activation too.

**Design decision — `controllerchange` triggers a hard
reload.** When the waiting worker takes control we
`window.location.reload()`. Skipping the reload would leave
RSC payloads and cached assets inconsistent between the old
SW's view of the app and the new one. A one-shot `reloaded`
latch prevents reload loops on browsers that re-emit
`controllerchange` on bfcache restore.

**Design decision — the install button renders nothing until
the prompt is available.** A disabled "Install app" button
that only works sometimes would be worse than no button. If
the user is on iOS Safari (no `beforeinstallprompt`), or
already installed the app, or the browser decided the origin
is ineligible, the component just returns `null`. The Install
affordance is discoverable without being noisy.

**Design decision — `BeforeInstallPromptEvent` is typed
locally, not imported.** The event is still a W3C Editor's
Draft and not in TypeScript's DOM lib. We declare an interface
that describes the two methods we actually call (`prompt()`,
`userChoice`) and cast on use. This matches how every other
production app handles the event today and will be a trivial
one-line change when the type lands upstream.

- [x] `public/sw.js` — `CACHE_VERSION` bumped `oneace-sw-v2` →
      `oneace-sw-v3` so `activate()` evicts the v2 caches
      atomically on rollout. Adds a `sync` event listener that
      matches on `QUEUE_DRAIN_SYNC_TAG = "oneace-queue-drain"`,
      calls `self.clients.matchAll({ type: "window",
      includeUncontrolled: true })`, and postMessages
      `{ type: "BACKGROUND_SYNC", tag }` to every live client.
      Uses `event.waitUntil` so the browser keeps the SW alive
      until the broadcast finishes. Top-of-file doc block
      updated to document the Sprint 28 addition alongside the
      Sprint 22 foundation and Sprint 24 precache tweak.
- [x] `src/lib/offline/queue.ts` — exports
      `QUEUE_DRAIN_SYNC_TAG` (string, shared with sw.js by
      convention) and `registerBackgroundSync()` which
      fire-and-forgets a `navigator.serviceWorker.ready`
      chain, feature-detects `registration.sync`, calls
      `sync.register(tag)`, and swallows all errors. Called
      from `enqueueOp` right after the successful `put` so
      every enqueue registers the wake-up hint.
- [x] `src/components/offline/offline-queue-runner.tsx` — adds
      a fourth drain trigger listening on
      `navigator.serviceWorker` for `message` events whose
      `data.type === "BACKGROUND_SYNC"`. The listener calls
      `void drain()` which reuses the existing single-flight
      guard, so two simultaneous triggers (e.g. online +
      BACKGROUND_SYNC arriving in the same tick) still produce
      exactly one drain pass. Cleanup in the effect's return
      removes the message listener alongside the online and
      visibilitychange listeners. Component-level doc block
      updated to document the fourth trigger.
- [x] `src/components/pwa/update-prompt.tsx` — NEW. Client
      component that subscribes to the SW registration on
      mount, tracks installing workers via `updatefound` +
      `statechange: installed`, and sets state to show a
      banner only when there is already an active controller
      (so the first-ever install doesn't show the banner).
      Renders an `<output aria-live="polite">` element with a
      `RefreshCw` icon, the i18n message, a "Reload" primary
      button that posts `{ type: "SKIP_WAITING" }` to the
      waiting worker, and a "Later" ghost button that flips
      a local `dismissed` flag. Listens for `controllerchange`
      on the SW container and does a one-shot
      `window.location.reload()` when the new worker claims
      the page. All DOM access is feature-detected so SSR and
      browsers without `navigator.serviceWorker` render
      nothing.
- [x] `src/components/pwa/install-app-button.tsx` — NEW.
      Client component that reads the Sprint 22
      `window.__oneaceInstallPrompt` park on mount and also
      subscribes to `beforeinstallprompt` directly so bfcache
      restores still get a button. Renders a small outline
      `<Button>` with a `Download` icon and the i18n label
      only when the prompt is available; otherwise returns
      `null`. On click calls `prompt.prompt()`, awaits
      `prompt.userChoice`, then clears both local state and
      the parked window handle so a second click does
      nothing. Also clears on `appinstalled`. Declares a local
      `BeforeInstallPromptEvent` interface with just the two
      methods we call; no `any` casts at the call site.
- [x] `src/app/(app)/layout.tsx` — imports `<UpdatePrompt>`
      and `<InstallAppButton>`, mounts the update prompt
      above the header, and mounts the install button in a
      right-aligned row between the offline queue banner and
      `<main>`. Adds new label props `t.pwa.update.message`,
      `t.pwa.update.reloadCta`, `t.pwa.update.dismissCta`,
      and `t.pwa.install.cta`. `SwRegister` still runs as the
      primary beforeinstallprompt capture; the install button
      reads the parked handle as its primary source.
- [x] `src/lib/i18n/messages/en.ts` — new top-level `pwa`
      block with two sub-blocks: `pwa.update.{message,
      reloadCta, dismissCta}` and `pwa.install.cta`. Four new
      keys total, all English. Placed above the `offline`
      block to group PWA-related copy together.
- [x] Verified clean: `prisma validate` (dummy env vars) +
      `tsc --noEmit` exit 0 + `biome check src` clean after
      one auto-format pass (collapsed the install button's
      multi-line `<Button>` props and swapped
      `<div role="status">` for `<output>` to satisfy
      `useSemanticElements`). 161 files.
- [x] **No new runtime dependencies.** The two new components
      use `lucide-react` icons already in the tree and the
      existing `<Button>` from `@/components/ui/button`. No
      schema changes.

---

## Sprint 29 — PWA Sprint 6: offline stock-counts viewer (shipped 2026-04-11)

Tagged `v0.29.0-sprint29`. Finally delivers the "resume a
stock count while offline" story that Sprint 27 explicitly
deferred: when a user opens a specific count's detail page
while online, the server snapshot (header + resolved scope
rows + per-row counted quantity) is persisted into Dexie;
when that same user loses connectivity, `/offline/stock-counts`
shows the cached counts with a list view and a per-count detail
view that reads directly from IndexedDB.

**Design decision — cache per-count, not per-list.** Visiting
`/stock-counts` on its own does NOT populate the cache. The
expensive part of a cached count is the rows (every item ×
warehouse in scope), and those only matter for a count the user
is actually about to walk. Opening a specific count writes that
count's header + rows. A shared-laptop user doesn't leak one
count's scope into another count's offline view, and the meta
row's "synced X ago" stamp reflects the most recent per-count
write across the scope.

**Design decision — labels resolved server-side at write
time.** The detail page already does bulk lookups on
items/warehouses for its own render. We piggy-back on those
maps to write `itemSku`/`itemName`/`warehouseName` into Dexie so
the offline viewer never has to cross-reference the items cache
at read time. That keeps the viewer's IndexedDB story to two
range scans (header by key, rows by `countId`) with zero joins.

**Design decision — replace-on-write, mirroring items-cache.**
The writer drops every `stockCountRows` row keyed on
`countId` before bulkPutting the fresh set. Without tombstones
we can't otherwise reflect a server-side row deletion, so the
honest move is a full replace inside one Dexie transaction. The
hit is tiny because per-count row counts are in the low
hundreds at most.

**Design decision — `force-static` route + client query-string
read.** `src/app/offline/stock-counts/page.tsx` is
`force-static` so the SW can precache a single HTML shell.
Next's `searchParams` prop is disabled on force-static routes
(one prerender serves every query), so the shell exports an
`OfflineStockCountsShell` client wrapper that reads
`?id=` from `window.location.search` on mount and subscribes
to `popstate` so back-navigation between list and detail
works without a full reload.

**Design decision — the viewer picks the "most recent sync"
scope.** Mirrors `offline-items-view`. Pulling every
`stockCounts`-table meta row and sorting by `syncedAt` picks
the (org, user) tuple that was last active. This is the
honest pick for a shared-browser case: whatever the user
touched most recently is the cache that corresponds to
whatever shell they were just looking at.

**Design decision — cross-user filter in `readStockCountDetail`
and in the client detail component.** Both the helper and the
direct `db.stockCounts.get()` call in the detail view compare
the cached header's `userId` to the active scope's `userId`
before rendering. A belt-and-braces check because the composite
key is `${orgId}:${id}` — scoping on org alone would be a leak
on a shared laptop where two users share an org.

**Design decision — point-in-time `entryCount`, live progress
deferred.** The cache captures `entryCount` at write time and
the viewer renders it unchanged. Anything the user queues
locally after the sync lives in the Sprint 25 `pendingOps`
table; reading it into the viewer's progress indicator is a
future enhancement (tracked alongside Sprint 31's live-query
story) and was deliberately left out of Sprint 29 so the
schema-bump + two-table introduction could ship cleanly
without entangling the reconcile flow.

- [x] `src/lib/offline/db.ts` — `OFFLINE_DB_VERSION` bumped
      `v2` → `v3`. Adds `CachedStockCount` + `CachedStockCountRow`
      row types alongside `CacheMeta.table` union expanded to
      include `"stockCounts"`. New `stockCounts` +
      `stockCountRows` Dexie tables declared on the Dexie
      subclass. New `.version(3).stores({...})` block appended
      (never edited in place; Dexie replays every version on
      open so touching a prior block corrupts the migration
      graph). Index choices:
      `stockCounts.[orgId+userId]` + `stockCounts.syncedAt` +
      `stockCounts.state`, and `stockCountRows.countId` +
      `stockCountRows.[orgId+userId]`. New helper
      `stockCountRowKey(orgId, countId, snapshotId)` prefixes
      by `countId` so a range scan can load every row in a count
      in one shot.
- [x] `src/lib/offline/stockcounts-cache.ts` — **NEW.** Exports
      `StockCountSnapshotHeader`, `StockCountSnapshotRowInput`,
      `StockCountSnapshotScope` (server-safe plain types — no
      Prisma imports), `writeStockCountDetail(scope, header,
      rows)`, `readStockCountList(scope)`, and
      `readStockCountDetail(scope, countId)`. The writer runs
      one `rw` transaction over `stockCounts` + `stockCountRows`
      + `meta`: deletes existing rows by `countId`, bulkPuts the
      fresh set, puts the header, then recomputes the running
      "total cached counts in this scope" via
      `.where("[orgId+userId]").equals([orgId, userId]).count()`
      for the meta row. Returns boolean; all IndexedDB failures
      (quota, abort, missing DB) are swallowed and return
      `false`.
- [x] `src/components/offline/stock-count-cache-sync.tsx` —
      **NEW.** Mirrors `items-cache-sync`. Takes the snapshot
      as a prop (no re-fetch on mount), holds refs for
      scope/header/rows, deduplicates writes via a
      `lastWrittenRef` keyed on
      `${orgId}:${userId}:${countId}:${state}:${rowCount}:${entryCount}`,
      and defers the actual Dexie write to `requestIdleCallback`
      (falls back to `setTimeout(250)` on Safari). Renders
      `null`. The dedupe ref exists specifically so React's
      Strict-Mode effect double-invoke in dev doesn't double-
      write to IndexedDB.
- [x] `src/app/(app)/stock-counts/[id]/page.tsx` — imports
      `StockCountCacheSync` and the two type-only shapes from
      the new cache module. After `scopeRows` is assembled,
      builds an `offlineHeader` (nine plain fields — no
      Prisma objects crossing the server/client boundary) and
      an `offlineRows` array keyed on the existing `itemById`
      + `warehouseById` bulk maps. Per-row `countedQuantity`
      is pulled from the same `varianceRows` the render path
      uses, so there's no extra walk over `count.entries`. The
      `<StockCountCacheSync>` mount sits at the top of the
      returned `<div className="space-y-6">` so it renders
      `null` before the header/content and never affects
      layout.
- [x] `src/app/offline/stock-counts/page.tsx` — **NEW.**
      `force-static` server component. Pulls `getMessages()`
      (platform default, no request-scoped locale), assembles
      the `OfflineStockCountsViewLabels` bundle, and hands it
      to `<OfflineStockCountsShell>`. Zero auth, zero DB calls,
      safe to precache. `generateMetadata()` sets
      `robots: noindex, nofollow`.
- [x] `src/components/offline/offline-stockcounts-view.tsx` —
      **NEW.** Exports `OfflineStockCountsShell` (reads `?id=`
      from `window.location.search` on mount, subscribes to
      `popstate`, flips between list and detail views) which
      wraps the internal `OfflineStockCountsView`. The list
      view range-scans `stockCounts.[orgId+userId]` for the
      newest-`syncedAt` scope and renders name/state/rows/
      entries/synced-ago. The detail view range-scans
      `stockCountRows.countId`, sorts by `itemName` using the
      active locale's `localeCompare`, and renders the blind-
      mode banner + scope table. Detail view computes variance
      inline from `countedQuantity - expectedQuantity` without
      pulling in the Sprint 27 variance helper so the offline
      bundle stays small.
- [x] `src/app/offline/page.tsx` — adds a second CTA
      `View offline stock counts` → `/offline/stock-counts`
      directly under the existing `View cached catalog`
      button. Both render on the static offline fallback so
      a cold-start navigation while offline has two possible
      landing spots.
- [x] `public/sw.js` — `CACHE_VERSION` bumped `oneace-sw-v3`
      → `oneace-sw-v4` so `activate()` evicts the v3 caches
      atomically on rollout. `PRECACHE_URLS` gains
      `/offline/stock-counts` so the force-static shell is
      available on cold-start offline navigations. Top-of-file
      doc block updated to document the Sprint 29 addition.
- [x] `src/lib/i18n/messages/en.ts` — new `offline.stockCounts`
      sub-block with 34 keys covering the list shell, detail
      view, state/methodology labels, and the progress string
      (uses the same `{counted}/{total}` placeholder pattern
      the rest of the i18n bundle follows). Adds one new key
      `offline.viewCachedStockCountsCta` for the offline
      fallback's second CTA. All English; future locales
      extend en.ts.
- [x] Verified clean: `prisma validate` (dummy env vars) +
      `tsc --noEmit` exit 0 + `biome check src public/sw.js`
      clean after one auto-format pass (166 files).
- [x] **No new runtime dependencies.** The sprint adds zero
      npm packages. Dexie v2 → v3 is a schema bump, not a
      Dexie version bump. The two new Dexie tables and their
      indexes live inside the existing `oneace-offline`
      database so existing Sprint 23/25 data is untouched.

---

## Sprint 30 — PWA Sprint 7: failed-ops review UI at /offline/queue (shipped 2026-04-11)

Tagged `v0.30.0-sprint30`. Closes the "what happened to the
ops that couldn't sync?" gap that Sprint 25's banner hinted at
and Sprints 26/27 made concrete by shipping actual dispatchers
with `kind: "fatal"` code paths. Before this sprint a failed
op was a red number in the header with nowhere to click; after,
there's a full review screen with retry / discard / bulk-clear
actions, precached by the SW so users can manage the queue
even while still offline.

**Design decision — third force-static route, not a gated
`(app)` page.** The review screen follows the same pattern as
`/offline/items` (Sprint 24) and `/offline/stock-counts`
(Sprint 29): `dynamic = "force-static"`, zero auth, zero DB
calls, the server page resolves all labels once and hands them
to a client shell. This is the only way the SW can precache
the HTML, and it matches the "the offline routes are the ones
that work when nothing else does" mental model the user now
has from the other two.

**Design decision — implicit scope discovery, no query
string.** Unlike `/offline/stock-counts` which accepts
`?id=…`, this route takes no parameters. The queue is scoped
to the most-recently-synced `(orgId, userId)` tuple in the
`meta` table — the same scope the runner itself uses when it
drains on connectivity return. Pinning the scope server-side
would defeat the force-static cache, and taking it as a query
string would require the user to know their org id on a cold
start. The trade-off is that a multi-user browser will always
show the *last* user's queue, which is the correct default
because that's also whose ops the runner is about to replay.

**Design decision — three sections (pending / in_flight /
failed), `succeeded` omitted.** The runner's janitor sweeps
succeeded ops after 5 minutes already (Sprint 25
`clearSucceededOps`), so rendering them would be either
noisy or empty-by-the-time-the-user-looks. The three shown
sections map 1:1 to the live states the user might want to
act on: "I'm waiting for this", "this is going now", "this
broke".

**Design decision — actions only on the failed section.**
The retry / discard buttons only render for failed rows.
Retrying a pending row is meaningless (the runner is about
to pick it up on the next foreground drain), and discarding
an `in_flight` row would race with the dispatcher that's
currently awaiting a server response. `OfflineQueueSection`
takes `onRetry` / `onDiscard` as nullable props and the row
component hides the whole actions column when both are
null — one code path for both the "no actions" and "has
actions" case.

**Design decision — three new queue helpers, not a generic
status-transition API.** `queue.ts` gains `requeueFailedOp`,
`deleteOp`, and `clearFailedOps`. `requeueFailedOp` only
transitions `failed` → `pending` inside a Dexie `rw`
transaction (so two tabs clicking Retry at once can't both
win — same pattern as `markOpInFlight`). `attemptCount` is
deliberately **not** reset so a retried op still carries its
history; this lets a future backoff-aware runner know the op
has already been tried N times. `deleteOp` is permissive
about status (a user who clicks discard on an op that
already auto-succeeded should still see it disappear).
`clearFailedOps` is bounded by the `(orgId, userId)` index
so a multi-tenant browser only touches the active user's
failures. Exposing the generic "change status to X"
primitive was tempting but would push the safety rules
(cross-tab race avoidance, `attemptCount` preservation,
scope bounding) into every call site.

**Design decision — banner's failed count becomes a link,
optional prop for back-compat.** The `OfflineQueueBannerLabels`
interface gains a new optional `reviewCta` field. When
present (which the `(app)` layout now supplies), the failed
count renders a small underlined "Review" link next to it
pointing at `/offline/queue`. Keeping the field optional
means an external consumer that hasn't upgraded its label
bundle will still compile — the banner just won't render
the link, and the explicit failed count still communicates
something was wrong. One-line `if (labels.reviewCta)` guard
instead of a required breaking change.

**Design decision — inline payload preview, capped at 120
chars.** The row renders `JSON.stringify(payload)` truncated
to 120 chars as a font-mono second line. This is enough for
the user to distinguish a "5 units of SKU-001 to Warehouse A"
from a "5 units of SKU-002 to Warehouse B" without
shipping a schema-aware renderer for every opType. A
try/catch wraps the stringify because a payload containing
a circular reference (shouldn't happen, but Dexie doesn't
validate) would otherwise crash the row and take the whole
section down.

**Design decision — 3-second poll, same as banner.** No
native Dexie event fires when a row's status changes, and
the runner would race with the view otherwise. Action
handlers force an immediate re-read by calling `refresh()`
directly in the `finally` block so the "row disappears from
Failed" feedback is instant instead of up-to-3-seconds
delayed. Dexie live-query lands in Sprint 31 and will
replace both the banner's poll and this one.

- [x] `src/lib/offline/queue.ts` — three new helpers.
      `requeueFailedOp(id)` runs a Dexie `rw` transaction
      that reads the row, bails if it's missing or not
      `failed`, and writes back `{ status: "pending",
      updatedAt: now, lastError: null }`. **Does not**
      reset `attemptCount` so the history is preserved.
      `deleteOp(id)` reads-then-deletes so the caller can
      distinguish "row was gone" from "IndexedDB failed"
      (both return false — the caller must not
      differentiate). `clearFailedOps(scope)` uses the
      `[orgId+userId+status]` compound index to pull the
      primary keys of every failed row in the scope, then
      `bulkDelete`s them; returns the count so the UI can
      render "N failed operation(s) discarded". All three
      swallow every failure and return a sensible sentinel,
      mirroring every other helper in the file.
- [x] `src/components/offline/offline-queue-view.tsx` —
      **NEW** (~700 lines). Exports `OfflineQueueShell` +
      `OfflineQueueViewLabels`. The shell runs scope
      discovery (most-recently-synced `meta` row), wraps the
      chrome in an `OfflineQueueFrame` that's shared across
      loading / error / empty / ready states, and mounts
      `OfflineQueueView` once a scope is resolved.
      `OfflineQueueView` holds three row arrays
      (pendingRows / inFlightRows / failedRows), polls
      Dexie every 3s via `listOps(scope, [status])`, and
      renders three sections using the shared
      `OfflineQueueTable`. Actions (`handleRetry`,
      `handleDiscard`, `handleClearAllFailed`) use a
      `busyId` ref pattern to disable every button on a
      row while its action is in flight so double-clicks
      can't re-fire. The discard and clear-all buttons
      each throw a `window.confirm` prompt — intentional
      zero-dep guard; a nicer modal is fine follow-up but
      not blocking. A transient toast rendered as
      `<output aria-live="polite">` surfaces "Operation
      requeued", "Operation discarded", or "3 failed
      operation(s) discarded" for 4 seconds. The row
      component memoizes the payload preview so toggling
      `busy` doesn't re-serialize on every render.
- [x] `src/app/offline/queue/page.tsx` — **NEW.**
      Force-static server component. Resolves 38 labels
      server-side via `getMessages()` and hands them to
      `<OfflineQueueShell>`. Zero auth, zero DB calls,
      safe to precache. `generateMetadata()` sets
      `robots: noindex, nofollow`.
- [x] `src/components/offline/offline-queue-banner.tsx` —
      adds optional `reviewCta` field to
      `OfflineQueueBannerLabels`. When present, renders a
      small `<a href="/offline/queue">` next to the failed
      count. No behavioural change when the field is
      absent; no breaking change to existing callers.
- [x] `src/app/(app)/layout.tsx` — plumbs the new
      `t.offline.queue.reviewCta` label into the banner
      props so the in-app header surfaces the review link
      whenever failed ops exist.
- [x] `src/app/offline/page.tsx` — third CTA "Review
      offline queue" → `/offline/queue`, slotted in below
      the existing "View offline stock counts" CTA. The
      offline fallback landing now has three distinct
      "things you can do while offline" buttons:
      catalog, stock counts, queue.
- [x] `public/sw.js` — `CACHE_VERSION` bumped
      `oneace-sw-v4` → `oneace-sw-v5` so `activate()`
      evicts the v4 caches atomically on rollout.
      `PRECACHE_URLS` gains `/offline/queue`. Top-of-file
      doc block updated with the Sprint 30 addition.
- [x] `src/lib/i18n/messages/en.ts` — new
      `offline.queueReview` sub-block with 36 keys
      covering the shell chrome, section titles + empty
      bodies, table columns, four status labels, three
      opType display labels (movement.create,
      countEntry.add, unknown), retry/discard/clear CTAs
      and their confirm prompts, three toast messages,
      and a payload fallback string. Plus one new top-
      level `offline.viewQueueCta` for the offline
      fallback's third button, and one new
      `offline.queue.reviewCta` for the banner link.
- [x] Verified clean: `prisma validate` (dummy env vars) +
      `tsc --noEmit` exit 0 + `biome check src` clean
      after one auto-format pass (167 files — one new
      vs Sprint 29's 166).
- [x] **No new runtime dependencies.** No schema changes
      (no Dexie version bump). No new Prisma migrations.
      The sprint is additive: every existing Sprint 25/26
      queue row keeps working exactly as before, and the
      runner continues to treat `failed` rows the same
      way — the difference is the user can now see them
      and act on them.

---

## Sprint 37 — Production hardening (shipped 2026-04-11)

### What shipped

The first sprint that doesn't add a user-visible feature. Sprint 37
plugs the gaps that would bite us on the first production deploy
after MVP cut (2026-07-03) and establishes the observability
surface the Sprint 36 audit log assumed but couldn't yet produce.

Four pieces:

1. **Zod-validated environment schema** at `src/lib/env.ts`. Reads
   `process.env` once at module load and throws a formatted error
   listing every missing / malformed variable. Required vars:
   `DATABASE_URL`, `DIRECT_URL`, `BETTER_AUTH_SECRET` (min 32
   chars), `BETTER_AUTH_URL`. Optional: `NEXT_PUBLIC_APP_URL`,
   `RESEND_API_KEY` / `MAIL_FROM` (must be set together or unset
   together — enforced via `superRefine`), `LOG_LEVEL`, `NODE_ENV`.
   Exports `env` (frozen, typed) and `isProduction`.

2. **Structured server logger** at `src/lib/logger.ts`. Four level
   methods (`debug` / `info` / `warn` / `error`) with an Error-aware
   context serialiser (so Prisma error codes and stacks survive
   `JSON.stringify`). Emits single-line JSON on stdout in
   production (stderr for warn/error) and pretty-printed lines via
   `console.*` in development. Level threshold gated by
   `env.LOG_LEVEL` with sane defaults (debug in dev/test, info in
   prod). Zero dependencies beyond the env module — no pino bloat
   in the server bundle.

3. **Error boundaries** — two layers:
   - `src/app/global-error.tsx` (Client Component, renders its own
     `<html>`/`<body>`, hardcoded English fallback because i18n
     itself may be the culprit). Displays the Next.js `error.digest`
     so ops can correlate user reports with the server log.
   - `src/app/(app)/error.tsx` (route-segment boundary for the
     authenticated app group, keeps the sidebar/header intact).
     Uses the standard Card primitive set so it inherits the
     theme.

4. **`/api/health` route handler** at `src/app/api/health/route.ts`.
   Public, node-runtime, `force-dynamic`, no caching. Runs a cheap
   `SELECT 1` via `db.$queryRaw`, returns 200 with
   `{status, uptime, timestamp, environment, version, commit,
   checks: {database}}` when ready and 503 with the same shape
   when the DB probe fails. `version` / `commit` pulled from
   Vercel's `VERCEL_GIT_COMMIT_REF` / `VERCEL_GIT_COMMIT_SHA`
   with "unknown" fallback for local dev.

### Migrated call sites

Four files moved off raw `process.env`:
  - `src/lib/auth.ts` — `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`,
    `NEXT_PUBLIC_APP_URL` (trustedOrigins)
  - `src/lib/db.ts` — `NODE_ENV` replaced with `isProduction`
  - `src/lib/invitations.ts` — `NEXT_PUBLIC_APP_URL`
  - `src/lib/mail/index.ts` — `RESEND_API_KEY`, `MAIL_FROM`
    (the mail-pair superRefine in env.ts supersedes the old
    "silent failure at send time" posture)
  - `src/lib/audit.ts` — `console.error` replaced with
    `logger.error` so audit write failures join the structured
    stream.

`src/lib/auth-client.ts` (Client Component) deliberately still
reads `process.env.NEXT_PUBLIC_APP_URL` because Next.js inlines
`NEXT_PUBLIC_*` at build time and importing the server env module
into a client bundle would drag server-only validation into the
browser.

### Design decisions

- **Throw at boot, not at use**: the env module calls `parseEnv()`
  at module top-level and exports the frozen result. The first
  import transitively triggers validation; if it fails, the
  process dies with a multi-line message listing every issue. We
  considered lazy `getEnv()` helpers but rejected them — the whole
  point is to fail before the first request lands.

- **Mail pair all-or-nothing**: Sprint 33 deliberately deferred
  this check to send time. Sprint 37 pulls it forward because the
  boot-time error is clearer than a 422 from Resend with a generic
  message. Dev loops that never want to send mail still work —
  leave both unset, ConsoleMailer fires.

- **Logger is dependency-free**: pino is ~200KB and adds a child
  logger concept we don't need. Winston is worse. A 150-line
  handwritten module with four methods is right-sized for MVP,
  and the interface is narrow enough to swap behind later without
  touching call sites.

- **JSON lines in prod, console.* in dev**: the two modes emit
  very different output because the consumers are different.
  Vercel/Cloudwatch ingest JSON; `next dev` terminal output wants
  something a human can skim.

- **Error serialisation**: Error instances are walked once via
  `serialiseError` so `name`, `message`, `stack`, and any custom
  fields (Prisma's `code`, `meta`) survive JSON.stringify. Without
  this, `JSON.stringify(new Error("x"))` emits `{}` and you lose
  everything. The serialiser is applied recursively over the
  context object, not the message, so call sites can mix Error
  and non-Error values freely.

- **Two error boundaries, not one**: Next.js 15 fires the nearest
  `error.tsx` in the route tree first and only escalates to
  `global-error.tsx` when that boundary itself crashes or when
  the root layout is the thing that failed. A route-segment
  boundary inside `(app)` keeps the shell up for data-fetch
  errors (the common case) and the global boundary catches
  layout-level blowups (the rare case).

- **No i18n in global-error**: if i18n itself crashed, loading it
  again from the boundary is a loop. Global-error ships English
  strings directly. The segment boundary is fine to use the
  standard Card primitives because they don't touch i18n.

- **Health route is public**: load balancers and uptime probes
  can't authenticate. We expose zero tenant data — just
  environment, uptime, commit, and a database ok/fail boolean.
  Full error details go to the server log, not the response body.

- **503 on degraded, not 200**: some uptime providers want a
  single "success" status code and use the body for detail. We
  prefer explicit HTTP status signalling — 200 = ready, 503 =
  not ready, any other code = hard down. That's the PagerDuty /
  Better Stack convention.

- **`export const runtime = "nodejs"`**: Prisma's query engine is
  a Node native binding and crashes on the edge runtime. Pinning
  the route saves a future-us head-scratch when Next.js 16
  changes defaults.

### Files touched

- `src/lib/env.ts` — NEW (~150 lines)
- `src/lib/logger.ts` — NEW (~140 lines)
- `src/app/global-error.tsx` — NEW (client, ~110 lines)
- `src/app/(app)/error.tsx` — NEW (client, ~80 lines)
- `src/app/api/health/route.ts` — NEW (~110 lines)
- `src/lib/auth.ts` — migrated to `env`
- `src/lib/db.ts` — migrated to `isProduction`
- `src/lib/invitations.ts` — migrated to `env.NEXT_PUBLIC_APP_URL`
- `src/lib/mail/index.ts` — migrated to `env.RESEND_API_KEY` /
  `env.MAIL_FROM`
- `src/lib/audit.ts` — `console.error` → `logger.error`

### Verified clean

```
mv tsconfig.tsbuildinfo tsconfig.tsbuildinfo.old36
npx tsc --noEmit          exit 0, 0 lines
npx biome check src       185 files, 0 errors
                          (5 new vs Sprint 36's 180: env, logger,
                          global-error, (app)/error, api/health/route)
npx prisma validate       schema valid (unchanged)
```

### Known gaps / deferred

- No remote log shipping. Logger writes stdout/stderr only;
  plug Axiom / BetterStack / Datadog behind the same interface
  post-MVP.
- Health route checks database only. Redis, queue worker,
  mailer round-trip not yet probed — add as they're introduced.
- `ensureEnv()` style startup check with a warning for missing
  `NEXT_PUBLIC_APP_URL` in production is noted in env.ts but
  not implemented. Worth revisiting when we add a deploy-gate
  CLI.
- Client Component boundary for the `(auth)` group not added
  yet. Sign-in / sign-up pages still fall through to
  `global-error.tsx` on crash. Low priority since they're the
  simplest pages in the app.
- Tests that mutate `process.env` after importing the env
  module are now no-ops (validation runs once). No tests
  currently do this, but the pattern is noted in `mail/index.ts`
  comments in case we add Vitest later.

## Sprint 36 — Audit log (shipped 2026-04-11)

Tagged `v0.36.0-sprint36`. Introduces the first pass of a tenant-scoped,
append-only audit trail so OWNER / ADMIN can answer the
"who changed what?" question without pulling Postgres console access
or a structured-logging pipeline (still pending in Sprint 37). The
log is not a BI tool — it's the MVP governance surface that every
multi-tenant SaaS needs before it can safely onboard a second team.

### What shipped

- **`AuditEvent` Prisma model** — a new tenant-scoped append-only
  table with the shape
  `(id, organizationId, actorId?, action, entityType, entityId?, metadata: Json?, createdAt)`.
  Composite index `(organizationId, createdAt)` powers the default
  newest-first page query; a secondary `(entityType, entityId)` index
  is prepped for future per-entity drill-downs.
  `organizationId → Organization` is `onDelete: Cascade` so
  deleting a tenant wipes its log in the same transaction — see the
  design decision block below for the intentional consequence on
  `deleteOrganizationAction`.
  `actorId → User?` is `onDelete: SetNull` so a later "remove user"
  flow can destroy a `User` row without invalidating old log entries
  — they gracefully render as "Deleted user" on `/audit`.

- **`src/lib/audit.ts` write helper** — thin, single-function wrapper
  `recordAudit({ organizationId, actorId, action, entityType, entityId?, metadata? })`.
  Key posture: the helper **swallows its own errors and logs via
  `console.error`** rather than bubbling. The invariant is "an
  action that already succeeded must not be flipped to failed
  because its audit write hiccuped" — we'd rather lose a row than
  refuse a legitimate write. The Sprint 37 structured logger will
  replace the bare `console.error` without any caller changes.
  `AuditAction` and `AuditEntityType` are exported union types so
  TypeScript enforces the canonical vocabulary at every call site.

- **Action-layer wiring into 12 actions** across the three
  highest-severity surfaces:
  - `settings/actions.ts`:
    `updateOrganizationProfileAction` records
    `organization.updated` with a `{ before, after }` diff of the
    `name` + `slug` fields.
    `transferOrganizationAction` records
    `organization.transferred` with the outgoing and incoming user
    ids + the target's email (so the reader can see ownership
    hand-offs without a second query).
    `deleteOrganizationAction` deliberately does NOT record an
    event — the cascade would wipe it in the same transaction,
    so org-deletion observability belongs in the Sprint 37 server
    logger instead. This is documented inline.
  - `users/actions.ts`:
    `inviteMemberAction` records `member.invited` (email, role,
    expiresAt).
    `revokeInvitationAction` records `invitation.revoked` (email,
    role).
    `acceptInvitationAction` records `invitation.accepted` (email,
    role, `alreadyMember` hint).
    `updateMemberRoleAction` records `member.role_changed` (target
    userId, `from`, `to`) with an explicit no-op early-return so a
    same-role re-submit doesn't spam the log.
    `removeMemberAction` records `member.removed` (target userId,
    email, last-known role).
  - `purchase-orders/actions.ts`:
    `createPurchaseOrderAction` records `purchase_order.created`
    (supplierId, warehouseId, status, line count, currency).
    `markPurchaseOrderSentAction` records `purchase_order.sent`
    (poNumber + previous status).
    `cancelPurchaseOrderAction` records `purchase_order.cancelled`
    (poNumber + previous status).
    `deletePurchaseOrderAction` records `purchase_order.deleted`
    with `entityId: null` intentionally — the row is gone; the
    durable reference is the `poNumber` field in metadata.
    `receivePurchaseOrderAction` records `purchase_order.received`
    with `receivedLineCount`, `fullyReceived`, and
    `totalQty` summed across receipts. The log write happens
    outside the receive transaction so a ledger hiccup can't
    rollback real stock movements.

- **`/audit` page** — new route under `src/app/(app)/audit/` gated
  on `membership.role ∈ {OWNER, ADMIN}`. Non-admins get a friendly
  "You do not have permission" card before any DB query runs
  (defence-in-depth: the role check happens in the same
  component that does the findMany, not just the nav link).
  The page is a pure server component — no client hydration cost —
  with cursor-based pagination via `?cursor=<id>` query params.
  We fetch `PAGE_SIZE + 1` rows (50 + 1) so a "Load more" link
  can be rendered without a second count query, and the cursor
  follows Prisma's `cursor + skip: 1` idiom over a stable
  `(createdAt desc, id desc)` tiebreaker. No client bundle, no
  loading states, clean back-button URL history.

- **Sidebar nav entry** — new "Audit log" item between Users and
  Settings, lucide `History` icon. The existing layout already
  spreads `t.nav` into `SidebarLabels`, so the new `audit` key
  flows through automatically; we only had to append the literal
  array entry.

- **i18n additions** — new `t.nav.audit` and a full `t.audit`
  namespace at the end of `src/lib/i18n/messages/en.ts`. The
  `t.audit.actions` sub-object is a literal map from every
  `AuditAction` string to its human-readable label, which keeps
  the page render robust even if a future sprint adds a new
  action without touching the UI (the render falls back to the
  raw action string).

### Design decisions recorded

1. **Cascade on organizationId, not restrict.** Deleting an
   organization wipes its audit log in the same transaction. This
   is the correct multi-tenant posture — an audited tenant that
   deletes itself shouldn't leave dangling log rows pointing at a
   ghost FK. The trade-off is that `organization.deleted` events
   are impossible to capture in this table; they belong in the
   Sprint 37 server-side structured log. We accept that.

2. **SetNull on actorId, not Cascade.** When a user is later
   removed from the platform, their historical audit rows survive
   with `actor = null`. The `/audit` page renders this as
   "Deleted user", which is the right behaviour for a governance
   log — wiping a former admin's tracks defeats the point.

3. **Free-form `action` string, not a Prisma enum.** New actions
   can be added without a schema migration; the union type
   `AuditAction` gives TypeScript-level enforcement at every call
   site without forcing a DB migration for every new verb. The
   `/audit` page groups by dot-prefix (`organization`, `member`,
   `invitation`, `purchase_order`) so the grouping vocabulary is
   intrinsic to the naming convention, not a second enum.

4. **No `updatedAt` on `AuditEvent`.** Audit rows are never
   updated; the model enforces this at the schema level by
   omitting the column. `deleteMany` is likewise never called
   from application code — the only way a row leaves the table
   is via `organizationId`-cascade.

5. **`metadata: Json?` is deliberately small.** The helper
   documents "this is a log, not a data warehouse". Full before/
   after diffs for complex rows belong in the entity detail
   page's own history feed (a follow-up sprint); the audit log
   carries the minimum context a reviewer needs to decide whether
   to investigate further.

6. **`recordAudit` never throws.** The only safe place to audit
   is *after* the primary mutation has committed, and at that
   point the audit write is the log's problem, not the user's.
   `console.error` keeps failures visible in `vercel logs` /
   `next start` output; Sprint 37 will upgrade this to structured
   logging without any caller-side edit.

7. **`updateMemberRoleAction` no-op skip.** If the role doesn't
   actually change, the action returns `ok: true` without
   touching the log or the revalidate. Same-role resubmits from
   a flaky client retry aren't interesting to the governance
   reader.

8. **Admin-only `/audit` route.** MANAGER/MEMBER/VIEWER see
   nothing — not even an empty state. The nav entry would leak
   the URL to a curious MEMBER, but the page's own role check
   is the load-bearing guard, not the nav visibility. (A future
   sprint can filter the nav array by role, but for Sprint 36
   the explicit in-page guard is the simpler correct answer.)

9. **Cursor pagination over offset.** Audit logs grow
   monotonically; offset pagination would quietly shift older
   rows across pages as new events arrived. Cursor pagination
   guarantees a stable "where I was in the list" regardless of
   concurrent writes. The composite
   `(organizationId, createdAt)` index supports this cheaply.

### Files touched

- `prisma/schema.prisma` — new `AuditEvent` model; two relations
  added (Organization.auditEvents, User.auditEventsLogged)
- `src/generated/prisma/` — regenerated client (Sprint 36 types)
- `src/lib/audit.ts` — NEW; the write helper + vocabulary types
- `src/app/(app)/settings/actions.ts` — 2 action audit wires
  (update + transfer); inline note on why delete is skipped
- `src/app/(app)/users/actions.ts` — 5 action audit wires
  (invite, revoke, accept, role-change, remove) + same-role
  early-return for role-change
- `src/app/(app)/purchase-orders/actions.ts` — 5 action audit
  wires (create, sent, cancelled, deleted, received)
- `src/app/(app)/audit/page.tsx` — NEW; admin-gated viewer with
  cursor-based "Load more" pagination
- `src/components/shell/sidebar.tsx` — added `audit` nav entry
  with lucide `History` icon; extended `SidebarLabels.nav`
- `src/lib/i18n/messages/en.ts` — new `nav.audit` key and full
  `audit` namespace (metaTitle, heading, subtitle, forbidden,
  empty, 5 column labels, 13 action labels)

### Verified clean

```
npx tsc --noEmit                   # 0 errors
npx biome check src                # 0 errors (180 files)
DATABASE_URL=... npx prisma validate  # valid
```

### Known gaps / follow-up

- `items`, `warehouses`, `categories`, `stock_movements`,
  `stock_counts`, `suppliers` mutations are **not** audited yet.
  Adding them is mechanical (the helper + vocabulary are the
  hard parts); it's deferred only to keep this sprint's diff
  reviewable. A dedicated "audit wave 2" sprint can chase down
  the remaining ~20 server actions with no schema work.
- The `/audit` page has no filters. A later sprint can add
  per-entity / per-actor / per-action filters without touching
  the helper. The `(entityType, entityId)` secondary index is
  already prepped for the first of those.
- `organization.deleted` and any user-deletion events bypass the
  table (cascade / no user-delete flow). Sprint 37's structured
  logger is the right home for those — they don't belong in a
  tenant-scoped per-org log.
- `metadata` rendering on the page is a single-line truncated
  inline list. A detail drawer or per-row "expand JSON" affordance
  is a Sprint-38+ enhancement.
- No audit-log retention policy. Rows grow forever until the
  org is deleted. If storage ever becomes a concern, a partial
  index + a scheduled `deleteMany` older than N days is the
  natural first cut — but we're nowhere near that at MVP scale.

---

## Sprint 35 — ZXing-wasm scanner fallback (shipped 2026-04-11)

Tagged `v0.35.0-sprint35`. Closes the biggest usability cliff in the
app: `/scan` has been Chromium-only since Sprint 8 because it
exclusively used the native `BarcodeDetector` Web API, which Safari
(iOS + macOS) and Firefox don't ship. Any warehouse worker opening
OneAce on an iPhone landed on the "Camera scanning not supported"
wall and had to fall back to manual entry. This sprint plugs a
lazy-loaded `@zxing/browser` adapter behind the same detector
interface so those browsers now get live camera scanning with zero
UX change beyond a small badge that tells the user which engine is
active.

### What shipped

**Pluggable detector abstraction** at `src/lib/scanner/detector.ts`.
One tiny interface — `BarcodeDetectorLike = { detect: (source:
HTMLVideoElement) => Promise<Array<{ rawValue: string }>> }` — is
satisfied by two backends:

1. **Native engine** wraps `globalThis.BarcodeDetector` with a
   format list covering `ean_13`, `ean_8`, `upc_a`, `upc_e`,
   `code_128`, `code_39`, `qr_code`, `itf`. If a browser advertises
   the constructor but rejects unknown formats (some older
   Chromiums do), the builder falls back to the no-arg constructor.
   If even that throws we pretend native isn't available and let
   the ZXing path take over.

2. **ZXing engine** lazy-loads `@zxing/browser` via a dynamic
   `import()`, constructs a singleton `BrowserMultiFormatReader`,
   and wraps its synchronous `decode(video)` call in an adapter
   that matches the native shape. Recoverable scan failures
   (`NotFoundException`, `ChecksumException`, `FormatException`,
   or equivalent message prefixes) map to an empty array so the
   scanner's throttled requestAnimationFrame loop just tries again
   on the next tick. Only fatal failures propagate out and end the
   scan session.

The factory `createDetector()` prefers native (faster, lower
battery, less CPU) and falls back to ZXing only when native is
missing. Results of the ZXing dynamic import are cached in a
module-level `zxingPromise` so repeat calls across start/stop
cycles don't re-download the chunk.

**Scanner component refactor** (`src/app/(app)/scan/scanner.tsx`):

- Dropped the inline `globalThis.BarcodeDetector` feature-detect
  and `BarcodeDetectorCtor` type; `Scanner` now imports the
  abstraction from `@/lib/scanner/detector` and calls
  `createDetector()` inside `startCamera`. The RAF throttle loop
  (~6 FPS) is untouched — it works for both engines because they
  both present the same `.detect(videoElement)` promise.
- New `engine` state (`"native" | "zxing" | null`) fed by the
  factory return value.
- Small badge in the camera card header shows which engine is
  active: `Native engine` (secondary badge), `ZXing fallback`
  (outline badge), or `Loading engine…` (outline + spinner) while
  the dynamic import is in flight. Nothing is rendered before the
  first `startCamera` call.
- `cameraSubtitle` copy stays the same ("Scanning happens locally
  on your device") — true for both engines.
- The old "Chrome, Edge, and Android browsers work best"
  guidance in `unsupportedBody` is replaced with a neutral "Your
  browser does not expose a camera API, so live scanning can't
  start" message — triggered only when `navigator.mediaDevices`
  is entirely missing or both detector engines fail to initialize.

**i18n additions** in `t.scan.camera`:
- `engineNative`: "Native engine"
- `engineZxing`: "ZXing fallback"
- `engineLoading`: "Loading engine…"
- `unsupportedBody` rewritten (see above)

Plumbed through `scan/page.tsx` into the `ScannerLabels` prop so
the Scanner client component stays i18n-string-free.

**New runtime dependencies**:
- `@zxing/browser@^0.1.5`
- `@zxing/library@^0.21.3` (peer of `@zxing/browser`)

Both lazy-loaded via dynamic `import()` inside the detector
factory so they only enter the client bundle for browsers that
actually need them. Chromium users never download the chunk.

### Why this shape

- **Prefer native when available**: the browser BarcodeDetector is
  significantly faster than any JS/WASM decoder, uses less battery
  on mobile, and has hardware-accelerated format detection in
  recent Chrome builds. ZXing is strictly a fallback — about 2×
  slower on average and ~250 KB gzipped — so we don't want to pay
  for it on devices that don't need it.

- **Lazy import**: using `await import("@zxing/browser")` instead
  of a top-level import means the ZXing chunk only ships to
  browsers that hit the fallback path. Chromium users pay zero
  marginal bundle cost.

- **Cache the reader, cache the import**: `zxingPromise` is held
  at module scope so start/stop cycles don't re-import the ZXing
  module. The reader instance is also reused, which keeps its
  internal canvas allocation and `DecodeHints` map alive between
  `.detect()` calls.

- **Adapter matches existing RAF loop**: the scanner's 6 FPS
  throttle, dedupe on `lastCodeRef`, stop-on-match behavior, and
  torch-less camera setup all carry over unchanged. Zero
  conditional branching on engine inside the component logic —
  only inside the render for the small badge.

- **Engine badge, not toggle**: users do not get a UI to force
  one engine over the other. Machines that can run native should
  always run native; the badge exists so people debugging scan
  failures know which engine was in play.

- **Map all ZXing "no code" exceptions**: NotFoundException is the
  expected "no barcode in this frame" signal, but on macOS Safari
  I've seen it surface as a plain `Error` with a message that
  includes `"NotFoundException"` rather than a proper `name`
  field. The catch block sniffs both `err.name` and
  `err.message` to avoid ending scan sessions on recoverable
  failures.

### Files touched

- `src/lib/scanner/detector.ts` **(NEW, ~170 lines)** — detector
  abstraction + native/zxing factories + `createDetector`.
- `src/app/(app)/scan/scanner.tsx` — swap inline feature-detect
  for `createDetector`, add engine state + badge.
- `src/app/(app)/scan/page.tsx` — pass three new i18n keys into
  `ScannerLabels`.
- `src/lib/i18n/messages/en.ts` — three new `t.scan.camera`
  keys + rewritten `unsupportedBody`.
- `package.json` — add `@zxing/browser` + `@zxing/library` deps.

### Verified clean

```
npx tsc --noEmit                   exit 0
npx biome check src                178 files, clean
npx prisma validate                green
```

### Follow-up gaps (post-MVP unless flagged)

- **Torch toggle** on supported devices (we have the static
  helpers from `BrowserCodeReader.mediaStreamSetTorch`, just
  haven't wired a UI). Would help warehouse workers scanning in
  low light.
- **Device enumeration + camera picker** for laptops/tablets with
  multiple cameras. Currently we always pick `facingMode:
  environment` and let the browser choose.
- **Continuous-scan mode** instead of stop-on-first-match. Useful
  for bulk receiving.
- **Format subsetting on ZXing** — today we scan every format
  `BrowserMultiFormatReader` supports, which is slightly slower
  than narrowing to the eight formats the native engine uses.
  Measured impact is small (<40ms per frame) but worth revisiting
  if anyone files a "slow scan on Safari" bug.
- **Telemetry** on which engine fires in the field so we know
  the split. Currently we only know the client-side state.

---

## Sprint 34 — Supplier drill-down detail page (shipped 2026-04-11)

Tagged `v0.34.0-sprint34`. Closes a real broken link dating back to
Sprint 12 — the supplier-performance report (`/reports/suppliers`)
has been rendering each row as a `<Link href={"/suppliers/${id}"}>`
since it shipped, but until this sprint the only thing living under
`/suppliers/[id]/` was `/edit`, so clicking a supplier name in the
leaderboard 404'd. No schema changes, no new runtime dependencies,
no migrations — one new server component page, one list-page patch,
one new i18n sub-namespace.

### NEW `src/app/(app)/suppliers/[id]/page.tsx` (~540 lines)

Server component, three stacked sections + an identity header.
Single `supplier.findFirst({ id, organizationId })` query with a
nested `purchaseOrders → lines → item` include pulls everything
needed for the whole page in one round-trip. Defense-in-depth:
even though the route is gated by `requireActiveMembership`
upstream, the `organizationId` predicate on the supplier query is
how a crafted URL with a cross-tenant supplier id trips
`notFound()` — no implicit trust of URL params.

**Identity header** — `Truck` icon + supplier name + optional
code (mono, muted) + Active/Inactive `<Badge>`. Action buttons
row: `Back`, `Edit`, `New PO` (deep-links the generic
`/purchase-orders/new`; a later sprint can add `?supplierId=` to
prefill the supplier select). A tiny lead-time-sample line under
the title shows "Across {N} received PO(s)" as quick context
before the KPIs render below.

**Identity cards (3-up grid)**:

- `Contact` — contactName, email (mailto link), phone, website
  (external-link icon), and the supplier's default currency
  displayed as `Default currency: USD` in a mono chip. Empty
  state: "No contact details on file" italic muted.
- `Address` — `<address>` block with `addressLine1`,
  `addressLine2`, postal+city, region, country — each line only
  renders if non-empty, `addressParts` filter drops empties before
  map. Empty state: "No address on file".
- `Notes` — `whitespace-pre-wrap` paragraph preserving the text
  format from the supplier edit form. Empty state: "No notes".

**Activity section** — `<h2>` + subtitle, then either the empty
state card (CalendarClock icon + "No purchase orders yet" + "Raise
your first PO against this supplier…" + `New PO` CTA) when
`totalPos === 0`, or the four-KPI card grid when there is
activity.

**Four KPI cards** (2×2 on md, 4×1 on xl) with identical math to
the Sprint 12 supplier-performance report so totals reconcile
byte-for-byte between the two surfaces:

- **Received value** — `sum(receivedQty × unitCost)` across every
  line of every PO regardless of PO status, so
  `PARTIALLY_RECEIVED` POs contribute their shipped-so-far value.
  Rendered in region currency via `formatCurrency`.
- **Total POs** — `purchaseOrders.length` (DRAFT + SENT +
  PARTIALLY_RECEIVED + RECEIVED + CANCELLED). Card body:
  "{openPos} open right now" where "open" is `SENT +
  PARTIALLY_RECEIVED` only — DRAFT doesn't count as committed
  business.
- **On-time rate** — `onTimeCount / onTimeEligible × 100`,
  computed over RECEIVED POs that have an `expectedAt` date.
  Denominator excludes POs without an expected date (not counted
  as misses). Body: "{onTimeCount} of {onTimeEligible} received
  on or before the expected date". `N/A` when denominator is 0.
- **Avg lead time** — mean of `round((receivedMs - orderedMs) /
  86400000)` across RECEIVED POs with non-negative lead days
  (guards against clock-skewed data). Body: "Across {N} received
  PO(s)". `N/A` when sample is empty.

Mixed-currency caveat — if `currencyMix.size > 1` or any PO uses
a non-region currency, a muted italic caveat explains the 1:1
conversion and hints at the missing historical FX source.

**Recent POs table card** — "Newest first, up to the last 10
orders" subtitle + `View all purchase orders` ghost button that
links back to `/purchase-orders`. Seven columns: PO number (mono,
deep-links `/purchase-orders/[id]`), Status + timeliness badge,
Ordered date, Expected date, Received date, Lines count, PO
value. The PO value cell uses the same `receivedQty × unitCost`
math as the aggregate KPI so a sharp user clicking through the
table can reconcile line-by-line.

Per-row **timeliness badge** logic (on top of the status badge):

- RECEIVED + receivedAt + expectedAt → compare timestamps. Diff
  > 0 → destructive "Late"; diff < 0 → secondary "Early"; diff
  === 0 → default "On time".
- SENT or PARTIALLY_RECEIVED → outline "Outstanding" (nothing to
  compare yet — the PO is live).
- DRAFT or CANCELLED → no badge (DRAFT hasn't been committed;
  CANCELLED is a dead end, no timeliness to report).

**Top items card** — top 5 items ordered from this supplier by
total `orderedQty`, with both Ordered qty and Received qty
columns so the operator can spot chronic short-shipments (high
ordered, low received). Aggregation is in-memory via a `Map<id,
{name, sku, ordered, received}>` accumulated during the KPI pass
— no second query. Empty state: "This supplier has no ordered
lines yet" italic.

### Deep-link wiring

Updated `src/app/(app)/suppliers/page.tsx` so the name column
cell wraps in `<Link href={`/suppliers/${s.id}`}>` with
`hover:underline`. The edit / delete buttons still live in the
actions column, so the row reads cleanly: name → detail (primary
action), actions → edit/delete.

The supplier-performance report (`/reports/suppliers`) already
links to `/suppliers/${id}` from Sprint 12, so no change needed
there — that's the whole point of Sprint 34: those links now
resolve to a real page.

### i18n (`src/lib/i18n/messages/en.ts`)

NEW `t.suppliers.detail` sub-namespace under `t.suppliers`, ~50
keys covering: `metaTitle`, `backToList`, action CTAs
(`editCta`, `newPoCta`), identity card headings + empty states
(`contactHeading`, `addressHeading`, `notesHeading`,
`currencyLabel`, `websiteLabel`, `noContact`, `noAddress`,
`noNotes`), activity section (`activityHeading`,
`activitySubtitle`, `emptyActivityTitle`, `emptyActivityBody`),
KPI labels + bodies (`kpiReceivedValueLabel`,
`kpiReceivedValueBody`, `kpiTotalPosLabel`, `kpiTotalPosBody`,
`kpiOnTimeRateLabel`, `kpiOnTimeRateBody`,
`kpiAvgLeadTimeLabel`, `kpiAvgLeadTimeBody`, `kpiNotAvailable`,
`daysSuffix`), recent POs table (`recentHeading`,
`recentSubtitle`, `recentViewAllCta`, `colPoNumber`, `colStatus`,
`colOrderedAt`, `colExpectedAt`, `colReceivedAt`, `colLines`,
`colValue`, `lateBadge`, `earlyBadge`, `onTimeBadge`,
`outstandingBadge`), top items card (`topItemsHeading`,
`topItemsSubtitle`, `topItemsEmpty`, `colItem`, `colOrderedQty`,
`colReceivedQty`), plus `mixedCurrencyCaveat`.

Deliberate **not** to reuse `t.reports.supplierPerformance` keys
even where copy overlaps (KPI labels). The detail page is an
operational view with its own heading hierarchy, empty states,
and action wording — keeping namespaces separate means future
copy tweaks to one surface don't accidentally ripple into the
other.

### Design decisions

- **Single server query with nested include** over a separate
  per-supplier aggregate table. Scale concerns land after
  "supplier with 5k historical POs", at which point we either
  paginate the recent table and keep the KPI roll-up over a time
  window, or add a nightly aggregate. Not worth the complexity
  at MVP — a typical org has <50 active suppliers and <200 POs
  per supplier.
- **In-memory KPI roll-up** over SQL aggregation. The math is
  trivial (one pass over the PO array), the rows are already in
  RAM for the table, and keeping the math in TypeScript means
  the supplier-performance report and this detail page can share
  the exact same formulas (copy-pasted comments even mark the
  parity) instead of maintaining two SQL variants.
- **`findFirst` with explicit `organizationId`** over `findUnique`
  by id alone. Defense-in-depth against a URL-parameter attack
  even though `requireActiveMembership` already gates the route.
- **No new `?supplierId=` prefill on `/purchase-orders/new`**.
  That's a nice follow-up, but it needs a PO-form refactor to
  accept a pre-selected supplier prop, and it's out of scope for
  a single-sprint ship. The current CTA lands the user on the
  generic new-PO page with an empty supplier select — one click
  away from the goal.
- **Deep-link from the list page's name column, not a separate
  "View" button**. Primary-action-is-the-name matches the items
  table, warehouses table, and categories table — app-wide
  consistency. The edit/delete actions stay in the actions
  column for destructive vs. navigation separation.
- **No cross-currency FX conversion**. The caveat banner names
  the region currency so the user knows what they're looking at;
  implementing historical FX is a big enough story to deserve
  its own ADR and probably a new `FxRateSnapshot` table. Same
  deferral as the Sprint 12 report.
- **Defense-in-depth `notFound()`** even though
  `requireActiveMembership` gates upstream. Two gates, both
  cheap, is the right default for a multi-tenant detail page.

### Files touched

- NEW `src/app/(app)/suppliers/[id]/page.tsx`
- MODIFIED `src/app/(app)/suppliers/page.tsx`
- MODIFIED `src/lib/i18n/messages/en.ts`

### Verified clean

- `tsc --noEmit` exit 0
- `biome check src` clean (177 files — one new vs Sprint 33's
  176: `suppliers/[id]/page.tsx`; `suppliers/page.tsx` +
  `en.ts` modified in place)
- `DATABASE_URL=... DIRECT_URL=... prisma validate` → green

### What this does NOT cover (follow-ups)

- `?supplierId=` prefill on `/purchase-orders/new` (so the New PO
  CTA from the detail page lands with the supplier already
  selected)
- Historical FX conversion for multi-currency suppliers (needs
  an `FxRateSnapshot` table + a rate source — shared with the
  Sprint 12 deferral)
- Pagination on the recent POs table (currently hard-capped at
  10; a "View all" ghost button links back to the filtered PO
  list, but the PO list doesn't yet filter by supplier via query
  param — Sprint 15 added supplier filter as a `<select>` but
  not `?supplierId=` support)
- Lead-time trend sparkline / 90-day rolling window (needs the
  same time-series foundation as the deferred Sprint 12
  historical supplier-performance follow-up)
- Contact-person drill-down (one supplier = one contact today;
  moving to many-contacts-per-supplier is a schema change)

---

## Sprint 33 — Email delivery for invitations + `?next=` post-login redirect (shipped 2026-04-11)

Goal: close the last gap between the Sprint 20 invite/accept flow
and a real-world onboarding story. Until this sprint the admin
literally had to copy a capability URL out of the success toast
and paste it into their own email/Slack/WhatsApp, and the
invitee, if they clicked that URL before signing in, saw the
invite page, then got redirected through `/login` without any
memory of where they were trying to go — so they had to dig the
original email back up after authenticating. Sprint 33 fixes both
halves in a single bundle because they share a cause (the invite
flow) and neither half is useful without the other.

### Mailer abstraction

NEW `src/lib/mail/` module (5 files, ~250 lines total). Deliberate
interface-and-adapters split instead of a direct Resend call from
`inviteMemberAction`:

- **`mailer.ts`** — defines `Mailer` interface with a single
  `send(message)` method, plus the `MailMessage` and `MailResult`
  types. `MailResult` is a discriminated union so callers can
  log the provider error shape uniformly.
- **`console-mailer.ts`** — `ConsoleMailer` class that logs to
  stdout and pretends to succeed. Used whenever `RESEND_API_KEY`
  is unset (local dev, CI smoke, tests that don't want network
  I/O). The text body is echoed to the terminal so a dev copying
  the invite link out of their console has something to work
  with.
- **`resend-mailer.ts`** — `ResendMailer` class backed by a
  direct `POST https://api.resend.com/emails` via Node's global
  `fetch`. We deliberately skip the official `resend` npm SDK:
  we speak one endpoint, Node 20+ has fetch globally, and every
  dep we skip is one fewer audit surface and one fewer
  upgrade-cadence gotcha. Any non-2xx is normalized to
  `{ ok: false, error: "Resend HTTP <status>: <body>" }` and
  network failures are caught the same way — the class never
  throws.
- **`index.ts`** — `getMailer()` factory. Reads `RESEND_API_KEY`
  and `MAIL_FROM` from `process.env`, picks `ResendMailer` when
  both are set and `ConsoleMailer` otherwise, memoizes the
  instance per-process. Also exports `resetMailerForTests()` so
  unit tests can swap implementations mid-run by mutating
  `process.env` and clearing the cache.
- **Why the adapter pattern.** Tests never reach the network
  (swap `ConsoleMailer`), local dev works without a Resend key
  (the admin still has the copyable link fallback), and if we
  outgrow Resend (bill, deliverability, regional compliance)
  swapping in Postmark/SES is a one-file change.

### Invitation email template

NEW `src/lib/mail/templates/invitation-email.ts`. Renders both
plain-text and HTML bodies from pre-resolved i18n labels:

- **Single function returns `{ subject, text, html }`.** The
  three artifacts are always built together, so a three-way
  split would just create three imports for every caller.
- **Template receives pre-resolved strings, not enums or locale
  codes.** The caller owns i18n resolution and passes a
  `labels: InvitationEmailLabels` bundle + a pre-constructed
  `Intl.DateTimeFormat`. This keeps the template locale-agnostic
  and lets tests snapshot the output with hardcoded labels.
- **HTML escaping centralized.** `escapeHtml()` handles the five
  entities that matter for text-node + attribute contexts. The
  organization name, inviter name, role label, and timestamp
  string all flow through it before interpolation. The invite
  URL is escaped for the `href` attribute and the visible
  fallback copy.
- **Table-based layout, inline styles.** Email clients in 2026
  still treat `<div>`-with-flexbox as hostile; tables render
  consistently from Gmail to Outlook.app to Apple Mail.
  Self-contained HTML: no external CSS, no webfonts, no remote
  images. Slate-900 primary button against a neutral
  `#f5f5f5` body background, no brand palette yet (brand
  tokens via `theme-factory` skill are tracked for a later
  sprint).
- **Preheader div** (display:none, max-height:0) carries a
  short description so Gmail's inbox preview shows something
  useful instead of the first line of the heading.
- **`applyPlaceholders` helper** does `{org}`, `{inviter}`,
  `{role}`, `{expires}`, `{url}` substitution in one pass.

### `inviteMemberAction` rewrite

Modified `src/app/(app)/users/actions.ts`:

- **Result shape adds `emailDelivered: boolean`.** The invite
  row is created first (as before). If creation fails, the
  action still returns `{ ok: false, error }` — email delivery
  never gets a chance to run. If creation succeeds, we call
  the new `sendInvitationEmailSafely()` helper and record its
  boolean result in the response.
- **`sendInvitationEmailSafely()` is a sibling private function.**
  Kept out of the main action body so the happy path stays
  readable, and so tests can stub it without touching the
  action envelope. It resolves `getMessages()` + `getRegion()`
  to build the i18n labels and `Intl.DateTimeFormat`, renders
  the template, calls `getMailer().send(...)`, and logs any
  failure via `console.warn` before returning `false`. It
  **never throws** — the outer `try { … } catch (err)` catches
  any unexpected exception and returns `false` so the admin
  still gets the copyable fallback link.
- **Soft-miss philosophy.** A failed email delivery is not a
  failed action. The row is live, the URL is in the response,
  the UI has a variant that says "email not delivered — copy
  the link below". A DNS blip should not block team
  onboarding.

### `InviteForm` success variants

Modified `src/app/(app)/users/invite-form.tsx`:

- `InviteFormLabels` split the old `success` key into two:
  `successEmailSent` (happy path — "Invitation sent, you can
  also copy the link as a backup") and `successLinkOnly`
  (fallback — "Copy the link and send it through your own
  channel").
- `InviteCreated` state adds `emailDelivered: boolean`, sourced
  from the server action result.
- Success banner picks the right label at render time.
- The copyable URL is ALWAYS shown — even on the happy path —
  because (a) if the email vanishes into spam the admin still
  has a fallback, and (b) the admin might need to reshare the
  link weeks later.

### `isSafeRedirect` + `resolveSafeRedirect`

NEW `src/lib/redirects.ts`. Validates a candidate redirect
target string and returns the fallback on anything unsafe.
Rules:

- Must be a non-empty string ≤ 512 chars
- Must start with `/` but NOT `//` (protocol-relative URL)
- Must not contain `\` (some browser URL parsers treat it as
  a host separator)
- Must not contain `@` (userinfo injection like
  `/@evil.example`)
- Must not contain control characters (below 0x20 or 0x7F)

We deliberately do NOT try to parse-and-reparse the value as
a URL. An allowlist of character classes is strict and
predictable, and staying synchronous means the helper runs
fine in any `"use client"` component. The test strategy is a
tight matrix of positive and negative cases — every branch of
the rule list.

### Login form wiring

Modified `src/app/(auth)/login/login-form.tsx`:

- Reads `?next=` primarily, falls back to `?redirect=` for
  the pre-Sprint-33 callers.
- Both values flow through `resolveSafeRedirect(value, "/dashboard")`
  so a `?next=https://evil.example` is silently downgraded
  to `/dashboard` instead of executing a post-auth open
  redirect (classic credential-phishing pivot).
- The `callbackURL` sent to Better Auth is the already-validated
  path, not the raw query string.

### Register form + invitee variant

Modified `src/app/(auth)/register/register-form.tsx`:

- Same `?next=` / fallback `?redirect=` resolver as login.
- **New `isInviteFlow` derivation** — `redirectTo.startsWith("/invite/")`.
  When true, the register form:
  - **Hides the organization name input entirely** and shows
    a muted `role="note"` explainer ("You're signing up to
    accept a team invitation…").
  - **Skips the `/api/onboarding/organization` POST** after
    `signUp.email()` returns. Invitees are joining an
    existing org, so creating a new one is both wrong and
    confusing (they'd end up with two tenants).
  - **Still redirects to the same `redirectTo`** post-signup —
    the invite page, now authenticated, will detect the
    matching email and surface the accept button.
- **New i18n key `t.auth.register.inviteeNotice`** for the
  notice block. Wired through `register/page.tsx` label prop.

### Invite page CTA wiring

Modified `src/app/(auth)/invite/[token]/page.tsx`:

- The "Sign in" and "Create account" buttons on the
  unauthenticated-visitor variant now pass
  `?next=/invite/${encodeURIComponent(token)}`. Token is
  URL-encoded defensively even though `base64url` is
  URL-safe by spec, because the path segment still needs
  consistent encoding if a future invite format uses different
  characters.
- No other changes to the page — the wrong-email and accepted
  variants don't need a next-redirect because the user is
  already authenticated.

### i18n additions

Modified `src/lib/i18n/messages/en.ts`:

- **`t.users.invite.success` split** into `successEmailSent`
  and `successLinkOnly`. Callers in `users/page.tsx` updated.
- **`t.auth.register.inviteeNotice`** — new key for the
  "joining an org instead of creating one" notice.
- **NEW `t.mail.invitation` namespace** with 11 keys:
  `subject` (with `{inviter}`, `{org}`, `{role}` placeholders),
  `preheader`, `heading` (`{org}`), `bodyIntro`
  (`{inviter}`, `{org}`, `{role}`), `orgLabel`, `inviterLabel`,
  `roleLabel`, `cta`, `expiryNotice` (`{expires}`),
  `fallbackLabel`, `footer`. The `Messages` type derives from
  `typeof en`, so the new namespace propagates without a
  separate type declaration.

### Design decisions

- **Adapter over direct Resend call.** Tests, dev, future
  provider swap. One file of interface + two impls + one
  factory is worth the indirection.
- **No `resend` SDK.** Direct fetch to one endpoint. Node 20+
  has fetch globally. Fewer deps, narrower supply-chain
  surface, immune to SDK minor-version drift.
- **Soft-miss on delivery failure.** Create the row, attempt
  the email, surface either outcome. Don't block the admin
  on a provider blip.
- **HTML + plain text both required.** Screen readers and
  plain-text clients exist; Gmail shows plain text in some
  contexts. A missing text body would be a deliverability and
  accessibility regression.
- **Preheader in a hidden div.** Gmail's inbox preview shows
  the first visible text; the preheader is invisible to
  sighted users in the email body but shows up as preview in
  the list — makes the difference between "You're invited to
  join…" and "#DOCTYPE HTML" in the inbox row.
- **`?next=` query param name.** Matches the user memory
  directive and is the Rails / Django convention. `?redirect=`
  is still accepted as a fallback so pre-Sprint-33 links in
  user history keep working.
- **`isSafeRedirect` is strict, synchronous, allowlist-based.**
  An open-redirect at the login boundary is a credential
  phishing primer. Strict character-class validation is
  simple to reason about and impossible to bypass with
  creative encoding.
- **Invitee register skips org creation.** Creating a new
  org for an invitee then dropping them onto the invite page
  would leave the invitee owning an empty org forever after
  accepting. Detecting `/invite/` prefix at render time and
  hiding the org-name input is the cheapest correct answer.
- **Copyable URL always visible post-invite.** Even on the
  happy path. Spam filters exist; invitees change phones;
  the admin might want to reshare the link days later.
  Showing the link is strictly additive, never competes
  with email delivery.
- **No template engine (Handlebars, MJML, react-email).** A
  single template with `{placeholder}` substitution is
  strictly cheaper and easier to audit. If we grow to 10+
  templates we can revisit.

### Files touched

- NEW `src/lib/redirects.ts` — safe-redirect validator
- NEW `src/lib/mail/mailer.ts` — Mailer interface + types
- NEW `src/lib/mail/console-mailer.ts` — dev/test mailer
- NEW `src/lib/mail/resend-mailer.ts` — prod mailer (direct fetch)
- NEW `src/lib/mail/index.ts` — factory + barrel
- NEW `src/lib/mail/templates/invitation-email.ts` — template builder
- Modified `src/app/(app)/users/actions.ts` — wires mailer into
  `inviteMemberAction`, adds `sendInvitationEmailSafely` helper,
  extends `InviteMemberResult` with `emailDelivered`
- Modified `src/app/(app)/users/invite-form.tsx` — splits
  success label, tracks `emailDelivered` in state
- Modified `src/app/(app)/users/page.tsx` — wires new label keys
- Modified `src/app/(auth)/login/login-form.tsx` — `?next=`
  param + `resolveSafeRedirect`
- Modified `src/app/(auth)/register/register-form.tsx` —
  `?next=` param, `isInviteFlow` derivation, skip org
  creation for invitees, inviteeNotice label
- Modified `src/app/(auth)/register/page.tsx` — wires
  `inviteeNotice` label prop
- Modified `src/app/(auth)/invite/[token]/page.tsx` — passes
  `?next=/invite/{token}` on sign-in + create-account CTAs
- Modified `src/lib/i18n/messages/en.ts` — split invite
  success labels, add `inviteeNotice`, add `t.mail.invitation`
  namespace (11 keys)
- **No schema changes, no Prisma migration, no new runtime
  dependencies.** Resend is reached via bare fetch.

### Verified clean

- `tsc --noEmit` exit 0
- `biome check src` clean (176 files — six new vs Sprint 32's
  170: `redirects.ts`, `mail/mailer.ts`, `mail/console-mailer.ts`,
  `mail/resend-mailer.ts`, `mail/index.ts`,
  `mail/templates/invitation-email.ts`)
- `DATABASE_URL=... DIRECT_URL=... prisma validate` → green

### Env contract

New environment variables (both optional — absence falls back
to `ConsoleMailer`):

- `RESEND_API_KEY` — API key from resend.com dashboard
- `MAIL_FROM` — verified sender address (e.g.
  `"OneAce <invites@mail.oneace.app>"`). Must be verified in
  Resend or the API will 403.

Absence of either variable puts the mailer in console mode
with no crash — the invite UI degrades gracefully to the
"copy the link" path. Startup is never blocked on mail config.

### What this does NOT cover

- **No notification email for other events.** Organization
  delete, ownership transfer (Sprint 32), member role change,
  and failed stock-count audits all still happen silently.
  The mailer abstraction is in place so adding each new
  email is a two-file change (template + caller wiring),
  but the Sprint 33 scope was strictly the invitation flow.
- **No email preview page in-app.** Admins can't see what
  the email looks like before sending. A later sprint could
  add a dev-only preview route that renders the template
  with canned data.
- **No attachment support.** `MailMessage` is subject + text
  + html. If we ever need receipt PDFs or export zips, the
  interface will need a fourth field.
- **No per-recipient locale detection.** The email is built
  with the sender's current i18n context (the admin's
  `getMessages()` bundle), not the invitee's preferred
  language — which we don't know yet because they haven't
  signed up. A later `Invitation.locale` column could carry
  an explicit hint from the sender.
- **No rate limiting.** A hostile OWNER spamming invites
  would burn through the Resend quota. Sprint 33 relies on
  Resend's own per-domain rate limits; a per-org quota is
  deferred.
- **No bounce/complaint handling.** Resend webhooks for
  bounced or complained deliveries are ignored. A later
  sprint can wire `/api/webhooks/resend` to flag the
  `Invitation` row and surface the status on the pending-
  invitations table.

---

## Sprint 32 — Organization ownership transfer (shipped 2026-04-11)

Goal: close the multi-tenancy story. Sprint 11 shipped the org
switcher (pick which tenant to act in). Sprint 21 shipped org
delete (permanently destroy a tenant). The missing leg was
ownership hand-off — until this sprint, the only way an OWNER
could transfer the role was to manually promote a teammate to
OWNER via the users-table role dropdown and then manually demote
themselves, leaving the org in a two-OWNER intermediate state
that no audit log or export would represent honestly. Sprint 32
ships a dedicated **atomic** transfer flow.

### Server action: `transferOrganizationAction(targetMembershipId, confirmation)`

Lives in `src/app/(app)/settings/actions.ts`. Envelope:

- **OWNER only.** ADMIN cannot initiate, even though ADMIN can
  already set other members' roles via `updateMemberRoleAction`.
  Handing over the org-delete capability is a tighter scope.
- **Active-org is the only anchor.** Like `deleteOrganizationAction`
  (Sprint 21), this action never takes an `organizationId`
  parameter. Every lookup is pinned to
  `membership.organizationId` from `requireActiveMembership`.
  A crafted form cannot trick an OWNER into reassigning a
  different tenant they happen to own.
- **Self-target block.** `targetMembershipId === membership.id`
  short-circuits with `reason: "selfTarget"`. Without this the
  atomic transaction would be a no-op on target and a demotion
  on caller — surface the intent explicitly instead.
- **Typed-confirmation guard.** The caller must echo back the
  org's slug verbatim, same UX fat-finger protection the
  danger-zone card uses. Slug is used (not display name) because
  it has no spaces or diacritics, which makes it clean on phones.
- **Target must exist and be in the same org.** Defensive
  `findUnique` + `organizationId` check. A stale id from a
  member who was removed between render and submit returns
  `reason: "notFound"`.
- **Atomic `db.$transaction([…])`.** Target's role → OWNER and
  caller's role → ADMIN in one tx. There is no request-visible
  window where the org has zero OWNERS (bad — would brick
  delete) or where two requests could race the demotion of the
  only OWNER. If target was already OWNER (a step-down scenario
  where multiple OWNERs already existed and the caller is
  stepping back), the target `update` is effectively a no-op
  and the caller demote still lands cleanly — no special case
  needed.
- **Caller stays in the org as ADMIN.** Deliberately NOT
  demoting the caller all the way to MEMBER — most hand-offs
  (e.g. a founder handing to a new CEO) want the previous
  OWNER to retain operational access. A later "leave
  organization" flow can cover the clean-exit path.
- **Cookie untouched.** `ACTIVE_ORG_COOKIE` still points at the
  same org — the caller is still a member, just as ADMIN now.
  `requireActiveMembership` picks up the new role on the next
  navigation because the `cache()` wrapper is invalidated by
  `revalidatePath("/", "layout")`.
- **Revalidates both `/settings` and `/users`.** The transfer
  card unmounts from the caller's settings (they're no longer
  OWNER), and the members table on `/users` refreshes its role
  badges immediately. Layout revalidate ensures any future
  OWNER-gated header chip or sidebar item picks up the new role
  on the next click.
- **Return shape** `{ ok: true; targetName: string } | { ok:
  false; error; reason }`. Five reasons: `forbidden`,
  `selfTarget`, `notFound`, `mismatch`, `transferFailed`.
  `targetName` lets the client show a toast without a second
  lookup.

### UI: `TransferOwnershipCard`

NEW `src/app/(app)/settings/transfer-ownership-card.tsx`
(~240 lines). Sits on the settings page ABOVE the danger zone,
OWNER-only gate. Visual language is "advisory destructive" —
`KeyRound` icon instead of `AlertTriangle`, amber outline
instead of destructive red — because unlike delete-org, transfer
does not destroy data, but it is still irreversible without the
new owner's help. Layout mirrors `DangerZoneCard` so an OWNER
familiar with the delete flow reads the transfer flow
immediately.

- **Member picker** via `Select` from `@/components/ui/select`.
  Server-side filtered to exclude the caller
  (`NOT: { userId: session.user.id }`) so the list only shows
  viable candidates. Each row renders the display name (or
  email fallback) with a secondary `email · roleLabel` line so
  two "Alex" teammates remain distinguishable.
- **No-candidates path.** If the caller is the only member of
  the org, the card shows a muted explainer ("Invite a teammate
  before transferring ownership") instead of rendering a dead
  dropdown. The button is not rendered.
- **Confirmation `AlertDialog`.** Title + body (with
  `{name}` / `{org}` interpolation) + slug-echo input. Dialog
  body is reset to an empty slug on close so reopening starts
  fresh and a stale mismatch error never lingers.
- **Button is disabled** until a target is selected and the
  slug matches exactly. `isPending` locks all controls during
  the server action round-trip.
- **`<output aria-live="polite">` success announcement.**
  Screen readers hear "Ownership transferred to Alice. You are
  now an Admin." before `router.refresh()` re-renders the
  server tree and drops the card entirely (the caller is no
  longer OWNER).
- **Destructive variant not used on the CTA.** Amber outline
  matches the "advisory" framing — destructive red is reserved
  for delete-org which actually destroys data.

### Settings page wiring

`src/app/(app)/settings/page.tsx` now:

- Computes `canTransferOwnership = membership.role === "OWNER"`.
- Loads `transferCandidates` only when the gate passes — a
  single `membership.findMany` with `NOT: { userId }` filter,
  `include: user`, `orderBy: createdAt asc`, mapped to
  `TransferCandidate { id, name, email, roleLabel }`. The
  non-OWNER branch short-circuits to an empty array and skips
  the DB round-trip entirely.
- Renders `<TransferOwnershipCard>` above the existing
  `<DangerZoneCard>` so the less destructive operation is
  visually adjacent but distinct, and reading the page top to
  bottom takes the OWNER through their escalation path: edit
  profile → org defaults → hand over the keys → burn it down.

### i18n (added under `t.settings.transferOwnership`)

NEW namespace with 13 top-level keys + a 4-entry `consequences`
tuple + a 5-entry `errors` sub-block. All copy routes through
`src/lib/i18n/messages/en.ts` (no Turkish anywhere — same rule
every sprint has honoured). Placeholder conventions match the
danger-zone card so translators working on a single locale
file have identical contracts across both flows: `{slug}`,
`{name}`, `{org}`.

Keys:
- `heading`, `description`, `targetLabel`, `targetPlaceholder`,
  `noCandidates`, `consequences` (readonly tuple of 4),
  `confirmBody` (with `{name}` + `{org}`), `confirmInputLabel`
  (with `{slug}`), `confirmInputPlaceholder`, `confirmMismatch`,
  `transferCta`, `transferring`, `success` (with `{name}`),
  `errors.{forbidden, selfTarget, notFound, mismatch,
  transferFailed}`

### Design decisions

- **Dedicated action over `updateMemberRoleAction` reuse.**
  Promoting a member to OWNER is already possible via the
  users-table role dropdown (Sprint 7, reinforced in Sprint 20).
  We could have documented a two-step "promote then self-demote"
  workflow. But that leaves an intermediate two-OWNER state
  visible to any concurrent request, every audit log or CSV
  export, and the future billing-per-seat counter. An atomic
  single-click transfer is the honest shape.
- **OWNER gate, not ADMIN.** Mirrors delete-org. ADMIN can
  manage members via the existing role dropdown; OWNER is the
  single-point-of-authority for "who controls the org itself".
- **Slug-echo not name-echo.** Display names have spaces,
  diacritics, and case-sensitivity quirks on phones. Slugs are
  `[a-z0-9-]` by the slugify rule and identical across
  devices, so the typed confirmation is robust.
- **Caller demotes to ADMIN, not MEMBER.** ADMIN retains
  invite-management and org-profile editing. A founder handing
  over the OWNER role usually still wants to run day-to-day
  operations — the clean "leave the org entirely" flow is a
  separate story.
- **Select disabled when `isPending`.** Otherwise a user could
  change the target mid-transaction and cause the success
  toast to name the wrong person. Locking the whole card
  during the tx is the simplest correct answer.
- **Amber outline, not destructive.** The action is reversible
  (the new OWNER can promote you back) — just not by you
  alone. Visual language should reflect that asymmetry rather
  than triggering the same danger instinct as delete-org.
- **Live region inside the card, not a global toast.** The
  card unmounts as part of the post-transfer re-render, so a
  toast library tied to a component-level state would be
  announced then immediately torn down. Using the
  `<output aria-live="polite">` pattern the rest of the PWA
  surfaces already ship means the screen reader gets the
  announcement before `router.refresh()` completes.

### Files touched

- Modified `src/app/(app)/settings/actions.ts` — adds
  `TransferOrganizationResult` type and
  `transferOrganizationAction` (~160 lines of new code,
  including the full doc comment).
- NEW `src/app/(app)/settings/transfer-ownership-card.tsx`
  (~240 lines). Exports `TransferOwnershipCard`,
  `TransferOwnershipLabels`, `TransferCandidate`.
- Modified `src/app/(app)/settings/page.tsx` — imports the
  new card + type, adds `canTransferOwnership` gate,
  `transferCandidates` loader, and renders the card above
  the danger zone with full label wiring.
- Modified `src/lib/i18n/messages/en.ts` — adds
  `t.settings.transferOwnership` namespace (13 + 4 + 5 keys).
- **No schema changes, no Prisma migration, no new runtime
  dependencies.**

### Verified clean

- `tsc --noEmit` exit 0
- `biome check src` clean (170 files — one new vs Sprint 31's
  169: `transfer-ownership-card.tsx`)
- `DATABASE_URL=... DIRECT_URL=... prisma validate` → green

### What this does NOT cover

- **No "leave organization" flow** for former OWNERs who want
  to exit completely. The caller is demoted to ADMIN and
  stays in the org. A clean self-removal flow is still in
  the deferred list.
- **No notification to the new OWNER.** Email delivery for
  org events is blocked on the same SMTP decision that gates
  Sprint-20 invitation emails. For now the previous OWNER has
  to tell the new one out-of-band that they've been handed
  the keys.
- **No audit log entry.** The generic audit-log story is
  still deferred; when it lands, transfer events will be one
  of the first event types to emit.
- **No transferring across orgs.** Transfer is strictly
  within-tenant. Moving data between orgs is a separate
  story (probably never).

---

## Sprint 31 — PWA Sprint 8: Dexie live-query + Web Locks cross-tab guard (shipped 2026-04-11)

Goal: two long-standing TODOs from the PWA backlog both land
together because they share the same "who owns the write" story.

1. **Dexie live-query subscription** — replace the 3-second poll
   that the offline queue banner (Sprint 25) and the offline queue
   review screen (Sprint 30) used with a real `Dexie.liveQuery()`
   Observable. A write that lands in `pendingOps` (from the
   runner, from this tab, or — via Dexie's BroadcastChannel
   transport — from another tab on the same origin) now re-fires
   every subscribed component in the same tick. No more "click
   Retry, wait 3 seconds, see the row move". No more
   `refresh()`-in-finally dance the Sprint 30 action handlers had
   to run. The 3-second `setInterval` / `setTimeout` polling
   pattern is completely gone from these two surfaces.
2. **Web Locks cross-tab drain guard** — wrap the queue runner's
   `drain()` function in a new `withQueueDrainLock` helper that
   uses `navigator.locks.request(..., { ifAvailable: true }, …)`.
   Two tabs on the same origin still both receive the trigger
   events (`online`, `visibilitychange`, Background Sync relay) —
   but only one of them acquires the `oneace-queue-drain` lock
   and actually scans `pendingOps`. The others bail immediately
   with `{ acquired: false }`. Correctness was already guaranteed
   by Dexie row claiming (`markOpInFlight`'s transactional
   `pending → in_flight` transition); this sprint is a cost
   optimization that makes that guarantee explicit.

### Design decisions

- **Custom `useLiveQuery` hook, not `dexie-react-hooks`.**
  The useful bit of the official package is ~20 lines of
  `useState + useEffect + liveQuery().subscribe()`. Inlining it
  saves a runtime dep, a version to track, and a ~4 KB chunk in
  the offline bundle. The hook lives at
  `src/lib/offline/use-live-query.ts` and mirrors the `useEffect`
  shape (caller-provided dep array) every React developer already
  understands.
- **Caller-provided deps with a single-line biome suppression.**
  The hook deliberately doesn't include `querier` in its effect's
  dep array — a fresh closure every render would tear down and
  re-open the subscription on every parent re-render. Biome's
  `useExhaustiveDependencies` correctly flags this pattern, so
  the hook carries one `biome-ignore` line above the `useEffect`
  explaining the contract. Callers pass the stable scope values
  they'd otherwise pass to a `useEffect` themselves.
- **`ifAvailable: true`, not blocking.** The default Web Locks
  mode is exclusive-blocking: a busy lock queues behind the
  current holder. That's wrong for this workload — the second
  tab should bail, not sit on a promise waiting for the first
  tab's drain to finish (which may take seconds if the queue is
  long). `ifAvailable: true` hands us `null` immediately when
  the lock is busy, and the losing tab's trigger was already
  processed by the winner.
- **Feature detection with no-op fallback.** Web Locks ships in
  Chrome 69+, Edge 79+, Firefox 96+, Safari 15.4+, which covers
  every browser in our target matrix. Still, `getLockManager()`
  in `queue-lock.ts` returns `null` when `navigator.locks` is
  missing or when `locks.request` is not a function (Safari in
  private mode has historically gated this behind a permission
  prompt). A `null` lock manager means `withQueueDrainLock`
  runs the callback inline with `acquired: true` — **exactly**
  how the pre-Sprint-31 runner behaved, which shipped reliably
  for weeks. Zero regression surface.
- **Dedicated lock name, no sharing.** `"oneace-queue-drain"`
  is opaque and not used for anything else. Contention is
  visible in DevTools' Application panel without a legend.
- **Banner `pollIntervalMs` prop kept as a dead knob.** The
  `OfflineQueueBanner` Sprint 25 interface accepted an optional
  `pollIntervalMs` so storybook could override the 3-second
  default. Sprint 31 replaces the poll but keeps the prop so
  any older caller still compiles; the value is simply ignored.
  A follow-up cleanup sprint can remove it once no callers are
  found.
- **`EMPTY_BUCKETS` / `EMPTY_COUNTS` module-level constants.**
  `useLiveQuery`'s `initialValue` must be stable across renders
  or React warns about derived-state identity churn. Inlining
  `{ pending: [], inFlight: [], failed: [] }` would create a
  fresh reference on every render, so both the banner and the
  queue-view pin a frozen module-level constant and fall back
  to it again inside the render (`?? EMPTY_BUCKETS`) to keep
  the downstream `.length` reads ergonomic.
- **Only the `pendingOps` table is subscribed.** The other
  offline views (`offline-items-view`, `offline-stockcounts-view`)
  already rely on cache-on-detail-visit writes, not live
  updates; they don't poll and didn't need migration. Sprint 31
  is surgically scoped to the two surfaces that actually had a
  polling footprint.

### Files touched

- NEW `src/lib/offline/use-live-query.ts` (~100 lines).
  Exports `useLiveQuery<T>(querier, deps, initialValue?)`.
- NEW `src/lib/offline/queue-lock.ts` (~135 lines).
  Exports `withQueueDrainLock` + `isWebLocksSupported`.
  Self-contained feature detection via internal
  `getLockManager()` helper.
- Modified `src/components/offline/offline-queue-runner.tsx` —
  adds one import (`withQueueDrainLock`), wraps the entire
  `drain()` body in `await withQueueDrainLock(async () => { … })`,
  expands the header comment block to document the Sprint 31
  cross-tab guard story.
- Modified `src/components/offline/offline-queue-view.tsx` —
  removes the `refresh` callback + `setInterval` + three
  `useState` arrays, replaces with one `useLiveQuery` call
  returning `QueueRowBuckets`, drops the `refresh()` calls
  from all three action handlers' `finally` blocks.
  `EMPTY_BUCKETS` module-level constant pinned.
- Modified `src/components/offline/offline-queue-banner.tsx` —
  removes the refresh callback + `setInterval`, replaces with
  `useLiveQuery` returning `QueueCounts`. `useEffect` still
  subscribes to `window` `online`/`offline` events for the
  amber-vs-muted styling decision. `EMPTY_COUNTS` constant
  pinned. `pollIntervalMs` prop kept as a dead knob for
  back-compat with older callers.
- **No i18n changes** — Sprint 31 is pure plumbing.
- **No schema changes, no Prisma migration, no Dexie version
  bump, no new runtime dependencies.**

### Verified clean

- `tsc --noEmit` exit 0
- `biome check src` clean (169 files — two new vs Sprint 30's
  167: `use-live-query.ts` + `queue-lock.ts`)
- `DATABASE_URL=... DIRECT_URL=... prisma validate` → green

### What this does NOT cover

- **Not a live update for `/offline/items` or
  `/offline/stock-counts`.** Those surfaces read cached catalog
  data that's only ever written on detail-page visits, so a
  live query wouldn't fire more often than a navigate anyway.
  Deferred indefinitely unless a user need appears.
- **Not a real toast library.** The queue-view still uses a
  single `<output aria-live="polite">` ephemeral status row and
  `window.confirm` for destructive actions. A proper toast
  library + a custom confirm modal are tracked under the PWA
  Sprint 9+ backlog.
- **No user-visible "cross-tab guard active" indicator.** The
  `isWebLocksSupported` helper is exported but not consumed
  yet. Surfacing it would be a UX decision that deserves its
  own sprint.

---

### Still to port (deferred post-Sprint-22)

- [x] PWA Sprint 2 — offline-ready item catalog (IndexedDB read
      cache + Dexie wrapper). Shipped as Sprint 23 (see below).
- [x] PWA Sprint 3 — picklist caches for warehouses +
      categories, plus a static `/offline/items` route served
      directly from Dexie. Shipped as Sprint 24 (see above).
- [x] PWA Sprint 4 — offline stock counts (write queue, replay
      on reconnect, optimistic-UI markers). **Part A shipped as
      Sprint 25** (queue substrate, runner, banner — no op
      wired). **Part B shipped as Sprint 26** (first concrete
      op: movement create, with idempotency-key server contract
      + try-direct-then-enqueue form flow). **Follow-on shipped
      as Sprint 27** (second op: count entry add — the
      stock-count multi-row scan workflow, the Flutter moat, now
      drops into the queue on transport failure).
- [x] PWA Sprint 5 — background sync + update-prompt UX
      (surface the "new version available" state, wire the
      parked `beforeinstallprompt` to a first-party Install
      button). **Shipped as Sprint 28** — see below.
- [x] PWA Sprint 6 — offline stock-counts viewer
      (cache-on-detail-visit for stock counts, with a
      `/offline/stock-counts` list + detail view served from
      Dexie while offline). **Shipped as Sprint 29** — see
      below.
- [x] PWA Sprint 7 — failed-ops review UI at `/offline/queue`
      (retry, discard, bulk-clear for queue rows that the
      runner couldn't dispatch; banner failed count becomes
      a clickable review link). **Shipped as Sprint 30** —
      see below.
- [x] PWA Sprint 8 — Dexie live-query subscription in the
      queue banner and review screen (replaces the 3-second
      poll with an Observable that re-fires on every
      `pendingOps` write from any tab) + Web Locks cross-tab
      drain guard in the runner (`ifAvailable: true` so a
      second tab bails instead of scanning the table in
      parallel). **Shipped as Sprint 31** — see below.
- [x] Organization transfer (change OWNER to another member)
      — still the missing third leg of the multi-tenancy story
      after Sprint 11 (switcher) and Sprint 21 (delete).
      **Shipped as Sprint 32** — see below.
- [ ] Audit log
- [x] Email delivery for invitations (MVP: admin copies link)
      **Shipped as Sprint 33** — see below.
- [x] `?next=/invite/[token]` redirect after sign-in so users
      don't have to revisit the URL manually
      **Shipped as Sprint 33** — see below.
- [ ] Reports xlsx/pdf export variants (CSV only today)
- [ ] Full-text ranking via Postgres `tsvector` (current
      `contains` scan is fine to ~10k items per org;
      migrate at 100k)

---

## Parked Until Later

- `ScannerView` → **Sprint 8 (shipped 2026-04-11)**
- `StockCountView` + `StockCountSession` → Sprint 5 (Moat 2, with the Dexie layer)
- `ReportsView` → **Sprint 6 (shipped 2026-04-11)**
- `SettingsView` (org + locale / region picker) → **Sprint 7 (shipped 2026-04-11)**
- Billing & plan upgrades → Sprint 9+

---

## Porting Principles

1. **If a component does not need `"use client"`, port it as an RSC.** Forms, modals, scanner → client. Lists, detail pages, layouts → server.
2. **Data fetching always happens in a Server Component.** Call `db.item.findMany()` directly instead of `fetch()` to internal routes.
3. **Anything with `onClick` or `useEffect` is `"use client"`.** No exceptions.
4. **Form state → `react-hook-form` + `zodResolver`.** Server Actions under `app/(app)/.../actions.ts` are also fine (decide in Sprint 2).
5. **Multi-tenant guard: always include `organizationId` in queries.** Use the return of `requireActiveMembership()`.
6. **Never put business data in `localStorage`.** Only UI preferences (theme, collapsed sidebar). Business data → Dexie (offline) or DB.
7. **Never hardcode user-facing copy.** Every new string goes into `src/lib/i18n/messages/en.ts` and is consumed via `getMessages()` (server) or labels passed as props to client components.
