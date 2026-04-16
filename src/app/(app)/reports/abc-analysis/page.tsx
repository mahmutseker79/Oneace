"use client";

import {
  AlertCircle,

  DollarSign,
  Download,
  Package,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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
// Note: getMessages/getRegion are server-only (use next/headers).
// This client component uses hardcoded strings instead.
import { hasPlanCapability } from "@/lib/plans";
import { cn, formatCurrency } from "@/lib/utils";

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

interface _ParetoPoint {
  percentage: number;
  cumulativeValue: number;
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

export default function ABCAnalysisPage() {
  const [data, setData] = useState<ABCData[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [t, setT] = useState<any>(null);
  const [region, setRegion] = useState<any>(null);
  const [plan, setPlan] = useState<"FREE" | "PRO" | "BUSINESS">("FREE");
  const [orgId, setOrgId] = useState<string>("");

  useEffect(() => {
    async function init() {
      try {
        // Use defaults since we're a client component (can't call server-only getMessages/getRegion)
        setT({ reports: { heading: "Reports" } });
        setRegion({ numberLocale: "en-US", currency: "USD" });

        // Get org ID from session (this would normally come from requireActiveMembership)
        const sessionRes = await fetch("/api/session");
        const sessionData = await sessionRes.json();
        setOrgId(sessionData.organizationId);
        setPlan(sessionData.plan);

        // Fetch ABC data
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
      a.download = `abc-analysis-${new Date().toISOString().split("T")[0]}.${format}`;
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

  const handleAutoClassify = async () => {
    setClassifying(true);
    try {
      const result = await autoClassifyItems(orgId);
      if (result.success) {
        // Refresh data
        const abcData = await fetchABCData(orgId);
        setData(abcData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Classification failed");
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

  if (!t) {
    return <div>Loading...</div>;
  }

  const canViewReport = hasPlanCapability(plan, "abcAnalysis");

  if (!canViewReport) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="ABC Analysis"
          description="Pareto analysis of your inventory"
          backHref="/reports"
          breadcrumb={[{ label: "Reports", href: "/reports" }, { label: "ABC Analysis" }]}
        />
        <UpgradePrompt
          reason="ABC analysis is available on Pro and Business plans."
          requiredPlan="PRO"
          variant="banner"
          description="Upgrade to access ABC classification and Pareto analysis."
        />
      </div>
    );
  }

  // Calculate summary statistics
  const classA = data.filter((d) => d.classification === "A");
  const classB = data.filter((d) => d.classification === "B");
  const classC = data.filter((d) => d.classification === "C");

  const totalValue = data.reduce((sum, d) => sum + d.totalValue, 0);

  // Pareto chart data
  const paretoData = data.map((item, _idx) => ({
    name: item.sku,
    value: item.totalValue,
    cumulativePercent: item.cumulativePercentage,
  }));

  // Classification distribution
  const distributionData = [
    { name: "A", count: classA.length, value: classA.reduce((s, d) => s + d.totalValue, 0) },
    { name: "B", count: classB.length, value: classB.reduce((s, d) => s + d.totalValue, 0) },
    { name: "C", count: classC.length, value: classC.reduce((s, d) => s + d.totalValue, 0) },
  ];

  const getClassColor = (cls: string) => {
    switch (cls) {
      case "A":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
      case "B":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
      case "C":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="ABC Analysis"
        description="Pareto analysis of your inventory value distribution"
        backHref="/reports"
        breadcrumb={[{ label: "Reports", href: "/reports" }, { label: "ABC Analysis" }]}
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("pdf")}
              disabled={exporting}
            >
              <Download className="h-4 w-4 mr-1" />
              PDF
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

      {/* Summary KPIs */}
      <ReportSummaryCard
        metrics={[
          {
            label: "Total Items",
            value: data.length,
            icon: Package,
          },
          {
            label: "Total Value",
            value: region ? formatCurrency(totalValue, { currency: region.currency }) : "—",
            icon: DollarSign,
          },
          {
            label: "Class A Items",
            value: classA.length,
            trend: `${((classA.reduce((s, d) => s + d.totalValue, 0) / totalValue) * 100).toFixed(1)}% value`,
            trendDirection: "positive",
          },
          {
            label: "Class B Items",
            value: classB.length,
            trend: `${((classB.reduce((s, d) => s + d.totalValue, 0) / totalValue) * 100).toFixed(1)}% value`,
            trendDirection: "neutral",
          },
        ]}
      />

      {/* Auto-Classify Button */}
      <div>
        <Button onClick={handleAutoClassify} disabled={classifying} className="gap-2">
          <Zap className="h-4 w-4" />
          {classifying ? "Classifying..." : "Auto-Classify Items"}
        </Button>
        <p className="text-xs text-muted-foreground mt-2">
          Updates the ABC classification for all items based on current inventory value
        </p>
      </div>

      {/* Pareto Chart */}
      {data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Pareto Curve
            </CardTitle>
            <CardDescription>Cumulative percentage of inventory value</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={paretoData.slice(0, 50)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="sku" />
                <YAxis />
                <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="cumulativePercent"
                  stroke="hsl(221, 83%, 53%)"
                  dot={false}
                  name="Cumulative %"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Classification Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Classification Distribution</CardTitle>
          <CardDescription>Items and value by ABC class</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={distributionData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis
                yAxisId="left"
                label={{ value: "Count", angle: -90, position: "insideLeft" }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                label={{ value: "Value", angle: 90, position: "insideRight" }}
              />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="count" fill="hsl(221, 83%, 53%)" name="Item Count" />
              <Bar yAxisId="right" dataKey="value" fill="hsl(142, 71%, 45%)" name="Total Value" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Classification Matrix Table */}
      <Card>
        <CardHeader>
          <CardTitle>ABC Items</CardTitle>
          <CardDescription>All items with classifications</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">% of Total</TableHead>
                  <TableHead className="text-right">Cumulative %</TableHead>
                  <TableHead className="text-center">Class</TableHead>
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

      {/* Count Frequency Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>Count Frequency Recommendations</CardTitle>
          <CardDescription>Recommended count schedules based on ABC classification</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-red-100 text-red-800">A</Badge>
                <span className="font-medium">High-Value Items</span>
              </div>
              <p className="text-sm text-muted-foreground ml-6">
                Count monthly (every 30 days) to ensure accuracy on your most valuable SKUs
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-yellow-100 text-yellow-800">B</Badge>
                <span className="font-medium">Medium-Value Items</span>
              </div>
              <p className="text-sm text-muted-foreground ml-6">
                Count quarterly (every 90 days) to maintain reasonable accuracy
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-green-100 text-green-800">C</Badge>
                <span className="font-medium">Low-Value Items</span>
              </div>
              <p className="text-sm text-muted-foreground ml-6">
                Count annually or as-needed; lower priority for accuracy
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
