import {
  AlertTriangle,
  ArrowLeftRight,
  DollarSign,
  FileBarChart,
  Grid3X3,
  ScanLine,
  Truck,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [supplierCount, binCount, movementCount] = await Promise.all([
    db.supplier.count({ where: { organizationId: membership.organizationId } }),
    db.bin.count({
      where: {
        warehouse: { organizationId: membership.organizationId },
      },
    }),
    db.stockMovement.count({ where: { organizationId: membership.organizationId } }),
  ]);

  const hasSuppliers = supplierCount > 0;
  const hasBins = binCount > 0;
  const hasMovements = movementCount > 0;

  const reports = [
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

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <FileBarChart className="text-muted-foreground mt-1 h-5 w-5" />
        <div>
          <h1 className="text-2xl font-semibold">{t.reports.heading}</h1>
          <p className="text-muted-foreground">{t.reports.subtitle}</p>
        </div>
      </div>

      {/* Phase 15.2 — exports upgrade prompt for FREE users */}
      {!canExportByPlan ? (
        <UpgradePrompt
          reason="Exports are available on Pro and Business plans."
          requiredPlan="PRO"
          variant="banner"
          description="Upgrade to download CSV and Excel exports from any report."
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {reports.map((report) => {
          const Icon = report.icon;
          return (
            <Link key={report.href} href={report.href} className="group block">
              <Card className="h-full transition-colors group-hover:border-foreground/20">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Icon className="text-muted-foreground h-4 w-4" />
                    <CardTitle>{report.title}</CardTitle>
                  </div>
                  <CardDescription>{report.description}</CardDescription>
                </CardHeader>
                <CardContent />
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
