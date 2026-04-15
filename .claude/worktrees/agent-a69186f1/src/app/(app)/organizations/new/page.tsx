import { Building2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";

import { CreateOrgForm } from "./create-org-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.organizations.create.metaTitle };
}

/**
 * Dedicated page for creating an additional organization from an
 * already-authenticated, already-onboarded user. The first-org
 * flow lives at `/onboarding` and is reached from signup; this
 * page is reached from the header OrgSwitcher's "Create new
 * organization…" option.
 *
 * We still call `requireActiveMembership()` so a user with zero
 * memberships is redirected to /onboarding (which is the correct
 * path for them — they need the first-org flow, not this one).
 */
export default async function CreateOrganizationPage() {
  await requireActiveMembership();
  const t = await getMessages();

  return (
    <div className="mx-auto max-w-lg space-y-6 py-8">
      <div className="flex items-start gap-3">
        <Building2 className="text-muted-foreground mt-1 h-5 w-5" />
        <div>
          <h1 className="text-2xl font-semibold">{t.organizations.create.heading}</h1>
          <p className="text-muted-foreground text-sm">{t.organizations.create.subtitle}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.organizations.create.nameLabel}</CardTitle>
          <CardDescription>{t.organizations.create.nameHelper}</CardDescription>
        </CardHeader>
        <CardContent>
          <CreateOrgForm
            labels={{
              nameLabel: t.organizations.create.nameLabel,
              namePlaceholder: t.organizations.create.namePlaceholder,
              submit: t.organizations.create.submit,
              creating: t.organizations.create.creating,
              cancel: t.organizations.create.cancel,
              fallbackError: t.organizations.errors.createFailed,
            }}
          />
        </CardContent>
      </Card>

      <div>
        <Link href="/dashboard" className="text-muted-foreground text-sm hover:underline">
          ← {t.organizations.create.cancel}
        </Link>
      </div>
    </div>
  );
}
