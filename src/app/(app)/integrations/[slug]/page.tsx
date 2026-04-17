/**
 * Integration detail page with comprehensive management UI.
 *
 * Shows connection status, sync history, settings, field mappings,
 * sync rules, webhooks, and sync schedules.
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { IntegrationProvider } from "@/generated/prisma";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";
import { BarChart3, ExternalLink, RefreshCw } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { disconnectIntegrationAction, getSyncStatsAction, triggerSyncAction } from "../actions";
import { FieldMappingTable } from "./field-mapping-table";
import { SettingsPanel } from "./settings-panel";
import { SyncRulesPanel } from "./sync-rules-panel";
import { SyncSchedulesPanel } from "./sync-schedules-panel";
import { WebhookEventsPanel } from "./webhook-events-panel";

// ── Slug → Provider mapping ─────────────────────────────────────

const SLUG_MAP: Record<
  string,
  { provider: IntegrationProvider; name: string; docsUrl?: string; oauthPath?: string }
> = {
  quickbooks: {
    provider: "QUICKBOOKS_ONLINE",
    name: "QuickBooks Online",
    docsUrl: "https://developer.intuit.com/app/developer/qbo/docs/develop",
    oauthPath: "/api/integrations/quickbooks/callback",
  },
  "quickbooks-desktop": {
    provider: "QUICKBOOKS_DESKTOP",
    name: "QuickBooks Desktop",
  },
  shopify: {
    provider: "SHOPIFY",
    name: "Shopify",
    docsUrl: "https://shopify.dev/docs/apps",
    oauthPath: "/api/integrations/shopify/callback",
  },
  woocommerce: {
    provider: "WOOCOMMERCE",
    name: "WooCommerce",
    docsUrl: "https://woocommerce.github.io/woocommerce-rest-api-docs/",
  },
  xero: {
    provider: "XERO",
    name: "Xero",
    docsUrl: "https://developer.xero.com/documentation/",
  },
  amazon: {
    provider: "AMAZON",
    name: "Amazon",
    docsUrl: "https://developer-docs.amazon.com/sp-api/",
  },
  bigcommerce: {
    provider: "BIGCOMMERCE",
    name: "BigCommerce",
    docsUrl: "https://developer.bigcommerce.com/docs/rest-catalog",
  },
  magento: {
    provider: "MAGENTO",
    name: "Magento / Adobe Commerce",
    docsUrl: "https://developer.adobe.com/commerce/webapi/rest/",
  },
  wix: {
    provider: "WIX",
    name: "Wix",
    docsUrl: "https://dev.wix.com/docs/rest",
  },
  odoo: {
    provider: "ODOO",
    name: "Odoo",
    docsUrl: "https://www.odoo.com/documentation/17.0/developer.html",
  },
  "zoho-inventory": {
    provider: "ZOHO_INVENTORY",
    name: "Zoho Inventory",
    docsUrl: "https://www.zoho.com/inventory/api/v1/",
  },
  "custom-webhook": {
    provider: "CUSTOM_WEBHOOK",
    name: "Custom Webhook",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const info = SLUG_MAP[slug];
  return { title: info ? `${info.name} — Integrations` : "Integration" };
}

export default async function IntegrationDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const info = SLUG_MAP[slug];

  if (!info) {
    notFound();
  }

  const { membership } = await requireActiveMembership();
  const _t = await getMessages();

  const canConnect = hasCapability(membership.role, "integrations.connect");
  const canDisconnect = hasCapability(membership.role, "integrations.disconnect");
  const canSync = hasCapability(membership.role, "integrations.sync");

  // Fetch integration for this provider
  const integration = await db.integration.findFirst({
    where: {
      organizationId: membership.organizationId,
      provider: info.provider,
    },
    orderBy: { createdAt: "desc" },
  });

  const isConnected = integration?.status === "CONNECTED";

  // Fetch sync history
  const syncLogs = integration
    ? await db.syncLog.findMany({
        where: { integrationId: integration.id },
        orderBy: { startedAt: "desc" },
        take: 10,
        select: {
          id: true,
          direction: true,
          entityType: true,
          status: true,
          startedAt: true,
          completedAt: true,
          recordsProcessed: true,
          recordsFailed: true,
          errors: true,
        },
      })
    : [];

  // Fetch related data for connected integration
  const fieldMappings = integration
    ? await db.integrationFieldMapping.findMany({
        where: { integrationId: integration.id },
        orderBy: [{ entityType: "asc" }, { sortOrder: "asc" }],
      })
    : [];

  const syncRules = integration
    ? await db.integrationSyncRule.findMany({
        where: { integrationId: integration.id },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      })
    : [];

  const webhookEvents = integration
    ? await db.integrationWebhookEvent.findMany({
        where: { integrationId: integration.id },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const syncSchedules = integration
    ? await db.integrationSyncSchedule.findMany({
        where: { integrationId: integration.id },
        orderBy: [{ entityType: "asc" }],
      })
    : [];

  // Get sync stats
  let syncStats = {
    totalSyncs: 0,
    successfulSyncs: 0,
    failedSyncs: 0,
    totalRecords: 0,
    totalErrors: 0,
  };
  if (integration) {
    const statsResult = await getSyncStatsAction(integration.id);
    if (statsResult.ok) {
      syncStats = statsResult.data;
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={info.name}
        description={isConnected ? "Connected and active" : "Not connected"}
        breadcrumb={[
          { label: "Integrations", href: "/integrations" },
          { label: info.name, href: "#" },
        ]}
        backHref="/integrations"
      />

      {/* Status & Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Connection Status</CardTitle>
              <CardDescription>
                {isConnected
                  ? `Connected since ${integration?.createdAt?.toLocaleDateString()}`
                  : `Connect your ${info.name} account to start syncing data.`}
              </CardDescription>
            </div>
            <Badge variant={isConnected ? "success" : "secondary"}>
              {isConnected ? "Connected" : "Disconnected"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {isConnected ? (
              <>
                {canSync && integration && (
                  <form
                    action={async () => {
                      "use server";
                      await triggerSyncAction({ integrationId: integration.id });
                    }}
                  >
                    <Button type="submit" size="sm">
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Sync Now
                    </Button>
                  </form>
                )}
                {canDisconnect && integration && (
                  <form
                    action={async () => {
                      "use server";
                      await disconnectIntegrationAction({ integrationId: integration.id });
                    }}
                  >
                    <Button type="submit" variant="destructive" size="sm">
                      Disconnect
                    </Button>
                  </form>
                )}
              </>
            ) : (
              canConnect &&
              (info.oauthPath ? (
                <Link href={info.oauthPath}>
                  <Button size="sm">Connect {info.name}</Button>
                </Link>
              ) : (
                <p className="text-sm text-muted-foreground">
                  This integration is coming soon. Contact support for early access.
                </p>
              ))
            )}

            {info.docsUrl && (
              <Link href={info.docsUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  API Docs
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sync Statistics */}
      {isConnected && integration && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Sync Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total Syncs</p>
                <p className="text-2xl font-bold">{syncStats.totalSyncs}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Successful</p>
                <p className="text-2xl font-bold text-green-600">{syncStats.successfulSyncs}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Failed</p>
                <p className="text-2xl font-bold text-red-600">{syncStats.failedSyncs}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Records Synced</p>
                <p className="text-2xl font-bold">{syncStats.totalRecords}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Errors</p>
                <p className="text-2xl font-bold text-orange-600">{syncStats.totalErrors}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabbed Configuration */}
      {isConnected && integration && (
        <Tabs defaultValue="settings" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="mappings">Field Mappings</TabsTrigger>
            <TabsTrigger value="rules">Sync Rules</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
            <TabsTrigger value="schedules">Schedules</TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="space-y-4">
            <SettingsPanel integration={integration} />
          </TabsContent>

          <TabsContent value="mappings" className="space-y-4">
            <FieldMappingTable integrationId={integration.id} mappings={fieldMappings} />
          </TabsContent>

          <TabsContent value="rules" className="space-y-4">
            <SyncRulesPanel integrationId={integration.id} rules={syncRules} />
          </TabsContent>

          <TabsContent value="webhooks" className="space-y-4">
            <WebhookEventsPanel integrationId={integration.id} events={webhookEvents} />
          </TabsContent>

          <TabsContent value="schedules" className="space-y-4">
            <SyncSchedulesPanel integrationId={integration.id} schedules={syncSchedules} />
          </TabsContent>
        </Tabs>
      )}

      {/* Sync History */}
      {syncLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sync History</CardTitle>
            <CardDescription>Last 10 sync operations.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium">Date</th>
                    <th className="text-left py-2 px-3 font-medium">Direction</th>
                    <th className="text-left py-2 px-3 font-medium">Type</th>
                    <th className="text-left py-2 px-3 font-medium">Status</th>
                    <th className="text-right py-2 px-3 font-medium">Records</th>
                    <th className="text-right py-2 px-3 font-medium">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {syncLogs.map((log) => (
                    <tr key={log.id} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-3 text-muted-foreground">
                        {log.startedAt.toLocaleString()}
                      </td>
                      <td className="py-2 px-3">
                        <Badge variant="secondary">{log.direction}</Badge>
                      </td>
                      <td className="py-2 px-3">{log.entityType}</td>
                      <td className="py-2 px-3">
                        <Badge
                          variant={
                            log.status === "COMPLETED"
                              ? "success"
                              : log.status === "FAILED"
                                ? "destructive"
                                : "warning"
                          }
                        >
                          {log.status}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums">
                        {log.recordsProcessed ?? "—"}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums">
                        {log.recordsFailed ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state for no history when connected */}
      {isConnected && syncLogs.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <RefreshCw className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">No sync history yet.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Click &quot;Sync Now&quot; to start your first synchronization.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
