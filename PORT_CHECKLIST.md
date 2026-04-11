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
- [ ] PWA Sprint 5 — background sync + update-prompt UX
      (surface the "new version available" state, wire the
      parked `beforeinstallprompt` to a first-party Install
      button).
- [ ] Audit log
- [ ] Email delivery for invitations (MVP: admin copies link)
- [ ] `?next=/invite/[token]` redirect after sign-in so users
      don't have to revisit the URL manually
- [ ] Organization transfer (change OWNER to another member)
      — still the missing third leg of the multi-tenancy story
      after Sprint 11 (switcher) and Sprint 21 (delete)
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
