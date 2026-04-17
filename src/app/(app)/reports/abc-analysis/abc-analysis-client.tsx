"use client";

import { AlertCircle, DollarSign, Download, Package, TrendingUp, Zap } from "lucide-react";
import { useEffect, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ReportSummaryCard } from "@/components/ui/report-summary-card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UpgradePrompt } from "@/components/ui/upgrade-prompt";
import type { Messages } from "@/lib/i18n";
import { hasPlanCapability } from "@/lib/plans";
import { cn, formatCurrency } from "@/lib/utils";
import { DistributionChart } from "./lazy-distribution-chart";
import { ParetoChart } from "./lazy-pareto-chart";

interface ABCData {
  itemId: string;
  sku: string;
  name: string;
  quantity: number;
  costPrice: number;
  totalValue: number;
  classification: "A" | "B" | "C";
  percentageOfTotalValue: number;
  cumulativePercentage: number;
}

interface ABCAnalysisClientProps {
  labels: Messages["reports"]["abcAnalysis"];
}

async function fetchABCData(orgId: string): Promise<ABCData[]> {
  const res = await fetch("/api/reports/abc-analysis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orgId }),
  });

  if (!res.ok) throw new Error("Failed to fetch ABC data");
  return res.json();
}

async function autoClassifyItems(orgId: string): Promise<{ success: boolean; updated: number }> {
  const res = await fetch("/api/reports/abc-analysis/classify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orgId }),
  });

  if (!res.ok) throw new Error("Failed to classify items");
  return res.json();
}

export function ABCAnalysisClient({ labels }: ABCAnalysisClientProps) {
  const [data, setData] = useState<ABCData[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [region, setRegion] = useState<{ numberLocale: string; currency: string } | null>(null);
  const [plan, setPlan] = useState<"FREE" | "PRO" | "BUSINESS">("FREE");
  const [orgId, setOrgId] = useState<string>("");

  useEffect(() => {
    async function init() {
      try {
        setRegion({ numberLocale: "en-US", currency: "USD" });

        const sessionRes = await fetch("/api/session");
        const sessionData = await sessionRes.json();
        setOrgId(sessionData.organizationId);
        setPlan(sessionData.plan);

        const abcData = await fetchABCData(sessionData.organizationId);
        setData(abcData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  const handleExport = async (format: "csv" | "xlsx" | "pdf") => {
    setExporting(true);
    try {
      const response = await fetch("/api/reports/abc-analysis/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, data }),
      });

      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${labels.exportedFilename}-${new Date().toISOString().split("T")[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.exportFailed);
    } finally {
      setExporting(false);
    }
  };

  const handleAutoClassify = async () => {
    setClassifying(true);
    try {
      const result = await autoClassifyItems(orgId);
      if (result.success) {
        const abcData = await fetchABCData(orgId);
        setData(abcData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.classificationFailed);
    } finally {
      setClassifying(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const canViewReport = hasPlanCapability(plan, "abcAnalysis");

  if (!canViewReport) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={labels.heading}
          description={labels.description}
          backHref="/reports"
          breadcrumb={[{ label: "Reports", href: "/reports" }, { label: labels.heading }]}
        />
        <UpgradePrompt
          reason={labels.upgradeReason}
          requiredPlan="PRO"
          variant="banner"
          description={labels.upgradeDescription}
        />
      </div>
    );
  }

  const classA = data.filter((d) => d.classification === "A");
  const classB = data.filter((d) => d.classification === "B");
  const classC = data.filter((d) => d.classification === "C");

  const totalValue = data.reduce((sum, d) => sum + d.totalValue, 0);

  const paretoData = data.map((item) => ({
    name: item.sku,
    value: item.totalValue,
    cumulativePercent: item.cumulativePercentage,
  }));

  const distributionData = [
    { name: "A", count: classA.length, value: classA.reduce((s, d) => s + d.totalValue, 0) },
    { name: "B", count: classB.length, value: classB.reduce((s, d) => s + d.totalValue, 0) },
    { name: "C", count: classC.length, value: classC.reduce((s, d) => s + d.totalValue, 0) },
  ];

  const getClassColor = (cls: string) => {
    switch (cls) {
      case "A":
        return "bg-destructive-light text-destructive";
      case "B":
        return "bg-warning-light text-warning";
      case "C":
        return "bg-success-light text-success";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={labels.heading}
        description={labels.description}
        backHref="/reports"
        breadcrumb={[{ label: "Reports", href: "/reports" }, { label: labels.heading }]}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("csv")}
              disabled={exporting}
            >
              <Download className="h-4 w-4 mr-1" />
              {labels.exportCsv}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("xlsx")}
              disabled={exporting}
            >
              <Download className="h-4 w-4 mr-1" />
              {labels.exportXlsx}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("pdf")}
              disabled={exporting}
            >
              <Download className="h-4 w-4 mr-1" />
              {labels.exportPdf}
            </Button>
          </div>
        }
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{labels.errorTitle}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <ReportSummaryCard
        metrics={[
          {
            label: labels.kpiTotalItems,
            value: data.length,
            icon: Package,
          },
          {
            label: labels.kpiTotalValue,
            value: region ? formatCurrency(totalValue, { currency: region.currency }) : "—",
            icon: DollarSign,
          },
          {
            label: labels.kpiClassAItems,
            value: classA.length,
            trend: `${((classA.reduce((s, d) => s + d.totalValue, 0) / totalValue) * 100).toFixed(1)}% value`,
            trendDirection: "positive",
          },
          {
            label: labels.kpiClassBItems,
            value: classB.length,
            trend: `${((classB.reduce((s, d) => s + d.totalValue, 0) / totalValue) * 100).toFixed(1)}% value`,
            trendDirection: "neutral",
          },
        ]}
      />

      <div>
        <Button onClick={handleAutoClassify} disabled={classifying} className="gap-2">
          <Zap className="h-4 w-4" />
          {classifying ? labels.autoClassifyLoading : labels.autoClassifyButton}
        </Button>
        <p className="text-xs text-muted-foreground mt-2">{labels.autoClassifyHelp}</p>
      </div>

      {data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              {labels.paretoTitle}
            </CardTitle>
            <CardDescription>{labels.paretoDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <ParetoChart data={paretoData} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{labels.distributionTitle}</CardTitle>
          <CardDescription>{labels.distributionDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <DistributionChart data={distributionData} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{labels.tableTitle}</CardTitle>
          <CardDescription>{labels.tableDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{labels.columnSku}</TableHead>
                  <TableHead>{labels.columnName}</TableHead>
                  <TableHead className="text-right">{labels.columnQty}</TableHead>
                  <TableHead className="text-right">{labels.columnCost}</TableHead>
                  <TableHead className="text-right">{labels.columnValue}</TableHead>
                  <TableHead className="text-right">{labels.columnPercent}</TableHead>
                  <TableHead className="text-right">{labels.columnCumulative}</TableHead>
                  <TableHead className="text-center">{labels.columnClass}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item) => (
                  <TableRow key={item.itemId}>
                    <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{item.quantity}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {region && formatCurrency(item.costPrice, { currency: region.currency })}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {region && formatCurrency(item.totalValue, { currency: region.currency })}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {item.percentageOfTotalValue.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {item.cumulativePercentage.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={cn("font-bold", getClassColor(item.classification))}>
                        {item.classification}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{labels.recommendationsTitle}</CardTitle>
          <CardDescription>{labels.recommendationsDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-destructive-light text-destructive">A</Badge>
                <span className="font-medium">{labels.classALabel}</span>
              </div>
              <p className="text-sm text-muted-foreground ml-6">{labels.classARecommendation}</p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-warning-light text-warning">B</Badge>
                <span className="font-medium">{labels.classBLabel}</span>
              </div>
              <p className="text-sm text-muted-foreground ml-6">{labels.classBRecommendation}</p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-success-light text-success">C</Badge>
                <span className="font-medium">{labels.classCLabel}</span>
              </div>
              <p className="text-sm text-muted-foreground ml-6">{labels.classCRecommendation}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
