import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { getLocale, getMessages, getRegion } from "@/lib/i18n";
import { SUPPORTED_LOCALES, SUPPORTED_REGIONS } from "@/lib/i18n/config";
import { requireActiveMembership } from "@/lib/session";

import { LocalePicker } from "./locale-picker";
import { OrgProfileForm } from "./org-profile-form";
import { RegionPicker } from "./region-picker";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.settings.metaTitle };
}

export default async function SettingsPage() {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();
  const locale = await getLocale();
  const region = await getRegion();

  const organization = await db.organization.findUnique({
    where: { id: membership.organizationId },
    select: { id: true, name: true, slug: true, plan: true },
  });

  if (!organization) {
    // Shouldn't happen — requireActiveMembership guarantees membership → org,
    // but the defensive fallback keeps us honest.
    throw new Error("Organization not found");
  }

  const canEditOrg = membership.role === "OWNER" || membership.role === "ADMIN";

  const localeOptions = SUPPORTED_LOCALES.map((code) => ({
    code,
    label: t.settings.locale.names[code],
  }));

  const regionOptions = SUPPORTED_REGIONS.map((r) => ({
    code: r.code,
    label: r.label,
    currency: r.currency,
    timeZone: r.defaultTimeZone,
  }));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t.settings.heading}</h1>
        <p className="text-muted-foreground">{t.settings.subtitle}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t.settings.organization.heading}</CardTitle>
            <CardDescription>{t.settings.organization.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <OrgProfileForm
              initial={{
                name: organization.name,
                slug: organization.slug,
                plan: organization.plan,
              }}
              canEdit={canEditOrg}
              forbiddenLabel={t.settings.organization.errors.forbidden}
              labels={{
                nameLabel: t.settings.organization.nameLabel,
                namePlaceholder: t.settings.organization.namePlaceholder,
                slugLabel: t.settings.organization.slugLabel,
                slugHelp: t.settings.organization.slugHelp,
                planLabel: t.settings.organization.planLabel,
                save: t.common.saveChanges,
                saved: t.settings.organization.saved,
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.settings.locale.heading}</CardTitle>
            <CardDescription>{t.settings.locale.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <LocalePicker
              options={localeOptions}
              initial={locale}
              savedLabel={t.settings.locale.saved}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t.settings.region.heading}</CardTitle>
            <CardDescription>{t.settings.region.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <RegionPicker
              options={regionOptions}
              initial={region.code}
              labels={{
                currency: t.settings.region.currencyLabel,
                timeZone: t.settings.region.timeZoneLabel,
                saved: t.settings.region.saved,
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
