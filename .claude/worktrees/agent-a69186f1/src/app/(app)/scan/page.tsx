import type { Metadata } from "next";

import { AdvancedFeatureBanner } from "@/components/shell/advanced-feature-banner";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";

import { Scanner } from "./scanner";

type SearchParams = Promise<{ barcode?: string; sku?: string }>;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.scan.metaTitle };
}

export default async function ScanPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  // Gate on an active membership — the lookup action also re-checks, but
  // refusing to render the camera for signed-out users is cheaper.
  await requireActiveMembership();
  const t = await getMessages();

  const params = (await searchParams) ?? {};
  const initialQuery = params.barcode ?? params.sku ?? "";

  return (
    <div className="space-y-6">
      <AdvancedFeatureBanner labels={t.advancedFeature} />

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t.scan.heading}</h1>
        <p className="text-muted-foreground">{t.scan.subtitle}</p>
      </div>

      <Scanner
        initialQuery={initialQuery}
        labels={{
          cameraHeading: t.scan.camera.heading,
          cameraSubtitle: t.scan.camera.subtitle,
          startCamera: t.scan.camera.start,
          stopCamera: t.scan.camera.stop,
          cameraUnsupported: t.scan.camera.unsupported,
          cameraUnsupportedBody: t.scan.camera.unsupportedBody,
          cameraDenied: t.scan.camera.denied,
          cameraDeniedBody: t.scan.camera.deniedBody,
          cameraError: t.scan.camera.error,
          scanningStatus: t.scan.camera.scanningStatus,
          engineNative: t.scan.camera.engineNative,
          engineZxing: t.scan.camera.engineZxing,
          engineLoading: t.scan.camera.engineLoading,
          manualHeading: t.scan.manual.heading,
          manualSubtitle: t.scan.manual.subtitle,
          manualLabel: t.scan.manual.label,
          manualPlaceholder: t.scan.manual.placeholder,
          manualSubmit: t.scan.manual.submit,
          resultHeadingFound: t.scan.result.foundHeading,
          resultHeadingNotFound: t.scan.result.notFoundHeading,
          resultNotFoundBody: t.scan.result.notFoundBody,
          resultClear: t.scan.result.clear,
          resultViewItem: t.scan.result.viewItem,
          resultNewItem: t.scan.result.newItem,
          resultRecordMovement: t.scan.result.recordMovement,
          resultSku: t.scan.result.sku,
          resultBarcode: t.scan.result.barcode,
          resultOnHand: t.scan.result.onHand,
          resultReserved: t.scan.result.reserved,
          resultReorderPoint: t.scan.result.reorderPoint,
          resultStatus: t.scan.result.status,
          resultLevelsHeading: t.scan.result.levelsHeading,
          resultNoLevels: t.scan.result.noLevels,
          columnWarehouse: t.scan.result.columnWarehouse,
          columnQuantity: t.scan.result.columnQuantity,
          columnReserved: t.scan.result.columnReserved,
          status: {
            ACTIVE: t.common.active,
            ARCHIVED: t.common.archived,
            DRAFT: t.common.draft,
          },
          lookingUp: t.scan.result.lookingUp,
          lookupError: t.scan.result.lookupError,
        }}
      />
    </div>
  );
}
