# Stock Counting — the moat

## Why this is the moat

Inventory SaaS without credible counting is a database with forms. The
ledger is only trustworthy if there is a repeatable, auditable way to prove
it matches reality. Competitors either treat counting as a CSV upload
(OneAce did) or hide it behind consultants (legacy ERP). OneAce wins
by making counting feel like a first-class mobile-driven workflow with a
variance preview, methodology choice, and honest audit trail.

## Methodologies (the six modes)

From `packages/schema/src/enums.ts::COUNT_METHODOLOGIES`:

| Value          | Purpose                                                            | Expected visible? | Typical duration |
| -------------- | ------------------------------------------------------------------ | ----------------- | ---------------- |
| `cycle`        | Rolling subset, part of a monthly/quarterly program.               | Yes               | 30–120 min       |
| `full`         | Entire org or entire location. Usually annual.                     | Yes               | Hours – days     |
| `spot`         | Quick ad-hoc check of suspect SKUs.                                | Yes               | 5–15 min         |
| `blind`        | Counter doesn't see expected qty (honesty test).                   | **No**            | 30–120 min       |
| `double-blind` | Two counters count independently, system reconciles.              | **No**            | 2× a cycle       |
| `directed`     | System-selected items (top variance drivers, high-value, ABC A).   | Yes               | 15–60 min        |

**Implementation note.** The blind modes only hide the expected qty in the
UI — the snapshot is still persisted server-side. Do not ever store "blind"
as an absence of data; it's purely a view-time affordance.

## State machine

Matches `COUNT_STATES` enum and `canTransition()` in `@oneace/core/stockcount/machine`.

```
  open ───────► in_progress ───────► completed
    │                │
    │                └──────────────► cancelled
    └──────────────────────────────► cancelled
```

Transitions:

- `open` → `in_progress` — auto, on first count entry.
- `open` → `cancelled` — cancel dialog (reason required).
- `in_progress` → `completed` — reconcile flow with `applyAdjustments` toggle.
- `in_progress` → `cancelled` — same dialog as `open`.
- `completed` and `cancelled` are terminal.

## Screen inventory

| #  | Route                                    | Status    | Methodology support | Device    |
| -- | ---------------------------------------- | --------- | ------------------- | --------- |
| 1  | `/stock-counts`                          | **BUILT** | All six             | Web       |
| 2  | `/stock-counts/new`                      | **BUILT** | All six             | Web       |
| 3  | `/stock-counts/[id]`                     | **BUILT** | All six             | Web       |
| 4  | `/stock-counts/[id]/reconcile`           | **BUILT** | All six             | Web       |
| 5  | Mobile: count list                       | MVP       | All six             | Mobile    |
| 6  | Mobile: active count (scan+enter)        | MVP       | All six             | Mobile    |
| 7  | Mobile: variance preview summary card    | MVP       | All six             | Mobile    |
| 8  | Split to sheets wizard                   | POST-MVP  | `full`, `cycle`     | Web/Tablet|
| 9  | Sheet assignment (to counter)            | POST-MVP  | Same                | Web/Tablet|
| 10 | Dual-count merge / compare               | POST-MVP  | `double-blind`      | Web/Tablet|
| 11 | Supervisor review (approve variances)    | POST-MVP  | All six             | Tablet    |
| 12 | Printable count sheet (PDF)              | POST-MVP  | `full`, `cycle`     | Web       |
| 13 | Freeze inventory state overlay           | POST-MVP  | `full`              | Web       |
| 14 | Scheduled count rule                     | POST-MVP  | All six             | Web       |

## Screen 1 — Count list (BUILT)

**Purpose.** Show all counts for the active org, split by lifecycle state so
supervisors know at a glance what needs attention.

**Data.** `trpc.stockCounts.list` — returns rows ordered by `createdAt asc`.

**Header.** Page title "Stock counts" + description + primary CTA "New count".

**Sections.**

1. **In progress** card — rows where `state IN (open, in_progress)`.
2. **Closed** card — rows where `state IN (completed, cancelled)`.

**Row columns.** Name (bold), state badge (pill), methodology (muted), created
timestamp (relative on mobile, absolute on desktop), "Open" button.

**Empty states.**

- In-progress empty: "No open counts. Start a new one."
- Closed empty: "No closed counts yet."

**Loading.** Skeleton rows × 3 in each card.

**Error.** Destructive text banner below cards.

**Post-MVP extensions.**

- Filter by methodology, location, creator.
- Search by name.
- "Assigned to me" tab for counters.
- Sort by variance size on closed counts.

## Screen 2 — Create count (BUILT)

**Purpose.** Lock in the scope of what's about to be counted and freeze the
expected-quantity snapshot before the first counter starts.

**Data flow.**

1. `trpc.items.list` feeds the item picker (search `ilike` on name).
2. `trpc.locations.list` feeds the location filter.
3. On submit, `trpc.stockCounts.create` runs a DB transaction that:
   a. Pulls movement history for the selected items.
   b. Calls `ledger.deriveStockBatch` to compute expected qty per (item, location).
   c. Inserts the count row + snapshot rows atomically.

**Header area.** Back button, page title.

**Scope card.**

- Name input — required, placeholder "Q2 cycle — bin A".
- Methodology select — six options labeled as above.
- Location filter select — optional, defaults to "All locations".
- Helper text explains what location scope means.

**Items card.**

- Search input (magnifier icon left).
- Scrollable table, max-height 420px, sticky header inside.
- Columns: checkbox, SKU (mono), Name.
- "Select all visible" checkbox in header.
- Selected count chip in card description: "X selected".
- Pagination hint: "Showing first N of M. Narrow the search to see more."

**Validation.**

- Name required (trim-tested).
- At least one item required.
- Errors surface as a destructive text line above the footer.

**Footer.** Cancel + Create. Primary button shows "Creating…" while pending.

**Post-MVP extensions.**

- Item filter by category, tag, location, low stock.
- Bulk select via SKU list paste.
- "Copy from previous count" quick action.
- Preview expected total quantity before submit.

## Screen 3 — Count detail (BUILT)

**Purpose.** The working surface. Counters add entries; the UI aggregates them
live and shows variance status (unless blind).

**Data.**

- `trpc.stockCounts.byId({ id })` returns `{ count, snapshots, entries }`.
- `trpc.stockCounts.itemsInCount({ id })` returns SKU/name lookup.
- Variances computed **on the client** via `stockcount.calculateVariances`
  from `@oneace/core` — same function the server uses on complete, so no
  server call needed for preview.

**Header row.**

- Back button.
- Title = count name.
- Meta row: state badge, methodology, created, started (if present).
- Action cluster: "Cancel" (ghost) and "Reconcile" (primary), both gated
  by `stockcount.canTransition`.

**Add entry card** (only when editable):

- Four-column grid on desktop: item select, counted qty, optional note, Add button.
- Item select is populated from `itemsInCount`.
- Counted qty: type=number, min=0, step=1. Rejects negatives and non-integers.
- On success, fields reset, query invalidates, new row appears in entry log.

**Items-in-count table.**

- Columns: SKU, Name, Expected (hidden if blind), Counted, Variance, Status.
- Variance cell colors: green for match, amber for positive, red for negative.
- Status cell uses `VarianceBadge` molecule.
- When methodology is `blind` or `double-blind`, the Expected/Variance/Status
  columns are removed, not just hidden, so counters cannot leak info via
  inspect-element.

**Entry log card.**

- Append-only list of all entries, sorted newest first.
- Columns: When (relative), Item, Qty, Note.
- Empty state: "No entries yet. Add one above to get started."

**Cancel dialog.** Reason field (required), destructive confirm button.

**Post-MVP extensions.**

- Inline edit/delete of entries (currently append-only via aggregate-sum).
- Supervisor comment thread on a line item.
- Elapsed timer in the header (from `startedAt`).
- Progress ring (counted items / total items).
- Live concurrent-edit indicator (who else is on this count right now).
- Blind-mode "second counter" view that suppresses the first counter's
  entries.

## Screen 4 — Reconcile (BUILT)

**Purpose.** Review variances, decide whether to post ledger adjustments,
complete the count.

**Preview.** Variances computed client-side from the same pure `@oneace/core`
function the server runs on `complete`. This keeps the preview consistent
with what will actually be posted, with zero extra network calls.

**Summary tiles.** A 6-tile grid:

1. Total items
2. Matched (green)
3. Within tolerance (blue)
4. Over (amber)
5. Under (red)
6. Net unit variance (signed)

**Variance detail table.** SKU, Name, Expected, Counted, Variance (signed,
colored), Status badge. Sorted same order as snapshots (insertion order).

**Post card.**

- Checkbox: "Apply ledger adjustments automatically" (default true).
- Warning when unchecked: "Count will be marked completed but the ledger
  will stay out of sync until adjustments are posted manually."
- Primary button "Complete count" — calls `trpc.stockCounts.complete`.

**On success.**

- Redirect-in-place to a success state showing the final summary.
- Invalidate `stockCounts.*` and `movements.*` queries.
- Buttons: "View count", "Back to all counts".

**Audit trail.** Each non-zero variance posts a movement row:

- Positive variance (found extra) → movement type `count-adjustment`, qty abs.
- Negative variance (shrinkage) → movement type `shipment`, qty abs.
- `referenceId = count.id` — double-links ledger back to the count.
- `metadata.variance = signed int` — raw variance stored for reports.

## Blind methodology rules

**UI must:**

1. Remove Expected, Variance, and Status columns from the data-entry table.
2. Hide the summary tiles in the detail view until reconcile.
3. Still allow the reconcile screen to show the full preview (that's where
   the blind is broken — supervisor takes responsibility at post time).

**UI must not:**

1. Include expected qty in any DOM attribute or tooltip.
2. Show the variance-live feedback after adding an entry.
3. Reveal entries from the other counter (in double-blind).

## Double-blind methodology rules

- Two entries per (item, location), from two distinct `countedByUserId`s.
- Each counter sees only their own entries.
- Reconcile compares the two counters' aggregates:
  - Both match expected → auto-approve.
  - Both match each other but not expected → single variance recorded.
  - Disagree → "dispute" status. A supervisor must resolve (POST-MVP).
- The existing `aggregateEntries` sums all entries; MVP treats double-blind
  as a single aggregated count and flags any entry with a distinct
  `counterTag` (already an optional field in `addEntry` input).

**MVP cut:** double-blind is supported at the data layer and the user can
pick the methodology, but the dispute resolution UI is Post-MVP. Before
then, supervisors should use `blind` not `double-blind`.

## Mobile-specific screens

### Mobile screen — count list (MVP)

- Vertical list of cards. Each card: name, state badge, methodology, relative
  created time.
- FAB "New count" in bottom-right (Post-MVP cuts this to web-only creation).
- Pull to refresh.

### Mobile screen — active count (MVP)

- Sticky header: count name, state badge, elapsed time.
- Big scan button ("Scan barcode") in center.
- After scan: success feedback → auto-focus counted-qty input → soft keyboard
  opens → pressing "Add" pushes entry and resets.
- Below: most recent 10 entries in reverse order.
- Offline indicator in top bar when disconnected.
- When offline, entries are queued in WatermelonDB and show a "queued"
  badge until synced.

### Mobile screen — variance preview (MVP)

- After all items counted, counter taps "Submit for review".
- Shows client-computed summary (same tiles as web reconcile).
- Counter does **not** have reconcile permission (`stockcount.reconcile`),
  so the "Complete" button is replaced with "Notify supervisor".
- Supervisor finishes from web.

## Data model touchpoints

For reference when writing tests or new features:

- `stock_counts` — lifecycle columns: `state`, `startedAt`, `completedAt`,
  `cancelledAt`, `cancelReason`. `methodology` is immutable post-create.
- `count_snapshots` — one row per `(count, item, location)` with
  `expectedQuantity` frozen at create time.
- `count_entries` — append-only, `countedByUserId`, `counterTag`, `countedAt`.
- `movements` with `type = count-adjustment` — only written by the reconcile
  flow. Never written manually. Carries `referenceId = count.id`.

## Acceptance criteria for MVP

1. A warehouse manager can create a count, have a counter enter quantities
   from their phone, and reconcile on the web, all within 15 minutes.
2. Reconcile preview matches post result exactly (byte-for-byte) for every
   non-blind methodology.
3. A blind count's expected qty never appears in any web DOM until the user
   navigates to `/stock-counts/[id]/reconcile`.
4. Cancelling a count preserves the snapshot + entries for audit.
5. A completed count's movements are discoverable from the movements log
   with a filter by `referenceId`.
6. Offline mobile entries sync cleanly when connectivity returns and never
   double-post on flaky networks.
