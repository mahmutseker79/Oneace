/**
 * Phase E: Integration hub page.
 *
 * Lists all available integrations with connection status, last sync time,
 * and connect/disconnect buttons.
 */

import { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { requireActiveMembership } from "@/lib/session";
import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";

import { disconnectIntegrationAction } from "./actions";

export const metadata: Metadata = {
  title: "Integrations",
};

interface IntegrationCard {
  id: string;
  provider: string;
  status: string;
  lastSyncAt: Date | null;
  icon: string;
  description: string;
  connected: boolean;
}

export default async function IntegrationsPage() {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  const canConnect = hasCapability(membership.role, "integrations.connect");
  const canDisconnect = hasCapability(
    membership.role,
    "integrations.disconnect",
  );

  // Fetch connected integrations
  const connectedIntegrations = await db.integration.findMany({
    where: {
      organizationId: membership.organizationId,
      status: "CONNECTED",
    },
  });

  const connectedMap = new Map(
    connectedIntegrations.map((i) => [i.provider, i]),
  );

  // Define available integrations
  const availableIntegrations: IntegrationCard[] = [
    {
      id: "quickbooks",
      provider: "QUICKBOOKS_ONLINE",
      status: connectedMap.has("QUICKBOOKS_ONLINE") ? "connected" : "disconnected",
      lastSyncAt: connectedMap.get("QUICKBOOKS_ONLINE")?.lastSyncAt ?? null,
      icon: "qbo",
      description: "Sync items, suppliers, and purchase orders with QuickBooks Online",
      connected: connectedMap.has("QUICKBOOKS_ONLINE"),
    },
    {
      id: "shopify",
      provider: "SHOPIFY",
      status: connectedMap.has("SHOPIFY") ? "connected" : "disconnected",
      lastSyncAt: connectedMap.get("SHOPIFY")?.lastSyncAt ?? null,
      icon: "shopify",
      description: "Sync products and orders with Shopify",
      connected: connectedMap.has("SHOPIFY"),
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Integrations"
        description="Connect OneAce with external systems to sync data automatically."
        breadcrumb={[
          { label: "Settings", href: "/settings" },
          { label: "Integrations", href: "#" },
        ]}
        backHref="/settings"
      />

      <div className="grid gap-6 md:grid-cols-2">
        {availableIntegrations.map((integration) => (
          <div
            key={integration.id}
            className="border rounded-lg p-6 space-y-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="font-semibold text-lg">{integration.provider === "QUICKBOOKS_ONLINE" ? "QuickBooks Online" : integration.provider}</h2>
                <p className="text-sm text-muted-foreground">
                  {integration.description}
                </p>
              </div>
              <div
                className={`px-2 py-1 rounded text-sm font-medium ${
                  integration.connected
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {integration.connected ? "Connected" : "Disconnected"}
              </div>
            </div>

            {integration.lastSyncAt && (
              <div className="text-sm text-muted-foreground">
                Last sync:{" "}
                {integration.lastSyncAt.toLocaleString()}
              </div>
            )}

            <div className="flex gap-2 pt-4">
              {integration.connected ? (
                <>
                  <Link
                    href={`/settings/integrations/${integration.id}`}
                    className="flex-1 text-center px-3 py-2 text-sm font-medium border rounded hover:bg-gray-50"
                  >
                    Settings
                  </Link>
                  {canDisconnect && connectedMap.get(integration.provider) && (
                    <form action={async () => {
                      "use server";
                      const integrationRecord = await db.integration.findFirst({
                        where: { provider: integration.provider, organizationId: membership.organizationId, status: "CONNECTED" },
                        select: { id: true },
                      });
                      if (integrationRecord) {
                        await disconnectIntegrationAction({ integrationId: integrationRecord.id });
                      }
                    }}>
                      <Button type="submit" variant="destructive" size="sm" className="flex-1">
                        Disconnect
                      </Button>
                    </form>
                  )}
                </>
              ) : (
                canConnect && (
                  <Link
                    href={`/settings/integrations/${integration.id}`}
                    className="w-full text-center px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Connect
                  </Link>
                )
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Webhooks section */}
      <div className="pt-8 border-t">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Webhooks</h2>
          <Link
            href="/settings/webhooks"
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Manage webhooks
          </Link>
        </div>
        <p className="text-muted-foreground">
          Send real-time notifications to external systems when events occur in
          OneAce.
        </p>
      </div>
    </div>
  );
}
