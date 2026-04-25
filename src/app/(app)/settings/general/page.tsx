import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireActiveMembership } from "@/lib/session";
import type { Metadata } from "next";
import { getOrCreateOrgSettingsAction } from "./actions";
import { GeneralSettingsForm } from "./settings-form";

export const metadata: Metadata = {
  title: "General Settings",
};

/**
 * Phase L9 — Organization general settings page.
 *
 * Renders the org settings dashboard with sections for:
 *   - Numbering (Transfer, Sales Order, Asset Tag, Batch prefixes + sequence reads)
 *   - Counting Workflow (Methodology, Approval, Variance, Recount)
 *   - Stock Management (Negative stock, Default status)
 *   - Display (Date format, Currency symbol)
 *
 * Fetches current settings server-side and passes to the client form component
 * for interactive updates.
 */
export default async function GeneralSettingsPage() {
  const { membership } = await requireActiveMembership();
  const settingsResult = await getOrCreateOrgSettingsAction();

  if (!settingsResult.ok) {
    return (
      <div className="space-y-4">
        <PageHeader title="General Settings" />
        <Card variant="destructive">
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive">
              Failed to load settings: {settingsResult.error}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const settings = settingsResult.data as {
    id: string;
    organizationId: string;
    transferNumberPrefix: string;
    transferNumberSequence: number;
    salesOrderPrefix: string;
    salesOrderSequence: number;
    assetTagPrefix: string;
    assetTagSequence: number;
    batchNumberPrefix: string;
    batchNumberSequence: number;
    requireCountApproval: boolean;
    varianceThreshold: { toString: () => string } | string | number;
    recountOnThreshold: boolean;
    defaultCountMethodology: string;
    allowNegativeStock: boolean;
    defaultStockStatus: string;
    dateFormat: string;
    currencySymbol: string;
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="General Settings"
        description="Configure numbering prefixes, counting workflows, stock management rules, and display preferences."
        breadcrumb={[
          { label: "Settings", href: "/settings" },
          { label: "General", href: "#" },
        ]}
        backHref="/settings"
      />

      <GeneralSettingsForm settings={settings} organizationId={membership.organizationId} />
    </div>
  );
}
