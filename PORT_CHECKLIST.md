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

## Parked Until Later

- `ScannerView` → Sprint 3 (Moat 1)
- `StockCountView` + `StockCountSession` → Sprint 5 (Moat 2, with the Dexie layer)
- `ReportsView` → Sprint 7
- `SettingsView` (org + billing + locale / region picker) → Sprint 8–9

---

## Porting Principles

1. **If a component does not need `"use client"`, port it as an RSC.** Forms, modals, scanner → client. Lists, detail pages, layouts → server.
2. **Data fetching always happens in a Server Component.** Call `db.item.findMany()` directly instead of `fetch()` to internal routes.
3. **Anything with `onClick` or `useEffect` is `"use client"`.** No exceptions.
4. **Form state → `react-hook-form` + `zodResolver`.** Server Actions under `app/(app)/.../actions.ts` are also fine (decide in Sprint 2).
5. **Multi-tenant guard: always include `organizationId` in queries.** Use the return of `requireActiveMembership()`.
6. **Never put business data in `localStorage`.** Only UI preferences (theme, collapsed sidebar). Business data → Dexie (offline) or DB.
7. **Never hardcode user-facing copy.** Every new string goes into `src/lib/i18n/messages/en.ts` and is consumed via `getMessages()` (server) or labels passed as props to client components.
