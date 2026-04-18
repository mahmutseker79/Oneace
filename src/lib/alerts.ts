/**
 * P10.2 — Low-stock alert engine.
 *
 * Core responsibilities:
 *   1. Evaluate low-stock conditions for one or many items.
 *   2. Create new ACTIVE alerts (with dedup — skip if one already exists).
 *   3. Auto-resolve alerts when stock recovers above the reorder point.
 *   4. Fan out Notification rows to relevant members when a new alert fires.
 *
 * Triggers (called from server actions):
 *   - After a stock movement (receipt, issue, adjustment, transfer, count)
 *   - After PO receiving
 *   - After stock count reconciliation
 *   - After reorder config changes
 *
 * Design:
 *   - `evaluateAlerts` is the single entry point. It accepts a list of
 *     itemIds that were just affected and re-checks their low-stock status.
 *   - Each call is fire-and-forget from the caller's perspective — it
 *     runs outside the main transaction (creating an alert is never worth
 *     rolling back a stock movement for).
 *   - Dedup is application-level: we query for an existing ACTIVE alert
 *     for the same (org, item, LOW_STOCK) before inserting.
 */

import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

// §5.24 — Notifications default to a 90-day retention window; the
// cleanup-notifications cron prunes anything past `expiresAt`. Keep
// this in one place so producers that add new notification types
// don't each pick their own arbitrary TTL.
const NOTIFICATION_TTL_DAYS = 90;

// §5.24 — dedup window is one calendar day. Two fan-outs for the
// same (alert, user) within the same UTC day collapse to one row via
// the `Notification_dedup` unique index + `skipDuplicates: true`.
// Change cautiously: a shorter window (hours) would let the same
// alert spam the bell; a longer one would silently drop legitimate
// re-trips after an auto-resolve/re-open cycle.
function notificationDedupKey(source: string, userId: string, now: Date): string {
  const day = now.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  return createHash("sha256").update(`${source}:${userId}:${day}`).digest("hex").slice(0, 32);
}

/**
 * Evaluate low-stock alerts for the given items within an organization.
 *
 * For each item:
 *   - If on-hand ≤ reorderPoint AND no active alert exists → create alert + notifications
 *   - If on-hand > reorderPoint AND an active alert exists → resolve it
 *
 * This function is intentionally fire-and-forget safe — it catches all
 * errors internally so callers can `void evaluateAlerts(...)` without
 * risk of unhandled rejections.
 */
export async function evaluateAlerts(organizationId: string, itemIds: string[]): Promise<void> {
  try {
    if (itemIds.length === 0) return;

    // Deduplicate itemIds
    const uniqueIds = [...new Set(itemIds)];

    // Fetch items with their stock levels and any active alerts in one batch
    const items = await db.item.findMany({
      where: {
        id: { in: uniqueIds },
        organizationId,
        status: "ACTIVE",
        reorderPoint: { gt: 0 },
      },
      select: {
        id: true,
        name: true,
        sku: true,
        reorderPoint: true,
        stockLevels: { select: { quantity: true } },
        alerts: {
          where: { type: "LOW_STOCK", status: "ACTIVE" },
          select: { id: true },
        },
      },
    });

    // Fetch org members who should receive notifications (OWNER, ADMIN, MEMBER)
    // We'll only fetch this if we need to create new alerts.
    let memberUserIds: string[] | null = null;

    for (const item of items) {
      const onHand = item.stockLevels.reduce((sum, l) => sum + l.quantity, 0);
      const isLowStock = onHand <= item.reorderPoint;
      const hasActiveAlert = item.alerts.length > 0;

      if (isLowStock && !hasActiveAlert) {
        // Create new alert
        const alert = await db.alert.create({
          data: {
            organizationId,
            itemId: item.id,
            type: "LOW_STOCK",
            status: "ACTIVE",
            threshold: item.reorderPoint,
            currentQty: onHand,
          },
        });

        // Lazy-load member list on first alert creation
        if (memberUserIds === null) {
          const members = await db.membership.findMany({
            where: {
              organizationId,
              deactivatedAt: null,
              role: { in: ["OWNER", "ADMIN", "MEMBER", "MANAGER"] },
            },
            select: { userId: true },
          });
          memberUserIds = members.map((m) => m.userId);
        }

        // Fan out notifications.
        //
        // §5.24 — `dedupKey` + `skipDuplicates` makes the insert
        // idempotent across a UTC day. If evaluateAlerts fires twice
        // for the same alert in the same day (cron retry, double-
        // trigger race), the second pass collides with the unique
        // `Notification_dedup` index and silently drops.
        //
        // `expiresAt` bounds growth to NOTIFICATION_TTL_DAYS (90d) —
        // the cleanup-notifications cron prunes past-TTL rows.
        if (memberUserIds.length > 0) {
          const now = new Date();
          const expiresAt = new Date(now.getTime() + NOTIFICATION_TTL_DAYS * 24 * 60 * 60 * 1000);
          await db.notification.createMany({
            data: memberUserIds.map((userId) => ({
              organizationId,
              userId,
              alertId: alert.id,
              title: `Low stock: ${item.name}`,
              message: `${item.sku} has ${onHand} units (reorder point: ${item.reorderPoint})`,
              href: `/items/${item.id}`,
              expiresAt,
              dedupKey: notificationDedupKey(`alert:${alert.id}`, userId, now),
            })),
            skipDuplicates: true,
          });
        }
      } else if (!isLowStock && hasActiveAlert) {
        // Auto-resolve all active alerts for this item
        await db.alert.updateMany({
          where: {
            organizationId,
            itemId: item.id,
            type: "LOW_STOCK",
            status: "ACTIVE",
          },
          data: {
            status: "RESOLVED",
            resolvedAt: new Date(),
          },
        });
      }
    }
  } catch (error) {
    // Fire-and-forget: log but don't throw
    logger.error("alerts: evaluateAlerts failed", {
      tag: "alerts.evaluate",
      err: error,
    });
  }
}

/**
 * Dismiss an alert by ID. Sets status to DISMISSED and stamps the actor.
 * Returns true if the alert was found and dismissed, false otherwise.
 */
export async function dismissAlert(
  alertId: string,
  organizationId: string,
  userId: string,
): Promise<boolean> {
  const result = await db.alert.updateMany({
    where: {
      id: alertId,
      organizationId,
      status: "ACTIVE",
    },
    data: {
      status: "DISMISSED",
      dismissedAt: new Date(),
      dismissedById: userId,
    },
  });
  return result.count > 0;
}
