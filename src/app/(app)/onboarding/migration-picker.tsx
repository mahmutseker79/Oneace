"use client";

// Phase S3 — Migration picker step in onboarding wizard.
//
// Displays 5 migration source cards (Sortly, inFlow, Fishbowl, Cin7, SOS)
// plus a 6th "skip or other" card. User picks one to create a MigrationJob,
// or skips to proceed with empty workspace.

import {
  CheckCircle2,
  ChevronRight,
  Package,
  Boxes,
  Warehouse,
  Factory,
  Receipt,
  Plus,
  FileSpreadsheet,
  HardDrive,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { MigrationSource } from "@prisma/client";

const MIGRATION_SOURCES: Array<{
  id: MigrationSource | null;
  label: string;
  tagline: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: "SORTLY",
    label: "Sortly",
    tagline: "Tipik süre: 10 dk",
    Icon: Package,
  },
  {
    id: "INFLOW",
    label: "inFlow",
    tagline: "Tipik süre: 10 dk",
    Icon: Boxes,
  },
  {
    id: "FISHBOWL",
    label: "Fishbowl",
    tagline: "Tipik süre: 10 dk",
    Icon: Warehouse,
  },
  {
    id: "CIN7",
    label: "Cin7 Core",
    tagline: "Tipik süre: 10 dk",
    Icon: Factory,
  },
  {
    id: "SOS_INVENTORY",
    label: "SOS Inventory",
    tagline: "Tipik süre: 10 dk",
    Icon: Receipt,
  },
  {
    id: "QUICKBOOKS_ONLINE",
    label: "QuickBooks Online",
    tagline: "Tipik süre: 5-10 dk · API",
    Icon: FileSpreadsheet,
  },
  {
    id: "QUICKBOOKS_DESKTOP",
    label: "QuickBooks Desktop",
    tagline: "Tipik süre: 10-15 dk · IIF dosyası",
    Icon: HardDrive,
  },
  {
    id: null,
    label: "Başka bir sistem / boş başla",
    tagline: "Benimle başlayan",
    Icon: Plus,
  },
];

interface MigrationPickerProps {
  onPick: (source: MigrationSource | null) => void;
  onSkip: () => void;
}

export function MigrationPicker({ onPick, onSkip }: MigrationPickerProps) {
  const [selected, setSelected] = useState<MigrationSource | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Mevcut verini getir?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sortly, inFlow, Fishbowl, Cin7 Core, SOS Inventory, QuickBooks Online, ve QuickBooks Desktop&rsquo;ten veri taşımayı destekliyoruz.
          Bu adımı atlayabilir ve sonra yapabilirsiniz.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {MIGRATION_SOURCES.map((source) => {
          const Icon = source.Icon;
          const isSelected = selected === source.id;
          return (
            <button
              key={source.id ?? "skip"}
              type="button"
              onClick={() => setSelected(isSelected ? null : source.id)}
              className={`flex flex-col items-start gap-2 rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                isSelected
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-border hover:border-foreground/30 hover:bg-accent/30"
              }`}
            >
              <div className="flex w-full items-start justify-between gap-2">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                    isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                {isSelected ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                ) : null}
              </div>
              <div>
                <span className="font-medium">{source.label}</span>
                <div className="text-xs text-muted-foreground">{source.tagline}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onSkip}>
          Şimdi atla, sonra yapacağım
        </Button>
        <Button
          className="flex-1"
          disabled={selected === undefined}
          onClick={() => onPick(selected)}
        >
          Devam
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
