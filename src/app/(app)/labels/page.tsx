import { Pencil, Plus } from "lucide-react";import type { Metadata } from "next";

import { DeleteButton } from "@/components/shell/delete-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UpgradePrompt } from "@/components/ui/upgrade-prompt";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { hasPlanCapability } from "@/lib/plans";
import { requireActiveMembership } from "@/lib/session";

import { deleteLabelTemplateAction } from "./actions";

type PageProps = {
  params: Promise<Record<string, unknown>>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.labels?.metaTitle || "Label Templates" };
}

export default async function LabelsPage({ params: _params }: PageProps) {
  const { membership } = await requireActiveMembership();
  const _t = await getMessages();

  // Phase C — labels require PRO+ plan
  const labelsPlan = membership.organization.plan as "FREE" | "PRO" | "BUSINESS";
  const canUseLabels = hasPlanCapability(labelsPlan, "labels");

  const templates = await db.labelTemplate.findMany({
    where: { organizationId: membership.organizationId },
    orderBy: { createdAt: "desc" },
  });

  const typeLabels: Record<string, string> = {
    BIN: "Bin Label",
    ITEM: "Item Label",
    WAREHOUSE: "Warehouse Label",
    CUSTOM: "Custom Label",
  };

  const barcodeLabels: Record<string, string> = {
    CODE128: "Code 128",
    EAN13: "EAN-13",
    QR: "QR Code",
    CODE39: "Code 39",
    UPC_A: "UPC-A",
    ITF14: "ITF-14",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Label Templates</h1>
          <p className="text-muted-foreground">Create and manage label templates for printing</p>
        </div>
        {canUseLabels && templates.length > 0 ? (
          <Button variant="outline" asChild>
            <a href="/labels/designer">New Template</a>
          </Button>
        ) : null}
      </div>

      {/* Phase C — labels plan gate banner for FREE users */}
      {!canUseLabels ? (
        <UpgradePrompt
          reason="Unlock label template creation on Pro to customize your labels."
          requiredPlan="PRO"
          variant="banner"
        />
      ) : null}

      {templates.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Plus className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle>No Label Templates</CardTitle>
            <CardDescription>Create your first label template to get started</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-2">
            {canUseLabels ? (
              <Button asChild>
                <a href="/labels/designer">New Template</a>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Barcode Format</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="w-36 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">{template.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{typeLabels[template.type] || template.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {barcodeLabels[template.barcodeFormat] || template.barcodeFormat}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">
                        {template.width}mm x {template.height}mm
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canUseLabels ? (
                          <>
                            <Button variant="ghost" size="sm" asChild title="Edit template">
                              <a href={`/labels/designer?id=${template.id}`}>
                                <Pencil className="h-4 w-4" />
                              </a>
                            </Button>
                            <DeleteButton
                              labels={{
                                trigger: "Delete",
                                title: "Delete Label Template?",
                                body: "This action cannot be undone.",
                                cancel: "Cancel",
                                confirm: "Delete",
                              }}
                              action={deleteLabelTemplateAction.bind(null, template.id)}
                              iconOnly
                            />
                          </>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
