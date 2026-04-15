"use client";

// Phase 4.3 — Bulk item operations.
//
// Wraps the items table with checkbox selection state and a floating
// bulk-action bar. The server component passes serialized item rows;
// this client component handles selection without re-fetching.
//
// Supported bulk actions:
//   - Archive selected (ACTIVE → ARCHIVED)
//   - Export selected as CSV (generates a download in the browser)
//
// Design rules:
//   - Checkboxes appear on hover for clean default view.
//   - Bulk bar floats above the page footer, visible only when ≥1 selected.
//   - Select-all is scoped to the current page (not all items).
//   - Actions are optimistic: row de-selects immediately, error shown if API fails.

import { Archive, Check, Download, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResponsiveTable, MobileCard } from "@/components/ui/responsive-table";
import { Eye } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ItemRow = {
  id: string;
  sku: string;
  name: string;
  barcode: string | null;
  categoryName: string | null;
  status: "ACTIVE" | "ARCHIVED" | "DRAFT";
  onHand: number;
  unit: string;
  salePrice: string | null;
  currency: string;
  // Phase 16.1 — low-stock indicator: compare onHand to reorderPoint
  reorderPoint: number;
};

type ItemsTableProps = {
  items: ItemRow[];
  canEdit: boolean;
  canDelete: boolean;
  labels: {
    columnSku: string;
    columnName: string;
    columnCategory: string;
    columnStock: string;
    columnStatus: string;
    columnActions: string;
    none: string;
    active: string;
    archived: string;
    draft: string;
    edit: string;
    search: string;
  };
  deleteButton: (itemId: string) => React.ReactNode;
};

// ---------------------------------------------------------------------------
// Bulk action bar
// ---------------------------------------------------------------------------

function BulkBar({
  count,
  onArchive,
  onExport,
  onClear,
  isPending,
}: {
  count: number;
  onArchive: () => void;
  onExport: () => void;
  onClear: () => void;
  isPending: boolean;
}) {
  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-lg border bg-background px-4 py-2.5 shadow-lg">
        <span className="text-sm font-medium">
          {count} item{count !== 1 ? "s" : ""} selected
        </span>
        <div className="h-4 w-px bg-border" />
        <Button
          size="sm"
          variant="outline"
          onClick={onExport}
          disabled={isPending}
          className="h-7 gap-1.5 text-xs"
        >
          <Download className="h-3 w-3" />
          Export CSV
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onArchive}
          disabled={isPending}
          className="h-7 gap-1.5 text-xs"
        >
          <Archive className="h-3 w-3" />
          Archive
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClear}
          className="h-7 w-7 p-0"
          aria-label="Clear selection"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ItemsTable({ items, canEdit, canDelete, labels, deleteButton }: ItemsTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const allSelected = selected.size === items.length && items.length > 0;
  const someSelected = selected.size > 0 && !allSelected;

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.id)));
    }
  }

  function handleBulkArchive() {
    const ids = Array.from(selected);
    setActionError(null);
    startTransition(async () => {
      try {
        await Promise.all(
          ids.map((id) =>
            fetch(`/api/items/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "ARCHIVED" }),
            }),
          ),
        );
        setSelected(new Set());
      } catch {
        setActionError("Some items could not be archived. Please try again.");
      }
    });
  }

  function handleBulkExport() {
    const ids = Array.from(selected);
    const selectedItems = items.filter((i) => ids.includes(i.id));

    // Build CSV in-browser — no API call needed.
    const headers = ["SKU", "Name", "Category", "Status", "On Hand", "Unit"];
    const rows = selectedItems.map((item) => [
      item.sku,
      item.name,
      item.categoryName ?? "",
      item.status,
      String(item.onHand),
      item.unit,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "items-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function statusBadge(status: "ACTIVE" | "ARCHIVED" | "DRAFT") {
    if (status === "ACTIVE") return <Badge variant="success">{labels.active}</Badge>;
    if (status === "DRAFT") return <Badge variant="warning">{labels.draft}</Badge>;
    return <Badge variant="secondary">{labels.archived}</Badge>;
  }

  // Build mobile card view from items
  const cardView = items.map((item) => (
    <MobileCard
      key={item.id}
      title={item.name}
      subtitle={item.sku}
      fields={[
        { label: "Category", value: item.categoryName ?? labels.none },
        { label: "On Hand", value: `${item.onHand} ${item.unit}` },
      ]}
      badge={statusBadge(item.status)}
      href={`/items/${item.id}`}
    />
  ));

  return (
    <>
      {actionError ? <p className="mb-2 text-xs text-destructive">{actionError}</p> : null}

      <ResponsiveTable cardView={cardView}>
        <div className="overflow-x-auto">
          <Table className="min-w-[560px]">
            <TableHeader>
              <TableRow>
                {/* Bulk select checkbox */}
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={toggleAll}
                    aria-label="Select all items on this page"
                  />
                </TableHead>
                <TableHead>{labels.columnSku}</TableHead>
                <TableHead>{labels.columnName}</TableHead>
                <TableHead>{labels.columnCategory}</TableHead>
                <TableHead className="text-right">{labels.columnStock}</TableHead>
                <TableHead>{labels.columnStatus}</TableHead>
                <TableHead className="w-36 text-right">{labels.columnActions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const isSelected = selected.has(item.id);
                return (
                  <TableRow key={item.id} data-selected={isSelected || undefined} className="hover:bg-muted/50 transition-colors">
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggle(item.id)}
                        aria-label={`Select ${item.name}`}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                    <TableCell>
                      <Link href={`/items/${item.id}`} className="font-medium hover:underline">
                        {item.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.categoryName ?? labels.none}
                    </TableCell>
                    {/* Phase 16.1 — amber colour + dot when at/below reorder point */}
                    <TableCell className="text-right tabular-nums">
                      <span
                        className={
                          item.reorderPoint > 0 && item.onHand <= item.reorderPoint
                            ? "font-medium text-amber-600"
                            : undefined
                        }
                        title={
                          item.reorderPoint > 0 && item.onHand <= item.reorderPoint
                            ? `Below reorder point (${item.reorderPoint})`
                            : undefined
                        }
                      >
                        {item.onHand} {item.unit}
                        {item.reorderPoint > 0 && item.onHand <= item.reorderPoint ? (
                          <span
                            className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-500 align-middle"
                            aria-label="Below reorder point"
                          />
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell>{statusBadge(item.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/items/${item.id}`} aria-label={labels.search}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        {canEdit ? (
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/items/${item.id}/edit`}>{labels.edit}</Link>
                          </Button>
                        ) : null}
                        {canDelete ? deleteButton(item.id) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </ResponsiveTable>

      {selected.size > 0 ? (
        <BulkBar
          count={selected.size}
          onArchive={handleBulkArchive}
          onExport={handleBulkExport}
          onClear={() => setSelected(new Set())}
          isPending={isPending}
        />
      ) : null}
    </>
  );
}
