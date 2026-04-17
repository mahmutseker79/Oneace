/**
 * Standalone Integrations hub page.
 *
 * Lists all available integrations (12 providers from IntegrationProvider enum)
 * with connection status, last sync time, and connect/disconnect buttons.
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import type { IntegrationProvider } from "@/generated/prisma";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";
import {
  Boxes,
  Factory,
  FileSpreadsheet,
  Globe,
  HardDrive,
  Link2,
  Package,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  Store,
  Warehouse,
  Webhook,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { disconnectIntegrationAction } from "./actions";
import { MigrationCard } from "./components/migration-card";

export const metadata: Metadata = {
  title: "Integrations",
};

// ── Provider catalog ────────────────────────────────────────────
interface ProviderInfo {
  provider: IntegrationProvider;
  name: string;
  slug: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: "accounting" | "ecommerce" | "erp" | "migration" | "webhook";
}

const PROVIDERS: ProviderInfo[] = [
  // Accounting
  {
    provider: "QUICKBOOKS_ONLINE",
    name: "QuickBooks Online",
    slug: "quickbooks",
    description: "Sync items, suppliers, and purchase orders with QuickBooks Online.",
    icon: Package,
    category: "accounting",
  },
  {
    provider: "QUICKBOOKS_DESKTOP",
    name: "QuickBooks Desktop",
    slug: "quickbooks-desktop",
    description: "Connect to QuickBooks Desktop via Web Connector.",
    icon: Package,
    category: "accounting",
  },
  {
    provider: "XERO",
    name: "Xero",
    slug: "xero",
    description: "Two-way sync of products, invoices, and contacts with Xero.",
    icon: Globe,
    category: "accounting",
  },
  {
    provider: "ZOHO_INVENTORY",
    name: "Zoho Inventory",
    slug: "zoho-inventory",
    description: "Sync items, warehouses, and orders with Zoho Inventory.",
    icon: Package,
    category: "accounting",
  },
  // E-commerce
  {
    provider: "SHOPIFY",
    name: "Shopify",
    slug: "shopify",
    description: "Sync products, orders, and fulfillments with Shopify.",
    icon: ShoppingBag,
    category: "ecommerce",
  },
  {
    provider: "WOOCOMMERCE",
    name: "WooCommerce",
    slug: "woocommerce",
    description: "Sync products and orders with your WooCommerce store.",
    icon: ShoppingCart,
    category: "ecommerce",
  },
  {
    provider: "AMAZON",
    name: "Amazon",
    slug: "amazon",
    description: "Sync inventory levels and orders with Amazon Seller Central.",
    icon: ShoppingBag,
    category: "ecommerce",
  },
  {
    provider: "BIGCOMMERCE",
    name: "BigCommerce",
    slug: "bigcommerce",
    description: "Sync products, orders, and stock levels with BigCommerce.",
    icon: Store,
    category: "ecommerce",
  },
  {
    provider: "MAGENTO",
    name: "Magento / Adobe Commerce",
    slug: "magento",
    description: "Sync catalog, orders, and inventory with Magento 2.",
    icon: Store,
    category: "ecommerce",
  },
  {
    provider: "WIX",
    name: "Wix",
    slug: "wix",
    description: "Sync products and orders with your Wix eCommerce store.",
    icon: Globe,
    category: "ecommerce",
  },
  // ERP
  {
    provider: "ODOO",
    name: "Odoo",
    slug: "odoo",
    description: "Sync products, warehouses, and movements with Odoo ERP.",
    icon: Link2,
    category: "erp",
  },
  // Webhook
  {
    provider: "CUSTOM_WEBHOOK",
    name: "Custom Webhook",
    slug: "custom-webhook",
    description: "Send real-time event notifications to any HTTP endpoint.",
    icon: Webhook,
    category: "webhook",
  },
];

// Migration source labels for non-provider migrations
const MIGRATION_SOURCES_INFO = [
  {
    source: "SORTLY",
    name: "Sortly",
    icon: Package,
  },
  {
    source: "INFLOW",
    name: "inFlow",
    icon: Boxes,
  },
  {
    source: "FISHBOWL",
    name: "Fishbowl",
    icon: Warehouse,
  },
  {
    source: "CIN7",
    name: "Cin7 Core",
    icon: Factory,
  },
  {
    source: "SOS_INVENTORY",
    name: "SOS Inventory",
    icon: Receipt,
  },
  {
    source: "QUICKBOOKS_ONLINE",
    name: "QuickBooks Online (Göç)",
    icon: FileSpreadsheet,
  },
  {
    source: "QUICKBOOKS_DESKTOP",
    name: "QuickBooks Desktop (Göç)",
    icon: HardDrive,
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  accounting: "Accounting & Finance",
  ecommerce: "E-commerce",
  erp: "ERP Systems",
  migration: "Rakipten Göç / Migration",
  webhook: "Webhooks & Custom",
};

// ── Page component ──────────────────────────────────────────────

export default async function IntegrationsPage() {
  const { membership } = await requireActiveMembership();
  const _t = await getMessages();

  const canConnect = hasCapability(membership.role, "integrations.connect");
  const canDisconnect = hasCapability(membership.role, "integrations.disconnect");

  // Fetch all connected integrations for this org
  const connectedIntegrations = await db.integration.findMany({
    where: {
      organizationId: membership.organizationId,
      status: "CONNECTED",
    },
  });

  const connectedMap = new Map(connectedIntegrations.map((i) => [i.provider, i]));

  // Fetch completed migration jobs for this org to show last migration
  const completedMigrations = await db.migrationJob.findMany({
    where: {
      organizationId: membership.organizationId,
      status: "COMPLETED",
    },
    orderBy: { completedAt: "desc" },
    distinct: ["sourcePlatform"],
  });

  const lastMigrationMap = new Map();
  completedMigrations.forEach((job) => {
    if (!lastMigrationMap.has(job.sourcePlatform)) {
      const importResults = job.importResults as {
        totals?: { items?: number };
      } | null;
      lastMigrationMap.set(job.sourcePlatform, {
        completedAt: job.completedAt,
        itemsImported: importResults?.totals?.items ?? 0,
      });
    }
  });

  // Group providers by category
  const categories = ["accounting", "ecommerce", "erp", "migration", "webhook"] as const;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Integrations"
        description="Connect OneAce with external systems to sync data automatically."
      />

      {categories.map((cat) => {
        if (cat === "migration") {
          return (
            <section key={cat}>
              <h2 className="mb-4 text-lg font-semibold">{CATEGORY_LABELS[cat]}</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {MIGRATION_SOURCES_INFO.map((info) => {
                  const lastJob = lastMigrationMap.get(info.source as any) || null;
                  return (
                    <MigrationCard
                      key={info.source}
                      source={info.source as any}
                      lastJob={lastJob}
                      canStart={hasCapability(membership.role, "migrations.create")}
                    />
                  );
                })}
              </div>
            </section>
          );
        }

        const providersInCat = PROVIDERS.filter((p) => p.category === cat);
        if (providersInCat.length === 0) return null;

        return (
          <section key={cat}>
            <h2 className="mb-4 text-lg font-semibold">{CATEGORY_LABELS[cat]}</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {providersInCat.map((info) => {
                const connected = connectedMap.has(info.provider);
                const integration = connectedMap.get(info.provider);
                const Icon = info.icon;

                return (
                  <Card key={info.provider} className="relative overflow-hidden">
                    {/* Connection status indicator */}
                    {connected && (
                      <div className="absolute top-0 left-0 right-0 h-0.5 bg-success" />
                    )}
                    <CardContent className="pt-6 space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                          <Icon className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm truncate">{info.name}</h3>
                            <span
                              className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                connected
                                  ? "bg-success/10 text-success"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {connected ? "Connected" : "Not connected"}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {info.description}
                          </p>
                        </div>
                      </div>

                      {connected && integration?.lastSyncAt && (
                        <p className="text-xs text-muted-foreground">
                          Last sync: {integration.lastSyncAt.toLocaleDateString()}
                        </p>
                      )}

                      <div className="flex gap-2">
                        {connected ? (
                          <>
                            <Link href={`/integrations/${info.slug}`} className="flex-1">
                              <Button variant="outline" size="sm" className="w-full">
                                Settings
                              </Button>
                            </Link>
                            {canDisconnect && integration && (
                              <form
                                action={async () => {
                                  "use server";
                                  await disconnectIntegrationAction({
                                    integrationId: integration.id,
                                  });
                                }}
                              >
                                <Button type="submit" variant="destructive" size="sm">
                                  Disconnect
                                </Button>
                              </form>
                            )}
                          </>
                        ) : (
                          canConnect && (
                            <Link href={`/integrations/${info.slug}`} className="w-full">
                              <Button size="sm" className="w-full">
                                Connect
                              </Button>
                            </Link>
                          )
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
