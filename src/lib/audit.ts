// Sprint 36: Audit log write helper.
//
// A thin wrapper around `db.auditEvent.create` that centralises:
//
//   * the `action` vocabulary (so every call site uses the same canonical
//     verbs and the `/audit` page can group / filter cleanly),
//   * the always-on organization + actor plumbing (passing them in once
//     per call, with both typed), and
//   * the "this is a log, never fail the user action because of it" posture
//     — audit writes swallow errors and surface them via `console.error`
//     rather than bubbling up. An action that succeeded but failed to
//     audit is still a successful action; we'd rather lose a row than
//     refuse a legitimate write.
//
// The helper is deliberately tiny. We considered a richer API (trailing
// metadata builders, automatic before/after diffs) but experience in the
// Flutter predecessor showed that audit calls in the server actions
// themselves are the clearest place to decide what to record. Anything
// more clever tends to drift from what the reviewer actually wants to see.

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * Canonical `action` values used by the server-action layer. Treat this
 * as the controlled vocabulary for the audit log — new actions should be
 * added here so the TypeScript compiler helps us keep the set finite and
 * the `/audit` page's grouping-by-prefix stays predictable.
 *
 * Naming convention: `<entity>.<verb>` (dot-separated). The `/audit`
 * reader groups by the substring before the first dot.
 */
export type AuditAction =
  // --- Organization lifecycle --------------------------------------------
  | "organization.updated"
  | "organization.deleted"
  | "organization.transferred"
  // --- Membership / invitation lifecycle ---------------------------------
  | "member.invited"
  | "member.removed"
  | "member.role_changed"
  | "invitation.revoked"
  | "invitation.accepted"
  // --- Purchase order lifecycle ------------------------------------------
  | "purchase_order.created"
  | "purchase_order.sent"
  | "purchase_order.cancelled"
  | "purchase_order.deleted"
  | "purchase_order.received"
  // --- Item lifecycle (Phase 4A) -----------------------------------------
  | "item.created"
  | "item.updated"
  | "item.deleted"
  | "item.imported"
  // --- Warehouse lifecycle (Phase 4A) ------------------------------------
  | "warehouse.created"
  | "warehouse.updated"
  | "warehouse.deleted"
  // --- Stock count lifecycle (Phase 4A) ----------------------------------
  | "stock_count.created"
  | "stock_count.completed"
  | "stock_count.cancelled"
  // --- Stock movement lifecycle (Phase 4A) -------------------------------
  // One verb: the `type` (RECEIPT / ISSUE / TRANSFER / ADJUSTMENT) is
  // carried in metadata. Only fresh writes emit; replays from the
  // offline queue's `alreadyExists` branch do NOT (dedupe already
  // happened, re-auditing would double-count).
  | "stock_movement.created"
  // --- Bin lifecycle (P9.2) ------------------------------------------------
  | "bin.created"
  | "bin.updated"
  | "bin.deleted"
  // --- Billing lifecycle (Phase 14.1) ------------------------------------
  // Emitted by Stripe webhook handlers so OWNER/ADMIN can see plan changes
  // in the audit log. actorId is null (system-initiated).
  | "billing.plan_upgraded"
  | "billing.plan_downgraded"
  | "billing.payment_failed"
  | "billing.subscription_cancelled"
  // --- UI interaction tracking (Phase 8) -----------------------------------
  // Lightweight bridge analytics. Fire-and-forget from client wrappers.
  | "ui.bridge_card_click"
  | "ui.bridge_dismiss"
  | "ui.low_stock_banner_click"
  | "ui.reorder_config_save";

/**
 * Canonical `entityType` values. Paired with the action prefix in most
 * cases but kept independent so an action like `organization.transferred`
 * can still target `entityType: "organization"` cleanly.
 */
export type AuditEntityType =
  | "organization"
  | "membership"
  | "invitation"
  | "purchase_order"
  // Phase 4A extensions — one entity type per new action prefix.
  | "item"
  | "warehouse"
  | "stock_count"
  | "stock_movement"
  // P9.2 — bin sub-locations
  | "bin"
  // Phase 8 — UI interaction tracking
  | "ui_interaction"
  // Phase 14.1 — billing events
  | "billing";

/**
 * Input shape for `recordAudit`. `organizationId` is always required so
 * the row is tenant-scoped. `actorId` is optional: null means "system or
 * cron initiated" (Sprint 36 doesn't emit any yet, but this keeps the
 * door open). `metadata` is a free-form JSON blob — small, please.
 */
export type AuditInput = {
  organizationId: string;
  actorId: string | null;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Appends a row to the audit log. Never throws — the caller already
 * completed its primary mutation and we don't want a log-write hiccup to
 * flip a successful action into a failed one. Failures are logged to the
 * server console so ops still has a signal.
 *
 * Usage from a server action (after the main mutation has succeeded):
 *
 * ```ts
 * await recordAudit({
 *   organizationId: membership.organizationId,
 *   actorId: session.user.id,
 *   action: "organization.updated",
 *   entityType: "organization",
 *   entityId: membership.organizationId,
 *   metadata: { before, after },
 * });
 * ```
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await db.auditEvent.create({
      data: {
        organizationId: input.organizationId,
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        // Prisma's Json field accepts plain JSON-serialisable values.
        // Passing `null` explicitly writes a SQL NULL, which is what we
        // want when there's no metadata to record.
        metadata: (input.metadata ?? null) as never,
      },
    });
  } catch (err) {
    // Swallow and log — see the file header for the rationale.
    // Sprint 37 wired this through the structured logger so failures
    // land in the same JSON stream as the rest of the server log.
    logger.error("audit: failed to record event", {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      err,
    });
  }
}
