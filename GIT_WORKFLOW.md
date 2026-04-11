# Git Workflow — OneAce Next.js Port

This document is the exact runbook for getting the `oneace-next/` scaffold onto
GitHub as a long-lived `next-port` branch, opening a draft PR against `main`,
and iterating on it through Sprint 0 → Sprint 24.

> **Why this lives in a markdown file and not a git commit:** the port was
> scaffolded inside a sandboxed environment that cannot finalize `git` writes.
> Run the commands below **from your local machine** where your SSH key, GPG
> signing, and GitHub identity already work.

---

## 0. Fast path — use the pre-built bundle (RECOMMENDED, updated 2026-04-11)

Sprint 0 through Sprint 23 plus **Sprint 24** are already committed in a
portable git bundle at:

```
oneace-next/oneace-next-port-v0.24.0-sprint24.bundle
```

This bundle contains:

- **56 commits** — 8 Sprint 0 + 1 docs + Sprints 1..24 (each = 1 feature
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
  - `v0.17.0-sprint17` — Sprint 17 complete (movements warehouse-scope filter)
  - `v0.18.0-sprint18` — Sprint 18 complete (movements item-substring filter)
  - `v0.19.0-sprint19` — Sprint 19 complete (per-org default locale + region override)
  - `v0.20.0-sprint20` — Sprint 20 complete (invitation tokens + accept flow)
  - `v0.21.0-sprint21` — Sprint 21 complete (organization delete / danger zone)
  - `v0.22.0-sprint22` — Sprint 22 complete (PWA foundation — manifest + service worker)
  - `v0.23.0-sprint23` — Sprint 23 complete (PWA Sprint 2 — items read cache via Dexie)
  - `v0.24.0-sprint24` — Sprint 24 complete (PWA Sprint 3 — picklist caches + static /offline/items)

Older bundles (`oneace-next-port.bundle`,
`oneace-next-port-v0.1.0-sprint1.bundle` ... `oneace-next-port-v0.24.0-sprint24.bundle`)
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
git fetch /path/to/SimplyCount/oneace-next/oneace-next-port-v0.24.0-sprint24.bundle \
          next-port:next-port

# Also pull all twenty-three sprint tags
git fetch /path/to/SimplyCount/oneace-next/oneace-next-port-v0.24.0-sprint24.bundle \
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
          refs/tags/v0.16.0-sprint16:refs/tags/v0.16.0-sprint16 \
          refs/tags/v0.17.0-sprint17:refs/tags/v0.17.0-sprint17 \
          refs/tags/v0.18.0-sprint18:refs/tags/v0.18.0-sprint18 \
          refs/tags/v0.19.0-sprint19:refs/tags/v0.19.0-sprint19 \
          refs/tags/v0.20.0-sprint20:refs/tags/v0.20.0-sprint20 \
          refs/tags/v0.21.0-sprint21:refs/tags/v0.21.0-sprint21 \
          refs/tags/v0.22.0-sprint22:refs/tags/v0.22.0-sprint22 \
          refs/tags/v0.23.0-sprint23:refs/tags/v0.23.0-sprint23 \
          refs/tags/v0.24.0-sprint24:refs/tags/v0.24.0-sprint24

# Verify
git log --oneline next-port                # should show 56 commits
git tag -l                                 # should include all twenty-four sprint tags

# Push to GitHub
git push -u origin next-port
git push origin v0.1.0-sprint1 v0.2.0-sprint2 v0.3.0-sprint3 v0.4.0-sprint4 \
               v0.5.0-sprint5 v0.6.0-sprint6 v0.7.0-sprint7 v0.8.0-sprint8 \
               v0.9.0-sprint9 v0.10.0-sprint10 v0.11.0-sprint11 v0.12.0-sprint12 \
               v0.13.0-sprint13 v0.14.0-sprint14 v0.15.0-sprint15 \
               v0.16.0-sprint16 v0.17.0-sprint17 v0.18.0-sprint18 \
               v0.19.0-sprint19 v0.20.0-sprint20 v0.21.0-sprint21 \
               v0.22.0-sprint22 v0.23.0-sprint23 v0.24.0-sprint24
```

### What Sprint 24 added (v0.24.0-sprint24)

- **`src/lib/offline/warehouses-cache.ts`** and
  **`src/lib/offline/categories-cache.ts`** — mirrors of
  `items-cache.ts` for the two picklists the stock-count / scan
  flows will need in future sprints. Same replace-on-write
  semantics inside a single Dexie rw transaction, same
  `(orgId, userId)` scoping, same silent-false return on
  IndexedDB unavailable so callers never need a try/catch.
- **`src/lib/offline/db.ts`** — `CachedWarehouse` now tracks the
  real Prisma columns (`code`, `city`, `region`, `country`,
  `isDefault`) instead of the Sprint 23 placeholder shape. Still
  schema v1: the stores and indexes are unchanged, so this is a
  pure TypeScript-type tightening and requires no `.version(2)`
  block.
- **`src/components/offline/picklist-cache-sync.tsx`** — generic
  client bridge that dispatches to the right cache writer via a
  discriminator string (`"warehouses" | "categories"`). Why a
  discriminator and not a writer function prop: Next.js client
  components can only receive Server Action functions across the
  RSC boundary; a plain `writer` callback fails to serialize.
  Reuses the Sprint 23 ref + signature-string pattern so biome's
  `useExhaustiveDependencies` doesn't flag the effect.
- **`src/app/(app)/warehouses/page.tsx`** and
  **`src/app/(app)/categories/page.tsx`** — both build a
  serializable `*SnapshotRow[]` from their Prisma query and
  mount `<PicklistCacheSync>` at the end of the JSX tree. No
  banner yet (the warehouses/categories lists are small so a
  stale indicator is lower priority than on the items list).
- **`src/components/offline/offline-items-view.tsx`** —
  `"use client"` viewer that opens Dexie on mount, picks the
  most-recently-synced `(orgId, userId)` snapshot for the
  `items` table via `db.meta`, and renders a read-only table
  (SKU / name / category / stock / status). Sorts rows by
  `name.localeCompare` with the caller's locale. Four-state
  machine (loading / empty / error / ready). The "newest
  snapshot wins" policy is documented inline: when two users
  share a browser, whoever synced most recently gets their
  cache back on the offline screen, and since the cache is
  always written *before* logout it can never leak forward to
  a user who hasn't logged in yet.
- **`src/app/offline/items/page.tsx`** — a new `force-static`
  route with `robots: noindex`. Calls `getMessages()` on the
  server, packs the labels into a plain object, and hands them
  to `<OfflineItemsView>`. Never touches auth, cookies, or the
  database — that's what makes it safe for the SW to precache.
- **`public/sw.js`** — `CACHE_VERSION` bumped to
  `oneace-sw-v2` (so the old precache is evicted on activate)
  and `PRECACHE_URLS` now includes `/offline/items` so the
  cached catalog is available on the first cold-start offline
  navigation after install.
- **`src/app/offline/page.tsx`** — adds a primary CTA linking
  to `/offline/items` so users who land on the SW fallback
  page have a one-click path to their cached catalog.
- **`src/lib/i18n/messages/en.ts`** — new `offline.items.*`
  block (20 keys covering title, subtitle, loading, empty /
  error states, column headers, status labels, cached-count
  placeholder, and the back-home CTA) plus a top-level
  `offline.viewCachedItemsCta` for the /offline page link.
- **Non-goals this sprint:** cached-warehouses or
  cached-categories banners on their respective pages, an
  `/offline/warehouses` or `/offline/categories` viewer (Sprint
  25+), a write queue for offline mutations, login-aware
  snapshot selection, and any kind of filter / search inside
  the cached catalog viewer.
- **Triple-verify:** `tsc --noEmit` exit 0, `biome check .`
  clean (161 files, no errors, no warnings),
  `prisma validate` green.
- **No schema changes.**

### What Sprint 23 added (v0.23.0-sprint23)

- **`src/lib/offline/db.ts`** — Dexie v1 schema with four stores:
  `items`, `warehouses`, `categories`, `meta`. Every domain row
  carries `orgId` + `userId` so two users sharing a browser never
  cross-contaminate snapshots. The subclass is a module-level
  lazy singleton so `getOfflineDb()` is safe to call anywhere
  client-side and returns `null` on SSR / no-IndexedDB
  environments. Schema version and DB name are exported
  constants so a future migration block can reference them
  without string drift.
- **`src/lib/offline/items-cache.ts`** — `writeItemsSnapshot`
  (replace-on-write inside a single rw transaction, silently
  returns `false` on any failure so the UI never breaks because
  of a failed cache write), `readItemsSnapshot` (returns an
  empty-result fallback instead of null so call sites have a
  single render path), and `formatSyncedAgo` — a thin wrapper
  around `Intl.RelativeTimeFormat` with a `toLocaleString`
  fallback for browsers that don't support it.
- **`src/components/offline/items-cache-sync.tsx`** — `"use
  client"` bridge that takes a pre-serialized snapshot from the
  server component as a prop and writes it to Dexie on idle.
  Uses refs for the hot props and a short signature string as
  the effect key so unrelated parent re-renders don't thrash
  IndexedDB. `requestIdleCallback` with a 250ms `setTimeout`
  fallback for Safari.
- **`src/components/offline/items-cache-banner.tsx`** — a quiet
  status row under the items heading. Four states:
  1. Online with a fresh snapshot: "Offline catalog · 2 min ago"
     in muted grey.
  2. Online without a snapshot yet: "Offline catalog not yet
     cached on this device." (first pageview, fine).
  3. Offline with a snapshot: "Offline · showing cached catalog
     · 5 min ago · 42" (count of cached rows).
  4. Offline without a snapshot: amber warning.
  Reacts to `online`/`offline` window events so the copy
  switches live when the network comes back.
- **`src/app/(app)/items/page.tsx`** — the existing server
  component now builds an `ItemSnapshotRow[]` from its Prisma
  query (Decimal price → string to avoid precision loss,
  onHand pre-summed across stock levels) and renders both the
  banner and the cache sync component. The scope is pinned to
  `(membership.organizationId, session.user.id)` so snapshots
  are never accidentally visible to a second user on the same
  browser.
- **`src/lib/i18n/messages/en.ts`** — new
  `offline.cacheStatus.*` block with five keys for the banner
  states. Inherits the existing three-tier locale resolver.
- **`dexie@4.4.2`** added as a runtime dependency. Dexie is
  the web equivalent of the WatermelonDB reference the
  design-spec calls out for the Expo mobile app, and its API
  surface is intentionally thin so we can rip it out if we
  later standardize on a different offline story.
- **Non-goals this sprint (deferred to later PWA sprints):** a
  write queue for offline mutations, conflict resolution, an
  `/items/offline` route that reads directly from Dexie when
  the server fetch fails, cached warehouses / categories
  picklist, and any cross-tab coordination beyond Dexie's
  built-ins. Scoping the sprint to "read-cache the items
  page" keeps the blast radius small and the failure modes
  obvious.
- **Triple-verify:** tsc --noEmit exit 0, biome check . clean
  (no errors, no warnings), prisma validate green (no schema
  changes this sprint).
- **No schema changes.**

### What Sprint 22 added (v0.22.0-sprint22)

- **`public/manifest.webmanifest`** — first-party PWA manifest.
  `display: "standalone"`, `id`/`start_url`/`scope` all pinned
  to `/`, brand `theme_color` (`#0f172a`) + `background_color`
  (`#fdfcfb`) aligned with the existing CSS variables, icon set
  listing the SVG + 192/512 PNG + a maskable-512 PNG so Android
  adaptive-icon masking has something to chew on. No install
  promotions, no shortcuts — those are future sprint concerns.
- **`public/icon.svg` + `icon-192.png` + `icon-512.png` +
  `icon-maskable-512.png` + `apple-touch-icon.png`** — a simple
  brand mark (dark slate card, triangle + base block) generated
  from the brand tokens. Deliberately lightweight: the app
  already has a design language from the existing shell, and
  dropping in a more elaborate mark is a one-file swap later.
- **`public/sw.js`** — hand-written service worker. No Workbox,
  no build-time config, no webpack plugin. That's deliberate:
  Workbox would drag a bundler plumbing change AND hide lifecycle
  details I'd rather have visible while the offline story is
  still being designed. Three fetch strategies:
  1. **Navigation requests** (top-level page loads): network-
     first, fall back to the precached `/offline` page on
     network failure. Deliberately **not** cached — auth state
     would leak between sessions, and stale HTML would fight
     with the App Router's RSC boundary.
  2. **`/_next/static/*`** immutable hashed assets: cache-first
     with network-on-miss. The filename hash makes each entry
     effectively permanent until a deploy replaces it.
  3. **Everything else** (images, fonts, etc.): stale-while-
     revalidate against the same static cache. Fast first
     paint, eventually-fresh assets.
  Bypasses everything under `/api/*`, `/_next/data/*`, and all
  non-GET requests — the SW never interposes on auth or data
  writes, full stop. A `CACHE_VERSION` string gates eviction so
  `activate()` can atomically drop the old caches when a new
  worker takes over. A `message` listener accepts
  `{ type: "SKIP_WAITING" }` so a future update-prompt UX can
  tell the waiting worker to activate without a hard reload.
- **`src/components/pwa/sw-register.tsx`** — `"use client"`
  component that registers `/sw.js` only in production, only
  when `serviceWorker` is in `navigator`, and only after
  `requestIdleCallback` (or a 1200ms `setTimeout` fallback) so
  registration never competes with first-paint critical work.
  Also captures the `beforeinstallprompt` event on mount and
  parks the deferred prompt on `window.__oneaceInstallPrompt`
  — Chrome only fires that event once per page load, so the
  capture has to be synchronous-on-mount even though no UI
  triggers it yet. A later sprint will wire a first-party
  "Install app" button to the parked prompt.
- **Mount point deliberately restricted to the `(app)` layout
  only.** The `(auth)` layout intentionally does NOT load the
  SW so login / register / invite pages always hit the network
  fresh. An offline fallback during auth would be worse than
  useless: users would see a cached "sign in" page that has no
  way to actually authenticate.
- **`src/app/offline/page.tsx`** — server component with
  `export const dynamic = "force-static"` so it renders to
  plain HTML at build time and is safe to precache. Calls
  `getMessages()` (which has a graceful no-request-context
  fallback), doesn't touch `requireSession` or any DB helper,
  doesn't read a cookie. Renders a Wi-Fi-off icon + localized
  title/description/retry button/install tip. Precached by the
  SW so it survives a cold start while offline.
- **`src/app/layout.tsx` metadata** — added `metadata.manifest`
  pointing at the new manifest, an `appleWebApp` block
  (capable + default status-bar-style so iOS doesn't paint a
  broken status bar in standalone mode), and an `icons` bundle
  listing the SVG + 192/512 PNG + `apple-touch-icon`. Kept the
  existing `viewport.themeColor` light/dark pair — that already
  matches the manifest's `background_color` for each scheme.
- **i18n** — single new `t.offline.*` block: `metaTitle`,
  `iconLabel`, `title`, `description`, `retryCta`, `tip`. No
  existing keys touched.
- **Non-goals this sprint (deliberate, each deferred to its
  own future sprint):** `/api/*` response caching, RSC
  payload caching, IndexedDB / Dexie offline writes, background
  sync, push notifications, the first-party install button UI.
  Scoping the sprint to "installable + friendly offline page"
  keeps it a one-day ship without committing prematurely to
  any offline-data architecture.
- **No schema changes, no new npm dependencies.**

### What Sprint 21 added (v0.21.0-sprint21)

- **`deleteOrganizationAction`** (`src/app/(app)/settings/actions.ts`).
  OWNER-only — deliberately tighter than the OWNER/ADMIN guard used
  everywhere else in the settings module, because deleting an org is
  irreversible and destroys every user's data in the tenant. Never
  takes the target org id from the client: the action only ever
  deletes the **currently active** organization derived from
  `requireActiveMembership`, which closes off a CSRF-style attack
  where a crafted form could trick an OWNER into deleting a
  different tenant they happen to own. Typed-confirmation guard:
  the client must echo back the org's `slug` exactly (including
  case). Slug, not display name, because it has no spaces or
  diacritics — fewer ways to fat-finger the check on a phone.
- **Cascade model (audited, not modified).** Every org-owned relation
  on `Organization` — `Membership`, `Invitation`, `Warehouse`,
  `Category`, `Item`, `StockLevel`, `StockMovement`, `StockCount`,
  `CountSnapshot`, `CountEntry`, `Supplier`, `PurchaseOrder`,
  `PurchaseOrderLine` — is already marked `onDelete: Cascade`, so
  a single `db.organization.delete` call wipes the entire tenant
  in one transaction. `Category.parent` is a self-reference with
  `onDelete: SetNull` but that's safe because the children
  themselves cascade from the org. Better-Auth tables (`User`,
  `Session`, `Account`, `Verification`) are **not** org-owned and
  survive — the deleting user stays signed in.
- **Post-delete cookie management.** If the user has other
  memberships, the `oneace-active-org` cookie is updated to the
  oldest remaining one (matches `requireActiveMembership`'s
  ascending-`createdAt` ordering) so the next render lands in a
  valid tenant. If this was the user's only org, the cookie is
  cleared. The action returns a `nextPath` the client navigates
  to: `/` when another org is available (which resolves into that
  tenant), or `/organizations/create` when none remain (bypasses
  `/onboarding` so they can bootstrap a new tenant directly
  without the welcome flow bouncing them around).
- **`DangerZoneCard` client component**
  (`src/app/(app)/settings/danger-zone-card.tsx`). Destructive
  `Card` with `border-destructive/50`, `<AlertTriangle>` icon,
  bulleted consequences list from
  `t.settings.dangerZone.consequences` (5 items: data wipe,
  POs/suppliers/counts, teammates lose access, invitations
  invalidated, no undo). `AlertDialog`-guarded CTA with a
  slug-echo `<Input>`; the confirm button is disabled until
  `confirmation.trim() === organization.slug`. `handleOpenChange`
  resets the confirmation string + error state every time the
  dialog closes so reopening starts from a clean slate. On
  success the component calls `setOpen(false)` + `router.push`
  (not `replace`, so the back button can't land on a stale
  `/settings` for a deleted org) and a `router.refresh()`.
- **Settings page wiring.** `src/app/(app)/settings/page.tsx` now
  reads a second permission const, `canDeleteOrg = membership.role
  === "OWNER"`, alongside the existing `canEditOrg`, and renders
  `<DangerZoneCard>` at the bottom of the grid gated on
  `canDeleteOrg`. Non-OWNER members (including ADMIN) never see
  the card, so there's no "this button is disabled" affordance
  tempting them to poke at it.
- **i18n.** 13 new keys under `t.settings.dangerZone.*`:
  `heading`, `description`, `consequences` (5-string array),
  `deleteCta`, `confirmTitle`, `confirmBody` (uses `{org}`
  placeholder), `confirmInputLabel` and `confirmInputPlaceholder`
  (both use `{slug}` placeholder), `confirmMismatch`, `confirmCta`,
  `deleting`, and an `errors` subtree with `forbidden`,
  `mismatch`, `deleteFailed`.
- **No schema changes.** Pure app-layer work — the cascade
  machinery already existed since Sprint 0 and has been quietly
  waiting for a trigger. Clears the "organization delete /
  danger zone" item from the post-Sprint-11 deferred list —
  Sprint 11 half-shipped the multi-tenancy read path (header
  switcher + active-org cookie) and explicitly deferred the
  destructive half.

### What Sprint 20 added (v0.20.0-sprint20)

- **Schema — new `Invitation` model** (second schema change on
  `next-port`, after Sprint 19). Columns: `id`, `organizationId`,
  `email`, `role`, `token` (unique), `invitedById`, `expiresAt`,
  `acceptedAt`, `acceptedById`, `revokedAt`, `createdAt`. Relations:
  `Organization` (cascade), `User` via named `InvitationsSent` +
  `InvitationsAccepted` relations (onDelete: Cascade / SetNull
  respectively). `@@index([organizationId])` and `@@index([email])`
  on the model. `(organizationId, email)` deliberately **not** unique
  — the "no two live pending" rule is enforced at the action layer
  so we can cleanly re-issue after revoke. **Requires `npm run db:push`**
  after pulling. No `prisma/migrations/` entry because the project
  uses `db:push`, not `db:migrate`.
- **`src/lib/invitations.ts` — capability token helpers**
  `generateInvitationToken()` = `crypto.randomBytes(32).toString("base64url")`
  which yields 43 characters of opaque entropy (~256 bits). Deliberately
  not cuid: the token is a capability, so it needs to be unguessable
  even if the attacker knows the invited email and the organization.
  `buildInvitationUrl(token)` reads `NEXT_PUBLIC_APP_URL` so dev /
  staging / prod each mint URLs on their own hostname, falling back
  to `http://localhost:3000` so tests and local dev just work.
  `defaultInvitationExpiry()` = 14 days. `classifyInvitation()` is
  the single source of truth for the `{pending, accepted, revoked,
  expired}` state machine shared between the accept page and the
  pending-invitations query filter.
- **`inviteMemberAction` rewrite** (`src/app/(app)/users/actions.ts`).
  Previously returned `"user not found"` if the invitee didn't exist.
  New flow creates an `Invitation` row and returns
  `{ invitationId, inviteUrl, expiresAt }` so the admin UI can render
  a copy-link card. Guards: OWNER/ADMIN only, OWNER-only-can-invite-OWNER,
  reject existing membership, reject existing live pending invite
  (`acceptedAt: null`, `revokedAt: null`, `expiresAt: { gt: new Date() }`).
- **`revokeInvitationAction`** — OWNER/ADMIN gated. Stamps `revokedAt`
  rather than deleting so the audit trail survives. Idempotent on
  already-revoked invites (returns `{ ok: true }` without a second
  write). Refuses if the invite has already been accepted.
- **`acceptInvitationAction`** — calls `requireSession()` (not
  `requireActiveMembership`, because the user might not be a member
  of the target org yet). Uses `classifyInvitation()` for state checks,
  enforces `session.user.email.trim().toLowerCase() === invite.email`
  as the load-bearing guard that prevents a leaked URL being redeemed
  by a random third party. Runs an atomic `$transaction` to create
  the membership + stamp the invite; handles the "user is already a
  member of this org" edge by stamping the invite only. Revalidates
  both `/users` and the app layout so the header org switcher sees
  the new membership on the next navigation.
- **`src/app/(auth)/invite/[token]/page.tsx`** — server component with
  a full state machine: `not-found`, `accepted`, `revoked`, `expired`,
  `unauthenticated`, `wrong-email`, `ready`. Renders under the existing
  `(auth)` layout (brand panel + centered form area) and deliberately
  does **not** redirect unauthenticated users; instead it shows the
  invite details (org, inviter, role, expiry) before prompting sign-in
  so the user knows what they're committing to. Wrong-email state
  shows `"signed in as X but invite is for Y"` so the fix is obvious.
  All copy routed through the new `t.invitePage` i18n block.
- **`AcceptInviteButton` client component** — `useTransition` + success
  state. On success, renders an inline confirmation card with a
  "Go to dashboard" link rather than navigating automatically, so a
  mobile user can screenshot the confirmation for their records.
- **`InviteForm` rewrite** — success state now renders the invite URL
  inside a read-only `<input>` with a Copy button (uses
  `navigator.clipboard.writeText`, falls back gracefully when the
  clipboard API is blocked). Includes the invitee email and expiry
  timestamp in the help copy so the admin knows who to send it to.
- **Pending invitations card on `/users`** — new `Card` between the
  invite form and the members table, rendered only when `canManage`.
  Table of pending invitations (filter mirrors `classifyInvitation`)
  with per-row copy-link + revoke actions. `InvitationRow` client
  component uses the existing `AlertDialog` pattern from `MemberRow`
  for the revoke confirmation.
- **i18n** — `t.users.invite.errors.userNotFound` removed (dead
  with user-must-exist requirement gone), `alreadyInvited` added,
  description/success/success-link copy rewritten for the new flow.
  New `t.users.invitations.*` block for the pending-invitations card
  (heading, description, columns, empty, revoke copy, copy-link
  copy). New top-level `t.invitePage.*` block (36 keys) for the
  accept page — state titles, labels, CTAs, and an `errors` subtree
  that mirrors `classifyInvitation`'s enum.

### What Sprint 19 added (v0.19.0-sprint19)

- **Schema — `Organization.defaultLocale` + `Organization.defaultRegion`**
  Two nullable columns. `null` = "no org-level override, fall through
  to Accept-Language / platform default". **Requires `npm run db:push`**
  after pulling; no `prisma/migrations/` entry because this project
  uses `db:push`, not `db:migrate`. First schema change since Sprint 13
  (create-another-org flow).
- **`src/lib/session.ts` — new `getActiveOrgPreferences()`**
  Reads `oneace-active-org` cookie, queries the org's defaults, returns
  `{ defaultLocale, defaultRegion } | null`. Wrapped in React `cache()`
  so `getLocale` + `getRegion` together trigger at most one DB query
  per request. Deliberately unauthenticated-safe: any error
  (no cookie context, deleted org, DB blip) returns `null` so the
  marketing shell / login pages can't be crashed by the i18n resolver.
  Reading an org's default locale is not sensitive, and every query
  that touches actual org data still goes through
  `requireActiveMembership`.
- **`src/lib/i18n/index.ts` — resolver rewrite**
  `getLocale` now has a four-tier priority: user cookie → org default
  → Accept-Language → `DEFAULT_LOCALE`. `getRegion` has a three-tier
  priority: user cookie → org default → `DEFAULT_REGION_CODE`. The
  org-default layer is inserted *between* the user cookie and the
  header/platform fallback so a user's explicit choice always wins,
  but a teammate joining an org automatically inherits the org's
  preferred language without anyone touching cookies. New
  `isSupportedRegion` type guard mirrors the existing
  `isSupportedLocale`.
- **`updateOrgDefaultsAction`** — OWNER/ADMIN gated server action.
  Empty string = clear the override (null), non-empty is validated
  against `SUPPORTED_LOCALES` / `SUPPORTED_REGIONS`. Updates
  `Organization.{defaultLocale,defaultRegion}` then calls
  `revalidatePath('/', 'layout')` so every server component re-reads
  on the next navigation.
- **`OrgDefaultsForm` client component** — two `<Select>`s with a
  `__platform__` sentinel for the "Platform default" option. Can't
  use `""` as a Radix Select value (collides with the placeholder
  state), so the form maps the sentinel to `""` on submit.
- **Settings page** — full-width card below Region & currency, gated
  on the same `canEditOrg` check as Organization profile. Fetches
  `defaultLocale` / `defaultRegion` alongside the existing org
  `findUnique`.
- **i18n** — 12 new keys on `t.settings.orgDefaults.*` (heading,
  description, helpText explaining users can still override, three
  labels, saved, and four error variants).

### What Sprint 18 added (v0.18.0-sprint18)

- **`src/app/(app)/movements/filter.ts`** — new `q` axis. A
  `parseQuery` helper trims the input and caps it at 64 chars
  (mirroring the Sprint 15 PO-number filter shape), and
  `buildMovementWhere` adds a relation-level filter:
  `where.item = { OR: [sku, name, barcode contains insensitive] }`.
  Crucially, that lives on `where.item`, NOT the top-level
  `where.OR` the Sprint 17 warehouse axis already uses —
  Prisma composes them under the implicit outer AND so users
  can narrow by warehouse AND item at the same time.
- **`MovementsFilterBar`** — full-width item search field
  above the date/type/warehouse grid row, with a leading
  `Search` icon and `maxLength={64}`. Using `<input type="search">`
  gives us the native clear-X on most browsers for free. The
  Clear button now also resets the item search.
- **`/movements` page** — passes `initialQ` into the filter bar
  and extends `buildExportHref` so the Export CSV button deep-links
  the item search along with the existing axes.
- **`/movements/export` route** — now reads `warehouse` and `q`
  out of the request URL (fixes a Sprint 17 oversight where the
  Export button silently dropped the warehouse axis when exporting).
  `filterActive` widened to include both new axes so the row-cap
  bump (5k → 20k) kicks in for pure item-scope exports too.
- **i18n** — two new keys on `t.movements.filter`
  (`itemLabel`, `itemPlaceholder`); `emptyFilteredBody` copy
  updated to mention the item search alongside the other axes.

No schema changes. Uses the existing `(organizationId, sku)`
index and `(organizationId, barcode)` index; substring scans
are fine to ~10k items per org. Migrate to Postgres `tsvector`
ranking if a single org ever crosses 100k items.

### What Sprint 17 added (v0.17.0-sprint17)

- **`src/app/(app)/movements/filter.ts`** — extended with a
  `warehouseId` axis. `MovementSearchParams` gains a `warehouse`
  field, `MovementFilter` gains `warehouseId` + `rawWarehouse`,
  and `parseWarehouseId` passes the value through opaquely
  (length-capped at 64). The outer query is already org-scoped
  so a cross-org id guess returns zero rows. `hasAnyFilter` now
  counts the warehouse axis too.
- **`buildMovementWhere` TRANSFER handling** — `where.OR =
  [{ warehouseId }, { toWarehouseId }]`. Matching both sides of
  a TRANSFER is the whole point: "show me everything that
  happened in warehouse X" has to include *incoming* transfers,
  not just outgoing. RECEIPT/ISSUE/ADJUSTMENT only set
  `warehouseId`, so the `toWarehouseId` branch is a no-op for
  them. Prisma composes this OR under the implicit outer AND
  so it combines cleanly with an active `type` filter.
- **`MovementsFilterBar` client component** — fourth column
  added: a warehouse `<Select>` populated from the server-loaded
  list, with its own `__all__` sentinel. The grid template grew
  from `1fr_1fr_1fr_auto` to `1fr_1fr_1fr_1fr_auto`. Clear button
  now also resets the warehouse value.
- **`/movements` page** — loads warehouses via `Promise.all`
  alongside the ledger query, unscoped to the active filter (so
  a narrowed ledger doesn't make the selected warehouse
  disappear from the dropdown and strand the user unable to
  broaden). `isArchived: false` keeps archived warehouses out.
  `buildExportHref` was extended to carry `warehouse` into the
  CSV route so the Sprint 14 export honours the Sprint 17 axis
  without touching the export handler — `parseMovementFilter`
  already reads it.
- **i18n** — two new keys on `t.movements.filter`
  (`warehouseLabel`, `warehouseAll`). `truncatedNotice` and
  `emptyFilteredBody` tweaked to mention the warehouse filter.

No schema changes. Pure read-path + URL state.

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
