import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";

import { ImportItemsForm, type ImportItemsLabels } from "./import-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.itemsImport.metaTitle };
}

export default async function ImportItemsPage() {
  // Gate the page on an active membership. We don't need any org data here —
  // the wizard is entirely client-side until the final commit, at which point
  // the server action re-checks the session itself.
  await requireActiveMembership();
  const t = await getMessages();

  const labels: ImportItemsLabels = {
    steps: {
      upload: t.itemsImport.stepUpload,
      map: t.itemsImport.stepMap,
      preview: t.itemsImport.stepPreview,
      done: t.itemsImport.stepDone,
    },
    upload: {
      title: t.itemsImport.uploadTitle,
      help: t.itemsImport.uploadHelp,
      pickFile: t.itemsImport.uploadPickFile,
      dropHint: t.itemsImport.uploadDropHint,
      template: t.itemsImport.uploadTemplate,
      templateHint: t.itemsImport.uploadTemplateHint,
      parseError: t.itemsImport.parseError,
      fileTooLarge: t.itemsImport.fileTooLarge,
      noRowsFound: t.itemsImport.noRowsFound,
    },
    map: {
      title: t.itemsImport.mapTitle,
      help: t.itemsImport.mapHelp,
      sourceColumn: t.itemsImport.mapSourceColumn,
      targetField: t.itemsImport.mapTargetField,
      unmapped: t.itemsImport.mapUnmapped,
      requiredMissing: t.itemsImport.mapRequiredMissing,
      continue: t.itemsImport.mapContinue,
      back: t.itemsImport.mapBack,
      fields: {
        sku: t.itemsImport.fields.sku,
        name: t.itemsImport.fields.name,
        description: t.itemsImport.fields.description,
        barcode: t.itemsImport.fields.barcode,
        unit: t.itemsImport.fields.unit,
        costPrice: t.itemsImport.fields.costPrice,
        salePrice: t.itemsImport.fields.salePrice,
        currency: t.itemsImport.fields.currency,
        reorderPoint: t.itemsImport.fields.reorderPoint,
        reorderQty: t.itemsImport.fields.reorderQty,
        status: t.itemsImport.fields.status,
      },
    },
    preview: {
      title: t.itemsImport.previewTitle,
      help: t.itemsImport.previewHelp,
      readyTab: t.itemsImport.previewReadyTab,
      rejectedTab: t.itemsImport.previewRejectedTab,
      conflictsTab: t.itemsImport.previewConflictsTab,
      conflictsHelp: t.itemsImport.previewConflictsHelp,
      noConflicts: t.itemsImport.previewNoConflicts,
      commit: t.itemsImport.previewCommit,
      back: t.itemsImport.previewBack,
      empty: t.itemsImport.previewEmpty,
      rowNumber: t.itemsImport.previewRowNumber,
      sku: t.itemsImport.previewSku,
      name: t.itemsImport.previewName,
      unit: t.itemsImport.previewUnit,
      cost: t.itemsImport.previewCost,
      sale: t.itemsImport.previewSale,
      status: t.itemsImport.previewStatus,
      errors: t.itemsImport.previewErrors,
    },
    success: {
      title: t.itemsImport.successTitle,
      body: t.itemsImport.successBody,
      skipped: t.itemsImport.successSkipped,
      viewItems: t.itemsImport.successViewItems,
      importMore: t.itemsImport.successImportMore,
    },
    errors: {
      noRows: t.itemsImport.errors.noRows,
      tooManyRows: t.itemsImport.errors.tooManyRows,
      allRowsInvalid: t.itemsImport.errors.allRowsInvalid,
      allRowsConflict: t.itemsImport.errors.allRowsConflict,
      commitFailed: t.itemsImport.errors.commitFailed,
      genericError: t.itemsImport.errors.genericError,
    },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/items">
            <ArrowLeft className="h-4 w-4" />
            {t.itemsImport.backToItems}
          </Link>
        </Button>
      </div>

      <PageHeader title={t.itemsImport.heading} description={t.itemsImport.subtitle} />

      <ImportItemsForm labels={labels} />
    </div>
  );
}
