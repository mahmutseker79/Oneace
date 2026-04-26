"use client";

import { AlertCircle, Download, TrendingDown } from "lucide-react";
import { useEffect, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
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
import { cn } from "@/lib/utils";
import { VarianceChart } from "./lazy-variance-chart";

interface DepartmentVariance {
  departmentId: string;
  departmentName: string;
  itemCount: number;
  variance: number;
  variancePercent: number;
  status: "good" | "warning" | "critical";
}

interface DepartmentVarianceClientProps {
  labels: Messages["reports"]["departmentVariance"];
}

export function DepartmentVarianceClient({ labels }: DepartmentVarianceClientProps) {
  const [data, setData] = useState<DepartmentVariance[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<"FREE" | "PRO" | "BUSINESS">("FREE");

  useEffect(() => {
    async function init() {
      try {
        const sessionRes = await fetch("/api/session");
        const sessionData = await sessionRes.json();
        setPlan(sessionData.plan);

        const res = await fetch("/api/reports/department-variance");
        if (!res.ok) throw new Error("Failed to fetch data");
        const varianceData = await res.json();
        setData(varianceData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  const handleExport = async (format: "csv" | "xlsx") => {
    setExporting(true);
    try {
      const res = await fetch("/api/reports/department-variance/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, data }),
      });

      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `department-variance-${new Date().toISOString().split("T")[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.errorTitle);
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
          reason="Reports are available on Pro and Business plans."
          requiredPlan="PRO"
          variant="banner"
          description="Upgrade to access advanced reports."
        />
      </div>
    );
  }

  const avgVariance =
    data.length > 0 ? data.reduce((sum, d) => sum + d.variancePercent, 0) / data.length : 0;
  const highestVariance = data.length > 0 ? Math.max(...data.map((d) => d.variancePercent)) : 0;
  const lowestVariance = data.length > 0 ? Math.min(...data.map((d) => d.variancePercent)) : 0;
  const criticalDepts = data.filter((d) => d.status === "critical").length;

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

      {criticalDepts > 0 && (
        <Alert variant="destructive">
          <TrendingDown className="h-4 w-4" />
          <AlertTitle>High Variance Departments</AlertTitle>
          <AlertDescription>{criticalDepts} department(s) with variance above 10%</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {labels.kpiHighestVariance}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{highestVariance.toFixed(2)}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {labels.kpiLowestVariance}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lowestVariance.toFixed(2)}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {labels.kpiAverageVariance}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgVariance.toFixed(1)}%</div>
          </CardContent>
        </Card>
      </div>

      {data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{labels.chartTitle}</CardTitle>
            <CardDescription>{labels.chartDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <VarianceChart data={data} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{labels.columnDepartment}</CardTitle>
          <CardDescription>Detailed variance metrics per department</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{labels.columnDepartment}</TableHead>
                  <TableHead className="text-right">{labels.columnCount}</TableHead>
                  <TableHead className="text-right">{labels.columnVariance}</TableHead>
                  <TableHead className="text-right">Variance %</TableHead>
                  <TableHead className="text-center">{labels.columnTrend}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((dept) => (
                  <TableRow
                    key={dept.departmentId}
                    className={cn(
                      dept.status === "critical" && "bg-destructive-light",
                      dept.status === "warning" && "bg-warning-light",
                    )}
                  >
                    <TableCell className="font-medium">{dept.departmentName}</TableCell>
                    <TableCell className="text-right">{dept.itemCount}</TableCell>
                    <TableCell className="text-right font-mono">
                      {dept.variance > 0 ? "+" : ""}
                      {dept.variance}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {dept.variancePercent.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-center">
                      {dept.status === "good" && (
                        <Badge variant="success">
                          Good
                        </Badge>
                      )}
                      {dept.status === "warning" && (
                        <Badge variant="warning">
                          Warning
                        </Badge>
                      )}
                      {dept.status === "critical" && <Badge variant="destructive">Critical</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
