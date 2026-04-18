# GDPR User-Delete Cascade Matrix

Audit v1.2 §5.35 — policy audit of every `User` foreign-key relation
in `prisma/schema.prisma`, with the `onDelete` behaviour and the
rationale for that choice.

The `POST /api/account/delete` route (see
`src/app/api/account/delete/route.ts`) deletes the current user's
`User` row inside a Prisma transaction. Every relation listed below
is reached by that delete — either via a manual `deleteMany` in the
route, or implicitly by the Postgres foreign-key policy encoded in
the schema.

The static test `src/lib/gdpr-cascade.test.ts` pins the full matrix:
any new `User` FK added to the schema, and any change to an
`onDelete` policy on an existing one, will fail the test until the
expected map below is updated. This is the drift guard that prevents
a new relation from quietly skipping the delete (the silent-orphan
scenario the audit flagged).

## Matrix

| Relation                              | Policy   | Rationale |
|---------------------------------------|----------|-----------|
| `Membership.userId`                   | Cascade  | Membership is per-user per-org; no reason to keep it. Manual `deleteMany` in route fires the `account.deleted` audit event before the drop. |
| `Invitation.invitedById`              | Cascade  | If the inviter is gone, the invitation history for their sends is lost. Acceptable trade-off — invitations are transient and the accepted org membership survives on its own row. |
| `Invitation.acceptedById`             | SetNull  | If the invitee deletes their account later, the invitation record still lives on the *inviter's* history as "accepted by (deleted user)". Preserves audit trail for the inviter's side. |
| `Session.userId`                      | Cascade  | Sessions are short-lived tokens; no retention value. |
| `Account.userId`                      | Cascade  | OAuth/password credential rows — must go with the user. |
| `TwoFactorAuth.userId`                | Cascade  | Secret material, must go. |
| `Notification.userId`                 | Cascade  | Notifications are per-user and meaningless without their recipient. |
| `CountAssignment.userId`              | Cascade  | Assignment is a live-state record for an ongoing count; if the assignee deletes themselves mid-count, the assignment disappears and the count operator gets an unassigned state. Product decision — counts survive, assignments don't. |
| `SavedView.userId`                    | Cascade  | Personal UI preference; nothing else references it. |
| `AuditEvent.actorId`                  | SetNull  | Audit retention is the whole point of AuditEvent. We keep the row with `actorId = null` (anonymised actor) so compliance timelines stay intact. |
| `StockMovement.createdByUserId`       | SetNull  | Inventory history must not be destroyed by a single user's deletion — movements affect stock levels, finance, and audits. Anonymise the creator, keep the row. |
| `StockCount.createdByUserId`          | SetNull  | Same argument — count records are business history. |
| `CountEntry.countedByUserId`          | SetNull  | Same — individual count rows survive; the counter is anonymised. |
| `CountApproval.reviewedById`          | SetNull  | Approval decisions are kept; reviewer anonymised. |
| `CountZone.createdByUserId`           | SetNull  | Zone definitions survive; creator anonymised. |
| `PurchaseOrder.createdByUserId`       | SetNull  | POs are financial history. |
| `Department.managerId`                | SetNull  | Department survives without its manager; assigning a new manager is an admin UI task. |
| `SerialHistory.performedByUserId`     | SetNull  | Serial-number audit trail — history stays, actor anonymised. |
| `ItemAttachment.uploadedByUserId`     | SetNull  | Attachment survives; uploader anonymised (file retention decided separately). |
| `PickTask.assignedToUserId`           | SetNull  | Pick task survives so the warehouse flow doesn't break mid-pick. |
| `FixedAsset.assignedToUserId`         | SetNull  | Asset record kept; assignee cleared. |
| `ZoneLabel.printedByUserId`           | SetNull  | Printed-label audit trail kept. |
| `MigrationJob.createdByUserId`        | SetNull  | Data-import jobs are ops history. |
| `ImportJob.createdByUserId`           | SetNull  | Same as above. |
| `StockTransfer.shippedByUserId`       | SetNull  | Transfer history survives; shipper anonymised. |
| `StockTransfer.receivedByUserId`      | SetNull  | Transfer history survives; receiver anonymised. |
| `CountApproval.requestedById`         | **Restrict** | ⚠️ **Policy concern** — Restrict means `user.delete()` FAILS if the user has any pending `CountApproval` requests. The delete route will throw a Prisma constraint error and return 500. Three possible remediations, deferred to product/legal review (see §5.35 fix-risk note in audit v1.2): (a) change to `SetNull` (approval survives, requester anonymised — consistent with the other approval-reviewed pattern), (b) manually cascade-delete or re-assign pending approvals before calling `user.delete()` in the route, (c) keep Restrict but surface the blocker in the UI so users can "close out" their approvals before deleting their account. The `gdpr-cascade.test.ts` flags this via `POLICY_CONCERNS` so it can't be forgotten. |

## Categorisation summary (snapshot)

- **Cascade (8):** credential + personal rows with no retention value.
  `Membership`, `Session`, `Account`, `TwoFactorAuth`, `Notification`,
  `CountAssignment`, `SavedView`, `Invitation.invitedById`.
- **SetNull (18):** business-history rows we keep past the user's
  deletion; the user reference is anonymised.
- **Restrict (1):** `CountApproval.requestedById` — known policy
  concern, flagged above.

Total: 27 relations.

## Fields the account-delete route still `deleteMany`s manually

Even though `Membership`, `Session`, `Account`, `TwoFactorAuth`, and
`Notification` are all Cascade, the route still calls `deleteMany`
on the first four BEFORE the `user.delete()` call. This is
deliberate:

  1. **Audit-event ordering** — `recordAudit()` fires before the
     transaction so the `account.deleted` event has a valid
     `membership.id` to reference. Manual `deleteMany` inside the
     tx guarantees the membership row is gone by the time the user
     row drops, even on DB engines that batch cascades differently.

  2. **Explicit rather than implicit** — the route's intent reads
     straightforwardly in source without needing a reader to know
     Prisma cascade semantics.

The other Cascade relations (`Notification`, `CountAssignment`,
`SavedView`) rely on the Postgres FK to do the cleanup implicitly,
which is fine because those rows carry no audit significance.
