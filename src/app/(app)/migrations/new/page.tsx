"use client";

import { createMigrationJobAction } from "@/app/(app)/migrations/actions";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import type { MigrationSource } from "@/generated/prisma";
import {
  type MigrationScopeOptions,
  defaultScopeOptions,
  parseScopeOptions,
} from "@/lib/migrations/core/scope-options";
import type { FieldMapping } from "@/lib/migrations/core/types";
import {
  Boxes,
  Factory,
  FileSpreadsheet,
  HardDrive,
  Package,
  Receipt,
  Warehouse,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ScopeOptionsStep } from "./scope-options-step";

const MIGRATION_SOURCES = [
  {
    source: "SORTLY",
    name: "Sortly",
    icon: Package,
    description: "Ürünler, kategoriler, tedarikçiler ve stoğu taşıyın",
  },
  {
    source: "INFLOW",
    name: "inFlow",
    icon: Boxes,
    description: "Envanter verilerini inFlow'dan getirin",
  },
  {
    source: "FISHBOWL",
    name: "Fishbowl",
    icon: Warehouse,
    description: "Fishbowl merkezli depolama verilerini aktarın",
  },
  {
    source: "CIN7",
    name: "Cin7 Core",
    icon: Factory,
    description: "Cin7 Core işletme verilerinizi getirin",
  },
  {
    source: "SOS_INVENTORY",
    name: "SOS Inventory",
    icon: Receipt,
    description: "SOS Inventory'den tam katalog taşıyın",
  },
  {
    source: "QUICKBOOKS_ONLINE",
    name: "QuickBooks Online",
    icon: FileSpreadsheet,
    description: "QuickBooks Online API aracılığıyla veri taşıyın",
  },
  {
    source: "QUICKBOOKS_DESKTOP",
    name: "QuickBooks Desktop",
    icon: HardDrive,
    description: "QuickBooks Desktop IIF dosyasını yükleyin",
  },
];

// API sources that skip file upload
const API_SOURCES: MigrationSource[] = ["CIN7", "SOS_INVENTORY", "QUICKBOOKS_ONLINE"];

interface WizardState {
  currentStep: 1 | 2 | 3 | 4 | 5;
  source: MigrationSource | null;
  migrationJobId: string | null;
  scopeOptions: MigrationScopeOptions;
  fieldMappings: FieldMapping[];
  uploadedFiles: File[];
  isLoading: boolean;
}

export default function NewMigrationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSource = searchParams.get("source") as MigrationSource | null;

  const [state, setState] = useState<WizardState>({
    currentStep: 1,
    source: initialSource,
    migrationJobId: null,
    scopeOptions: defaultScopeOptions(),
    fieldMappings: [],
    uploadedFiles: [],
    isLoading: false,
  });

  // Create migration job when source is selected
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally fires only when source changes
  useEffect(() => {
    if (state.source && !state.migrationJobId && state.currentStep === 1) {
      createJob();
    }
  }, [state.source]);

  const createJob = async () => {
    if (!state.source) return;
    setState((s) => ({ ...s, isLoading: true }));
    try {
      const result = await createMigrationJobAction(state.source);
      setState((s) => ({
        ...s,
        migrationJobId: result.id,
        currentStep: API_SOURCES.includes(state.source!) ? 3 : 2,
      }));
    } catch (err) {
      console.error("Failed to create migration job:", err);
      setState((s) => ({ ...s, isLoading: false }));
    }
  };

  const handleSourceSelect = (source: MigrationSource) => {
    setState((s) => ({
      ...s,
      source,
      currentStep: 1,
    }));
  };

  const handleScopeOptionsChange = (scopeOptions: MigrationScopeOptions) => {
    setState((s) => ({ ...s, scopeOptions }));
  };

  const handleScopeOptionsNext = () => {
    setState((s) => ({ ...s, currentStep: 4 }));
  };

  const handleScopeOptionsBack = () => {
    setState((s) => ({
      ...s,
      currentStep: API_SOURCES.includes(state.source!) ? 2 : 3,
    }));
  };

  // Step 1: Source Selection
  if (!state.source) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Yeni Göç Başlat"
          description="Rakipten veri taşımak için kaynağı seçin"
        />

        <div className="grid gap-4 md:grid-cols-2">
          {MIGRATION_SOURCES.map((src) => {
            const Icon = src.icon;
            return (
              <button
                key={src.source}
                onClick={() => handleSourceSelect(src.source as MigrationSource)}
                className="block group text-left"
              >
                <div className="border rounded-lg p-6 hover:border-primary hover:shadow-lg transition space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted group-hover:bg-primary/10">
                      <Icon className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base">{src.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{src.description}</p>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Step 2: File Upload (file-mode sources only)
  if (state.currentStep === 2) {
    return (
      <div className="space-y-8">
        <PageHeader title="Yeni Göç Başlat" description="Dosyalarınızı yükleyin" />
        <div className="rounded-lg border p-8 text-center">
          <p className="text-muted-foreground">Dosya yükleme adımı hazırlanıyor...</p>
        </div>
      </div>
    );
  }

  // Step 3: Scope Options
  if (state.currentStep === 3) {
    return (
      <div className="space-y-8">
        <PageHeader title="Yeni Göç Başlat" description="Göç kapsamını belirleyin" />
        <div className="max-w-2xl">
          <ScopeOptionsStep
            value={state.scopeOptions}
            onChange={handleScopeOptionsChange}
            onBack={() => setState((s) => ({ ...s, currentStep: 2 }))}
            onNext={handleScopeOptionsNext}
            isLoading={state.isLoading}
          />
        </div>
      </div>
    );
  }

  // Step 4: Field Mapping (file-mode sources only)
  if (state.currentStep === 4) {
    return (
      <div className="space-y-8">
        <PageHeader title="Yeni Göç Başlat" description="Alan eşlemesi" />
        <div className="rounded-lg border p-8 text-center">
          <p className="text-muted-foreground">Alan eşleme adımı hazırlanıyor...</p>
        </div>
      </div>
    );
  }

  // Step 5: Preview & Start
  if (state.currentStep === 5) {
    return (
      <div className="space-y-8">
        <PageHeader title="Yeni Göç Başlat" description="Özeti gözden geçirin ve başlatın" />
        <div className="rounded-lg border p-8 text-center">
          <p className="text-muted-foreground">Göç özeti hazırlanıyor...</p>
        </div>
      </div>
    );
  }

  return null;
}
