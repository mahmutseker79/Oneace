/**
 * Phase E: Export hub page.
 *
 * Allows users to export inventory data in various formats.
 */

import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Export",
};

export default async function ExportPage() {
  const { membership: _membership } = await requireActiveMembership();
  const _t = await getMessages();

  const exportOptions = [
    {
      id: "ITEM",
      label: "Items",
      description: "Export all products and SKUs",
      formats: ["CSV", "Excel"],
    },
    {
      id: "SUPPLIER",
      label: "Suppliers",
      description: "Export vendor information",
      formats: ["CSV", "Excel"],
    },
    {
      id: "PURCHASE_ORDER",
      label: "Purchase Orders",
      description: "Export PO data",
      formats: ["CSV", "Excel"],
    },
    {
      id: "STOCK_LEVEL",
      label: "Stock Levels",
      description: "Export current inventory levels",
      formats: ["CSV", "Excel"],
    },
    {
      id: "CATEGORY",
      label: "Categories",
      description: "Export product categories",
      formats: ["CSV", "Excel"],
    },
    {
      id: "WAREHOUSE",
      label: "Warehouses",
      description: "Export warehouse/location data",
      formats: ["CSV", "Excel"],
    },
    {
      id: "CUSTOMER",
      label: "Customers",
      description: "Export customer information",
      formats: ["CSV", "Excel"],
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Export Data"
        description="Export inventory data from OneAce in various formats."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {exportOptions.map((option) => (
          <div key={option.id} className="border rounded-lg p-6 space-y-4">
            <div>
              <h2 className="font-semibold text-lg">{option.label}</h2>
              <p className="text-sm text-muted-foreground">{option.description}</p>
            </div>

            <div className="space-y-2">
              {option.formats.map((format) => (
                <button
                  key={format}
                  className="w-full px-3 py-2 text-sm font-medium border rounded hover:bg-muted transition"
                >
                  Export as {format}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Scheduled exports info */}
      <div className="border-t pt-8">
        <h2 className="text-xl font-semibold mb-4">Scheduled Exports</h2>
        <p className="text-muted-foreground mb-4">
          Set up automatic exports to be sent to your email or integrated systems.
        </p>
        <Link
          href="/settings/scheduled-reports"
          className="inline-block px-4 py-2 text-sm font-medium bg-info text-white rounded hover:bg-info/90"
        >
          Configure Scheduled Exports
        </Link>
      </div>
    </div>
  );
}
