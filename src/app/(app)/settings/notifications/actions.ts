// Sprint 41 — notification preferences server action.
//
// A single server action, `updateNotificationPreferenceAction`, upserts
// the active user's preference row for a given (organization, type)
// with the submitted frequency. Frequency must be one of the four
// NotificationFrequency values; anything else is rejected at the
// validation step.
//
// This is a `"use server"` module (no default export, just the named
// action). The client form at `./preferences-form.tsx` calls it via
// `useTransition` + `FormData`, matching the pattern used by the
// Sprint 19 locale picker and the Sprint 36 settings page.
//
// Opt-in semantics: a frequency of NEVER is a legitimate stored value,
// not a delete. A user who once opted into DAILY and then wants to
// opt out flips the select to NEVER and we keep the row so they can
// see "NEVER" as the current setting on the next page load. The cron
// route filters by `frequency = DAILY | WEEKLY` so NEVER rows are
// effectively silent without needing a special case.

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { NotificationFrequency, NotificationType } from "@/generated/prisma";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";

export type NotificationPrefsActionResult = { ok: true } | { ok: false; error: string };

// Derive the accepted frequency list from the Prisma enum so a future
// addition to NotificationFrequency automatically flows into the
// validator without a second edit.
const FREQUENCY_VALUES = Object.values(NotificationFrequency) as [
  NotificationFrequency,
  ...NotificationFrequency[],
];
const TYPE_VALUES = Object.values(NotificationType) as [NotificationType, ...NotificationType[]];

const prefSchema = z.object({
  type: z.enum(TYPE_VALUES),
  frequency: z.enum(FREQUENCY_VALUES),
});

export async function updateNotificationPreferenceAction(
  formData: FormData,
): Promise<NotificationPrefsActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  const parsed = prefSchema.safeParse({
    type: formData.get("type"),
    frequency: formData.get("frequency"),
  });
  if (!parsed.success) {
    return { ok: false, error: t.settings.notifications.errors.invalid };
  }

  const { type, frequency } = parsed.data;

  try {
    await db.notificationPreference.upsert({
      where: {
        userId_organizationId_type: {
          userId: session.user.id,
          organizationId: membership.organizationId,
          type,
        },
      },
      update: {
        frequency,
      },
      create: {
        userId: session.user.id,
        organizationId: membership.organizationId,
        type,
        frequency,
      },
    });
  } catch (_err) {
    // Don't leak Prisma error shapes. The user-facing copy is the same
    // for every failure mode because there's no actionable user fix
    // beyond "try again".
    return { ok: false, error: t.settings.notifications.errors.updateFailed };
  }

  // Revalidate the settings/notifications page so a re-navigation
  // reflects the saved frequency without a stale cache.
  revalidatePath("/settings/notifications");
  return { ok: true };
}
