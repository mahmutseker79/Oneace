# MVP Cutline — what ships by 2026-07-03

> Source of truth for scope discipline. If it isn't in the MVP table, it doesn't
> ship on July 3rd. The "Post-MVP" columns are not wishes — they're acknowledged
> commitments to *not* build these before launch so the team can focus.

## Principles behind the cut

1. **The moat ships first.** Stock counting (six methodologies, blind + double-blind,
   variance preview, reconcile with audit-trail linked adjustments) is the thing
   that differentiates OneAce from OneAce's retired surface and from inFlow.
   Everything else exists to make the moat credible.
2. **Ledger truth over breadth.** Items, locations, movements, and stock counts
   form a closed loop. You can audit everything that shipped. PO/SO, BOM, labels,
   rule builder, analytics are intentionally out of MVP because they widen the
   surface without increasing ledger truth.
3. **Mobile is read-heavy + scan-heavy for MVP.** Full count entry from phone is
   in. Editing master data from phone is not — do that on the web.
4. **No new domain logic for MVP.** Everything MVP ships is already in
   `@oneace/core` or trivial UI composition. If a feature needs new core
   functions (forecasting, FEFO, workflow engine), it is Post-MVP by definition.

## MVP — ships 2026-07-03

### Web (`apps/web`)

| Area              | Status    | Notes                                            |
| ----------------- | --------- | ------------------------------------------------ |
| Auth (Supabase)   | **BUILT** | Login, signup, callback, middleware refresh.     |
| Items CRUD        | **BUILT** | Search, create, edit, delete, money fields.      |
| Locations CRUD    | **BUILT** | Warehouse/store/bin/virtual/in_transit kinds.    |
| Movements log     | **BUILT** | Append-only ledger + manual adjustment form.     |
| Stock counts list | **BUILT** | Open vs closed, state badges.                    |
| Stock count create| **BUILT** | 6 methodologies, item picker.                    |
| Stock count entry | **BUILT** | Add entry, live variance (non-blind), cancel.    |
| Reconcile flow    | **BUILT** | Client-side preview → complete → summary tiles.  |
| Org switcher      | **BUILT** | Auto-pick first org, create-org dialog.          |
| CSV import (items)| MVP       | Upload → map → preview → commit. Error report.   |
| Receiving (PO)    | MVP       | Minimal PO list + receive form. No approvals.    |
| Reports v1        | MVP       | Count variance, movement log, low stock. CSV.    |
| Role UI           | MVP       | Badge in top bar + disabled actions when denied. |
| Settings page     | MVP       | Org details, members, roles (list only).         |

### Mobile (`apps/mobile` — Expo)

| Area              | Status    | Notes                                            |
| ----------------- | --------- | ------------------------------------------------ |
| Auth              | MVP       | Supabase session, same flow as web.              |
| Items (read)      | MVP       | Search + detail. No edit.                        |
| Barcode scanner   | MVP       | Expo Camera + zxing. Feed into count entry.      |
| Stock count entry | MVP       | Pick count, scan item, enter qty, sync.          |
| Offline cache     | MVP       | WatermelonDB of active count + items picklist.   |
| Sync status       | MVP       | Online/offline banner, queued count entries.     |

### Cross-cutting

| Area                      | Status    | Notes                                    |
| ------------------------- | --------- | ---------------------------------------- |
| Design tokens             | MVP       | `tokens.json` consumed by both apps.     |
| Permission enforcement    | **BUILT** | Server-side via `requirePermission`.     |
| Audit log (read-only UI)  | MVP       | Filter by actor, entity, time.           |
| Deploy (Vercel + Supabase)| MVP       | Migrations + CI green-check merge gate.  |
| E2E smoke test            | MVP       | Playwright: login → count → reconcile.   |

## Post-MVP — deferred (but captured)

### ERP breadth (built after launch, not before)

- Sales orders + fulfilment + invoicing + payments
- Purchase order approvals workflow (multi-level)
- Supplier management + vendor performance
- Customer management + B2B portal
- Pick lists + pack lists + ship confirmations
- BOM / kitting / assembly orders / material consumption
- Serial & lot tracking (activate, expire, FIFO/FEFO, traceability)
- Label designer (canvas, templates, printer connect, bulk print)
- Warehouse zone map (visual)
- Check-in / check-out for equipment or returnable assets
- Returns / scrap / damage workflows

### Intelligence

- ABC analysis
- Demand forecasting
- Reorder point recommendations
- Seasonal trend detection
- Category performance analytics
- Predictive stock dashboard

### Automation

- Rule builder (triggers, actions, schedules)
- Auto-reorder rules
- Scheduled counts
- Alert rules + alert history
- Webhook configuration
- Channel-specific notifications (Slack/Teams)

### Scanner power-ups

- Multi-scan mode
- Scan-to-pick
- Scan-to-receive
- Offline scan queue with conflict resolution
- Scan history feed

### Tablet-specific

- Split view master-detail shell
- Persistent filter side panel
- Review panel for supervisors
- Dense compact-density tables

### Operational polish

- Global search across entities
- Saved reports + scheduled reports
- Bulk label print queue
- Conflict resolution center (3-way merge UI)
- Sync center dashboard

## Decision log

| Date       | Decision                                              | Why                                               |
| ---------- | ----------------------------------------------------- | ------------------------------------------------- |
| 2026-04-10 | Defer serial/lot to post-MVP                          | No existing core logic; needs traceability model. |
| 2026-04-10 | Defer label designer                                  | Canvas tooling is weeks of work for 0 audit gain. |
| 2026-04-10 | Include CSV import in MVP                             | Without it, first-run onboarding dead-ends.       |
| 2026-04-10 | Mobile is scan+count only for MVP                     | Keeps Expo surface narrow, offline reliable.      |
| 2026-04-10 | Reports v1 is CSV-export only, no visual analytics    | Visual analytics need a chart system (post-MVP).  |
