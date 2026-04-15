# Role-Based Access

## Why RBAC is in the design spec

RBAC isn't a settings-page feature. It's a **design constraint** that
touches every screen: nav visibility, button visibility, read-only states,
permission-denied fallbacks, and invite copy. Getting RBAC right at MVP
means we can sell to multi-warehouse teams without shipping a fake
"everyone is an admin" product that we quietly walk back later.

## Permission primitives

Two layers:

1. **System permission keys** — defined in
   `packages/schema/src/enums.ts::PERMISSION_KEYS`. These are the atoms.
   Custom roles can combine any subset of them.
2. **Built-in roles** — pre-composed bundles of keys shipped with every
   org, from `MEMBERSHIP_ROLES`: `owner`, `admin`, `member`, `viewer`.
   Custom roles (POST-MVP) let orgs compose their own.

### Full permission-key list (from enum)

| Domain        | Keys                                                                          |
| ------------- | ----------------------------------------------------------------------------- |
| Catalog       | `item.read`, `item.write`, `item.delete`, `location.read`, `location.write`, `location.delete` |
| Ledger/counts | `movement.read`, `movement.write`, `stockcount.read`, `stockcount.write`, `stockcount.reconcile` |
| Orders        | `purchase_order.read`, `purchase_order.write`, `purchase_order.approve`, `sales_order.read`, `sales_order.write`, `sales_order.fulfill` |
| Partners      | `supplier.read`, `supplier.write`, `customer.read`, `customer.write`          |
| Admin         | `org.admin`, `member.manage`, `role.manage`, `billing.manage`, `audit_log.read`, `tax_rate.manage` |

### Built-in role → permission mapping

| Key                         | owner | admin | member | viewer |
| --------------------------- | :---: | :---: | :----: | :----: |
| `item.read`                 | ✓     | ✓     | ✓      | ✓      |
| `item.write`                | ✓     | ✓     | ✓      |        |
| `item.delete`               | ✓     | ✓     |        |        |
| `location.read`             | ✓     | ✓     | ✓      | ✓      |
| `location.write`            | ✓     | ✓     | ✓      |        |
| `location.delete`           | ✓     | ✓     |        |        |
| `movement.read`             | ✓     | ✓     | ✓      | ✓      |
| `movement.write`            | ✓     | ✓     | ✓      |        |
| `stockcount.read`           | ✓     | ✓     | ✓      | ✓      |
| `stockcount.write`          | ✓     | ✓     | ✓      |        |
| `stockcount.reconcile`      | ✓     | ✓     |        |        |
| `purchase_order.read`       | ✓     | ✓     | ✓      | ✓      |
| `purchase_order.write`      | ✓     | ✓     | ✓      |        |
| `purchase_order.approve`    | ✓     | ✓     |        |        |
| `sales_order.read`          | ✓     | ✓     | ✓      | ✓      |
| `sales_order.write`         | ✓     | ✓     | ✓      |        |
| `sales_order.fulfill`       | ✓     | ✓     | ✓      |        |
| `supplier.read`             | ✓     | ✓     | ✓      | ✓      |
| `supplier.write`            | ✓     | ✓     | ✓      |        |
| `customer.read`             | ✓     | ✓     | ✓      | ✓      |
| `customer.write`            | ✓     | ✓     | ✓      |        |
| `org.admin`                 | ✓     |       |        |        |
| `member.manage`             | ✓     | ✓     |        |        |
| `role.manage`               | ✓     |       |        |        |
| `billing.manage`            | ✓     |       |        |        |
| `audit_log.read`            | ✓     | ✓     |        |        |
| `tax_rate.manage`           | ✓     |       |        |        |

**Design implication of the "reconcile" split.** The `stockcount.reconcile`
permission is deliberately higher than `stockcount.write`. A counter
(`member`) can add entries all day but can't post ledger adjustments. A
supervisor (`admin` or custom role) is the one who finalizes. This matches
every real-world warehouse audit workflow.

## How permissions flow through the UI

Three mechanisms, from coarse to fine:

1. **Nav filtering** — done in `components/sidebar.tsx` (web) and the
   mobile shell. Entries whose `.read` permission is missing are removed
   from the tree entirely. See [`04-information-architecture.md`](./04-information-architecture.md).
2. **Page-level gate** — a route wrapper reads the user's perms from the
   tRPC session and shows the permission-denied fallback if the user lacks
   the required key for that route.
3. **Component-level gate** — individual buttons and form fields hide or
   disable based on a `usePermission('item.write')` hook. This hook is
   pure client-side for UI only; the server re-checks on every mutation.

**Golden rule.** The server is the source of truth. Client-side gates are
for display only — the UI must still gracefully handle a 403 from the
server (e.g., if a user's role was downgraded mid-session).

## Permission matrix by screen

Read rows tell you what's required to *open* the screen. Write rows tell
you what's required to take the primary action.

### Items

| Action                      | Required key(s)                 | Built-in roles           |
| --------------------------- | ------------------------------- | ------------------------ |
| View items list             | `item.read`                     | all                      |
| View item detail            | `item.read`                     | all                      |
| Create item                 | `item.write`                    | owner, admin, member     |
| Edit item                   | `item.write`                    | owner, admin, member     |
| Delete item                 | `item.delete`                   | owner, admin             |
| CSV import                  | `item.write`                    | owner, admin, member     |

### Locations

| Action                      | Required key(s)                 | Built-in roles           |
| --------------------------- | ------------------------------- | ------------------------ |
| View locations              | `location.read`                 | all                      |
| Create / edit location      | `location.write`                | owner, admin, member     |
| Delete location             | `location.delete`               | owner, admin             |

### Movements

| Action                      | Required key(s)                 | Built-in roles           |
| --------------------------- | ------------------------------- | ------------------------ |
| View movements              | `movement.read`                 | all                      |
| Post manual adjustment      | `movement.write`                | owner, admin, member     |
| Export movements CSV        | `movement.read`                 | all                      |

### Stock counts

| Action                      | Required key(s)                 | Built-in roles           |
| --------------------------- | ------------------------------- | ------------------------ |
| View counts list            | `stockcount.read`               | all                      |
| View count detail           | `stockcount.read`               | all                      |
| Create count                | `stockcount.write`              | owner, admin, member     |
| Add entry                   | `stockcount.write`              | owner, admin, member     |
| Cancel count                | `stockcount.write`              | owner, admin, member     |
| Reconcile (complete + post) | `stockcount.reconcile`          | owner, admin             |

### Admin

| Action                      | Required key(s)                 | Built-in roles           |
| --------------------------- | ------------------------------- | ------------------------ |
| View members                | `member.manage`                 | owner, admin             |
| Invite member               | `member.manage`                 | owner, admin             |
| Change member role          | `member.manage`                 | owner, admin             |
| Remove member               | `member.manage`                 | owner, admin             |
| View roles                  | `role.manage`                   | owner                    |
| Create / edit custom role   | `role.manage`                   | owner (POST-MVP)         |
| View audit log              | `audit_log.read`                | owner, admin             |
| View billing                | `billing.manage`                | owner                    |
| Change plan                 | `billing.manage`                | owner                    |
| Org settings                | `org.admin`                     | owner                    |

## Screen-level gating rules

### Nav visibility

A top-level nav entry is visible if the user has at least the `.read`
permission for that section:

- Items — `item.read`
- Locations — `location.read`
- Movements — `movement.read`
- Stock counts — `stockcount.read`
- Purchase orders — `purchase_order.read` (POST-MVP)
- Sales orders — `sales_order.read` (POST-MVP)
- Reports — any of `item.read`, `movement.read`, `stockcount.read`
- Admin — any of `member.manage`, `role.manage`, `billing.manage`,
  `org.admin`, `audit_log.read`

### CTA visibility

Buttons that trigger writes hide when the user lacks the relevant write
permission. Hide, don't disable — a disabled button with no tooltip is
frustrating; a hidden button is honest.

Exception: if a disabled state carries useful information ("reconcile is
disabled because the count is blind and supervisor approval is pending"),
we use disabled + tooltip instead.

### Read-only detail pages

If a user has `.read` but not `.write` on an entity, the detail page still
renders. Edit button is hidden. Destructive actions (archive, delete) are
hidden. Form fields render as non-editable labels using `body` + `text.muted`.

### Permission-denied screen

Spec in [`05-onboarding-activation.md`](./05-onboarding-activation.md).
Never a 403 HTTP page — always the branded fallback with a "Back to home"
CTA and a one-sentence human explanation.

## Role selector UX

### Invite modal (MVP)

- Email input + role dropdown.
- Role dropdown shows the four built-in roles with a one-line description
  each:
  - **Owner** — Full access to everything, including billing.
  - **Admin** — Manage members, reconcile counts, approve POs.
  - **Member** — Everyday operator. Can count, receive, adjust.
  - **Viewer** — Read-only access for stakeholders and auditors.
- Owner-to-owner transfer is a separate flow, not an "invite as owner"
  action.
- Cannot downgrade your own role from the modal (prevents self-lockout).

### Role-edit row (MVP)

In `/admin/members`:

- Each member row has a role chip. Tapping opens a dropdown to change.
- Save is immediate — no "save changes" bar. Role change emits a toast and
  audit log entry.
- Changing a member's role never kicks them out of their current session;
  they see the new permissions on next page load.

### Custom roles (POST-MVP)

- New screen `/admin/roles`.
- List of built-in + custom roles.
- Create custom role = name + description + checkbox matrix of permission
  keys, grouped by domain.
- Role deletion requires reassigning all holders first.
- Auditable: every permission key addition/removal writes an audit log row.

## Owner is special

Exactly one owner per org. Rules:

- Cannot delete own membership.
- Cannot demote self below owner.
- Transfer ownership is a distinct dialog with explicit "I understand"
  confirmation. After transfer, old owner becomes admin.
- Delete org requires typing the org name to confirm — owner only.

## Multi-org reality

A user can be a member of many orgs, with different roles in each. The
active org lives in localStorage (`ACTIVE_ORG_KEY`) and is sent on every
request via the `x-oneace-org` header. Org switching:

1. Opens dropdown in top bar.
2. User picks a new org.
3. All tRPC queries invalidate.
4. Nav re-renders based on new membership's role.
5. Currently-open page re-fetches; if the new role can't access it, the
   permission-denied screen appears.

There is **no "global" dashboard across orgs** at MVP. Each org is a
separate workspace.

## Audit log triggers

Every permission-sensitive action writes an `audit_logs` row. Required
coverage at MVP:

- Member invited / accepted / declined / removed.
- Member role changed.
- Count created / cancelled / reconciled (entries are too noisy — not
  logged per-entry, only at state transitions).
- Location created / deleted.
- Item deleted (create / update are too noisy; POST-MVP adds them behind a
  flag).
- Sign-in / sign-out.
- Org settings changed.

Audit rows carry: `actorUserId`, `action` (enum), `entityType`, `entityId`,
`metadata` (jsonb), `createdAt`, `ip`. The log is append-only — there is
no delete UI, not even for owners.

## Permission check API (developer notes)

Client-side:

```ts
import { usePermission } from '@/lib/permissions';
const canReconcile = usePermission('stockcount.reconcile');
```

Server-side (tRPC middleware):

```ts
.use(requirePermission('stockcount.reconcile'))
```

Both read from the same source: the `session.permissions` set derived from
the active membership's role on each request. The server check is the only
one that matters for security; the client check is for UX.

## Anti-patterns

Don't:

- Gate by hardcoded role strings (`role === 'admin'`). Always gate by
  permission key.
- Hide admin sections with CSS. Remove them from the component tree.
- Show "upgrade your plan" nudges in place of permission-denied messages.
  Plan gating and role gating are different concerns.
- Let a user change their own permissions (including via custom roles).
- Let the "last owner" leave without transferring ownership.

## Acceptance criteria

1. A viewer account cannot see any "Create" or "Edit" buttons anywhere in
   the UI.
2. A member account cannot see the Reconcile button on the stock-count
   detail page, and the API rejects their call even if the button is
   manually made visible via browser devtools.
3. An admin account can manage members but cannot access billing.
4. An owner cannot delete or demote their own membership without first
   transferring ownership.
5. Switching org instantly updates nav visibility and invalidates cached
   queries. The old org's data is never visible after switch.
6. Every MVP audit-log trigger produces exactly one row, with accurate
   actor, entity, and metadata fields.
