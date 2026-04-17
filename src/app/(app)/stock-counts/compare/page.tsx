import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireActiveMembership } from "@/lib/session";
import { compareStockCounts } from "@/lib/stockcount/compare";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Compare Stock Counts",
};
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * Compare two stock counts side-by-side.
 */
export default async function ComparePage({
  searchParams,
}: {
  searchParams: { count1?: string; count2?: string };
}) {
  const { membership } = await requireActiveMembership();
  const orgId = membership.organizationId;

  // Fetch all counts for dropdown
  const counts = await db.stockCount.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true, state: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const count1Id = searchParams.count1;
  const count2Id = searchParams.count2;

  let comparisonRows = null;
  let count1Data = null;
  let count2Data = null;

  if (count1Id && count2Id && count1Id !== count2Id) {
    // Verify both counts exist and belong to org
    const [c1, c2] = await Promise.all([
      db.stockCount.findFirst({
        where: { id: count1Id, organizationId: orgId },
        select: { id: true, name: true, state: true },
      }),
      db.stockCount.findFirst({
        where: { id: count2Id, organizationId: orgId },
        select: { id: true, name: true, state: true },
      }),
    ]);

    if (c1 && c2) {
      count1Data = c1;
      count2Data = c2;
      comparisonRows = await compareStockCounts(count1Id, count2Id, orgId);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Compare Counts</h1>
        <p className="text-muted-foreground">Side-by-side analysis of two counts</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Counts</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Count 1</label>
              <Select defaultValue={count1Id ?? ""}>
                <SelectTrigger>
                  <SelectValue placeholder="Select first count" />
                </SelectTrigger>
                <SelectContent>
                  {counts.map((count) => (
                    <SelectItem key={count.id} value={count.id}>
                      {count.name} ({new Date(count.createdAt).toLocaleDateString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Count 2</label>
              <Select defaultValue={count2Id ?? ""}>
                <SelectTrigger>
                  <SelectValue placeholder="Select second count" />
                </SelectTrigger>
                <SelectContent>
                  {counts.map((count) => (
                    <SelectItem key={count.id} value={count.id}>
                      {count.name} ({new Date(count.createdAt).toLocaleDateString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </form>
        </CardContent>
      </Card>

      {comparisonRows && count1Data && count2Data && (
        <Card>
          <CardHeader>
            <CardTitle>Comparison Results</CardTitle>
            <p className="text-sm text-muted-foreground">
              {count1Data.name} vs {count2Data.name}
            </p>
          </CardHeader>
          <CardContent>
            {comparisonRows.length === 0 ? (
              <p className="text-center text-muted-foreground">No items in common</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Warehouse</TableHead>
                      <TableHead className="text-right">{count1Data.name}</TableHead>
                      <TableHead className="text-right">{count2Data.name}</TableHead>
                      <TableHead className="text-right">Difference</TableHead>
                      <TableHead className="text-right">Variance %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparisonRows.map((row) => (
                      <TableRow key={`${row.itemId}:${row.warehouseCode}`}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{row.itemName}</p>
                            <p className="text-xs text-muted-foreground">{row.itemSku}</p>
                          </div>
                        </TableCell>
                        <TableCell>{row.warehouseCode}</TableCell>
                        <TableCell className="text-right">{row.count1Qty}</TableCell>
                        <TableCell className="text-right">{row.count2Qty}</TableCell>
                        <TableCell
                          className={`text-right ${row.difference !== 0 ? "font-semibold" : ""}`}
                        >
                          {row.difference > 0 ? "+" : ""}
                          {row.difference}
                        </TableCell>
                        <TableCell
                          className={`text-right ${Math.abs(row.variancePercent) > 5 ? "text-destructive font-semibold" : ""}`}
                        >
                          {row.variancePercent.toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
