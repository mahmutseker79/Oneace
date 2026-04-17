"use client";

import { AlertCircle, Download } from "lucide-react";
import { useEffect, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { UpgradePrompt } from "@/components/ui/upgrade-prompt";
// Note: getMessages is server-only. This client component uses hardcoded strings.
import { hasPlanCapability } from "@/lib/plans";
import { VarianceTrendChart } from "./lazy-trend-chart";

interface TrendPoint {
  date: string;
  variance: number;
}

export default function VarianceTrendPage() {
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [t, setT] = useState<{ reports?: { heading?: string } } | null>(null);
  const [plan, setPlan] = useState<"FREE" | "PRO" | "BUSINESS">("FREE");

  useEffect(() => {
    async function init() {
      try {
        // server-only: use defaults instead
        const messages = { reports: { heading: "Reports" } };
        setT(messages);

        const sessionRes = await fetch("/api/session");
        const sessionData = await sessionRes.json();
        setPlan(sessionData.plan);

        // Fetch trend data
        const res = await fetch("/api/reports/variance-trend");
        if (!res.ok) throw new Error("Failed to fetch data");
        const data = await res.json();
        setTrendData(data);
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
      const res = await fetch("/api/reports/variance-trend/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, data: trendData }),
      });

      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `variance-trend-${new Date().toISOString().split("T")[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
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

  if (!t) return <div>Loading...</div>;

  const canViewReport = hasPlanCapability(plan, "reports");

  if (!canViewReport) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Variance Trend"
          description="Variance over time"
          backHref="/reports"
          breadcrumb={[{ label: "Reports", href: "/reports" }, { label: "Variance Trend" }]}
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
    trendData.length > 0 ? trendData.reduce((sum, d) => sum + d.variance, 0) / trendData.length : 0;

  const latestVariance =
    trendData.length > 0 ? (trendData[trendData.length - 1]?.variance ?? 0) : 0;
  const trend = latestVariance < avgVariance ? "improving" : "worsening";

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Variance Trend"
        description="Inventory variance over time"
        backHref="/reports"
        breadcrumb={[{ label: "Reports", href: "/reports" }, { label: "Variance Trend" }]}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("csv")}
              disabled={exporting}
            >
              <Download className="h-4 w-4 mr-1" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("xlsx")}
              disabled={exporting}
            >
              <Download className="h-4 w-4 mr-1" />
              XLSX
            </Button>
          </div>
        }
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Average Variance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgVariance.toFixed(2)}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Latest Variance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{latestVariance.toFixed(2)}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {trend === "improving" ? "🟢" : "🔴"} {trend}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trend Chart */}
      {trendData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Variance Over Time</CardTitle>
            <CardDescription>
              Percentage variance tracked daily over the last 30 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VarianceTrendChart data={trendData} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
