"use server";

import type { AuditAction } from "@/lib/audit";
import { recordAudit } from "@/lib/audit";
import { requireActiveMembership } from "@/lib/session";

/** Allowed subset of AuditAction for bridge tracking. */
type BridgeAction = Extract<
  AuditAction,
  | "ui.bridge_card_click"
  | "ui.bridge_dismiss"
  | "ui.low_stock_banner_click"
  | "ui.reorder_config_save"
>;

/**
 * Fire-and-forget bridge interaction tracking.
 * Called from client wrappers — never blocks navigation.
 */
export async function trackBridgeAction(action: BridgeAction, metadata?: Record<string, unknown>) {
  const { membership, session } = await requireActiveMembership();
  await recordAudit({
    organizationId: membership.organizationId,
    actorId: session.user.id,
    action,
    entityType: "ui_interaction",
    metadata: metadata ?? null,
  });
}
