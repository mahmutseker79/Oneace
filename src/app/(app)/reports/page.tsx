import {
  AlertTriangle,
  ArrowLeftRight,
  Barcode,
  DollarSign,

  Grid3X3,
  MapPin,
  Package,
  ScanLine,
  Tag,
  Truck,
  Wrench,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { UpgradePrompt } from "@/components/ui/upgrade-prompt";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { hasPlanCapability } from "@/lib/plans";
import { requireActiveMembership } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.reports.metaTitle };
}

export default async function ReportsPage() {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  // Phase 15.2 — plan check for reports/exports
  const reportsPlan = membership.organization.plan as "FREE" | "PRO" | "BUSINESS";
  const canExportByPlan = hasPlanCapability(reportsPlan, "exports");

  // P3.7 — Only show the Supplier Performance card if the org has
  // suppliers or purchase orders. For a first-run user this keeps the
  // reports page focused on the two core reports.
  // Hardening Track: also conditionally show bin inventory (bins exist)
  // and movement history (any movements recorded).
  const [
    supplierCount,
    binCount,
    movementCount,
    adjustmentCount,
    stockCountCount,
    serialCount,
    transferCount,
    stockLevelCount,
  ] = await Promise.all([
    db.supplier.count({ where: { organizationId: membership.organizationId } }),
    db.bin.count({
      where: {
        warehouse: { organizationId: membership.organizationId },
      },
    }),
    db.stockMovement.count({ where: { organizationId: membership.organizationId } }),
    db.stockMovement.count({
      where: { organizationId: membership.organizationId, type: "ADJUSTMENT" },
    }),
    db.stockCount.count({ where: { organizationId: membership.organizationId } }),
    db.serialNumber.count({ where: { organizationId: membership.organizationId } }),
    db.stockTransfer.count({ where: { organizationId: membership.organizationId } }),
    db.stockLevel.count({ where: { organizationId: membership.organizationId } }),
  ]);

  const hasSuppliers = supplierCount > 0;
  const hasBins = binCount > 0;
  const hasMovements = movementCount > 0;
  const hasAdjustments = adjustmentCount > 0;
  const hasStockCounts = stockCountCount > 0;
  const hasSerials = serialCount > 0;
  const hasTransfers = transferCount > 0;
  const hasStock = stockLevelCount > 0;

  const coreReports = [
    {
      href: "/reports/low-stock",
      icon: AlertTriangle,
      title: t.reports.lowStock.heading,
      description: t.reports.lowStock.subtitle,
    },
    {
      href: "/reports/stock-value",
      icon: DollarSign,
      title: t.reports.stockValue.heading,
      description: t.reports.stockValue.subtitle,
    },
    {
      href: "/reports/scan-activity",
      icon: ScanLine,
      title: t.reports.scanActivity.heading,
      description: t.reports.scanActivity.subtitle,
    },
  ];

  const conditionalReports = [
    ...(hasMovements
      ? [
          {
            href: "/reports/movements",
            icon: ArrowLeftRight,
            title: t.reports.movementHistory.heading,
            description: t.reports.movementHistory.subtitle,
          },
        ]
      : []),
    ...(hasBins
      ? [
          {
            href: "/reports/bin-inventory",
            icon: Grid3X3,
            title: t.reports.binInventory.heading,
            description: t.reports.binInventory.subtitle,
          },
        ]
      : []),
    ...(hasSuppliers
      ? [
          {
            href: "/reports/suppliers",
            icon: Truck,
            title: t.reports.supplierPerformance.heading,
            description: t.reports.supplierPerformance.subtitle,
          },
        ]
      : []),
  ];

  const advancedReports = [
    ...(hasAdjustments
      ? [
          {
            href: "/reports/adjustments",
            icon: Wrench,
            title: "Adjustment Report",
            description: "Track inventory adjustments and reconciliation",
          },
        ]
      : []),
    ...(hasStockCounts
      ? [
          {
            href: "/reports/location-accuracy",
            icon: MapPin,
            title: "Location Accuracy Report",
            description: "Warehouse inventory accuracy metrics",
          },
        ]
      : []),
    {
      href: "/reports/reason-code-summary",
      icon: Tag,
      title: "Reason Code Summary",
      description: "Track inventory adjustments by reason code",
    },
    ...(hasStock
      ? [
          {
            href: "/reports/stock-exceptions",
            icon: AlertTriangle,
            title: "Stock Exceptions",
            description: "Negative and zero stock inventory issues",
          },
        ]
      : []),
    ...(hasSerials
      ? [
          {
            href: "/reports/serial-traceability",
            icon: Barcode,
            title: "Serial Traceability",
            description: "Track serial number lifecycle and movements",
          },
        ]
      : []),
    ...(hasStock
      ? [
          {
            href: "/reports/stock-by-status",
            icon: Package,
            title: "Stock by Status",
            description: "Inventory breakdown by stock status",
          },
        ]
      : []),
    ...(hasTransfers
      ? [
          {
            href: "/reports/transfer-history",
            icon: Truck,
            title: "Transfer History",
            description: "Track inter-warehouse transfers",
          },
        ]
      : []),
  ];


  // Helper for premium report card rendering
  function renderReportCard(report: {
    href: string;
    icon: typeof AlertTriangle;
    title: string;
    description: string;
  }) {
    const Icon = report.icon;
    return (
      <Link key={report.href} href={report.href} className="group block">
        <Card className="h-full card-interactive overflow-hidden border-transparent hover:border-border/60">
          <CardHeader className="pb-3">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary group-hover:bg-primary/12 transition-colors">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-sm font-semibold leading-tight">
                  {report.title}
                </CardTitle>
                <CardDescription className="text-xs mt-1 line-clamp-2">
                  {report.description}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      </Link>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <PageHeader
        title={t.reports.heading}
        description={t.reports.subtitle}
      />

      {/* Phase 15.2 — exports upgrade prompt for FREE users */}
      {!canExportByPlan ? (
        <UpgradePrompt
          reason="Exports are available on Pro and Business plans."
          requiredPlan="PRO"
          variant="banner"
          description="Upgrade to download CSV and Excel exports from any report."
        />
      ) : null}

      {/* Core Reports */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-foreground">Core Reports</h2>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full tabular-nums">
            {coreReports.length}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {coreReports.map(renderReportCard)}
        </div>
      </section>

      {/* Conditional Reports */}
      {conditionalReports.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-foreground">Movement & Warehouse</h2>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full tabular-nums">
              {conditionalReports.length}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {conditionalReports.map(renderReportCard)}
          </div>
        </section>
      )}

      {/* Advanced Reports */}
      {advancedReports.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-foreground">Advanced Reports</h2>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full tabular-nums">
              {advancedReports.length}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {advancedReports.map(renderReportCard)}
          </div>
        </section>
      )}
    </div>
  );
}
