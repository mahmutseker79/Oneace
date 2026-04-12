"use server";

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { requireActiveMembership } from "@/lib/session";

/**
 * P7.2 — Marks the post-setup bridge as dismissed for the current
 * membership. Sets `uiState.bridgeDismissed = true` which the
 * items page reads to gate bridge rendering.
 *
 * P8.6 — Also records an audit event for bridge analytics.
 */
export async function dismissBridgeAction() {
  const { membership, session } = await requireActiveMembership();
  const currentState = (membership.uiState as Record<string, unknown> | null) ?? {};

  await db.membership.update({
    where: { id: membership.id },
    data: {
      uiState: { ...currentState, bridgeDismissed: true },
    },
  });

  // P8.6 — fire-and-forget analytics
  void recordAudit({
    organizationId: membership.organizationId,
    actorId: session.user.id,
    action: "ui.bridge_dismiss",
    entityType: "ui_interaction",
  });
}
