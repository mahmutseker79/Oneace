import { Download, Trash2 } from "lucide-react";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";

import { DeleteAccountForm } from "./delete-account-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.privacy?.heading || "Privacy & Data" };
}

export default async function PrivacyPage() {
  const { membership, session } = await requireActiveMembership();
  const t = await getMessages();

  // Check if user is owner of any org to show warning
  const ownedOrgs = await db.membership.findMany({
    where: {
      userId: session.user.id,
      role: "OWNER",
    },
  });

  const isOrgOwner = ownedOrgs.length > 0;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t.privacy?.heading || "Privacy & Data"}</h1>
        <p className="text-muted-foreground">
          {t.privacy?.subtitle || "Manage your personal data and account settings"}
        </p>
      </div>

      <div className="space-y-6">
        {/* Data Export Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              {t.privacy?.exportData?.title || "Export Your Data"}
            </CardTitle>
            <CardDescription>
              {t.privacy?.exportData?.subtitle ||
                "Download a copy of all your data in JSON format"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              You can request a complete copy of your personal data. This includes your profile,
              account history, memberships, and all items/movements you've created.
            </p>
            <Button asChild>
              <a href="/api/account/export" download>
                <Download className="mr-2 h-4 w-4" />
                {t.privacy?.exportData?.button || "Download My Data"}
              </a>
            </Button>
          </CardContent>
        </Card>

        {/* Delete Account Card */}
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <Trash2 className="h-4 w-4" />
              {t.privacy?.deleteAccount?.title || "Delete Account"}
            </CardTitle>
            <CardDescription>
              {t.privacy?.deleteAccount?.subtitle ||
                "Permanently delete your account and all associated data"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md bg-red-50 p-4 dark:bg-red-950">
              <p className="text-sm font-semibold text-red-900 dark:text-red-200">
                {t.privacy?.deleteAccount?.warning ||
                  "Warning: This action cannot be undone. Your personal data will be deleted, but organization data (items, movements) will be preserved."}
              </p>
            </div>

            {isOrgOwner && (
              <div className="rounded-md bg-yellow-50 p-4 dark:bg-yellow-950">
                <p className="text-sm text-yellow-900 dark:text-yellow-200">
                  {t.privacy?.deleteAccount?.ownerWarning ||
                    "You are the owner of one or more organizations. You must transfer ownership before deleting your account."}
                </p>
              </div>
            )}

            <DeleteAccountForm
              isDisabled={isOrgOwner}
              labels={{
                confirmPhrase: t.privacy?.deleteAccount?.confirmPhrase || "Confirmation phrase",
                confirmPlaceholder:
                  t.privacy?.deleteAccount?.confirmPlaceholder || "Type DELETE MY ACCOUNT",
                button: t.privacy?.deleteAccount?.button || "Delete My Account",
                cancel: t.common?.cancel || "Cancel",
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
