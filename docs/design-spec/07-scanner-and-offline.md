# Scanner & Offline

## Why this chapter exists

The moat isn't just stock counting — it's stock counting **that works in
the aisle**. That means a scanner that handshakes like a real barcode gun
and an offline layer that never silently drops data. Both of these failure
modes ("I scanned 200 items and half are missing" / "I lost network and
everything vanished") are the canonical reasons operators fire inventory
SaaS vendors. The scanner and the sync layer are where trust is earned or
permanently lost.

## Scanner principles

1. **Scanner is the primary input, keyboard is the fallback.** Forms must
   focus-and-accept scanner input without any user tap.
2. **Scanner is device-native, not web.** We do not ship a web-based camera
   scanner in MVP. Mobile only, Expo + `expo-camera` + `expo-barcode-scanner`.
3. **One scan = one decision.** Every scan resolves to exactly one of:
   match / not-found / ambiguous / error. No spinners longer than 200ms.
4. **Feedback is audible and haptic, not just visual.** Warehouses are loud
   and gloved. Sound is the cheapest redundancy.
5. **Off-rhythm scans are caught.** If a user scans twice in < 500ms we
   treat it as the same scan, not two. Prevents bounce double-counts.

## Scanner modes

| Mode              | Status    | Where                           | Purpose                                    |
| ----------------- | --------- | ------------------------------- | ------------------------------------------ |
| Lookup            | MVP       | Scan tab (standalone)           | "What is this item? How many on hand?"     |
| Count entry       | MVP       | Active count screen             | Scan → auto-increment or prompt quantity   |
| Receive           | POST-MVP  | Receiving flow                  | Scan a PO line → confirm received qty      |
| Pick              | POST-MVP  | Pick list screen                | Scan to confirm correct item picked        |
| Transfer          | POST-MVP  | Transfer flow                   | Scan from + scan to locations              |
| Label print       | POST-MVP  | Item detail                     | Print a label from the last scanned item   |

## Scanner screen (MVP) — layout

```
┌─────────────────────────────────────┐
│ ← Back          Scan               │ ← top bar, 56pt
├─────────────────────────────────────┤
│                                     │
│         [ CAMERA VIEWFINDER ]       │
│                                     │
│       ┌───────────────────┐         │
│       │                   │         │ ← target frame (reticle)
│       │    (ALIGN CODE)   │         │
│       │                   │         │
│       └───────────────────┘         │
│                                     │
│         Target a barcode            │ ← helper text
│                                     │
├─────────────────────────────────────┤
│  [  Torch  ]         [ Enter code ] │ ← action bar
└─────────────────────────────────────┘
```

- Viewfinder: full-bleed camera preview with dimmed edges. Reticle 250×150
  centered. White 2px stroke. Corner accents pulse while idle.
- **Torch button** — toggles camera torch on supported devices.
- **Enter code button** — opens a text input modal for manual barcode
  entry. Used when: code is damaged, glare prevents scan, or device has no
  camera (dev only).

## Scanner result states

Every result is a single frame with five elements: status color, icon,
primary line, secondary line, action row.

### Success (found)

- Color: `status.scan.success` (green).
- Icon: check in circle.
- Primary: item name.
- Secondary: SKU + current on-hand (if the user's role can read it).
- Actions: "Scan another", "Open item" (secondary), "Add to count" (primary,
  only when reached via count-entry mode).
- Haptic: light success (iOS `.success`, Android short tick).
- Sound: short major-second chime (off by default, enabled in settings).

### Not found

- Color: `status.scan.not_found` (amber).
- Icon: question mark in circle.
- Primary: "No item matches that code."
- Secondary: scanned code in mono.
- Actions: "Scan again", "Create item from code" (POST-MVP, hidden at MVP).
- Haptic: medium warning.

### Error (camera / decode)

- Color: `status.scan.error` (red).
- Icon: alert triangle.
- Primary: "Couldn't read the code."
- Secondary: human-readable reason ("Camera permission denied",
  "Couldn't decode barcode").
- Actions: "Try again", "Enter code manually".
- Haptic: strong error.

### Ambiguous (barcode matches multiple items)

- Color: amber.
- Icon: list.
- Primary: "Multiple items matched."
- Secondary: count of matches.
- Actions: shows a bottom sheet with the matching items; user picks one.
- This is rare but happens when two items share a barcode (vendor reuses).

### Offline match-from-cache

- Same success frame, plus a small "from cache" pill next to the secondary
  line.
- If the scanned code isn't in cache: shows "Not found — will re-check
  online" state with the code queued for server verification when sync
  resumes.

## Scan→count handshake

The highest-value flow. Sequence:

1. User opens a count on mobile, taps "Scan".
2. Scanner opens in **count entry mode** (top bar shows count name +
   elapsed time).
3. On first successful scan:
   a. Haptic + sound.
   b. Quantity input sheet slides up from the bottom.
   c. Keyboard auto-opens with numeric pad.
   d. Cursor focused in the quantity field, initial value = 1.
4. User types quantity or accepts default, taps "Add".
5. Entry is appended to the count, sheet closes, camera re-arms.
6. Recent-entries strip at the bottom updates with the new entry.

Tuning notes:

- Sheet auto-opens in 150ms after success feedback — any faster feels
  jarring on first scan.
- Quantity default is **1** (not the last quantity). Counting five of the
  same item should be five scans, not one scan + five.
- If the same SKU is scanned within 500ms, the next entry starts at
  `lastQty + 1`. This supports "hold the trigger" scan guns.

## Manual entry fallback

- Accessible from every scanner screen via "Enter code".
- Input accepts any string 4–64 chars.
- Submitting runs the exact same match pipeline as a scanned code.
- Manual entry is logged with `source = "manual"` in the entry record
  (Post-MVP; for MVP we just don't distinguish).

## Offline model

### Where state lives

- **Web (desktop)** — online-only at MVP. Web is considered a "connected"
  surface. No offline queue, no service worker.
- **Mobile** — offline-first via **WatermelonDB** + custom sync adapter.
- **Shared** — domain functions are pure in `@oneace/core`; they run
  identically on client and server.

### What is cached on mobile

| Collection          | TTL       | Refresh strategy                            |
| ------------------- | --------- | ------------------------------------------- |
| Items               | 24h       | Pull on sign-in; pull on org switch; pull on manual refresh |
| Locations           | 24h       | Same                                        |
| Active counts       | Live      | Push-subscribed via Supabase realtime       |
| Count entries (mine)| Live      | Kept in WatermelonDB until sync ack         |
| Movements           | Not cached| Too large; fetched on demand, paginated     |

### Write queue

All mutations on mobile go into an append-only queue table in WatermelonDB
before they touch the network. Each row has:

- `id` (ULID, generated client-side)
- `type` (`stockcount.addEntry`, `item.update`, etc.)
- `payload` (json)
- `createdAt`
- `attemptedAt`, `lastError`, `attempts`
- `syncedAt` (null until ack)

The UI reads from the queue + server merge so that a just-entered row shows
instantly, even before sync.

### Sync loop

1. App becomes foreground / network comes back.
2. Sync worker pulls new server state (delta since last successful sync)
   into local collections.
3. Sync worker drains the write queue in order, one mutation at a time.
4. Each mutation is optimistic-safe because server operations are
   **idempotent on the client-generated ULID** (`id` as a dedupe key).
5. Successful mutations are stamped `syncedAt`. Failed mutations are left
   with `lastError` and retried with exponential backoff.
6. Sync indicator updates on every transition.

### Sync indicator states

Uses `status.sync.*` tokens from the design-token file.

| State        | Color              | Icon          | When                                     |
| ------------ | ------------------ | ------------- | ---------------------------------------- |
| `online`     | green              | cloud-check   | Queue empty, last sync < 60s             |
| `syncing`    | blue               | spinner       | Currently pushing or pulling             |
| `offline`    | gray               | cloud-off     | No network                               |
| `error`      | red                | cloud-alert   | Sync failed after max retries            |
| `conflict`   | amber              | alert-triangle| Server rejected a mutation (see below)   |

The indicator lives in the top bar of every mobile screen and the sidebar
footer on web. Tapping it opens the sync center (POST-MVP; at MVP, a toast
with details).

## Conflict resolution (MVP vs POST-MVP)

### MVP behavior

- Conflicts are rare at MVP because the only mutation that can conflict is
  `stockcount.addEntry` — and entries are append-only with unique IDs, so
  the server accepts them all.
- The only real conflict case is "count was completed/cancelled server-side
  while the mobile user was still adding entries offline." In this case:
  - Server rejects with a specific error.
  - Mobile shows a destructive toast: "This count was already completed.
    Your local entries weren't saved."
  - User's offline entries are moved to a "rejected" bucket and exported as
    JSON for support review.

### POST-MVP conflict center

- Dedicated screen showing rejected mutations.
- Per-row: reason, what was attempted, "discard" / "re-submit" actions.
- Supervisor-level conflict review for `double-blind` counts where two
  counters disagree on a line (beyond the scope of addEntry — needs a new
  `entry.override` mutation).

## Offline UX rules

1. **Show the state, don't hide it.** Offline is a normal state, not an
   error. Users shouldn't feel broken for being offline.
2. **Pre-write, don't pre-validate.** Validation that requires the server
   (e.g., "does this SKU exist in another org?") must gracefully degrade.
3. **Queued actions are visible.** Any row that represents a queued write
   carries a "pending" pill or subtle animation.
4. **Destructive actions are never allowed offline unless idempotent.** No
   "delete item" offline — the user can't verify downstream effects.
5. **Clock skew is server-authoritative.** All `createdAt` fields are
   server-stamped on sync, not device-stamped, so two offline entries never
   appear out of order.

## Camera permissions flow

First-time scanner use on mobile:

1. User taps Scan tab.
2. If permission not yet granted: show a pre-prompt screen explaining why
   we need camera ("OneAce uses your camera to scan barcodes. Your photos
   are never uploaded.") with a big "Allow camera" button.
3. Pressing Allow triggers the native OS prompt.
4. If OS-denied: land on a dead-end state with copy "We can't scan without
   camera access. Open settings to change this." + "Open settings" button
   that deeps into OS settings.
5. If granted: full scanner screen loads.

Never call the OS permission prompt cold — it destroys conversion.

## Developer-only manual entry mode

For dev and QA, a long-press on the scanner screen header toggles "manual
mode" that accepts keyboard input from a USB barcode scanner or a paired
Bluetooth scanner gun. This is not user-facing but must exist for internal
testing before real devices ship.

## Acceptance criteria

1. A scan that matches an item must complete the success feedback frame
   within **200ms** on a representative mid-range Android device.
2. 100 scan→count entries over a flaky cellular connection must all arrive
   on the server exactly once, in order, after 30 seconds of online time.
3. A camera-permission denial must never strand the user — there is always
   a "Try manual" fallback visible.
4. Sync indicator must refresh within 1 second of connectivity change.
5. No scan is ever silently dropped. If a code can't be decoded three
   frames in a row, the user sees the error state within 500ms.
6. Killing the app mid-count must preserve all unsent entries on re-launch.
