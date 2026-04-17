import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FieldMappingTable } from "@/components/ui/field-mapping-table";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import type { FieldMapping } from "@/lib/migrations/core/types";
import { requireActiveMembership } from "@/lib/session";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Field Mapping",
};

const TARGET_SCHEMA: Record<string, string> = {
  "item.sku": "Item SKU",
  "item.name": "Item Name",
  "item.barcode": "Barcode",
  "item.description": "Description",
  "item.costPrice": "Cost Price",
  "item.salePrice": "Sale Price",
  "item.reorderPoint": "Reorder Point",
  "item.reorderQty": "Reorder Quantity",
  "category.name": "Category",
  "supplier.name": "Supplier",
  "stockLevel.quantity": "Stock Level",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MappingPage(props: PageProps) {
  const params = await props.params;
  const { membership } = await requireActiveMembership();

  const job = await db.migrationJob.findFirst({
    where: {
      id: params.id,
      organizationId: membership.organizationId,
    },
  });

  if (!job) {
    notFound();
  }

  const sourceFiles = job.sourceFiles as
    | { headers: string[]; preview: (string | null)[][] }[]
    | null;
  const sourceHeaders = sourceFiles?.[0]?.headers ?? [];
  const previewRows = sourceFiles?.[0]?.preview ?? [];
  const mappings = (job.fieldMappings as FieldMapping[] | null) ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Alan Eşlemesi"
        description="Kaynak dosyasının sütunlarını OneAce alanlarına eşleyin"
      />

      <Card>
        <CardContent className="pt-6 space-y-6">
          <FieldMappingTable
            sourceHeaders={sourceHeaders}
            targetSchema={TARGET_SCHEMA}
            mappings={mappings}
            onChange={(newMappings) => {
              // This would be handled by a server action in production
              console.log("Mappings changed:", newMappings);
            }}
            previewRows={previewRows}
          />

          <div className="flex gap-2 pt-4 border-t">
            <Button variant="outline">Geri</Button>
            <Button>Devam Et</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
