/**
 * Phase E: Import hub page.
 *
 * General import entry point with entity type selector,
 * recent import jobs, and import templates.
 */

import { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireActiveMembership } from "@/lib/session";
import { getMessages } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Import",
};

export default async function ImportPage() {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  // Fetch recent import jobs
  const recentJobs = await db.importJob.findMany({
    where: {
      organizationId: membership.organizationId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 10,
  });

  // Fetch available templates
  const templates = await db.importTemplate.findMany({
    where: {
      organizationId: membership.organizationId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 5,
  });

  const entityTypes = [
    { id: "ITEM", label: "Items", description: "Import products and SKUs" },
    { id: "SUPPLIER", label: "Suppliers", description: "Import vendor information" },
    {
      id: "PURCHASE_ORDER",
      label: "Purchase Orders",
      description: "Import PO data",
    },
    {
      id: "STOCK_LEVEL",
      label: "Stock Levels",
      description: "Import inventory levels",
    },
    {
      id: "CATEGORY",
      label: "Categories",
      description: "Import product categories",
    },
    {
      id: "WAREHOUSE",
      label: "Warehouses",
      description: "Import warehouse/location data",
    },
    {
      id: "CUSTOMER",
      label: "Customers",
      description: "Import customer information",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Import Data</h1>
        <p className="text-muted-foreground mt-2">
          Import data from CSV or Excel files into OneAce.
        </p>
      </div>

      {/* Entity type selector */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Select what to import</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {entityTypes.map((entity) => (
            <Link
              key={entity.id}
              href={`/import/new?type=${entity.id}`}
              className="border rounded-lg p-4 hover:bg-gray-50 transition"
            >
              <h3 className="font-semibold">{entity.label}</h3>
              <p className="text-sm text-muted-foreground">
                {entity.description}
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* Import templates */}
      {templates.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Saved Templates</h2>
            <Link
              href="/import/templates"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {templates.map((template) => (
              <div
                key={template.id}
                className="border rounded-lg p-4 flex items-center justify-between hover:bg-gray-50"
              >
                <div>
                  <h3 className="font-medium">{template.name}</h3>
                </div>
                <Link
                  href={`/import/new?template=${template.id}`}
                  className="px-3 py-1 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Use
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent imports */}
      {recentJobs.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Recent Imports</h2>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Entity</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">
                    Date
                  </th>
                  <th className="text-right px-4 py-3 font-medium">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentJobs.map((job) => (
                  <tr key={job.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">{job.entityType}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded ${
                          job.status === "COMPLETED"
                            ? "bg-green-100 text-green-800"
                            : job.status === "PROCESSING"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-red-100 text-red-800"
                        }`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {job.createdAt.toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/import/${job.id}`}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
