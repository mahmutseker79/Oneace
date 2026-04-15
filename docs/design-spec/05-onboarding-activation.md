# Onboarding & Activation

## The one rule

Every onboarding step ends on a real product surface. There are no fake
checklist screens, no confetti celebrations, no "you're all set!" dead-ends.
The user's very next click, every time, should put them in front of the
thing they're actually going to use daily.

This is a reaction to ERP onboarding tropes: seven-step wizards that end on
a dashboard the user has to re-learn. OneAce replaces the "setup complete"
screen with **a real object they created** — a real item, a real count, a
real location.

## Activation events (what we measure)

Activation isn't "account created". It's the first time a user does
something that would hurt to undo. For OneAce these are:

1. **First real item** — either created manually or via CSV import.
2. **First real location** — beyond the auto-created default warehouse.
3. **First movement** — an opening-balance adjustment, a manual receipt, or
   a count-posted adjustment.
4. **First successful stock count** — reconciled with at least one non-zero
   variance or at least one matched row.
5. **First mobile sign-in from second device** — proves the multi-device
   promise.

Onboarding should nudge toward events 1, 2, and 3 in that order. Events 4
and 5 are activation milestones tracked but not explicitly prompted.

## First-run paths

Two entry points lead to different flows.

### Path A — Owner signs up (no invite)

| Step | Screen                          | Status    | Outcome                                |
| ---- | ------------------------------- | --------- | -------------------------------------- |
| 1    | Sign up (email + password)      | **BUILT** | Supabase auth row created              |
| 2    | Create organization             | **BUILT** | Org + owner membership + default role  |
| 3    | Default warehouse auto-created  | **BUILT** | `locations.default=true`, kind=warehouse|
| 4    | Land on `/items` empty state    | **BUILT** | Empty-state CTA: "Add your first item" |
| 5    | Add first item (modal or page)  | MVP       | Form: SKU, name, unit, initial stock   |
| 6    | Redirect to item detail         | MVP       | Shows the item they just made          |

After step 6, onboarding is implicitly done. No checklist, no progress bar.
The only persistent nudge is an "Activation tips" card on the Home page
that dismisses once each tip is satisfied.

### Path B — Invitee accepts invite

| Step | Screen                          | Status    | Outcome                                |
| ---- | ------------------------------- | --------- | -------------------------------------- |
| 1    | Invite email with magic link    | MVP       | Opens `/invite/:token`                 |
| 2    | Sign in or sign up              | MVP       | If new account, minimal form           |
| 3    | Membership + role applied       | MVP       | `memberships` row inserted             |
| 4    | Land on role-appropriate home   | MVP       | Counter→counts tab, Viewer→items list  |

**Key difference:** invitees never see an org-creation step, never see an
empty-state catalog, and never see activation tips for things they can't do.
A counter who lands on an empty items page is confused — they should land
on counts.

## Empty-state design contract

Every list page at MVP has an empty state with four elements:

1. **Illustration or icon** — 48–64px, muted tone, not decorative clutter.
2. **Headline** — 18px / `title`, one line, plain language.
3. **Sub-line** — 14px / `body` muted, one sentence explaining why the list
   is empty and what the user can do about it.
4. **Primary CTA** — the single most common next action. Secondary link for
   "learn more" docs if applicable.

### Inventory of MVP empty states

| Page                | Headline                                      | Sub-line                                              | CTA                |
| ------------------- | --------------------------------------------- | ----------------------------------------------------- | ------------------ |
| `/items`            | "No items yet"                                | "Add your first SKU or import a CSV to get started."  | Add item / Import  |
| `/locations`        | "Just one warehouse so far"                   | "Create more locations when you're ready to split stock."| Add location   |
| `/movements`        | "No movements yet"                            | "Every count adjustment, receipt, and transfer lands here."| Log adjustment|
| `/stock-counts` (IP)| "No open counts. Start a new one."            | (none — CTA is already on page header)                | New count          |
| `/stock-counts` (closed)| "No closed counts yet."                   | "Completed counts appear here with their variance totals."| (none)         |
| `/reports`          | "Nothing to show yet"                         | "Reports fill in automatically as you log movements." | Go to items        |
| Mobile items tab    | "Catalog is empty"                            | "Ask an admin to add items or CSV-import them on the web."| (none)         |
| Mobile counts tab   | "Nothing assigned to you"                     | "When a supervisor starts a count, it shows up here." | (none)             |

All empty states are components not page literals. Shared
`ui/empty-state.tsx` (MVP).

## Permission-denied states

If a user navigates to a page their role can't read, we show a branded
permission-denied screen — **not** a 403 HTTP error page, and **not** an
app crash.

Contents:

- Icon (lock, not the destructive one).
- Headline: "You don't have access to this page."
- Sub-line: one sentence explaining which permission is missing (e.g.,
  "Counts require the `stockcount.read` permission — ask your admin.").
- CTA: "Back to home" primary, "Ask admin" secondary (opens `mailto:` to
  the owner of the current org).

Never expose internal permission key strings to end users — translate them
to human words in the sub-line.

## Activation tips card (MVP)

A single dismissible card on the Home page. Replaces the "onboarding
checklist" pattern. Contents:

- Title: "Getting started with OneAce"
- 3–5 tips, each tip is one line + a small icon + a status ("Not done" /
  "Done" in muted green). Tips are inferred from real data, not from
  checkbox state in user metadata.
- Each tip is clickable → routes to the relevant page.
- "Hide tips" affordance at bottom-right. Permanent hide is one click.

MVP tip inventory:

1. ✅ Add at least one item (checked when `items.count > 1`).
2. ✅ Add a second location (checked when `locations.count > 1`).
3. ✅ Log a movement (checked when `movements.count > 0`).
4. ✅ Run a count (checked when any count is in state `completed`).
5. ✅ Invite a teammate (checked when `memberships.count > 1`).

All five are cheap to compute from counts already in the DB. No separate
`onboarding_state` table.

## Wizards we do NOT build

The Figma prompt calls for multi-step setup wizards — industry selection,
business-type questions, sample-data import. We're cutting all of it at
MVP because:

- Industry-specific defaults can be selected later when we have data to
  build real templates (we'd be making them up today).
- Sample data risks the user confusing sample items with real ones. We've
  seen support tickets on exactly this.
- Multi-step wizards feel long even when short. The real product is a
  better onboarding than any wizard.

POST-MVP candidates (measured against actual user drop-off):

- Guided import wizard for CSVs with column-mapping preview.
- Quick-start templates (retail / warehouse / manufacturing) that seed a
  category tree and unit-of-measure set.
- "Bring your last inventory spreadsheet" tool with a mapping UI.

## Invite flow (MVP)

| Step | Actor     | Screen                                    | Notes                                |
| ---- | --------- | ----------------------------------------- | ------------------------------------ |
| 1    | Owner     | `/admin/members` → Invite button          | Modal: email + role select           |
| 2    | System    | Send email with magic link                | `invites` row with `token`, `expiresAt`|
| 3    | Invitee   | Click link → `/invite/:token`             | Link handler validates + signs in    |
| 4    | Invitee   | Accept or decline                         | Declined invites are logged          |
| 5    | System    | Create membership, revoke invite token    | Single transaction                   |
| 6    | Invitee   | Landed on role-appropriate home           | See Path B above                     |

Invite copy is plain: no emoji, no exclamation marks. Subject line reads
"{InviterName} invited you to {OrgName} on OneAce". Body is three short
lines + the accept link + a fallback URL.

## Auth flows — BUILT surface

What exists today:

- **Sign up** — email + password, confirmation email, redirect to org
  create.
- **Sign in** — email + password, redirect to last-visited page or `/`.
- **Sign out** — clears Supabase session + local `ACTIVE_ORG_KEY`, routes
  to sign-in.
- **Org create** — one field (org name), immediately creates the default
  warehouse.
- **Org switch** — header dropdown, swaps `x-oneace-org` header and
  invalidates all queries.

MVP gaps:

- Password reset via email link.
- Magic-link sign-in (needed for invite flow).
- Two-factor (TOTP) for owners.
- Email change.

POST-MVP:

- SSO (Google / Microsoft).
- SCIM provisioning.
- Session management UI (see active sessions, revoke).

## Activation success metrics

Used internally to decide what to fix next. Not shown to users.

| Metric                                | Target for launch | How we measure                          |
| ------------------------------------- | ----------------- | --------------------------------------- |
| Time to first item                    | < 5 min           | From `auth.users.created_at` to first item|
| Time to first count                   | < 1 day           | First `stock_counts.completedAt`        |
| 7-day return rate                     | > 50%             | Any API call from user 6–8 days later   |
| Invite→join conversion                | > 60%             | `invites.accepted_at` / `invites.count` |
| Mobile activation (from web-only user)| > 25%             | First mobile sign-in after first web use|

These are targets, not shippable features. The metrics dashboard itself is
POST-MVP.

## Copy tone throughout onboarding

- Plain English. No "Let's get you set up!" exclamation marks.
- Second person ("You can add…"), never royal "we".
- No emoji.
- Short headlines (< 6 words where possible).
- CTAs use the verb + noun pattern: "Add item", "New count", "Invite member".
- No "awesome", "amazing", "great job". Operators find it condescending.
