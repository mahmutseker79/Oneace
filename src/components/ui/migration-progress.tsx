"use client";

import { Badge } from "@/components/ui/badge";
import type { ImportPhase, PhaseResult } from "@/lib/migrations/core/types";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";

interface MigrationProgressProps {
  phases: PhaseResult[];
  currentPhase: ImportPhase | null;
  isImporting?: boolean;
}

const PHASE_LABELS: Record<ImportPhase, string> = {
  CATEGORIES: "Categories",
  SUPPLIERS: "Suppliers",
  WAREHOUSES: "Warehouses",
  LOCATIONS: "Locations",
  CUSTOM_FIELD_DEFS: "Custom Fields",
  ITEMS: "Items",
  CUSTOM_FIELD_VALUES: "Field Values",
  STOCK_LEVELS: "Stock Levels",
  ATTACHMENTS: "Attachments",
  PURCHASE_ORDERS: "Purchase Orders",
};

const PHASE_ORDER: ImportPhase[] = [
  "CATEGORIES",
  "SUPPLIERS",
  "WAREHOUSES",
  "LOCATIONS",
  "CUSTOM_FIELD_DEFS",
  "ITEMS",
  "CUSTOM_FIELD_VALUES",
  "STOCK_LEVELS",
  "ATTACHMENTS",
  "PURCHASE_ORDERS",
];

export function MigrationProgress({
  phases,
  currentPhase,
  isImporting = false,
}: MigrationProgressProps) {
  const phaseMap = new Map(phases.map((p) => [p.phase, p]));

  return (
    <div className="space-y-3">
      {PHASE_ORDER.map((phase) => {
        const result = phaseMap.get(phase);
        const isCurrent = currentPhase === phase;
        const isDone = result && !isCurrent && phases.some((p) => p.phase === phase);

        return (
          <div key={phase} className="flex items-center gap-3 py-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center">
              {isDone ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : isCurrent && isImporting ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground" />
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{PHASE_LABELS[phase]}</span>
                {result && (
                  <span className="text-xs text-muted-foreground">
                    {result.created + result.updated} created/updated,{" "}
                    {result.failed > 0 && (
                      <span className="text-destructive">{result.failed} failed</span>
                    )}
                  </span>
                )}
              </div>
            </div>

            {result && (
              <div className="flex gap-1">
                {result.created > 0 && (
                  <Badge variant="success" className="text-[10px]">
                    {result.created} created
                  </Badge>
                )}
                {result.updated > 0 && (
                  <Badge variant="info" className="text-[10px]">
                    {result.updated} updated
                  </Badge>
                )}
                {result.failed > 0 && (
                  <Badge variant="destructive" className="text-[10px]">
                    {result.failed} failed
                  </Badge>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
