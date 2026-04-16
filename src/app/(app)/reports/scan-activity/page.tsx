"use client";

/**
 * Scan Activity Report (P9.3e)
 *
 * A client-side report that reads from the Dexie scan history (localStorage-backed)
 * and displays a table with: barcode, item name, found/not-found, timestamp.
 *
 * Features:
 * - Table of scan entries (newest first)
 * - CSV export
 * - Optional filters
 */

import { CheckCircle2, Download, ScanLine, XCircle } from "lucide-react";
import React, { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ReportSummaryCard } from "@/components/ui/report-summary-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type ScanHistoryEntry, getScanHistory } from "@/lib/scanner/scan-history";
// i18n format is server-only; inline helper for client component
function _format(tpl: string, vars: Record<string, string>) {
  return Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, v), tpl);
}

export default function ScanActivityReportPage() {
  const [entries, _setEntries] = useState<ScanHistoryEntry[]>(() => getScanHistory());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    React.startTransition(() => {
      setMounted(true);
    });
  }, []);

  const handleExportCsv = () => {
    if (entries.length === 0) return;

    const headers = ["Barcode", "Item Name", "Status", "Quantity", "Timestamp"];
    const rows = entries.map((entry) => [
      entry.barcode,
      entry.itemName || "(unknown)",
      entry.found ? "Found" : "Not Found",
      entry.quantity.toString(),
      new Date(entry.timestamp).toLocaleString(),
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scan-activity-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Calculate metrics
  const foundCount = entries.filter((e) => e.found).length;
  const notFoundCount = entries.filter((e) => !e.found).length;
  const successRate = entries.length > 0 ? Math.round((foundCount / entries.length) * 100) : 0;

  if (!mounted) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Scan Activity"
          description="Loading scan history..."
          backHref="/reports"
          breadcrumb={[{ label: "Reports", href: "/reports" }, { label: "Scan Activity" }]}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scan Activity"
        description={`Recent barcode scans and their results (${entries.length} total)`}
        backHref="/reports"
        breadcrumb={[{ label: "Reports", href: "/reports" }, { label: "Scan Activity" }]}
        actions={
          entries.length > 0 ? (
            <Button variant="outline" size="sm" onClick={handleExportCsv}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          ) : undefined
        }
      />

      {entries.length > 0 && (
        <ReportSummaryCard
          metrics={[
            {
              label: "Total Scans",
              value: entries.length,
              icon: ScanLine,
            },
            {
              label: "Found",
              value: foundCount,
              icon: CheckCircle2,
              trendDirection: "positive",
            },
            {
              label: "Not Found",
              value: notFoundCount,
              icon: XCircle,
              trendDirection: notFoundCount > 0 ? "negative" : "neutral",
            },
            {
              label: "Success Rate",
              value: `${successRate}%`,
            },
          ]}
        />
      )}

      {entries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No scans recorded yet.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Start scanning items in the Scan section to see activity here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Scan History</CardTitle>
              <CardDescription>
                Newest scans first. Click timestamps to see details.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Barcode</TableHead>
                      <TableHead>Item Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead>Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-mono text-sm">{entry.barcode}</TableCell>
                        <TableCell>
                          {entry.itemName || (
                            <span className="text-muted-foreground italic">(unknown)</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                              entry.found
                                ? "bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400"
                                : "bg-orange-100 text-orange-800 dark:bg-orange-950/30 dark:text-orange-400"
                            }`}
                          >
                            {entry.found ? "Found" : "Not Found"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{entry.quantity}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(entry.timestamp).toLocaleString()}
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
