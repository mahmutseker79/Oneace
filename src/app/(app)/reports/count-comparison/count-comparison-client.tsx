"use client";

import { AlertCircle, Download } from "lucide-react";
import { useEffect, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { hasPlanCapability } from "@/lib/plans";
import { cn } from "@/lib/utils";
import type { Messages } from "@/lib/i18n";

interface CountData {
  id: string;
  name: string;
  state: string;
  createdAt: string;
  itemCount: number;
}

interface ComparisonItem {
  itemId: string;
  sku: string;
  name: string;
  count1Qty: number | null;
  count2Qty: number | null;
  variance: number;
  variancePercent: number;
}

interface CountComparisonClientProps {
  labels: Messages["reports"]["countComparison"];
}

export function CountComparisonClient({ labels }: CountComparisonClientProps) {
  const [counts, setCounts] = useState<CountData[]>([]);
  const [comparison, setComparison] = useState<ComparisonItem[]>([]);
  const [selectedCount1, setSelectedCount1] = useState<string>("");
  const [selectedCount2, setSelectedCount2] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<"FREE" | "PRO" | "BUSINESS">("FREE");

  useEffect(() => {
    async function init() {
      try {
        const sessionRes = await fetch("/api/session");
        const sessionData = await sessionRes.json();
        setPlan(sessionData.plan);

        const countsRes = await fetch("/api/reports/count-comparison/counts");
        const countsData = await countsRes.json();
        setCounts(countsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load counts");
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  const handleCompare = async () => {
    if (!selectedCount1 || !selectedCount2) {
      setError(labels.noCountsSelected);
      return;
    }

    setComparing(true);
    try {
      const res = await fetch("/api/reports/count-comparison/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count1Id: selectedCount1,
          count2Id: selectedCount2,
        }),
      });

      if (!res.ok) throw new Error("Comparison failed");

      const data = await res.json();
      setComparison(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.comparisonFailed);
    } finally {
      setComparing(false);
    }
  };

  const handleExport = async (format: "csv" | "xlsx") => {
    setExporting(true);
    try {
      const res = await fetch("/api/reports/count-comparison/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          comparison,
          count1Name: counts.find((c) => c.id === selectedCount1)?.name,
          count2Name: counts.find((c) => c.id === selectedCount2)?.name,
        }),
      });

      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
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

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const canViewReport = hasPlanCapability(plan, "reports");

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

  const varianceStats = {
    totalItems: comparison.length,
    withVariance: comparison.filter((c) => c.variance !== 0).length,
    avgVariance:
      comparison.length > 0
        ? Math.abs(comparison.reduce((sum, c) => sum + c.variance, 0) / comparison.length)
        : 0,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={labels.heading}
        description={labels.description}
        backHref="/reports"
        breadcrumb={[{ label: "Reports", href: "/reports" }, { label: labels.heading }]}
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{labels.errorTitle}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{labels.selectLabel}</CardTitle>
          <CardDescription>{labels.selectLabel}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium mb-2 block">{labels.selectLabel} 1</label>
              <Select value={selectedCount1} onValueChange={setSelectedCount1}>
                <SelectTrigger>
                  <SelectValue placeholder={labels.selectLabel} />
                </SelectTrigger>
                <SelectContent>
                  {counts.map((count) => (
                    <SelectItem key={count.id} value={count.id}>
                      {count.name} ({count.itemCount} items)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">{labels.selectLabel} 2</label>
              <Select value={selectedCount2} onValueChange={setSelectedCount2}>
                <SelectTrigger>
                  <SelectValue placeholder={labels.selectLabel} />
                </SelectTrigger>
                <SelectContent>
                  {counts.map((count) => (
                    <SelectItem key={count.id} value={count.id}>
                      {count.name} ({count.itemCount} items)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            onClick={handleCompare}
            disabled={comparing || !selectedCount1 || !selectedCount2}
          >
            {comparing ? labels.comparing : labels.compareButton}
          </Button>
        </CardContent>
      </Card>

      {comparison.length > 0 && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {labels.columnName}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{varianceStats.totalItems}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Items with Variance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{varianceStats.withVariance}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {((varianceStats.withVariance / varianceStats.totalItems) * 100).toFixed(1)}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Avg Variance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {varianceStats.avgVariance.toFixed(0)} units
                </div>
              </CardContent>
            </Card>
          </div>

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
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{labels.comparisonTitle}</CardTitle>
              <CardDescription>{labels.comparisonDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{labels.columnSku}</TableHead>
                      <TableHead>{labels.columnName}</TableHead>
                      <TableHead className="text-right">{labels.columnCount1}</TableHead>
                      <TableHead className="text-right">{labels.columnCount2}</TableHead>
                      <TableHead className="text-right">{labels.columnVariance}</TableHead>
                      <TableHead className="text-right">{labels.columnVariancePercent}</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparison.map((item) => (
                      <TableRow
                        key={item.itemId}
                        className={cn(item.variance !== 0 && "bg-destructive-light")}
                      >
                        <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                        <TableCell>{item.name}</TableCell>
                        <TableCell className="text-right font-mono">
                          {item.count1Qty ?? "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {item.count2Qty ?? "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold">
                          {item.variance > 0 ? "+" : ""}
                          {item.variance}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {item.variancePercent.toFixed(1)}%
                        </TableCell>
                        <TableCell>
                          {item.variance === 0 ? (
                            <Badge variant="outline" className="bg-success-light">
                              Match
                            </Badge>
                          ) : (
                            <Badge variant="destructive">Mismatch</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
