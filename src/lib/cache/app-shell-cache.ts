/**
 * P1-5 (audit v1.0 §5.10) — App shell query cache.
 *
 * The `(app)` layout runs three DB queries on every navigation in the
 * authenticated app: a low-stock badge count over `Item` + nested
 * `StockLevel`, the 20 most recent notifications, and an unread count.
 * On a warm DB each is cheap (~1-3ms), but the layout re-renders for
 * every server component navigation in the app — so a user clicking
 * around the sidebar runs them dozens of times in a session even
 * though the underlying state changes infrequently.
 *
 * This module wraps each query in `unstable_cache` (Next.js's request-
 * memoizing data cache) keyed by org/user, and exposes typed
 * `revalidate*` helpers that mutation paths call to bust the cache
 * when the underlying state actually changes.
 *
 * Tag taxonomy:
 *   - `app-shell:low-stock:<orgId>` — busted on item/stock mutations
 *   - `app-shell:notifications:<orgId>:<userId>` — busted on notification create/read
 *
 * The cache TTL is intentionally short (60s) as a safety net in case
 * a mutation site forgets to call its revalidate helper. The tags
 * are the primary invalidation mechanism; the TTL is belt-and-
 * suspenders.
 */

import { revalidateTag, unstable_cache } from "next/cache";

import { db } from "@/lib/db";

const TTL_SECONDS = 60;

// ─────────────────────────────────────────────────────────────────────
// Low-stock badge
// ─────────────────────────────────────────────────────────────────────

function lowStockTag(orgId: string): string {
  return `app-shell:low-stock:${orgId}`;
}

/**
 * Count of active items at or below their reorder point. Returns
 * `undefined` when the count is zero so the sidebar badge can omit
 * itself entirely (an empty string would render an empty pill).
 */
export async function getLowStockBadge(orgId: string): Promise<string | undefined> {
  const cached = unstable_cache(
    async (organizationId: string) => {
      const itemsWithReorder = await db.item.findMany({
        where: {
          organizationId,
          status: "ACTIVE",
          reorderPoint: { gt: 0 },
        },
        select: {
          reorderPoint: true,
          stockLevels: { select: { quantity: true } },
        },
      });
      return itemsWithReorder.filter((item) => {
        const onHand = item.stockLevels.reduce((sum, l) => sum + l.quantity, 0);
        return onHand <= item.reorderPoint;
      }).length;
    },
    ["app-shell-low-stock", orgId],
    {
      tags: [lowStockTag(orgId)],
      revalidate: TTL_SECONDS,
    },
  );

  const count = await cached(orgId);
  return count > 0 ? String(count) : undefined;
}

/**
 * Bust the low-stock cache for an organization. Call this from any
 * mutation path that changes item.reorderPoint, item.status, or any
 * stockLevel.quantity for the org.
 *
 * Cheap to over-call — `revalidateTag` is a no-op when nothing in
 * the cache holds the tag.
 */
export function revalidateLowStock(orgId: string): void {
  revalidateTag(lowStockTag(orgId));
}

// ─────────────────────────────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────────────────────────────

export type AppShellNotification = {
  id: string;
  title: string;
  message: string;
  href: string | null;
  alertId: string | null;
  readAt: string | null;
  createdAt: string;
};

function notificationsTag(orgId: string, userId: string): string {
  return `app-shell:notifications:${orgId}:${userId}`;
}

/**
 * Fetch the 20 most recent notifications + the unread count for the
 * given user in the given org. Both queries run in parallel inside
 * the cached function so the cache holds one combined value.
 */
export async function getNotificationData(
  orgId: string,
  userId: string,
): Promise<{ items: AppShellNotification[]; unreadCount: number }> {
  const cached = unstable_cache(
    async (organizationId: string, uid: string) => {
      const [recent, unread] = await Promise.all([
        db.notification.findMany({
          where: {
            userId: uid,
            organizationId,
          },
          select: {
            id: true,
            title: true,
            message: true,
            href: true,
            alertId: true,
            readAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
        db.notification.count({
          where: {
            userId: uid,
            organizationId,
            readAt: null,
          },
        }),
      ]);

      const items: AppShellNotification[] = recent.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        href: n.href,
        alertId: n.alertId,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      }));

      return { items, unreadCount: unread };
    },
    ["app-shell-notifications", orgId, userId],
    {
      tags: [notificationsTag(orgId, userId)],
      revalidate: TTL_SECONDS,
    },
  );

  return cached(orgId, userId);
}

/**
 * Bust the notification cache for one user. Call this from any
 * mutation path that creates, updates, deletes, or marks-as-read
 * notifications for the user.
 */
export function revalidateNotifications(orgId: string, userId: string): void {
  revalidateTag(notificationsTag(orgId, userId));
}

/**
 * Bust the notification cache for ALL users in an org. Use when an
 * alert is dismissed at the org level (it cascades to every user's
 * notification list) or when a backend job creates notifications for
 * many users at once. Less precise than `revalidateNotifications`
 * — invalidates by tag prefix isn't supported by Next, so callers
 * that know the userId should prefer the per-user variant.
 *
 * Note: this currently invalidates only the org-level low-stock tag
 * as a coarse signal. For cross-user notification fanout we rely on
 * the 60s TTL; per-user mutation paths use the precise tag.
 */
export function revalidateOrgScopedShellData(orgId: string): void {
  revalidateLowStock(orgId);
}
