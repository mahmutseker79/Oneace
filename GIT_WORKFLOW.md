# Git Workflow — OneAce Next.js Port

This document is the exact runbook for getting the `oneace-next/` scaffold onto
GitHub as a long-lived `next-port` branch, opening a draft PR against `main`,
and iterating on it through Sprint 0 → Sprint 37.

> **Why this lives in a markdown file and not a git commit:** the port was
> scaffolded inside a sandboxed environment that cannot finalize `git` writes.
> Run the commands below **from your local machine** where your SSH key, GPG
> signing, and GitHub identity already work.

---

## 0. Fast path — use the pre-built bundle (RECOMMENDED, updated 2026-04-11)

Sprint 0 through Sprint 36 plus **Sprint 37** are already committed in a
portable git bundle at:

```
oneace-next/oneace-next-port-v0.37.0-sprint37.bundle
```

This bundle contains:

- **82 commits** — 8 Sprint 0 + 1 docs + Sprints 1..37 (each = 1 feature
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
  - `v0.25.0-sprint25` — Sprint 25 complete (PWA Sprint 4 Part A — offline write queue substrate)
  - `v0.26.0-sprint26` — Sprint 26 complete (PWA Sprint 4 Part B — first offline op: movement create)
  - `v0.27.0-sprint27` — Sprint 27 complete (PWA Sprint 4 follow-on — second offline op: count entry add / stock-count offline session)
  - `v0.28.0-sprint28` — Sprint 28 complete (PWA Sprint 5 — Background Sync API + new-version prompt + first-party Install button)
  - `v0.29.0-sprint29` — Sprint 29 complete (PWA Sprint 6 — offline stock-counts viewer: cache-on-detail-visit + /offline/stock-counts list + detail)
  - `v0.30.0-sprint30` — Sprint 30 complete (PWA Sprint 7 — failed-ops review UI at /offline/queue: retry / discard / clear-all for queued ops)
  - `v0.31.0-sprint31` — Sprint 31 complete (PWA Sprint 8 — Dexie liveQuery subscriptions in the queue banner + review screen, Web Locks cross-tab drain guard in the runner)
  - `v0.32.0-sprint32` — Sprint 32 complete (organization ownership transfer — atomic OWNER → ADMIN hand-off with typed-slug confirmation, closes the multi-tenancy trio after Sprint 11 switcher + Sprint 21 delete)
  - `v0.33.0-sprint33` — Sprint 33 complete (invitation email delivery + post-login `?next=/invite/[token]` redirect bundle — Mailer adapter + ConsoleMailer/ResendMailer, rendered invitation-email template, inviteMemberAction wires delivery with soft-miss, login/register forms honour `?next=`, invitee register variant skips org creation)
  - `v0.34.0-sprint34` — Sprint 34 complete (supplier drill-down detail page at `/suppliers/[id]` — identity header + 3-up contact/address/notes cards + 4 KPIs matching Sprint 12 math + recent POs table with timeliness badges + top items card; fixes the Sprint 12 leaderboard broken link)
  - `v0.35.0-sprint35` — Sprint 35 complete (ZXing-wasm scanner fallback — pluggable detector abstraction at `src/lib/scanner/detector.ts`, lazy-loaded `@zxing/browser` backend for Safari + Firefox, engine badge in the camera card, scanning now works on iPhones; closes the biggest `/scan` usability cliff since Sprint 8)
  - `v0.36.0-sprint36` — Sprint 36 complete (tenant-scoped append-only audit log — new `AuditEvent` Prisma model with composite `(organizationId, createdAt)` index + secondary `(entityType, entityId)` index, `src/lib/audit.ts` write helper with typed `AuditAction` vocabulary, wired into 12 high-severity actions across settings / users / purchase-orders, new admin-gated `/audit` page with cursor-paginated "Load more", History-icon sidebar entry, full `t.audit` i18n namespace with 13 action labels)
  - `v0.37.0-sprint37` — Sprint 37 complete (production hardening — zod-validated env schema at `src/lib/env.ts` fails boot on missing/malformed required vars, dependency-free structured logger at `src/lib/logger.ts` with JSON-lines-in-prod / pretty-in-dev output, `/app/global-error.tsx` + `(app)/error.tsx` two-layer error boundaries showing Next.js `error.digest`, `/api/health` liveness+readiness probe with `SELECT 1` DB check returning 200/503, five call sites migrated off raw `process.env`, audit helper rewired to `logger.error`)

Older bundles (`oneace-next-port.bundle`,
`oneace-next-port-v0.1.0-sprint1.bundle` ... `oneace-next-port-v0.37.0-sprint37.bundle`)
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
git fetch /path/to/SimplyCount/oneace-next/oneace-next-port-v0.37.0-sprint37.bundle \
          next-port:next-port

# Also pull all thirty-seven sprint tags
git fetch /path/to/SimplyCount/oneace-next/oneace-next-port-v0.37.0-sprint37.bundle \
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
          refs/tags/v0.24.0-sprint24:refs/tags/v0.24.0-sprint24 \
          refs/tags/v0.25.0-sprint25:refs/tags/v0.25.0-sprint25 \
          refs/tags/v0.26.0-sprint26:refs/tags/v0.26.0-sprint26 \
          refs/tags/v0.27.0-sprint27:refs/tags/v0.27.0-sprint27 \
          refs/tags/v0.28.0-sprint28:refs/tags/v0.28.0-sprint28 \
          refs/tags/v0.29.0-sprint29:refs/tags/v0.29.0-sprint29 \
          refs/tags/v0.30.0-sprint30:refs/tags/v0.30.0-sprint30 \
          refs/tags/v0.31.0-sprint31:refs/tags/v0.31.0-sprint31 \
          refs/tags/v0.32.0-sprint32:refs/tags/v0.32.0-sprint32 \
          refs/tags/v0.33.0-sprint33:refs/tags/v0.33.0-sprint33 \
          refs/tags/v0.34.0-sprint34:refs/tags/v0.34.0-sprint34 \
          refs/tags/v0.35.0-sprint35:refs/tags/v0.35.0-sprint35 \
          refs/tags/v0.36.0-sprint36:refs/tags/v0.36.0-sprint36 \
          refs/tags/v0.37.0-sprint37:refs/tags/v0.37.0-sprint37

# Verify
git log --oneline next-port                # should show 82 commits
git tag -l                                 # should include all thirty-seven sprint tags

# Push to GitHub
git push -u origin next-port
git push origin v0.1.0-sprint1 v0.2.0-sprint2 v0.3.0-sprint3 v0.4.0-sprint4 \
               v0.5.0-sprint5 v0.6.0-sprint6 v0.7.0-sprint7 v0.8.0-sprint8 \
               v0.9.0-sprint9 v0.10.0-sprint10 v0.11.0-sprint11 v0.12.0-sprint12 \
               v0.13.0-sprint13 v0.14.0-sprint14 v0.15.0-sprint15 \
               v0.16.0-sprint16 v0.17.0-sprint17 v0.18.0-sprint18 \
               v0.19.0-sprint19 v0.20.0-sprint20 v0.21.0-sprint21 \
               v0.22.0-sprint22 v0.23.0-sprint23 v0.24.0-sprint24 \
               v0.25.0-sprint25 v0.26.0-sprint26 v0.27.0-sprint27 \
               v0.28.0-sprint28 v0.29.0-sprint29 v0.30.0-sprint30 \
               v0.31.0-sprint31 v0.32.0-sprint32 v0.33.0-sprint33 \
               v0.34.0-sprint34 v0.35.0-sprint35 v0.36.0-sprint36 \
               v0.37.0-sprint37
```

### What Sprint 37 added (v0.37.0-sprint37)

The first "no new user feature" sprint of the port. Sprint 37
is a production-hardening pass that closes the gaps that would
bite us on the first real deploy and builds the observability
surface the Sprint 36 audit log comment-block explicitly
deferred ("Sprint 37's structured logger handles that
instead"). Four pieces, all infrastructure:

**1. Zod-validated environment schema (`src/lib/env.ts`).**
Reads `process.env` exactly once at module load and throws a
formatted multi-line error listing every missing or malformed
variable. Required: `DATABASE_URL`, `DIRECT_URL`,
`BETTER_AUTH_SECRET` (min 32 chars so devs can't paste in a
placeholder), `BETTER_AUTH_URL`. Optional with pairing rules:
`NEXT_PUBLIC_APP_URL`, `RESEND_API_KEY` + `MAIL_FROM` (must be
set together or unset together, enforced via `superRefine` —
the old Sprint 33 posture of "fail at send time" was clearer in
dev but left prod stuck with a cryptic Resend 422; now the
server refuses to start with a helpful message). Exports `env`
(frozen, fully typed — `env.NODE_ENV` narrows to a literal
union) and a convenience `isProduction` boolean. Parse happens
at the module top-level, not lazily, so the first import
anywhere in the graph triggers validation — `db.ts`, `auth.ts`,
`logger.ts`, and `api/health/route.ts` all depend on it so the
check fires at the very beginning of the request chain.

**2. Dependency-free structured logger (`src/lib/logger.ts`).**
Four level methods (`debug` / `info` / `warn` / `error`). Each
takes a `(message, context?)` pair where context is an
arbitrary `Record<string, unknown>`. An internal
`serialiseError` walk turns Error instances into
JSON-friendly shapes (preserving `name` / `message` / `stack`
and any Prisma-style custom fields like `code` / `meta`) so
`JSON.stringify(new Error("x"))` no longer collapses to `{}`.
Production mode emits single-line JSON to stdout (stderr for
warn/error so Vercel's stream routing picks up the right
severity); development mode uses `console.info/warn/error`
with a `[LEVEL]` prefix so `next dev` output stays skimmable.
Level threshold gated by `env.LOG_LEVEL` with defaults of
`debug` in dev/test and `info` in prod. No pino, no winston —
150 lines of hand-written code that swap cleanly behind the
same interface when we add Axiom/Datadog post-MVP.

**3. Two-layer error boundaries.**
- `src/app/global-error.tsx` is a Client Component that
  renders its own `<html>`/`<body>` (required by Next.js 15
  when the root layout itself crashed) with hard-coded
  English strings — deliberately no i18n, because loading
  the i18n module from the boundary that exists to catch
  i18n load failures is a loop. Shows the Next.js-generated
  `error.digest` so ops can correlate user reports with
  server log entries. Retry button calls `reset()`.
- `src/app/(app)/error.tsx` is the route-segment boundary
  for the authenticated app group. Renders *inside* the
  `(app)/layout.tsx` shell so the sidebar/header stay up
  while the failing page shows a Card with "This page hit
  an unexpected error. The rest of the app is still usable."
  This covers the common case — Prisma errors in page-level
  data fetching — without escalating the whole window to
  the global boundary.

**4. `/api/health` route handler.**
Pure liveness+readiness probe at `src/app/api/health/route.ts`.
Public (no auth — load balancers and uptime probes can't
authenticate), `export const runtime = "nodejs"` (Prisma's
engine doesn't run on the edge runtime), `export const dynamic
= "force-dynamic"` + `Cache-Control: no-store` (the whole
point is that each hit exercises the DB so caching would
invalidate the probe). Executes `db.$queryRaw\`SELECT 1\``
and returns a compact JSON body:
`{status, uptime, timestamp, environment, version, commit,
checks: {database}, errors?}`. HTTP 200 when everything is ok,
503 when the database probe fails. `version` and `commit`
are pulled from Vercel's `VERCEL_GIT_COMMIT_REF` and
`VERCEL_GIT_COMMIT_SHA` with an "unknown" fallback for local
dev. No PII or tenant data in the response body — just the
shape uptime dashboards need.

**Call-site migration.** Five server-side files moved off
raw `process.env`: `src/lib/auth.ts` (baseURL + secret +
trustedOrigins), `src/lib/db.ts` (NODE_ENV replaced with
`isProduction`), `src/lib/invitations.ts`
(`NEXT_PUBLIC_APP_URL` for invite URL minting),
`src/lib/mail/index.ts` (`RESEND_API_KEY` + `MAIL_FROM`
through the env module so the mail-pair superRefine governs
them), and `src/lib/audit.ts` (the Sprint 36 audit helper's
catch-branch `console.error` is now `logger.error`, joining
the same structured stream as everything else).
`src/lib/auth-client.ts` deliberately stays on
`process.env.NEXT_PUBLIC_APP_URL` because it's a Client
Component and `NEXT_PUBLIC_*` vars are inlined at build time
— importing the server env module into the client bundle
would drag server-only validation into the browser.

**Triple verification clean:**

```
mv tsconfig.tsbuildinfo tsconfig.tsbuildinfo.old36
npx tsc --noEmit          exit 0
npx biome check src       185 files, 0 errors (5 new vs
                          Sprint 36's 180: env, logger,
                          global-error, (app)/error, api/health/route)
npx prisma validate       schema valid (unchanged)
```

### What Sprint 36 added (v0.36.0-sprint36)

Tenant-scoped append-only audit log — the first pass of a governance
surface that answers the "who changed what?" question without
requiring Postgres console access or a structured-logging pipeline
(Sprint 37 territory). Up to this sprint, OneAce's multi-tenant
story covered switcher (Sprint 11), delete (Sprint 21), transfer
(Sprint 32), and invitation email delivery (Sprint 33) — but an
admin couldn't see, after the fact, *who* changed what in their
org. This sprint is the missing load-bearing piece before OneAce
can safely host a second paying team.

**New schema**: `AuditEvent` model in `prisma/schema.prisma` —
`(id, organizationId, actorId?, action, entityType, entityId?, metadata: Json?, createdAt)`.
Composite `(organizationId, createdAt)` index powers the default
"latest first" read; secondary `(entityType, entityId)` index is
prepped for future per-entity drill-downs. The `organization`
relation is `onDelete: Cascade` (audited tenant deletes wipe
their logs cleanly), the `actor` relation is `onDelete: SetNull`
(deleting a former user preserves the historical trail as
"Deleted user"). No `updatedAt` — rows are strictly append-only.
Two relation arrays added upstream: `Organization.auditEvents`
and `User.auditEventsLogged`.

**New file**: `src/lib/audit.ts` — the write helper
`recordAudit({ organizationId, actorId, action, entityType, entityId?, metadata? })`
plus two typed unions (`AuditAction` and `AuditEntityType`) that
define the canonical vocabulary. The helper **swallows its own
errors and logs via `console.error`** rather than bubbling —
the invariant is that a successfully-committed action must never
flip to failed because its audit write hiccuped. We'd rather
lose a row than refuse a legitimate mutation. Sprint 37's
structured logger will replace the bare console call without
any caller-side edit.

**Action-layer wiring** — 12 `recordAudit` calls across three
files:

- `src/app/(app)/settings/actions.ts` — `organization.updated`
  (with `{ before, after }` diff of `name`/`slug`) and
  `organization.transferred` (with outgoing/incoming user ids
  and the target's email). `deleteOrganizationAction` intentionally
  does NOT write an audit event — the cascade would wipe it in
  the same transaction, so org-deletion observability belongs in
  the Sprint 37 server log instead. This is documented inline
  in the action body.
- `src/app/(app)/users/actions.ts` — five wires covering
  `member.invited`, `invitation.revoked`, `invitation.accepted`,
  `member.role_changed`, `member.removed`. The role-change action
  gained a no-op early-return so same-role resubmits from a flaky
  client retry don't spam the log.
- `src/app/(app)/purchase-orders/actions.ts` — five wires
  covering `purchase_order.created` / `.sent` / `.cancelled` /
  `.deleted` / `.received`. The deleted event intentionally
  carries `entityId: null` because the PO row is gone; the
  durable reference is the `poNumber` in metadata. The received
  event is logged *outside* the receive transaction so a ledger
  hiccup can't rollback real stock movements.

**New page**: `src/app/(app)/audit/page.tsx` — admin-gated viewer
(`membership.role ∈ {OWNER, ADMIN}`, checked in the same
component that issues the `findMany` so the role check is
defence-in-depth, not nav-visibility). Pure server component
— zero client bundle — with cursor-paginated "Load more" via a
`?cursor=<id>` search param. We fetch `PAGE_SIZE + 1` (50 + 1)
rows so the next-page detection doesn't need a second count
query, and the cursor follows Prisma's
`cursor + skip: 1` idiom over a stable `(createdAt desc, id desc)`
tiebreaker. Table columns: When / Actor / Action / Entity /
Details, with metadata rendered as a terse single-line
"key: value · key: value" inline summary.

**Sidebar + i18n**: new `Audit log` nav entry between Users and
Settings (lucide `History` icon). Extended `SidebarLabels.nav`
with an `audit` key; the existing layout spreads `t.nav` into
the sidebar so the new key flowed through without an extra
rewire. New `t.nav.audit` and full `t.audit` namespace at the
end of `src/lib/i18n/messages/en.ts` — metaTitle, heading,
subtitle, forbidden / empty / systemActor / deletedUser /
noEntity / loadMore strings, 5 column labels, and a full
`t.audit.actions` map with 13 human-readable labels keyed by
`AuditAction`.

Files touched:

- `prisma/schema.prisma` — new `AuditEvent` model + two relation
  arrays on Organization / User
- `src/generated/prisma/` — regenerated client
- `src/lib/audit.ts` — NEW write helper + vocabulary types
- `src/app/(app)/settings/actions.ts` — 2 audit wires + delete
  skip note
- `src/app/(app)/users/actions.ts` — 5 audit wires + role-change
  no-op guard
- `src/app/(app)/purchase-orders/actions.ts` — 5 audit wires
- `src/app/(app)/audit/page.tsx` — NEW admin-gated viewer with
  cursor pagination
- `src/components/shell/sidebar.tsx` — audit nav entry +
  `SidebarLabels.nav.audit` field
- `src/lib/i18n/messages/en.ts` — `nav.audit` key + full `audit`
  namespace

Verified clean: `tsc --noEmit` 0 errors, `biome check src` 0
errors across 180 files, `prisma validate` valid.

---

### What Sprint 35 added (v0.35.0-sprint35)

ZXing-wasm scanner fallback — `/scan` now works on iOS Safari,
macOS Safari, and Firefox for the first time since it shipped in
Sprint 8. Up to this sprint the scanner component hard-coded a
check for `globalThis.BarcodeDetector` (a Chromium-only Web API),
so any warehouse worker opening OneAce on an iPhone hit a "Camera
scanning not supported" wall and could only type barcodes
manually. This sprint plugs a lazy-loaded `@zxing/browser`
adapter behind the same detector interface, so those browsers
get live camera scanning with zero UX change beyond a small
badge that tells the user which engine is active.

**New file**: `src/lib/scanner/detector.ts` (~170 lines) defines
`BarcodeDetectorLike`, `DetectorEngine`, and the factory
`createDetector()`. It prefers a native `BarcodeDetector` wrapper
(fast, battery-friendly) and falls back to a lazy `import(
"@zxing/browser")` + `BrowserMultiFormatReader.decode(video)`
adapter. Recoverable scan failures from ZXing
(NotFoundException / ChecksumException / FormatException, plus
string-sniffed equivalents for platforms that throw plain Errors)
map to an empty array so the scanner's throttled RAF loop just
retries on the next tick. A module-scoped `zxingPromise` caches
the dynamic import across start/stop cycles.

**Scanner refactor** (`src/app/(app)/scan/scanner.tsx`):
dropped the inline `globalThis.BarcodeDetector` feature-detect
and `SUPPORTED_FORMATS` constant in favor of calling
`createDetector()` inside `startCamera`. New `engine` state feeds
a small badge in the camera card header — `Native engine`
(secondary) for Chromium, `ZXing fallback` (outline) for
Safari/Firefox, `Loading engine…` (outline + spinner) while the
dynamic import is in flight. RAF throttle, dedupe, and
stop-on-match behavior all unchanged because both engines
present the same `.detect(video)` promise shape.

**i18n**: three new `t.scan.camera` keys (`engineNative`,
`engineZxing`, `engineLoading`) plumbed through
`scan/page.tsx` into `ScannerLabels`. `unsupportedBody` copy
rewritten to drop the old "Chrome/Edge/Android work best"
guidance — the ZXing fallback makes that guidance obsolete.

**New runtime deps**: `@zxing/browser@^0.1.5` and
`@zxing/library@^0.21.3`. Both lazy-loaded via dynamic import
so Chromium users never download the chunk — bundle weight for
Safari/Firefox is ~250KB gzipped, Chromium adds zero.

Files touched:
- `src/lib/scanner/detector.ts` (NEW)
- `src/app/(app)/scan/scanner.tsx`
- `src/app/(app)/scan/page.tsx`
- `src/lib/i18n/messages/en.ts`
- `package.json` + `package-lock.json`

Triple-verified: `tsc --noEmit` exit 0, `biome check src` clean
(178 files — one new vs Sprint 34's 177), `prisma validate`
green.

---

### What Sprint 34 added (v0.34.0-sprint34)

Supplier drill-down detail page at `/suppliers/[id]`. Fixes a real
broken link from Sprint 12 — the supplier-performance leaderboard
(`/reports/suppliers`) has rendered each row as a
`<Link href={"/suppliers/${id}"}>` since it shipped, but until this
sprint the only thing living under `/suppliers/[id]/` was `/edit`,
so clicking through 404'd. No schema changes, no new runtime deps,
no migrations.

NEW `src/app/(app)/suppliers/[id]/page.tsx` (~540 lines) — server
component with a single `supplier.findFirst({ id, organizationId })`
query whose nested include pulls every PO + line + item in one
round-trip. Defense-in-depth: the `organizationId` predicate on
the supplier query is how a cross-tenant URL attack trips
`notFound()` even though `requireActiveMembership` already gates
the route upstream.

Layout is four stacked sections:

 1. **Identity header** — Truck icon + name + mono code + Active
    badge; action buttons row: Back, Edit, New PO (generic
    `/purchase-orders/new` dead-end; a later sprint can add
    `?supplierId=` prefill).

 2. **Three identity cards** (Contact / Address / Notes) — each
    with its own empty state; Contact includes mailto link,
    website external link, and the default-currency chip; Address
    uses a filtered `addressParts` array so no empty lines ever
    render; Notes uses `whitespace-pre-wrap` to preserve the edit
    form's formatting.

 3. **Activity section** with four KPI cards — Received value,
    Total POs (+ open count in body), On-time rate (fraction
    shown in body), Avg lead time (sample size in body). Math
    is **identical** to the Sprint 12 supplier-performance
    report so numbers reconcile byte-for-byte between the two
    surfaces (comment in the page file even flags the parity).
    Mixed-currency caveat banner if `currencyMix.size > 1` or
    any PO uses a non-region currency. Empty state
    (CalendarClock icon + "No purchase orders yet") when
    `totalPos === 0`.

 4. **Recent POs table** — newest-first, hard-capped at 10 rows.
    Seven columns: PO number (mono, deep-links
    `/purchase-orders/[id]`), Status + timeliness badge, Ordered,
    Expected, Received, Lines count, Value. Per-row timeliness
    badge on top of the status badge: RECEIVED + receivedAt +
    expectedAt → compare timestamps and pick destructive "Late"
    / secondary "Early" / default "On time"; SENT or
    PARTIALLY_RECEIVED → outline "Outstanding"; DRAFT /
    CANCELLED → no badge. The "View all purchase orders" ghost
    button links back to `/purchase-orders`.

 5. **Top items card** — top 5 items by total ordered quantity
    from this supplier, with both Ordered qty and Received qty
    columns so the operator can spot chronic short-shipments.
    Aggregation via an in-memory `Map<itemId, {name, sku,
    ordered, received}>` accumulated during the same pass that
    computes the KPIs — no second query, no race.

MODIFIED `src/app/(app)/suppliers/page.tsx` — the name column
cell now wraps in `<Link href={"/suppliers/${id}"}>` with
`hover:underline`. Matches the items / warehouses / categories
table convention: name is the primary navigation, edit/delete
stay in the actions column.

i18n (`src/lib/i18n/messages/en.ts`) — NEW `t.suppliers.detail`
sub-namespace with ~50 keys: `metaTitle`, `backToList`, action
CTAs (`editCta`, `newPoCta`), identity card headings +
`noContact` / `noAddress` / `noNotes` / `currencyLabel` /
`websiteLabel`, activity section (`activityHeading`,
`activitySubtitle`, `emptyActivityTitle`, `emptyActivityBody`),
KPI labels + bodies (`kpiReceivedValueLabel`,
`kpiReceivedValueBody`, `kpiTotalPosLabel`, `kpiTotalPosBody`,
`kpiOnTimeRateLabel`, `kpiOnTimeRateBody`, `kpiAvgLeadTimeLabel`,
`kpiAvgLeadTimeBody`, `kpiNotAvailable`, `daysSuffix`), recent
POs table (`recentHeading`, `recentSubtitle`, `recentViewAllCta`,
seven column labels, four badges), top items card
(`topItemsHeading`, `topItemsSubtitle`, `topItemsEmpty`, three
column labels), plus `mixedCurrencyCaveat`. Deliberately **not**
reusing `t.reports.supplierPerformance` keys even where copy
overlaps — the detail page is an operational view with its own
heading hierarchy, empty states, and action wording, and
decoupled namespaces mean future copy tweaks don't accidentally
ripple between surfaces. All copy routes through `en.ts` — no
Turkish anywhere.

**Design decisions** — single server query with nested include
over a separate aggregate table (scale concerns land after ~5k
POs/supplier, not worth the complexity at MVP); in-memory KPI
roll-up over SQL aggregation (trivial math, rows already in RAM
for the table, shared formulas with the Sprint 12 report);
`findFirst` with explicit `organizationId` over `findUnique` by
id alone (defense-in-depth); no new `?supplierId=` prefill on
`/purchase-orders/new` (needs a PO-form refactor, out of scope);
deep-link from the list page's name column not a separate "View"
button (app-wide consistency with items/warehouses/categories);
no cross-currency FX conversion (deferred with the Sprint 12
historical FX story); defense-in-depth `notFound()` even though
`requireActiveMembership` gates upstream (two cheap gates is the
right default for a multi-tenant detail page).

**No schema changes, no Prisma migration, no new runtime
dependencies.** Triple-verified clean:

- `tsc --noEmit` exit 0
- `biome check src` clean (177 files — one new vs Sprint 33's
  176: `suppliers/[id]/page.tsx`; `suppliers/page.tsx` +
  `en.ts` modified in place)
- `DATABASE_URL=... DIRECT_URL=... prisma validate` → green

---

### What Sprint 33 added (v0.33.0-sprint33)

Invitation email delivery + post-login `?next=/invite/[token]`
redirect bundle. Sprint 20 shipped the capability-token invite
flow but left two loose ends: the admin had to ship the copyable
invite URL out-of-band themselves, and an invitee clicking the
link while signed-out bounced through `/login` and landed on
`/dashboard` instead of the original `/invite/[token]` page.
Sprint 33 closes both — the admin now sees "Email sent to X"
(or "Email not configured — copy the link below" as a soft-miss
variant), and unauthenticated clicks on an invite link now
round-trip through `/login?next=/invite/{token}` or
`/register?next=/invite/{token}` and end on the accept screen.

**Mailer abstraction (five new files under `src/lib/mail/`):**

- `mailer.ts` — `Mailer` interface + `MailMessage` +
  `MailResult` discriminated union. Deliberately minimal: one
  `send(message)` method, no provider shape leakage. Lets the
  action layer stay ignorant of Resend vs. console vs. future
  SES/Postmark.
- `console-mailer.ts` — `ConsoleMailer` implements `Mailer`.
  Logs subject/to + html/text byte counts via `console.info`,
  echoes the plain-text body so a dev copying the invite link
  from the terminal has something to work with even when
  Resend is off. Returns `{ ok: true, id: 'console-${Date.now()}' }`.
- `resend-mailer.ts` — `ResendMailer` class. Talks to Resend's
  REST API directly (`POST https://api.resend.com/emails`) via
  global `fetch` — no `resend` npm SDK. Constructor takes
  `(apiKey, from)` explicitly so tests can instantiate without
  env vars. Non-2xx normalized to
  `{ ok: false, error: 'Resend HTTP <status>: <body>' }`; fetch
  throws (DNS/TLS) caught and wrapped the same way. Never
  throws out of `send()`.
- `index.ts` — `getMailer()` factory reads
  `process.env.RESEND_API_KEY` + `process.env.MAIL_FROM` once,
  caches the result, returns `ConsoleMailer` if either is
  missing else `ResendMailer`. Also exports
  `resetMailerForTests()` and re-exports the types.
- `templates/invitation-email.ts` — `buildInvitationEmail(params)`
  returns `{ subject, text, html }`. Takes pre-resolved i18n
  labels (`InvitationEmailLabels`), an `Intl.DateTimeFormat`,
  and a `roleLabel: string`. `escapeHtml` handles `& < > " '`.
  `applyPlaceholders` does `{key}` → value substitution. HTML
  is table-based with inline styles (email client compat),
  includes a `display:none` preheader div for Gmail preview,
  slate-900 primary button, copyable URL fallback, and footer
  disclaimer.

**Why an adapter instead of calling Resend directly from
`inviteMemberAction`:** tests never reach the network (swap in
`ConsoleMailer` or a recording stub); local dev doesn't need a
Resend API key (admin still has the copyable fallback); and
swapping providers later is a one-file change.

**Why direct `fetch` instead of the `resend` npm SDK:** one
endpoint, Node 20+ has `fetch` globally, fewer deps means less
supply-chain surface and immunity to SDK minor-version drift.

**`inviteMemberAction` (`src/app/(app)/users/actions.ts`):**
the happy-path variant of `InviteMemberResult` gains
`emailDelivered: boolean`. `db.invitation.create` now sits in
its own try/catch; on success, the code calls a new sibling
helper `sendInvitationEmailSafely(params)` which resolves
i18n + region + date formatter, builds the template, calls
`getMailer().send(...)`, and returns a boolean. Delivery
failures are logged+swallowed — the invite row is still valid,
the copyable URL is still returned, so a DNS blip does not
block team onboarding. The helper is a private sibling so the
happy path in the action stays readable and tests can stub
the mailer without reaching into action internals.

**`InviteForm` (`src/app/(app)/users/invite-form.tsx`):**
`InviteFormLabels` splits `success` into `successEmailSent` +
`successLinkOnly`. `InviteCreated` state gains
`emailDelivered: boolean`. Success banner picks the label via
`created.emailDelivered ? successEmailSent : successLinkOnly`,
so the admin always knows whether the invitee got an email or
needs to be pinged through another channel. The users page
(`src/app/(app)/users/page.tsx`) passes both label props.

**`src/lib/redirects.ts` — `isSafeRedirect` helper:**
synchronous, allowlist-based validator for user-supplied
redirect strings. Rules: non-empty string ≤512 chars, must
start with `/` but not `//`, no `\`, no `@`, no control
characters (below 0x20 or 0x7F). Exports `isSafeRedirect` as
a type-guard plus `resolveSafeRedirect(value, fallback)`.
Predictable, impossible to bypass with creative encoding
schemes that `new URL(...)` parsing might miss. Stays
synchronous so it can run in client components.

**Login form (`src/app/(auth)/login/login-form.tsx`):** imports
`resolveSafeRedirect`. Reads `?next=` primarily and falls back
to the legacy `?redirect=` so any existing call site keeps
working. `redirectTo = resolveSafeRedirect(nextParam, "/dashboard")`
and the validated value gets passed to `authClient.signIn.email`
as `callbackURL`.

**Register form (`src/app/(auth)/register/register-form.tsx`):**
imports `resolveSafeRedirect` + `useSearchParams`. Derives
`isInviteFlow = redirectTo.startsWith("/invite/")`. When
`isInviteFlow`, the form skips the `/api/onboarding/organization`
POST entirely (the invitee is joining an existing org, not
creating one), hides the org-name input, and shows an
`inviteeNotice` explainer instead. The success branch
redirects to the validated `redirectTo` (not a hard-coded
`/dashboard`). The register page wires a new
`inviteeNotice: t.auth.register.inviteeNotice` label prop
through.

**Invite page CTAs (`src/app/(auth)/invite/[token]/page.tsx`):**
the unauthenticated "Sign in" and "Create account" buttons now
point to `/login?next=/invite/${encodeURIComponent(token)}` and
`/register?next=/invite/${encodeURIComponent(token)}`. The
token is already base64url-safe but `encodeURIComponent` is
defensive for any future invite format that uses different
characters.

**i18n additions (`src/lib/i18n/messages/en.ts`):**

- `t.users.invite`: `success` → `successEmailSent` +
  `successLinkOnly`
- `t.auth.register`: new `inviteeNotice` key explaining to
  invitees that they're joining an existing organization
- NEW `t.mail.invitation` namespace with 11 keys: `subject`,
  `preheader`, `heading`, `bodyIntro`, `orgLabel`,
  `inviterLabel`, `roleLabel`, `cta`, `expiryNotice`,
  `fallbackLabel`, `footer`. The `Messages` type
  (`export type Messages = typeof en`) automatically picks up
  the new namespace without a manual type declaration.

All copy routes through `en.ts` — no Turkish anywhere, same
rule every sprint has honoured.

**Design decisions** — adapter pattern over direct Resend
call (swappable, testable, key-free dev); direct fetch over
Resend SDK (narrower supply chain); soft-miss on email
delivery failure (invite row is durable, a DNS blip should
not block onboarding); `?next=` primary / `?redirect=`
fallback (memory directive + zero regression for the one
existing call site); allowlist `isSafeRedirect` over
`new URL(...)` parsing (predictable, synchronous, impossible
to bypass with creative encoding); invitee register variant
detected via `redirectTo.startsWith("/invite/")` at render
time (no new query-param shape, no server round-trip); token
`encodeURIComponent` in invite page CTAs (defensive against
future invite-format changes); HTML escape helper inlined
into the template file (one-file mental footprint for email
rendering); table-based email layout + inline styles (email
client compatibility across Gmail/Outlook/Apple Mail).

**Files touched:**

- NEW `src/lib/redirects.ts`
- NEW `src/lib/mail/mailer.ts`
- NEW `src/lib/mail/console-mailer.ts`
- NEW `src/lib/mail/resend-mailer.ts`
- NEW `src/lib/mail/index.ts`
- NEW `src/lib/mail/templates/invitation-email.ts`
- MODIFIED `src/app/(app)/users/actions.ts`
- MODIFIED `src/app/(app)/users/invite-form.tsx`
- MODIFIED `src/app/(app)/users/page.tsx`
- MODIFIED `src/app/(auth)/login/login-form.tsx`
- MODIFIED `src/app/(auth)/register/register-form.tsx`
- MODIFIED `src/app/(auth)/register/page.tsx`
- MODIFIED `src/app/(auth)/invite/[token]/page.tsx`
- MODIFIED `src/lib/i18n/messages/en.ts`

**No schema changes, no Prisma migration, no new runtime
dependencies.** Triple-verified clean:

- `tsc --noEmit` exit 0
- `biome check src` clean (176 files — six new vs Sprint 32's
  170: `redirects.ts`, `mail/mailer.ts`, `mail/console-mailer.ts`,
  `mail/resend-mailer.ts`, `mail/index.ts`,
  `mail/templates/invitation-email.ts`)
- `DATABASE_URL=... DIRECT_URL=... prisma validate` → green

**Environment contract:** production delivery requires
`RESEND_API_KEY=re_...` and `MAIL_FROM="OneAce <noreply@your-domain>"`.
Missing either one falls back to `ConsoleMailer` and the UI
shows the `successLinkOnly` variant — this is the intended
local-dev and CI-build experience.

**What this does NOT cover** (still in the deferred list):
password-reset email flow, email change confirmation,
transactional notifications on organization events,
unsubscribe / preferences center, admin preview of rendered
email, bounce / complaint webhook handling, DKIM/SPF setup
runbook, and per-org `MAIL_FROM` override.

---

### What Sprint 32 added (v0.32.0-sprint32)

Organization ownership transfer — the missing third leg of the
multi-tenancy trio after Sprint 11 (switcher) and Sprint 21
(delete). Until this sprint, the only way an OWNER could hand
the keys to another member was to manually promote a teammate
to OWNER via the users-table role dropdown and then manually
self-demote, leaving the org in a visible two-OWNER intermediate
state. Sprint 32 ships a dedicated atomic transfer flow on the
settings page.

Server action `transferOrganizationAction(targetMembershipId,
confirmation)` in `src/app/(app)/settings/actions.ts`:

- OWNER-only gate. ADMIN can already change other members' roles
  via `updateMemberRoleAction`, but handing over the org-delete
  capability is tighter.
- Active-org is the only anchor — never takes an
  `organizationId` parameter, every lookup is pinned to
  `membership.organizationId` from `requireActiveMembership`.
  Prevents CSRF-style attacks reassigning a different tenant
  the OWNER happens to own.
- Self-target block short-circuits with `reason: "selfTarget"`.
- Typed-confirmation guard — caller must echo the org's slug
  verbatim, same UX pattern `deleteOrganizationAction` uses.
- Target membership must exist and belong to the same org.
- Atomic `db.$transaction([…])` — target role → OWNER, caller
  role → ADMIN in one round-trip. No window with zero OWNERs
  (would brick delete) or two requests racing the only-OWNER
  demotion. If target was already OWNER (step-down scenario),
  the target update is a no-op and the caller demote still
  lands cleanly.
- Caller stays in the org as ADMIN, not MEMBER. Most hand-offs
  want the previous OWNER to retain operational access; a
  clean "leave organization" flow is still in the deferred list.
- Cookie untouched. Caller is still a member, just as ADMIN now;
  `requireActiveMembership` picks up the new role on the next
  navigation thanks to the layout revalidate.
- `revalidatePath("/settings")` drops the transfer card from
  the caller's view, `revalidatePath("/users")` refreshes the
  members-table role badges immediately, `revalidatePath("/",
  "layout")` ensures any future OWNER-gated header chip picks
  up the new role.
- Return shape `{ ok: true; targetName } | { ok: false;
  error; reason }` with five reasons: `forbidden`, `selfTarget`,
  `notFound`, `mismatch`, `transferFailed`.

NEW `src/app/(app)/settings/transfer-ownership-card.tsx`
(~240 lines). Visual language is "advisory destructive" —
`KeyRound` icon instead of `AlertTriangle`, amber outline
instead of destructive red — because unlike delete-org,
transfer does not destroy data, but it IS irreversible without
the new OWNER's help. Layout mirrors `DangerZoneCard` so an
OWNER familiar with the delete flow reads the transfer flow
immediately:

- Member picker `<Select>` server-side filtered to exclude the
  caller. Each row renders name (or email fallback) + secondary
  `email · roleLabel` line so two "Alex" teammates remain
  distinguishable.
- No-candidates fallback — if the caller is the only member,
  the card shows a muted "invite a teammate before
  transferring" explainer instead of rendering a dead dropdown.
- Confirmation `AlertDialog` with `{name}` / `{org}`
  interpolation + slug-echo input. Reset on close so reopening
  never inherits a stale mismatch error.
- CTA locked until a target is selected AND the slug matches
  exactly. `isPending` locks every control during the tx.
- `<output aria-live="polite">` success announcement inside
  the card so screen readers hear "Ownership transferred to
  Alice. You are now an Admin." before `router.refresh()`
  re-renders the server tree and drops the card entirely.

`src/app/(app)/settings/page.tsx` gains `canTransferOwnership`
gate, loads `transferCandidates` with one `membership.findMany`
(excluded self, ordered by `createdAt asc`) mapped to
`{ id, name, email, roleLabel }`, and renders the card ABOVE
the existing `<DangerZoneCard>` so the less destructive
operation is visually adjacent but distinct.

i18n (added under `t.settings.transferOwnership` in
`src/lib/i18n/messages/en.ts`): 13 top-level keys + a 4-entry
`consequences` tuple + a 5-entry `errors` sub-block. All copy
routes through `en.ts` — no Turkish anywhere, same rule every
sprint has honoured.

**Design decisions** — dedicated action over
`updateMemberRoleAction` reuse (atomic avoids intermediate
two-OWNER state visible to audit logs, CSV exports, or a
future billing-per-seat counter); OWNER gate not ADMIN
(mirrors delete-org); slug-echo not name-echo (robust across
devices); caller demotes to ADMIN not MEMBER (preserves
operational access); Select disabled during `isPending` (can't
mid-flight change the target and cause the success toast to
name the wrong person); amber outline not destructive (action
is reversible by the new OWNER — visual language should
reflect that asymmetry); live region inside the card not a
global toast (card unmounts on re-render, so component-level
toast state would be torn down before announcement).

**No schema changes, no Prisma migration, no new runtime
dependencies.** Triple-verified clean:

- `tsc --noEmit` exit 0
- `biome check src` clean (170 files — one new vs Sprint 31's
  169: `transfer-ownership-card.tsx`)
- `DATABASE_URL=... DIRECT_URL=... prisma validate` → green

---

### What Sprint 31 added (v0.31.0-sprint31)

PWA Sprint 8: two long-standing TODOs from the PWA backlog land
together. First, the Sprint 25/30 3-second poll in the offline
queue banner and review screen is replaced with a real
`Dexie.liveQuery()` Observable subscription — writes that land in
`pendingOps` (from the runner, from this tab, or from another tab
via Dexie's BroadcastChannel transport) now re-fire every
subscribed component in the same tick. Second, the queue runner's
`drain()` function is wrapped in a new Web Locks helper so only
one tab at a time scans the table; the other tabs bail
immediately instead of paying the Dexie read cost.

- NEW **`src/lib/offline/use-live-query.ts`** — a ~100-line
  custom React hook wrapping `Dexie.liveQuery()`. Callers pass a
  querier function, a dependency array, and an optional initial
  value; the hook opens a subscription on mount, re-opens it on
  every dep change, and tears it down on unmount. A single
  `biome-ignore lint/correctness/useExhaustiveDependencies`
  suppression sits above the `useEffect` documenting the
  deliberate contract (caller deps drive re-subscription; the
  querier closure is NOT a dep because that would churn on every
  parent render). This replaces a potential `dexie-react-hooks`
  dependency — the useful bit is small enough that inlining
  saves a runtime dep, a version to track, and ~4 KB of the
  offline bundle.
- NEW **`src/lib/offline/queue-lock.ts`** — a ~135-line
  browser-API wrapper around the Web Locks API. Exports
  `withQueueDrainLock<T>(fn)` which runs `fn` under the
  `oneace-queue-drain` lock with `ifAvailable: true` (so a busy
  lock returns `null` immediately instead of queueing). Returns
  `{ acquired: true, value }` on success or
  `{ acquired: false, value: null }` when another tab holds the
  lock. Also exports `isWebLocksSupported()` for future UX that
  wants to surface "cross-tab guard active". An internal
  `getLockManager()` helper does the feature detection: returns
  `null` when `navigator.locks` is missing or when
  `locks.request` is not a function (Safari private mode
  historically gated this). A `null` lock manager means the
  helper runs the callback inline with `acquired: true` —
  exactly how the pre-Sprint-31 runner behaved, so zero
  regression risk on older browsers.
- Modified **`src/components/offline/offline-queue-runner.tsx`**
  — adds `withQueueDrainLock` import and wraps the entire
  `drain()` body in
  `await withQueueDrainLock(async () => { … })`. The outer
  `drainingRef` single-flight guard stays in place as a second
  layer (a single tab still shouldn't fire N parallel drain
  calls even if the lock is free). Header comment block is
  expanded to document the Sprint 31 cross-tab guard story
  next to the Sprint 25 Dexie row-claiming story.
- Modified **`src/components/offline/offline-queue-view.tsx`**
  — the three `useState<CachedPendingOp[]>` arrays and the
  `refresh` callback + `setInterval(3000)` are replaced with
  one `useLiveQuery<QueueRowBuckets>` call that returns
  `{ pending, inFlight, failed }` in a single tick. The three
  action handlers (`handleRetry`, `handleDiscard`,
  `handleClearAllFailed`) drop their `await refresh()` calls
  from the `finally` blocks — the live query picks up the row
  transition as soon as the mutating transaction commits. A
  frozen module-level `EMPTY_BUCKETS` constant is pinned as the
  `useLiveQuery` initial value + render-time fallback so the
  identity stays stable across renders. Header comment block
  explains the Sprint 31 live-query transition.
- Modified **`src/components/offline/offline-queue-banner.tsx`**
  — the `refresh` callback + `setInterval` + `counts` state
  are replaced with `useLiveQuery<QueueCounts>` returning
  `{ pending, failed }`. The remaining `useEffect` only
  subscribes to `window` `online`/`offline` events to drive the
  amber-vs-muted styling decision. Frozen `EMPTY_COUNTS`
  constant pinned. The `pollIntervalMs` prop is kept as a
  dead knob for back-compat with older callers that passed a
  custom interval; a follow-up cleanup sprint can remove it.
- **No i18n changes.** Sprint 31 is pure plumbing.
- **No schema changes, no Prisma migration, no Dexie version
  bump, no new runtime dependencies.** The sprint is additive:
  every existing row in `pendingOps` keeps working exactly the
  same, the runner's dispatcher registry is untouched, and
  every Sprint 30 action handler semantically does the same
  thing — the difference is the UI reflects it in the same
  tick instead of up to 3 seconds later.

Triple-verified clean: `tsc --noEmit` exit 0, `biome check src`
clean (169 files — two new vs Sprint 30's 167: `use-live-query.ts`
and `queue-lock.ts`), `prisma validate` green (with dummy
`DATABASE_URL` / `DIRECT_URL` env vars).

### What Sprint 30 added (v0.30.0-sprint30)

PWA Sprint 7: lands the failed-ops review UI that was deferred by
Sprint 28. Until this sprint, a queued op that permanently failed
(dispatcher throw, offline beyond the retry budget, etc.) was
visible only as a count in the layout banner — the user had no way
to see what was stuck, retry it, or throw it away. `/offline/queue`
is now a force-static review surface that lists every non-succeeded
row in `pendingOps` grouped by status, with retry / discard /
clear-all actions on the Failed section. Zero schema changes; three
small helpers added to the queue library, one new component, one
new route, and a tiny banner enhancement.

- **`src/lib/offline/queue.ts`** — adds three helpers:
  - `requeueFailedOp(id)` — wraps a Dexie `rw` transaction that
    only transitions rows whose current status is `failed`,
    mirroring the `markOpInFlight` safety pattern so two tabs
    clicking Retry at the same moment don't double-dispatch.
    Deliberately does **not** reset `attemptCount` — the retry
    history is signal the runner uses to drive backoff and the
    user to judge whether a row is pathologically stuck.
  - `deleteOp(id)` — idempotent single-row delete; returns
    `true` only if a row existed and was removed.
  - `clearFailedOps(scope)` — bulk delete scoped by the
    `[orgId+userId+status]` compound index so it never touches
    rows belonging to a different tenant or user, even if the
    runner is mid-drain for the same orgId.
- **`src/components/offline/offline-queue-view.tsx`** — NEW.
  Exports `OfflineQueueShell` and `OfflineQueueViewLabels`
  (40-key label bundle). Internal structure:
  `OfflineQueueShell` is the client-only entry point; it runs
  the same scope-discovery routine the stock-counts viewer uses
  (newest-synced `meta` row wins), renders a shared
  `OfflineQueueFrame` (back-link + title + subtitle), and then
  either `OfflineQueueEmpty` or the `OfflineQueueView` body.
  The body polls every 3 seconds and additionally forces an
  immediate `refresh()` in each action's `finally` block so
  the Failed row leaves its section the instant the user
  clicks Retry / Discard rather than waiting for the next
  tick. Sections are rendered in fixed order: `pending`,
  `in_flight`, `failed`. Succeeded rows are deliberately
  omitted — the runner's janitor pass removes them and
  exposing them here would just invite the user to "clear"
  rows that are already gone. Actions live **only** on the
  failed section; both `onRetry` and `onDiscard` are optional
  props and the table hides its Actions column when neither
  is provided, so the pending and in-flight tables render
  read-only. A `busyId` state disables buttons while an
  action is in flight; a `"__bulk__"` sentinel drives the
  clear-all busy state. A transient `<output aria-live="polite">`
  toast auto-dismisses after 4s for confirmation feedback.
  `window.confirm` is used as a zero-dependency guard on the
  destructive Discard / Clear-all paths — cheap, accessible,
  and consistent with how the rest of the offline UI already
  handles destructive confirmations. Payload preview: one
  monospace line of `JSON.stringify(payload).slice(0, 120)`
  wrapped in a try/catch with a translated fallback string,
  so a malformed payload can't crash the view.
- **`src/app/offline/queue/page.tsx`** — NEW force-static page
  (same `export const dynamic = "force-static"` profile as
  `/offline/items` and `/offline/stock-counts`). Zero auth,
  zero DB calls, zero cookie reads — just resolves the
  40-key label bundle from the compiled `en` catalog and
  renders `<OfflineQueueShell labels={labels} />`. Next's
  `searchParams` is deliberately untouched so there's exactly
  one prerender for the route regardless of query string,
  keeping it safe to precache.
- **`src/components/offline/offline-queue-banner.tsx`** —
  gains an **optional** `reviewCta?: string` field on its
  label interface. When a caller passes it, the banner
  renders a small underlined anchor to `/offline/queue` next
  to the failed-count line; when omitted, the banner behaves
  exactly as before. The optionality is deliberate — older
  label bundles (and any future external embed) keep
  compiling and the link simply doesn't render.
- **`src/app/(app)/layout.tsx`** — passes
  `reviewCta: t.offline.queue.reviewCta` into the banner
  label bundle so signed-in users get the link.
- **`src/app/offline/page.tsx`** — adds a third CTA below
  the existing "view cached items" and "view cached
  stock-counts" links so a cold-start-while-offline landing
  also has a path to the queue review screen.
- **`src/lib/i18n/messages/en.ts`** — adds `offline.viewQueueCta`
  (landing-page link text), `offline.queue.reviewCta` (inline
  banner link text inside the existing `offline.queue` block),
  and a new `offline.queueReview` sub-block with 36 keys
  (meta title, page title/subtitle, loading / error / empty
  states, three section titles + empty hints, six column
  headers, three op-type labels, four status labels, retry /
  discard / clear-failed CTAs, two confirm dialog copy
  strings, three toast strings, a retry-disabled hint, an
  `attemptCountTemplate` with an `{count}` placeholder, and
  a `payloadFallback` string for the try/catch).
- **`public/sw.js`** — bumps `CACHE_VERSION` from
  `oneace-sw-v4` to `oneace-sw-v5` so the activate() handler
  evicts the prior precache atomically, and adds
  `/offline/queue` to `PRECACHE_URLS` alongside `/offline`,
  `/offline/items`, and `/offline/stock-counts`. The file
  header comment block records the new sprint line so the
  rationale survives future reads.

### What Sprint 29 added (v0.29.0-sprint29)

PWA Sprint 6: finally delivers the "resume a stock count while offline"
story that Sprint 27 deferred. A stock-count detail page visit while
online now persists the resolved snapshot (header + per-row counted
quantity) into Dexie, and a new `/offline/stock-counts` force-static
route reads those rows back into a list + detail viewer. No schema
changes to Postgres — this is purely a browser-side cache layered on
top of the existing Prisma model.

- **`src/lib/offline/db.ts`** — bumps `OFFLINE_DB_VERSION` from
  `v2` to `v3`. Adds two row types (`CachedStockCount` +
  `CachedStockCountRow`) with the fields the offline viewer
  actually renders (state, methodology, warehouse label, scope
  row count, entry count, per-row expected/counted quantity).
  `CacheMeta.table` union gains `"stockCounts"` so the meta row
  pattern Sprint 23 established extends cleanly. A new
  `.version(3).stores({...})` block appends the two new stores
  — never editing a prior block, because Dexie replays every
  version on open and rewriting v1/v2 corrupts migration graphs
  for anyone upgrading from those points. Index choices:
  `stockCounts.[orgId+userId]` (scope range scan) +
  `stockCounts.syncedAt` (newest-first sort) +
  `stockCounts.state`, and `stockCountRows.countId` (detail
  range scan) + `stockCountRows.[orgId+userId]` (scope cleanup).
  New helper `stockCountRowKey(orgId, countId, snapshotId)`
  prefixes by `countId` so one range scan loads an entire
  count in one shot.
- **`src/lib/offline/stockcounts-cache.ts`** — NEW module.
  Exports server-safe plain types (no Prisma imports) and three
  helpers: `writeStockCountDetail` runs one `rw` transaction
  over the two new tables + `meta` (delete existing rows
  keyed to this count, bulkPut the fresh set, put the header,
  recompute the running scope count for the meta row);
  `readStockCountList` returns the newest-synced-first list
  for a given scope; `readStockCountDetail` returns
  `{ header, rows }` with a defensive cross-user filter so
  one tab can't leak another user's cache on a shared laptop.
  All IndexedDB failures (quota, abort, missing DB) are
  swallowed — the reader returns `{ header: null, rows: [] }`,
  the writer returns `false`.
- **`src/components/offline/stock-count-cache-sync.tsx`** — NEW
  mount-on-detail-page client component. Mirrors Sprint 24's
  `items-cache-sync`: takes `{ scope, header, rows }` as a prop
  (no re-fetch on mount), keys the effect on a snapshot
  signature, dedupes via `lastWrittenRef` (so Strict Mode's
  double-invoke in dev doesn't double-write), and defers the
  Dexie write to `requestIdleCallback` with a `setTimeout(250)`
  fallback for Safari. Renders `null`.
- **`src/app/(app)/stock-counts/[id]/page.tsx`** — piggy-backs
  on the existing bulk lookups (`itemById`, `warehouseById`)
  that the page already does for its own render. After the
  variance computation, builds an `offlineHeader` (nine plain
  fields — no Prisma objects crossing the server/client boundary)
  and an `offlineRows` array pulling per-row `countedQuantity`
  directly from `varianceRows` so no extra walk over
  `count.entries` is needed. `<StockCountCacheSync>` is
  mounted at the top of the return block so it renders `null`
  before the header/content and never affects layout.
- **`src/app/offline/stock-counts/page.tsx`** — NEW
  `force-static` server component. Pulls `getMessages()` (the
  platform default locale because the page is prerendered at
  build time with no request scope), assembles a 34-field
  label bundle, and hands it to `<OfflineStockCountsShell>`.
  Zero auth, zero DB, safe to precache.
- **`src/components/offline/offline-stockcounts-view.tsx`** —
  NEW client component. Top-level `OfflineStockCountsShell`
  reads `?id=` from `window.location.search` on mount (Next's
  `searchParams` prop is disabled on force-static routes — one
  prerender serves every query string) and subscribes to
  `popstate` so the browser back button flips between list and
  detail views without a full reload. The list view
  range-scans `stockCounts.[orgId+userId]` for the
  newest-`syncedAt` scope (same "most-recent wins" rule that
  `offline-items-view` uses); the detail view range-scans
  `stockCountRows.countId` and sorts rows by `itemName` using
  `localeCompare` for deterministic order. Detail view renders
  blind-mode banner + SKU/item/warehouse/expected/counted/
  variance table, with variance computed inline as
  `countedQuantity - expectedQuantity` rather than importing
  the Sprint 27 variance helper so the offline bundle stays
  small.
- **`src/app/offline/page.tsx`** — adds a second CTA
  `View offline stock counts` → `/offline/stock-counts` under
  the existing `View cached catalog` button. A user who loses
  connectivity cold-starts this page and now has two possible
  landing spots, mirroring the two force-static read caches.
- **`public/sw.js`** — bumps `CACHE_VERSION` from
  `oneace-sw-v3` to `oneace-sw-v4` so `activate()` evicts v3
  caches atomically on rollout. `PRECACHE_URLS` gains
  `/offline/stock-counts` so the force-static shell is
  available on cold-start offline navigations the same way
  `/offline/items` has been since Sprint 24.
- **`src/lib/i18n/messages/en.ts`** — 34-key
  `offline.stockCounts` sub-block covering the list shell,
  detail view, state/methodology labels, and the progress
  string (uses the same `{counted}/{total}` placeholder
  pattern the rest of the i18n bundle follows). One new
  top-level `offline.viewCachedStockCountsCta` for the offline
  fallback's second CTA. All English; future locales extend
  en.ts.

**Design decision — cache per-count, not per-list.** Visiting
`/stock-counts` on its own does NOT populate the cache. The
expensive part of a cached count is the scope rows (every item ×
warehouse in scope); those only matter for a count the user is
actually about to walk. Opening a specific count writes that
count's header + rows, so blast radius is one count per
session write. A shared-laptop user doesn't leak one count's
scope into another count's offline view, and the meta row's
"synced X ago" stamp reflects the most recent per-count write.

**Design decision — labels resolved server-side at write time.**
The detail page already does bulk lookups on items and
warehouses for its own render. We piggy-back on those maps to
write `itemSku`/`itemName`/`itemUnit`/`warehouseName` into
Dexie so the offline viewer never cross-references the items
cache at read time. That keeps the viewer's IndexedDB story
to two range scans (header by key, rows by `countId`) with
zero joins.

**Design decision — replace-on-write, mirroring items-cache.**
The writer deletes every `stockCountRows` row keyed on
`countId` before bulkPutting the fresh set. Without tombstones
we can't otherwise reflect a server-side row deletion, so a
full replace inside one Dexie transaction is the honest move.
The hit is tiny because per-count row counts are in the low
hundreds at most.

**Design decision — `force-static` route + client query-string
read.** The parent page is `force-static` so the SW can
precache a single HTML shell. Next's `searchParams` prop is
disabled on force-static (one prerender serves every query),
so the shell exports a `OfflineStockCountsShell` client
wrapper that reads `window.location.search` on mount and
subscribes to `popstate`. List → detail → back works without
a full reload.

**Design decision — point-in-time `entryCount`, live progress
deferred.** The cache captures `entryCount` at write time and
the viewer renders it unchanged. Anything the user queues
locally after the sync lives in the Sprint 25 `pendingOps`
table; reading it into the viewer's progress indicator is a
future enhancement (tracked alongside the Sprint 31 live-query
work) and was deliberately left out of Sprint 29 so the
schema-bump + two-table introduction could ship cleanly
without entangling the reconcile flow.

- **No new runtime dependencies.** Everything in Sprint 29
  uses APIs that ship with the existing Dexie 4.4.2, Next 15,
  and React 19 versions. No new `package.json` entries.

---

### What Sprint 28 added (v0.28.0-sprint28)

PWA Sprint 5: three independent PWA quality-of-life bumps that all sit on
top of the Sprint 22..27 foundation without touching the queue substrate
or the dispatchers. The common thread is "use browser APIs that exist
specifically so PWAs feel like apps, and feature-detect them all the way
down so Safari/Firefox still load the page".

- **`public/sw.js`** — bumps `CACHE_VERSION` from
  `oneace-sw-v2` to `oneace-sw-v3` (so the runtime caches
  get evicted on the next install — mandatory any time we
  change SW behavior) and adds a **Background Sync** event
  listener. The handler matches the single
  `oneace-queue-drain` tag, grabs every open window client
  via `self.clients.matchAll({ type: "window",
  includeUncontrolled: true })`, and `postMessage`s a
  `{ type: "BACKGROUND_SYNC", tag }` envelope to each one.
  The SW itself **does not drain the queue** — the Dexie
  writer is in the main-thread client, and trying to replay
  ops from the SW would double-write. The SW is only a
  wake-up mechanism.
- **`src/lib/offline/queue.ts`** — exports a new
  `QUEUE_DRAIN_SYNC_TAG = "oneace-queue-drain"` constant
  (shared with the SW by convention — they must match or
  the wake-up silently fails) and a new
  `registerBackgroundSync()` helper. The helper is
  feature-detected end-to-end: `typeof navigator`, then
  `navigator.serviceWorker`, then `sw.ready` (to make sure
  there's actually a registration), then the optional
  `registration.sync` property (Chrome only — Safari /
  Firefox will skip this entirely). The `SyncManager` type
  isn't in the DOM lib, so we cast to a minimal shape:
  `{ sync?: { register: (tag) => Promise<void> } }`. Call
  is fire-and-forget with a `.catch(() => {})` so a
  registration failure can never block `enqueueOp` from
  returning. `enqueueOp` calls `registerBackgroundSync()`
  immediately after a successful Dexie `put` — the new row
  is on disk whether or not the browser agrees to wake us
  up later.
- **`src/components/offline/offline-queue-runner.tsx`** —
  adds a fourth drain trigger: a `message` listener on
  `navigator.serviceWorker` that calls `drain()` when the
  envelope's `type` is `"BACKGROUND_SYNC"`. Sprint 26 added
  online + periodic + queue-change triggers; this one is
  the one that fires **after the tab was reopened by the
  OS in response to the SW's sync event**. Registered +
  torn down in the same `useEffect` as the other triggers
  so the cleanup path is symmetric.
- **`src/components/pwa/update-prompt.tsx`** — NEW client
  component. Sprint 22 wired a `message` handler inside
  the SW that responds to `{ type: "SKIP_WAITING" }` by
  calling `self.skipWaiting()` — but nothing in the UI was
  posting that message until now. `UpdatePrompt` watches
  the current registration for a `waiting` worker (and for
  any new install transitioning to `installed` while the
  tab is open), guards against the **first-install case**
  by checking `navigator.serviceWorker.controller` is
  already live (no controller = no prior SW = this is an
  install, not an update), renders a small `<output>` banner
  with "A new version of OneAce is available." plus
  Reload / Later buttons, and on Reload posts
  `SKIP_WAITING` to the waiting worker and listens for
  `controllerchange` to do a one-shot
  `window.location.reload()` once the new worker has
  claimed the page. The `reloaded` latch is important: some
  browsers re-emit `controllerchange` on bfcache restore,
  which would cause an infinite reload loop. Biome's
  `useSemanticElements` rule pushed us from
  `<div role="status" aria-live="polite">` to an actual
  `<output>` element — kept because the semantic element
  is more correct anyway.
- **`src/components/pwa/install-app-button.tsx`** — NEW
  client component. Sprint 22 captures the
  `beforeinstallprompt` event synchronously and parks it on
  `window.__oneaceInstallPrompt` so the button doesn't race
  the event. This component reads that parked handle on
  mount **and** also subscribes to `beforeinstallprompt` in
  case the event fires after the component is alive (e.g.
  bfcache restore). Click calls `prompt.prompt()` then
  `await prompt.userChoice` then clears the handle
  regardless of outcome — an event instance is single-use.
  Listens for `appinstalled` to clear the handle so the
  button disappears without a reload. `BeforeInstallPromptEvent`
  is not in the DOM lib (the spec is still a W3C Editor's
  Draft) so we declare a local interface with only the
  surface we call. Returns `null` when no prompt is
  available — a button that sometimes works is worse than
  no button, so iOS Safari users simply never see it.
- **`src/app/(app)/layout.tsx`** — imports and mounts both
  new components. `<UpdatePrompt labels={...} />` sits
  above `<Header>` so the banner occupies the full width
  inside the lg:pl-64 rail. `<InstallAppButton />` sits in
  a right-aligned flex row between `<OfflineQueueBanner>`
  and `<main>`. Only the `(app)` layout mounts them — the
  `(auth)` routes deliberately have no SW (Sprint 22) and
  therefore have no update story and no install affordance.
- **`src/lib/i18n/messages/en.ts`** — adds a new `pwa`
  block above `offline` with `update.message`,
  `update.reloadCta`, `update.dismissCta`, and `install.cta`
  strings. English-only per the project rule; the other
  locales inherit the fallback path until they are
  explicitly translated.
- **Design decisions (captured in PORT_CHECKLIST.md):**
  SW broadcasts instead of draining to avoid duplicate
  writers; `QUEUE_DRAIN_SYNC_TAG` shared as a const so the
  SW and the main thread can't drift; `registerBackgroundSync`
  is fire-and-forget so enqueue success does not depend on
  sync registration; suppress update prompt on first install
  via the controller check; hard reload after
  `controllerchange` with a one-shot latch to avoid reload
  loops on bfcache; install button returns null when no
  prompt (no disabled affordance); `BeforeInstallPromptEvent`
  typed locally with only the surface we call.
- **Triple-verify:** `tsc --noEmit` exit 0,
  `biome check src` clean (161 files — two new files vs
  Sprint 27's 159), `prisma validate` green (no schema
  changes this sprint).
- **No new runtime dependencies.** Everything in Sprint 28
  uses existing browser APIs + existing React/lucide-react
  imports. Schema unchanged.

### What Sprint 27 added (v0.27.0-sprint27)

PWA Sprint 4 follow-on: the **stock-count entry** path is now offline-first,
mirroring the Sprint 26 movement-create pattern. This is the Flutter moat —
a warehouse counter walking bins on flaky wifi must not lose a single scan.

- **`prisma/schema.prisma`** — adds `idempotencyKey String?`
  nullable column to `CountEntry` plus a compound unique
  index `@@unique([organizationId, idempotencyKey])`. Same
  shape as Sprint 26's StockMovement change: nullable so the
  legacy online FormData action (`addCountEntryAction`) keeps
  working without a key, compound with `organizationId` so two
  tenants can't collide on the same UUID. Pushed via
  `prisma db:push` (no migration file).
- **`src/lib/validation/stockcount.ts`** — new
  `countEntryOpPayloadSchema = z.object({ idempotencyKey:
  z.string().uuid(), input: addEntryInputSchema })` with a
  matching `CountEntryOpPayload` type. Used by the entry form
  (producer), the dispatcher (consumer re-validating a Dexie
  row), and the server action (authoritative).
- **`src/app/(app)/stock-counts/actions.ts`** — substantial
  refactor. New shared `writeCountEntry(args)` helper takes a
  `WriteCountEntryArgs` and returns a
  `WriteCountEntryOutcome` discriminated union
  (`ok | alreadyExists | countNotFound | notEditable |
  outOfScope | transientError`). Both the legacy
  `addCountEntryAction` and the new `submitCountEntryOpAction`
  delegate to it, so every path shares the same count lookup,
  state guard (`canAddEntry`), scope check against
  `countSnapshot`, pre-check-then-insert idempotency
  handling, OPEN → IN_PROGRESS auto-transition, and P2002 race
  fallback. `submitCountEntryOpAction(payload:
  CountEntryOpPayload)` is the queue-aware entry point: never
  throws, wraps `requireActiveMembership` in a try/catch so a
  token expiry reports as `retryable: false` instead of
  crashing the dispatcher, and does **not** revalidate when
  the outcome is `alreadyExists` (a replay on a count that has
  already been closed should not bust caches).
- **`src/lib/offline/dispatchers/count-entry-add.ts`** — NEW
  file. Second concrete dispatcher wired into the Sprint 25
  substrate. Pure client module (no `"use client"` needed
  because no JSX/hooks). Exports
  `COUNT_ENTRY_ADD_OP_TYPE = "countEntry.add"`, a co-located
  `buildCountEntryAddPayload` helper, and
  `dispatchCountEntryAdd: OpDispatcher`. The dispatcher
  defensively re-parses the Dexie payload via
  `countEntryOpPayloadSchema.safeParse` (a stale-client
  payload becomes **fatal** so it surfaces in the failed-ops
  UI instead of looping), calls `submitCountEntryOpAction`,
  translates the `CountEntryOpResult` into a
  `DispatcherResult.kind`, and maps any transport throw to
  `retry`.
- **`src/components/offline/offline-queue-runner.tsx`** —
  registers the second dispatcher at the same seam Sprint 26
  introduced. One import + one map entry:
  `[COUNT_ENTRY_ADD_OP_TYPE]: dispatchCountEntryAdd`. The
  drain loop, triggers, and single-flight guard are
  untouched — every future op type will be added the same way.
- **`src/app/(app)/stock-counts/[id]/entry-form.tsx`** —
  rewritten end-to-end. New required
  `scope: EntryFormScope` prop (`{ orgId, userId }`); the
  previous `scope` prop (the list of snapshot pairs) is
  renamed to `rows` so the shape matches
  `MovementFormScope` from Sprint 26. New
  `generateIdempotencyKey()` uses `crypto.randomUUID()` with
  a Math.random RFC4122 v4 fallback. `handleSubmit` generates
  the key **once** before any network attempt,
  pre-flight-checks `navigator.onLine === false`, tries
  `submitCountEntryOpAction` directly, and falls through to
  `enqueueOp` on transport throw / `retryable: true` / offline
  pre-flight — all using the **same key** so a flaky network
  can't double-count. Non-retryable errors (validation,
  out-of-scope row, count not found, not editable) surface
  inline and are **not** enqueued. `resetAfterSave` clears
  qty + note but **keeps `itemId`** so the counter can hammer
  the same SKU across multiple bin locations without clicking
  the dropdown again. `CloudOff` icon replaces the spinner in
  the pending button when the user is offline.
- **`src/app/(app)/stock-counts/[id]/page.tsx`** — plumbs
  `scope={{ orgId: membership.organizationId, userId:
  session.user.id }}` and the new `submittingLabel` /
  `queuedLabel` labels into `<EntryForm>`. Local
  `scope` variable renamed to `scopeRows` to free the name
  for the new prop shape. Destructures `session` out of
  `requireActiveMembership` alongside `membership`.
- **`src/lib/i18n/messages/en.ts`** — adds
  `t.stockCounts.offlineSubmitting = "Saving…"` and
  `t.stockCounts.offlineQueued = "Entry queued — will sync
  when you're back online."`.
- **Design decisions (captured in PORT_CHECKLIST.md):**
  mirror Sprint 26 end-to-end so both offline ops follow one
  pattern; keep `writeCountEntry` inline in actions.ts rather
  than extracting a cross-module service (the shared code is
  ~40 lines and both callers live in the same file); rename
  `scope` → `rows` instead of inventing a new name; preserve
  `itemId` after save because that's the real ergonomic win
  for a counter walking a warehouse; defer Dexie session-state
  caching (offline resume of an in-progress count) to
  Sprint 29 where it belongs with the `/offline/stock-counts`
  viewer.
- **Triple-verify:** `tsc --noEmit` exit 0,
  `biome check src` clean (159 files), `prisma validate`
  green against the new unique constraint.
- **No new runtime dependencies.** Zod, Dexie, and Prisma
  were all already in the tree. The schema change is additive
  + nullable and was pushed via the `prisma db:push` workflow
  (no migration file).

### What Sprint 26 added (v0.26.0-sprint26)

- **`prisma/schema.prisma`** — adds `idempotencyKey String?`
  nullable column to `StockMovement` plus a compound unique
  index `@@unique([organizationId, idempotencyKey])`. Nullable
  because the legacy online fast-path (the Sprint 14 FormData
  action) doesn't carry a key — only the new queue-aware JSON
  path does. Compound with `organizationId` so two orgs can't
  collide on the same UUID (unlikely but the constraint shape
  should match how we scope everything else).
- **`src/lib/validation/movement.ts`** — new
  `movementOpPayloadSchema = z.object({ idempotencyKey:
  z.string().uuid(), input: movementInputSchema })` with a
  matching `MovementOpPayload` type. Used by the form
  (producer), the dispatcher (consumer re-validating payloads
  from IndexedDB), and the server action (authoritative).
- **`src/app/(app)/movements/actions.ts`** — refactored. New
  internal `writeMovement(args)` helper does the transactional
  ledger write for **both** callers — the legacy FormData
  `createMovementAction` and the new JSON/idempotent
  `submitMovementOpAction`. Shared body, shared membership
  guards, shared stockLevel upserts, shared P2002/P2025
  handling. The new `submitMovementOpAction(payload)` is the
  queue-aware entry point: never throws, returns a
  `MovementOpResult` discriminated union with an explicit
  `retryable: boolean` so the dispatcher can pick the right
  queue verdict. Pre-checks the idempotency index with a
  `findUnique` before opening the transaction so the common
  "replay hit" path is a single indexed SELECT instead of a
  failed INSERT + rollback; P2002 handling inside the catch
  block still covers the rare pre-check-vs-insert race.
- **`src/lib/offline/dispatchers/movement-create.ts`** — NEW
  file. Pure client module (no `"use client"` directive needed
  because no JSX/hooks). Exports
  `MOVEMENT_CREATE_OP_TYPE = "movement.create"`, a co-located
  `buildMovementCreatePayload` helper, and
  `dispatchMovementCreate: OpDispatcher`. The dispatcher
  defensively re-parses the Dexie payload via
  `movementOpPayloadSchema.safeParse` (a malformed row from a
  stale client becomes a **fatal** failure — otherwise it
  would loop forever), calls `submitMovementOpAction`,
  translates `ok/retryable/non-retryable` into
  `DispatcherResult.kind` values, and maps any transport
  throw to `retry`.
- **`src/components/offline/offline-queue-runner.tsx`** —
  registers the first dispatcher at the Sprint 25 seam. One
  import + one map entry:
  `[MOVEMENT_CREATE_OP_TYPE]: dispatchMovementCreate`. The
  top-of-file doc block is updated from "Sprint 25 substrate"
  to "Sprint 25 substrate, Sprint 26 wires the first concrete
  dispatcher". Drain loop, triggers, and single-flight guard
  are all untouched — every future op will be added the same
  way.
- **`src/app/(app)/movements/movement-form.tsx`** — rewritten
  end-to-end. New required `scope: MovementFormScope` prop
  (`{ orgId, userId }`). New `buildInput(form)` helper
  produces a typed `MovementInput` directly instead of a
  FormData blob. New `generateIdempotencyKey()` uses
  `crypto.randomUUID()` with a Math.random RFC4122 v4
  fallback. `handleSubmit` generates the key **once** (before
  any network attempt), pre-flight-checks
  `navigator.onLine === false`, tries
  `submitMovementOpAction` first, and falls through to
  `enqueueOp` on transport throw / `retryable: true` / offline
  pre-flight — all using the **same key** so a flaky network
  can't double-post. Non-retryable errors (validation, missing
  item, membership denied) surface inline with field-level
  messages and are **not** enqueued (would loop forever). New
  `CloudOff` icon replaces the spinner in the pending button
  when the user is offline.
- **`src/app/(app)/movements/new/page.tsx`** — plumbs
  `scope={{ orgId, userId }}` and the new `submittingLabel` /
  `queuedLabel` labels into `<MovementForm>`. Now destructures
  `session` out of `requireActiveMembership` alongside
  `membership`.
- **`src/lib/i18n/messages/en.ts`** — adds
  `t.movements.offlineQueued` and
  `t.movements.offlineSubmitting`.
- **Triple-verify:** `tsc --noEmit` exit 0,
  `biome check src` clean (158 files), `prisma validate` green
  against the new unique constraint.
- **No new runtime dependencies.** Zod, Dexie, and Prisma
  were all already in the tree. The schema change is additive
  + nullable and was pushed via the `prisma db:push` workflow
  (no migration file).

### What Sprint 25 added (v0.25.0-sprint25)

- **`src/lib/offline/db.ts`** — bumps `OFFLINE_DB_VERSION` to 2
  and adds a new `pendingOps` store inside a new
  `.version(2).stores()` block. The v1 block is preserved
  verbatim — editing a prior version in place would corrupt
  Dexie's migration graph because Dexie replays every version
  on open. The migration is **additive**: no existing rows are
  touched, no `.upgrade()` callback is needed. Defines
  `CachedPendingOp` + `CachedPendingOpStatus` (four-state
  lifecycle: `pending`/`in_flight`/`succeeded`/`failed`) and
  indexes chosen for the runner's hot path:
  `[orgId+userId+status]` for scoped drains, `status` alone for
  cross-scope counts, `createdAt` for deterministic FIFO order
  across compactions.
- **`src/lib/offline/queue.ts`** — the full queue API:
  `enqueueOp` (generates a `crypto.randomUUID()` id — falls back
  to a non-crypto id if Web Crypto is missing — which doubles as
  the idempotency key server handlers MUST honor),
  `listOps` / `countOps` (bounded compound-index range scans),
  `markOpInFlight` (runs inside a Dexie transaction that only
  transitions `pending` rows so two tabs can't claim the same
  op — whichever loses gets `null` and moves on),
  `markOpSucceeded`, `markOpFailed` (with a `retryable` flag
  that resets to `pending` or parks as `failed`),
  `releaseInFlight` (unsticks rows from a crashed previous tab),
  `clearSucceededOps` (janitor; default 5 min threshold). Every
  error message is truncated to 500 chars so a runaway server
  stack trace can't bloat the DB.
- **`src/components/offline/offline-queue-runner.tsx`** — a
  `"use client"` **headless** component mounted from the
  `(app)` layout. Single-flight drain (ref guard so a rapid
  online + visibility + mount sequence doesn't fire N parallel
  drains), triggers on `online` + `visibilitychange` + startup,
  releases stuck `in_flight` rows at mount. Exports
  `OpDispatcher` + `DispatcherResult` types; the default
  `DISPATCHERS` registry is **deliberately empty** this sprint.
  Unknown opTypes are marked as **non-retryable** failures so a
  typo or a stale op from a removed dispatcher never loops
  forever. Unhandled throws from a dispatcher are caught and
  marked as fatal so a buggy handler can't oscillate.
- **`src/components/offline/offline-queue-banner.tsx`** — a
  quiet status row mounted above `<main>` in the `(app)`
  layout. Three visible states plus an invisible idle state:
  muted "N waiting to sync" (online + pending), amber "N queued
  offline" (offline + pending), destructive "N failed to sync"
  (any failed). Polls every 3 seconds because Dexie fires no
  row-change events and the runner would otherwise race with
  the banner; a live-query subscription is on the PWA Sprint 5+
  shopping list.
- **`src/app/(app)/layout.tsx`** — mounts the runner (headless)
  and the banner (visible) with a `queueScope` pinned to
  `(membership.organizationId, session.user.id)`. Re-renders on
  org switch because `requireActiveMembership` changes, and the
  runner remounts with the new scope.
- **`src/lib/i18n/messages/en.ts`** — new `offline.queue.*`
  block with 3 keys (`pendingOnline`, `pendingOffline`,
  `failed`) that use the `{count}` placeholder pattern Sprint
  24 established.
- **Non-goals this sprint (deferred to Sprint 26+):** any real
  dispatcher implementation, any server-side changes to
  existing mutation actions, per-op exponential backoff, Web
  Locks for strict cross-tab coordination, a `/offline/queue`
  review UI for failed ops, Dexie live-query subscriptions on
  the banner.
- **Triple-verify:** `tsc --noEmit` exit 0,
  `biome check .` clean (164 files), `prisma validate` green
  (no Prisma schema change — Dexie-side migration only).
- **No Prisma schema changes.** No new runtime dependencies.

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
