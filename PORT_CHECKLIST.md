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
- [ ] Per-supplier drill-down page showing the underlying POs ranked
      by value and lead-time outlier
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
