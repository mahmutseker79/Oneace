"use server";

import { revalidatePath } from "next/cache";

import { dismissAlert } from "@/lib/alerts";
import { db } from "@/lib/db";
import { requireActiveMembership } from "@/lib/session";

export async function markNotificationReadAction(notificationId: string) {
  const { session, membership } = await requireActiveMembership();

  await db.notification.updateMany({
    where: {
      id: notificationId,
      userId: session.user.id,
      organizationId: membership.organizationId,
    },
    data: { readAt: new Date() },
  });

  revalidatePath("/");
}

export async function markAllNotificationsReadAction() {
  const { session, membership } = await requireActiveMembership();

  await db.notification.updateMany({
    where: {
      userId: session.user.id,
      organizationId: membership.organizationId,
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  revalidatePath("/");
}

export async function dismissAlertAction(alertId: string) {
  const { session, membership } = await requireActiveMembership();

  const dismissed = await dismissAlert(alertId, membership.organizationId, session.user.id);

  if (dismissed) {
    // Mark all notifications for this alert as read
    await db.notification.updateMany({
      where: {
        alertId,
        organizationId: membership.organizationId,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
  }

  revalidatePath("/");
}
