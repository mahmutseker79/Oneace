import { ChevronLeft, Barcode } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ExportButton } from "@/components/ui/export-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/db";
import { getMessages, getRegion } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return {
    title: `Serial Traceability Report — ${t.reports.metaTitle}`,
  };
}

type SerialHistoryRow = {
  date: Date;
  action: string;
  fromLocation: string;
  toLocation: string;
  user: string;
  reference: string;
  note: string;
};

type SerialRow = {
  serialNumber: string;
  itemName: string;
  itemSku: string;
  currentStatus: string;
  currentLocation: string;
  history: SerialHistoryRow[];
};

interface SearchParams {
  serial?: string;
}

export default async function SerialTraceabilityReportPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();
  const region = await getRegion();

  const params = await searchParams;
  const searchSerial = params?.serial?.trim() ?? "";

  let serialData: SerialRow | null = null;

  if (searchSerial) {
    const serial = await db.serialNumber.findFirst({
      where: {
        organizationId: membership.organizationId,
        serialNumber: {
          contains: searchSerial,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        serialNumber: true,
        item: { select: { name: true, sku: true } },
      },
    });

    if (serial) {
      const history = await db.serialHistory.findMany({
        where: { serialNumberId: serial.id },
        select: {
          id: true,
          action: true,
          fromLocation: true,
          toLocation: true,
          performedAt: true,
          performedBy: { select: { name: true } },
          reference: true,
          note: true,
        },
        orderBy: { performedAt: "asc" },
      });

      const currentHistory = history.length > 0 ? history[history.length - 1] : null;

      serialData = {
        serialNumber: serial.serialNumber,
        itemName: serial.item.name,
        itemSku: serial.item.sku,
        currentStatus: currentHistory?.action ?? "UNKNOWN",
        currentLocation: currentHistory?.toLocation ?? currentHistory?.fromLocation ?? "Unknown",
        history: history.map((h) => ({
          date: h.performedAt,
          action: h.action,
          fromLocation: h.fromLocation ?? "",
          toLocation: h.toLocation ?? "",
          user: h.performedBy?.name ?? "",
          reference: h.reference ?? "",
          note: h.note ?? "",
        })),
      };
    }
  }

  const dateFmt = new Intl.DateTimeFormat(region.numberLocale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/reports">
            <ChevronLeft className="h-4 w-4" />
            Back to Reports
          </Link>
        </Button>
        <div className="flex items-start gap-3">
          <Barcode className="text-muted-foreground mt-1 h-5 w-5" />
          <div>
            <h1 className="text-2xl font-semibold">Serial Traceability</h1>
            <p className="text-muted-foreground">Track serial number lifecycle and movements</p>
          </div>
        </div>
      </div>

      <form method="get" className="flex gap-2">
        <Input
          name="serial"
          placeholder="Search by serial number..."
          defaultValue={searchSerial}
          className="flex-1"
        />
        <Button type="submit">Search</Button>
        {searchSerial && (
          <Button asChild variant="outline">
            <Link href="/reports/serial-traceability">Clear</Link>
          </Button>
        )}
      </form>

      {searchSerial && !serialData && (
        <EmptyState
          icon={Barcode}
          title="Serial not found"
          description={`No serial number matching "${searchSerial}" found.`}
        />
      )}

      {!searchSerial && (
        <EmptyState
          icon={Barcode}
          title="Enter a serial number"
          description="Search for a serial number to view its complete traceability history."
        />
      )}

      {serialData && (
        <>
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <CardDescription>Serial Number</CardDescription>
                  <p className="text-lg font-mono font-bold">{serialData.serialNumber}</p>
                </div>
                <div>
                  <CardDescription>Item</CardDescription>
                  <div>
                    <p className="font-medium">{serialData.itemName}</p>
                    <p className="text-sm text-muted-foreground font-mono">{serialData.itemSku}</p>
                  </div>
                </div>
                <div>
                  <CardDescription>Current Status</CardDescription>
                  <p className="font-medium">{serialData.currentStatus}</p>
                </div>
                <div>
                  <CardDescription>Current Location</CardDescription>
                  <p className="font-medium">{serialData.currentLocation}</p>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Movement Timeline</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>From Location</TableHead>
                    <TableHead>To Location</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {serialData.history.map((entry, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {dateFmt.format(entry.date)}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{entry.action}</TableCell>
                      <TableCell className="text-sm">{entry.fromLocation || "—"}</TableCell>
                      <TableCell className="text-sm">{entry.toLocation || "—"}</TableCell>
                      <TableCell className="text-sm">{entry.user || "—"}</TableCell>
                      <TableCell className="text-sm font-mono">{entry.reference || "—"}</TableCell>
                      <TableCell className="text-sm max-w-xs truncate">{entry.note || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {serialData.history.length > 0 && (
            <div className="flex items-center gap-2">
              <ExportButton href={`/reports/serial-traceability/export?serial=${encodeURIComponent(serialData.serialNumber)}`}>
                Export Timeline
              </ExportButton>
            </div>
          )}
        </>
      )}
    </div>
  );
}
