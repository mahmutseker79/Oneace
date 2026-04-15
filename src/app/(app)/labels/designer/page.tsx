import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";

type PageProps = {
  params: Promise<Record<string, unknown>>;
  searchParams: Promise<{ id?: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: "Label Designer" };
}

export default async function LabelDesignerPage({ params, searchParams }: PageProps) {
  await params; // Satisfy the unused param lint rule
  const { id } = await searchParams;
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  let template = null;
  if (id && typeof id === "string") {
    template = await db.labelTemplate.findFirst({
      where: { id, organizationId: membership.organizationId },
    });

    if (!template) {
      notFound();
    }
  }

  const isEdit = !!template;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/labels">
            <ArrowLeft className="h-4 w-4" />
            Back to Templates
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">
          {isEdit
            ? "Edit Label Template"
            : "New Label Template"}
        </h1>
        <p className="text-muted-foreground">
          Design your label layout and configure barcode settings
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Configuration Panel */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Template Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Standard Bin Label"
                  defaultValue={template?.name || ""}
                  maxLength={120}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Label Type</Label>
                <Select defaultValue={template?.type || "BIN"}>
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BIN">Bin Label</SelectItem>
                    <SelectItem value="ITEM">Item Label</SelectItem>
                    <SelectItem value="WAREHOUSE">Warehouse Label</SelectItem>
                    <SelectItem value="CUSTOM">Custom Label</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="width">Width (mm)</Label>
                  <Input
                    id="width"
                    type="number"
                    min="10"
                    max="500"
                    step="0.5"
                    defaultValue={template?.width || "50"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="height">Height (mm)</Label>
                  <Input
                    id="height"
                    type="number"
                    min="10"
                    max="500"
                    step="0.5"
                    defaultValue={template?.height || "30"}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="barcodeFormat">
                  Barcode Format
                </Label>
                <Select defaultValue={template?.barcodeFormat || "CODE128"}>
                  <SelectTrigger id="barcodeFormat">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CODE128">Code 128</SelectItem>
                    <SelectItem value="CODE39">Code 39</SelectItem>
                    <SelectItem value="EAN13">EAN-13</SelectItem>
                    <SelectItem value="UPC_A">UPC-A</SelectItem>
                    <SelectItem value="ITF14">ITF-14</SelectItem>
                    <SelectItem value="QR">QR Code</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview and Canvas Panel */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Label Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Simplified canvas preview */}
              <div className="space-y-4">
                <div
                  className="border-2 border-dashed border-muted-foreground/50 bg-muted/30 p-4"
                  style={{
                    aspectRatio: template ? `${template.width}/${template.height}` : "50/30",
                  }}
                >
                  <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
                    <div>
                      <p className="font-medium">Label Preview</p>
                      <p className="text-xs">
                        {template
                          ? `${template.width}mm × ${template.height}mm`
                          : "Configure dimensions to see preview"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">
                    Label Fields
                  </h3>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded-md border border-muted-foreground/20 bg-muted/30 p-2">
                      <span className="text-sm">
                        Barcode
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Remove field"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    title="Add field"
                  >
                    <Plus className="h-4 w-4" />
                    Add Field
                  </Button>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button variant="outline" asChild>
                    <Link href="/labels">Cancel</Link>
                  </Button>
                  <Button>{isEdit ? "Save" : "Create"}</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
