import { CreditCard, Plug } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { getLocale, getMessages, getRegion } from "@/lib/i18n";
import { SUPPORTED_LOCALES, SUPPORTED_REGIONS } from "@/lib/i18n/config";
import { requireActiveMembership } from "@/lib/session";

import { DangerZoneCard } from "./danger-zone-card";
import { LocalePicker } from "./locale-picker";
import { OrgDefaultsForm } from "./org-defaults-form";
import { OrgProfileForm } from "./org-profile-form";
import { RegionPicker } from "./region-picker";
import { type TransferCandidate, TransferOwnershipCard } from "./transfer-ownership-card";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.settings.metaTitle };
}

export default async function SettingsPage() {
  const { membership, session } = await requireActiveMembership();
  const t = await getMessages();
  const locale = await getLocale();
  const region = await getRegion();

  const organization = await db.organization.findUnique({
    where: { id: membership.organizationId },
    select: {
      id: true,
      name: true,
      slug: true,
      plan: true,
      defaultLocale: true,
      defaultRegion: true,
    },
  });

  if (!organization) {
    // Shouldn't happen — requireActiveMembership guarantees membership → org,
    // but the defensive fallback keeps us honest.
    throw new Error("Organization not found");
  }

  const canEditOrg = membership.role === "OWNER" || membership.role === "ADMIN";
  // Sprint 21: OWNER is a strictly smaller set than ADMIN — deleting
  // an org is irreversible and destroys every user's data in the
  // tenant, so it's scoped tighter than the other edit operations.
  const canDeleteOrg = membership.role === "OWNER";
  // Sprint 32: transfer ownership is OWNER-only and the caller cannot
  // target themselves, so there's no point loading candidates if the
  // caller is not an OWNER.
  const canTransferOwnership = membership.role === "OWNER";

  const transferCandidates: TransferCandidate[] = canTransferOwnership
    ? await db.membership
        .findMany({
          where: {
            organizationId: membership.organizationId,
            NOT: { userId: session.user.id },
          },
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: "asc" },
        })
        .then((rows) =>
          rows.map((row) => ({
            id: row.id,
            name: row.user.name ?? row.user.email,
            email: row.user.email,
            roleLabel: t.users.roles[row.role],
          })),
        )
    : [];

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
      <PageHeader
        title={t.settings.heading}
        description={t.settings.subtitle}
        breadcrumb={[{ label: t.settings?.heading ?? "Settings" }]}
      />

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

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t.settings.orgDefaults.heading}</CardTitle>
            <CardDescription>{t.settings.orgDefaults.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <OrgDefaultsForm
              canEdit={canEditOrg}
              initial={{
                defaultLocale: organization.defaultLocale,
                defaultRegion: organization.defaultRegion,
              }}
              localeOptions={localeOptions}
              regionOptions={regionOptions}
              labels={{
                heading: t.settings.orgDefaults.heading,
                description: t.settings.orgDefaults.description,
                helpText: t.settings.orgDefaults.helpText,
                localeLabel: t.settings.orgDefaults.localeLabel,
                regionLabel: t.settings.orgDefaults.regionLabel,
                platformDefault: t.settings.orgDefaults.platformDefault,
                save: t.common.saveChanges,
                saved: t.settings.orgDefaults.saved,
                forbidden: t.settings.orgDefaults.errors.forbidden,
              }}
            />
          </CardContent>
        </Card>

        {canTransferOwnership ? (
          <TransferOwnershipCard
            organization={{ name: organization.name, slug: organization.slug }}
            canTransfer={canTransferOwnership}
            candidates={transferCandidates}
            labels={{
              heading: t.settings.transferOwnership.heading,
              description: t.settings.transferOwnership.description,
              targetLabel: t.settings.transferOwnership.targetLabel,
              targetPlaceholder: t.settings.transferOwnership.targetPlaceholder,
              noCandidates: t.settings.transferOwnership.noCandidates,
              consequences: t.settings.transferOwnership.consequences,
              confirmInputLabel: t.settings.transferOwnership.confirmInputLabel,
              confirmInputPlaceholder: t.settings.transferOwnership.confirmInputPlaceholder,
              confirmMismatch: t.settings.transferOwnership.confirmMismatch,
              transferCta: t.settings.transferOwnership.transferCta,
              transferring: t.settings.transferOwnership.transferring,
              confirmBody: t.settings.transferOwnership.confirmBody,
              success: t.settings.transferOwnership.success,
              cancel: t.common.cancel,
              forbidden: t.settings.transferOwnership.errors.forbidden,
            }}
          />
        ) : null}

        {/* Integrations card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plug className="h-4 w-4 text-muted-foreground" />
              Integrations
            </CardTitle>
            <CardDescription>Connect QuickBooks, Shopify, and other services.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" asChild>
              <Link href="/settings/integrations">Manage integrations</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Phase 12.3 — Billing card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              Plan &amp; Billing
              <Badge variant="secondary" className="ml-1 font-mono text-xs">
                {organization.plan}
              </Badge>
            </CardTitle>
            <CardDescription>Manage your subscription and billing details.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" asChild>
              <Link href="/settings/billing">Manage billing</Link>
            </Button>
          </CardContent>
        </Card>

        {canDeleteOrg ? (
          <DangerZoneCard
            organization={{ name: organization.name, slug: organization.slug }}
            canDelete={canDeleteOrg}
            labels={{
              heading: t.settings.dangerZone.heading,
              description: t.settings.dangerZone.description,
              consequences: t.settings.dangerZone.consequences,
              deleteCta: t.settings.dangerZone.deleteCta,
              confirmTitle: t.settings.dangerZone.confirmTitle,
              confirmBody: t.settings.dangerZone.confirmBody,
              confirmInputLabel: t.settings.dangerZone.confirmInputLabel,
              confirmInputPlaceholder: t.settings.dangerZone.confirmInputPlaceholder,
              confirmMismatch: t.settings.dangerZone.confirmMismatch,
              confirmCta: t.settings.dangerZone.confirmCta,
              cancel: t.common.cancel,
              deleting: t.settings.dangerZone.deleting,
              forbidden: t.settings.dangerZone.errors.forbidden,
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
