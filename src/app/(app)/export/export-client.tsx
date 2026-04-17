"use client";

import { logger } from "@/lib/logger";
import { useState } from "react";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  exportItemsAction,
  exportMovementsAction,
  exportPurchaseOrdersAction,
  exportStockLevelsAction,
} from "./actions";

interface ExportClientProps {
  exportType: string;
  label: string;
  formats: string[];
}

export function ExportClient({ exportType, label, formats }: ExportClientProps) {
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(false);

  const handleExport = (format: "csv" | "xlsx") => {
    setIsLoading(true);

    startTransition(async () => {
      try {
        let result: Awaited<ReturnType<typeof exportItemsAction>>;

        switch (exportType) {
          case "ITEM":
            result = await exportItemsAction({ format });
            break;
          case "STOCK_LEVEL":
            result = await exportStockLevelsAction({ format });
            break;
          case "STOCK_MOVEMENT":
            result = await exportMovementsAction({ format });
            break;
          case "PURCHASE_ORDER":
            result = await exportPurchaseOrdersAction({ format });
            break;
          default:
            toast.error("Unknown export type");
            setIsLoading(false);
            return;
        }

        if (!result.ok) {
          toast.error(result.error);
          setIsLoading(false);
          return;
        }

        const data = result.data;
        const fileName = `${label}_${new Date().toISOString().split("T")[0]}.${format === "csv" ? "csv" : "xlsx"}`;

        if (typeof data === "string") {
          const blob = new Blob([data], { type: "text/csv;charset=utf-8;" });
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = fileName;
          link.click();
        } else if ("base64" in data) {
          const binaryString = atob(data.base64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const blob = new Blob([bytes], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          });
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = fileName;
          link.click();
        }

        toast.success(`${label} exported successfully`);
      } catch (error) {
        logger.error("Export failed:", { error: error });
        toast.error("Export failed");
      } finally {
        setIsLoading(false);
      }
    });
  };

  return (
    <>
      {formats.map((format) => (
        <button
          key={format}
          onClick={() => handleExport(format.toLowerCase() as "csv" | "xlsx")}
          disabled={isPending || isLoading}
          className="w-full px-3 py-2 text-sm font-medium border rounded hover:bg-muted transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending || isLoading ? "Exporting..." : `Export as ${format}`}
        </button>
      ))}
    </>
  );
}
