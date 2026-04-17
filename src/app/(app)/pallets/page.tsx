import { Package, Plus, Printer, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DeleteButton } from "@/components/shell/delete-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";

import { deletePalletAction, listPalletsAction } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: "Pallet Labels" };
}

export default async function PalletsPage() {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  // Capability flags for conditional UI rendering
  const canCreate = hasCapability(membership.role, "assets.create");
  const canDelete = hasCapability(membership.role, "assets.create");

  // Fetch all pallets
  const result = await listPalletsAction();

  if (!result.ok) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Pallet Labels"
          description="Manage and print pallet barcodes for inventory tracking"
        />
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-destructive">{result.error}</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pallets = result.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Pallet Labels"
          description="Manage and print pallet barcodes for inventory tracking"
        />
        {canCreate && (
          <Link href="/pallets/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Pallet Label
            </Button>
          </Link>
        )}
      </div>

      {pallets.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No pallet labels yet"
          description="Create your first pallet label to start tracking pallets by barcode."
          actions={canCreate ? [{ label: "Create Pallet Label", href: "/pallets/new" }] : undefined}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Pallets</CardTitle>
            <CardDescription>{pallets.length} pallet(s)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left text-sm font-medium py-3 px-4">Barcode</th>
                    <th className="text-left text-sm font-medium py-3 px-4">Item</th>
                    <th className="text-left text-sm font-medium py-3 px-4">Qty</th>
                    <th className="text-left text-sm font-medium py-3 px-4">Location</th>
                    <th className="text-left text-sm font-medium py-3 px-4">Created</th>
                    <th className="text-right text-sm font-medium py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pallets.map((pallet) => {
                    const locationLabel = pallet.binCode
                      ? `${pallet.warehouseName} / ${pallet.binCode}`
                      : pallet.warehouseName;

                    const createdDate = new Date(pallet.createdAt);
                    const createdStr = createdDate.toLocaleDateString();

                    return (
                      <tr key={pallet.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4">
                          <code className="rounded bg-muted px-2 py-1 text-xs font-mono">
                            {pallet.barcodeValue}
                          </code>
                        </td>
                        <td className="py-3 px-4 text-sm">{pallet.itemName}</td>
                        <td className="py-3 px-4 text-sm">{pallet.quantity}</td>
                        <td className="py-3 px-4 text-sm">{locationLabel}</td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">{createdStr}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link href={`/pallets/${pallet.id}/print`}>
                              <Button variant="ghost" size="sm">
                                <Printer className="h-4 w-4" />
                              </Button>
                            </Link>
                            {canDelete && (
                              <DeleteButton
                                labels={{
                                  trigger: "Delete",
                                  title: "Delete pallet label",
                                  body: "Are you sure you want to delete this pallet label?",
                                  cancel: "Cancel",
                                  confirm: "Delete",
                                }}
                                action={deletePalletAction.bind(null, pallet.id)}
                                iconOnly
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
