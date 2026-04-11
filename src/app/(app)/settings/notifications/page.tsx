// Sprint 41 — /settings/notifications page.
//
// Per-user, per-org notification prefs. Currently one row: the
// low-stock digest. Future sprints (PO status / stock count
// completed / member invited) add rows without needing a second page.
//
// Opt-in semantics: a missing `NotificationPreference` row means "NEVER",
// and the cron route filters by `frequency = DAILY | WEEKLY` so a
// default-state user never receives mail. The first interaction with
// this page upserts a row, at which point the user's choice is
// durable. Removing a membership from the org does NOT delete the
// preference row — the cron fan-out skips ex-members at runtime, and
// keeping the row means a rejoining user keeps their previous setting.

import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NotificationFrequency, NotificationType } from "@/generated/prisma";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";

import { type FrequencyOption, type PreferenceRow, PreferencesForm } from "./preferences-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.settings.notifications.metaTitle };
}

// Ordered list of notification types to show in the UI. Order matters
// — we keep the primary workflow (low-stock digest) at the top and
// future additions stack below. Using an explicit list rather than
// `Object.values(NotificationType)` guards against a Prisma enum
// reordering accidentally shuffling the UI.
const TYPES_IN_UI: NotificationType[] = [NotificationType.LOW_STOCK_DIGEST];

export default async function NotificationsSettingsPage() {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  const prefs = await db.notificationPreference.findMany({
    where: {
      userId: session.user.id,
      organizationId: membership.organizationId,
    },
    select: { type: true, frequency: true },
  });
  const prefByType = new Map<NotificationType, NotificationFrequency>(
    prefs.map((p) => [p.type, p.frequency]),
  );

  const rows: PreferenceRow[] = TYPES_IN_UI.map((type) => {
    const copy = t.settings.notifications.types[type];
    return {
      type,
      title: copy.title,
      description: copy.description,
      frequency: prefByType.get(type) ?? NotificationFrequency.NEVER,
    };
  });

  const frequencyOptions: FrequencyOption[] = (
    Object.values(NotificationFrequency) as NotificationFrequency[]
  ).map((value) => ({
    value,
    label: t.settings.notifications.frequencies[value],
  }));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t.settings.notifications.heading}</h1>
        <p className="text-muted-foreground">{t.settings.notifications.subtitle}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.settings.notifications.emailHeading}</CardTitle>
          <CardDescription>{t.settings.notifications.emailDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <PreferencesForm
            rows={rows}
            frequencyOptions={frequencyOptions}
            labels={{
              frequencyAria: t.settings.notifications.frequencyAria,
              saved: t.settings.notifications.saved,
              saving: t.settings.notifications.saving,
              errorFallback: t.settings.notifications.errors.updateFailed,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
