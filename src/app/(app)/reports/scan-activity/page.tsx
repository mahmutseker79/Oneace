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

import { Download, ScanLine } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getScanHistory, type ScanHistoryEntry } from "@/lib/scanner/scan-history";
import { format } from "@/lib/i18n";

export default function ScanActivityReportPage() {
  const [entries, setEntries] = useState<ScanHistoryEntry[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const history = getScanHistory();
    setEntries(history);
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

  if (!mounted) {
    return (
      <div className="space-y-6">
        <div className="flex items-start gap-3">
          <ScanLine className="text-muted-foreground mt-1 h-5 w-5" />
          <div>
            <h1 className="text-2xl font-semibold">Scan Activity</h1>
            <p className="text-muted-foreground">Loading scan history...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <ScanLine className="text-muted-foreground mt-1 h-5 w-5" />
        <div>
          <h1 className="text-2xl font-semibold">Scan Activity</h1>
          <p className="text-muted-foreground">
            Recent barcode scans and their results ({entries.length} total)
          </p>
        </div>
      </div>

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
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={handleExportCsv}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>

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
                        <TableCell>{entry.itemName || <span className="text-muted-foreground italic">(unknown)</span>}</TableCell>
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
