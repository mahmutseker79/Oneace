"use server";

import { evaluateAlerts } from "@/lib/alerts";
import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";

type ReorderUpdate = {
  id: string;
  reorderPoint: number;
  reorderQty: number;
};

export async function batchUpdateReorderPoints(updates: ReorderUpdate[]) {
  const { membership, session } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "reorderConfig.edit")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  // Verify all item IDs belong to the caller's org (prevents cross-org writes)
  const orgItemIds = await db.item.findMany({
    where: {
      organizationId: membership.organizationId,
      id: { in: updates.map((u) => u.id) },
    },
    select: { id: true },
  });
  const validIds = new Set(orgItemIds.map((i) => i.id));
  const safeUpdates = updates.filter((u) => validIds.has(u.id));
  if (safeUpdates.length === 0) return;

  // Batch update in a transaction
  await db.$transaction(
    safeUpdates.map((u) =>
      db.item.update({
        where: { id: u.id },
        data: {
          reorderPoint: Math.max(0, u.reorderPoint),
          reorderQty: Math.max(0, u.reorderQty),
        },
      }),
    ),
  );

  // P8.6 — fire-and-forget analytics
  void recordAudit({
    organizationId: membership.organizationId,
    actorId: session.user.id,
    action: "ui.reorder_config_save",
    entityType: "ui_interaction",
    metadata: { itemCount: safeUpdates.length },
  });

  // P10.2 — reorder point changes can create or resolve alerts
  void evaluateAlerts(
    membership.organizationId,
    safeUpdates.map((u) => u.id),
  );
}
