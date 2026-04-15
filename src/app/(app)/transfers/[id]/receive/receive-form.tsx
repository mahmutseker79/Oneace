"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { ReceiveTransferInput } from "@/lib/validation/stock-transfer";

import { receiveTransferAction } from "../../actions";

type Item = {
  id: string;
  sku: string;
  name: string;
};

type Line = {
  id: string;
  shippedQty: number;
  item: Item;
};

interface ReceiveFormProps {
  transferId: string;
  lines: Line[];
}

export function ReceiveForm({ transferId, lines }: ReceiveFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  // State for received quantities
  const [receivedByLine, setReceivedByLine] = useState<Record<string, number>>(
    Object.fromEntries(lines.map((l) => [l.id, l.shippedQty]))
  );

  const handleQtyChange = (lineId: string, qty: number | "") => {
    if (qty === "") {
      setReceivedByLine((prev) => ({ ...prev, [lineId]: 0 }));
    } else {
      setReceivedByLine((prev) => ({ ...prev, [lineId]: Math.max(0, qty) }));
    }
  };

  const handleReceiveAll = () => {
    const allQtys: Record<string, number> = {};
    for (const line of lines) {
      allQtys[line.id] = line.shippedQty;
    }
    setReceivedByLine(allQtys);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const receiveLines = lines
        .map((line) => ({
          lineId: line.id,
          receivedQty: receivedByLine[line.id] || 0,
          note,
        }))
        .filter((l) => l.receivedQty > 0);

      if (receiveLines.length === 0) {
        setError("Please enter received quantities for at least one line");
        setIsLoading(false);
        return;
      }

      const input: ReceiveTransferInput = {
        transferId,
        lines: receiveLines,
        note: note || undefined,
      };

      const result = await receiveTransferAction(input);

      if (!result.ok) {
        setError(result.error);
        setIsLoading(false);
        return;
      }

      // Redirect back to transfer detail
      router.push(`/transfers/${transferId}`);
    } catch (err) {
      setError("An unexpected error occurred");
      setIsLoading(false);
    }
  };

  const totalShipped = lines.reduce((sum, l) => sum + l.shippedQty, 0);
  const totalReceived = lines.reduce(
    (sum, l) => sum + (receivedByLine[l.id] || 0),
    0
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead className="text-right">Shipped Qty</TableHead>
            <TableHead className="text-right">Received Qty</TableHead>
            <TableHead className="text-right">Discrepancy</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line) => {
            const receivedQty = receivedByLine[line.id] || 0;
            const discrepancy = receivedQty - line.shippedQty;
            return (
              <TableRow key={line.id}>
                <TableCell>{line.item.name}</TableCell>
                <TableCell className="text-right font-semibold">
                  {line.shippedQty}
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    min="0"
                    max="1000000"
                    value={receivedQty}
                    onChange={(e) =>
                      handleQtyChange(
                        line.id,
                        e.target.value ? parseInt(e.target.value, 10) : ""
                      )
                    }
                    className="w-24 text-right"
                  />
                </TableCell>
                <TableCell className="text-right">
                  {discrepancy !== 0 ? (
                    <span
                      className={
                        discrepancy > 0 ? "text-green-600" : "text-red-600"
                      }
                    >
                      {discrepancy > 0 ? "+" : ""}
                      {discrepancy}
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            );
          })}
          <TableRow className="border-t-2 font-semibold">
            <TableCell>Total</TableCell>
            <TableCell className="text-right">{totalShipped}</TableCell>
            <TableCell className="text-right">{totalReceived}</TableCell>
            <TableCell className="text-right">
              {totalReceived - totalShipped !== 0 ? (
                <span
                  className={
                    totalReceived - totalShipped > 0
                      ? "text-green-600"
                      : "text-red-600"
                  }
                >
                  {totalReceived - totalShipped > 0 ? "+" : ""}
                  {totalReceived - totalShipped}
                </span>
              ) : (
                "—"
              )}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <div className="space-y-2">
        <label className="text-sm font-medium">Notes (optional)</label>
        <Textarea
          placeholder="Add any notes about the receipt..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
        />
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Processing..." : "Complete Receipt"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleReceiveAll}
          disabled={isLoading}
        >
          Receive All
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
          disabled={isLoading}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
