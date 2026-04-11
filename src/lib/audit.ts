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
  // --- Catalog surfaces (Sprint 39) --------------------------------------
  // Items, warehouses and categories are the three catalog tables whose
  // writes Sprint 36 deliberately left out of the audit log to keep that
  // sprint's scope bounded. Sprint 39 back-fills them so an OWNER can
  // answer "who renamed SKU-123?" or "who archived Warehouse A?" from
  // the /audit page without digging through git or the DB.
  | "item.created"
  | "item.updated"
  | "item.imported"
  | "item.deleted"
  | "warehouse.created"
  | "warehouse.updated"
  | "warehouse.deleted"
  | "category.created"
  | "category.deleted"
  // --- Stock count lifecycle (Sprint 39) ---------------------------------
  // Only the state-transition endpoints are audited: created, cancelled,
  // completed. Individual count entries are deliberately NOT logged —
  // a single cycle-count session can emit hundreds of entries, which
  // would flood the log without telling a reviewer anything the count's
  // own detail page doesn't already show. The count-level events give
  // the governance signal; the entry-level detail stays in-feature.
  | "stock_count.created"
  | "stock_count.cancelled"
  | "stock_count.completed"
  // --- Audit housekeeping (Sprint 40) ------------------------------------
  // The retention script (`npm run audit:prune`) emits exactly one
  // aggregate row after a successful prune run with
  // `{ cutoffDate, deletedCount, retentionDays }` metadata. The
  // actor is null (system-initiated), entityType is "organization"
  // (the tenant whose rows were pruned), and entityId is the org id.
  // Recording the prune itself is the only way a reviewer can tell
  // "the log is short because nothing happened" from "the log is
  // short because someone ran prune last week" — missing this row
  // is its own alarm signal during audit review.
  | "audit.pruned";

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
  // Sprint 39 — catalog + stock-count coverage.
  | "item"
  | "warehouse"
  | "category"
  | "stock_count";

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
