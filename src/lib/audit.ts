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
  // --- Category lifecycle ---------------------------------------------------
  | "category.created"
  | "category.updated"
  | "category.deleted"
  // --- Supplier lifecycle ---------------------------------------------------
  | "supplier.created"
  | "supplier.updated"
  | "supplier.deleted"
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
  // --- Location barcodes (Phase C) ------------------------------------------
  | "warehouse.barcode_assigned"
  | "bin.barcode_assigned"
  // --- Label templates (Phase C) -------------------------------------------
  | "label_template.created"
  | "label_template.updated"
  | "label_template.deleted"
  // --- Billing lifecycle (Phase 14.1) ------------------------------------
  // Emitted by Stripe webhook handlers so OWNER/ADMIN can see plan changes
  // in the audit log. actorId is null (system-initiated).
  | "billing.plan_upgraded"
  | "billing.plan_downgraded"
  | "billing.payment_failed"
  | "billing.payment_recovered"
  | "billing.subscription_cancelled"
  | "billing.cancellation_pending"
  | "billing.cancellation_cleared"
  // --- UI interaction tracking (Phase 8) -----------------------------------
  // Lightweight bridge analytics. Fire-and-forget from client wrappers.
  | "ui.bridge_card_click"
  | "ui.bridge_dismiss"
  | "ui.low_stock_banner_click"
  | "ui.reorder_config_save"
  // --- Account lifecycle (GDPR) -------------------------------------------
  | "account.data_export"
  | "account.deleted"
  // --- Phase B: Counting Core Expansion ----------------------------------
  // Department lifecycle
  | "department.created"
  | "department.updated"
  | "department.deleted"
  // Stock count approval workflow
  | "stock_count.submitted_for_approval"
  | "stock_count.approved"
  | "stock_count.rejected"
  | "stock_count.rolled_back"
  // Count assignments
  | "count_assignment.created"
  | "count_assignment.removed"
  // Count templates
  | "count_template.created"
  | "count_template.updated"
  | "count_template.deleted"
  // --- Phase E: Integration & Import/Export --------------------------------
  // Integration lifecycle
  | "integration.connected"
  | "integration.disconnected"
  | "integration.synced"
  // Import job lifecycle
  | "import_job.started"
  | "import_job.completed"
  | "import_job.failed"
  | "import_job.cancelled"
  // Import template lifecycle
  | "import_template.created"
  | "import_template.updated"
  | "import_template.deleted"
  // Webhook lifecycle
  | "webhook.created"
  | "webhook.updated"
  | "webhook.deleted"
  | "webhook.tested"
  // --- Phase MIG-S8: Migration lifecycle (competitor imports) --------
  | "migration.started"
  | "migration.completed"
  | "migration.failed"
  | "migration.rollback"
  | "migration.sourceFiles.cleanup"
  | "migration.blob.cleanup"
  // --- Phase V4: Reason Codes -----------------------------------------------
  | "reason_code.created"
  | "reason_code.updated"
  | "reason_code.toggled"
  | "reason_code.seeded"
  // --- Phase V4: Stock Status Management ------------------------------------
  | "stock.status_changed"
  // --- Phase L: Sales Orders, Kits, Pick Tasks ------------------------------
  | "sales_order.created"
  | "sales_order.line_added"
  | "sales_order.line_removed"
  | "sales_order.confirmed"
  | "sales_order.allocated"
  | "sales_order.shipped"
  | "sales_order.cancelled"
  | "kit.created"
  | "kit.component_added"
  | "kit.component_removed"
  | "kit.assembled"
  | "kit.disassembled"
  | "pick_task.created"
  | "pick_task.generated_from_so"
  | "pick_task.assigned"
  | "pick_task.started"
  | "pick_task.completed"
  | "pick_task.verified"
  // --- Attachment lifecycle -----------------------------------------------
  | "attachment.created"
  | "attachment.deleted"
  | "attachment.reordered"
  // --- Location lifecycle -----------------------------------------------
  | "location.created"
  | "location.updated"
  | "location.deleted"
  | "location.reordered"
  // --- Saved views lifecycle -----------------------------------------------
  | "saved_view.created"
  | "saved_view.updated"
  | "saved_view.deleted"
  | "saved_view.set_default"
  // --- Serial numbers lifecycle -----------------------------------------------
  | "serial.created"
  | "serial.bulk_created"
  | "serial.moved"
  | "serial.status_updated"
  // --- Scheduled reports lifecycle ------------------------------------------
  | "scheduled_report.created"
  | "scheduled_report.updated"
  | "scheduled_report.deleted"
  // --- Count zones lifecycle (Phase V4+) ------------------------------------
  | "count_zone.created"
  | "count_zone.updated"
  | "count_zone.deleted"
  | "count_zone.barcodes_generated"
  // --- Vehicle lifecycle (Asset management) --------------------------------
  | "vehicle.created"
  | "vehicle.updated"
  | "vehicle.deleted"
  | "vehicle.loaded"
  | "vehicle.unloaded";

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
  | "category"
  | "supplier"
  | "warehouse"
  | "stock_count"
  | "stock_movement"
  // P9.2 — bin sub-locations
  | "bin"
  // Phase C — location barcode and label templates
  | "label_template"
  // Phase 8 — UI interaction tracking
  | "ui_interaction"
  // Phase 14.1 — billing events
  | "billing"
  // Phase B: Counting Core Expansion
  | "department"
  | "count_assignment"
  | "count_approval"
  | "count_template"
  // Phase E: Integration & Import/Export
  | "integration"
  | "import_job"
  | "import_template"
  | "webhook"
  // Phase MIG-S8: Migration jobs (competitor imports)
  | "migration_job"
  // Phase V4: Reason Codes & Stock Status
  | "reason_code"
  | "stock_level"
  // Phase L: Sales Orders, Kits, Pick Tasks
  | "sales_order"
  | "kit"
  | "pick_task"
  // Phase V4: Transfers, Assets, Serial Numbers, Batches
  | "transfer"
  | "fixed_asset"
  | "serial_number"
  | "batch"
  | "org_settings"
  | "saved_view"
  | "attachment"
  | "location_level"
  | "scheduled_report"
  | "count_zone";

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
