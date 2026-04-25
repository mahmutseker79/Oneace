"use client";

/**
 * Migration Wizard — end-to-end flow for importing data from
 * Sortly, inFlow, Fishbowl, Cin7 Core, SOS Inventory, QuickBooks Online, and QuickBooks Desktop.
 *
 * Two modes:
 *   - FILE mode (SORTLY, INFLOW, FISHBOWL, QUICKBOOKS_DESKTOP):
 *     Source → Upload → Mapping → Scope → Validate → Start
 *   - API mode (CIN7, SOS_INVENTORY, QUICKBOOKS_ONLINE):
 *     Source → Credentials → Scope → Validate → Start
 *
 * Each step POSTs to a server API route; the backend is in src/app/api/migrations/[id]/*.
 */

import { createMigrationJobAction } from "@/app/(app)/migrations/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Textarea } from "@/components/ui/textarea";
import type { MigrationSource } from "@/generated/prisma";
import {
  type MigrationScopeOptions,
  defaultScopeOptions,
} from "@/lib/migrations/core/scope-options";
import type { FieldMapping } from "@/lib/migrations/core/types";
import {
  AlertCircle,
  Boxes,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Factory,
  FileSpreadsheet,
  HardDrive,
  Loader2,
  Package,
  Receipt,
  Upload,
  Warehouse,
  X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ScopeOptionsStep } from "./scope-options-step";

// ─────────────────────────────────────────────────────────────────────────────
// Source catalog
// ─────────────────────────────────────────────────────────────────────────────

type SourceMeta = {
  source: MigrationSource;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  mode: "file" | "api";
  credentialsHint?: string;
};

const MIGRATION_SOURCES: SourceMeta[] = [
  {
    source: "SORTLY",
    name: "Sortly",
    icon: Package,
    description: "Ürünler, kategoriler, klasörler ve stok seviyelerini taşıyın",
    mode: "file",
  },
  {
    source: "INFLOW",
    name: "inFlow",
    icon: Boxes,
    description: "Products, Vendors, StockLevels CSV'lerini getirin",
    mode: "file",
  },
  {
    source: "FISHBOWL",
    name: "Fishbowl",
    icon: Warehouse,
    description: "Fishbowl CSV/IIF dışarı-aktarımlarını yükleyin",
    mode: "file",
  },
  {
    source: "QUICKBOOKS_DESKTOP",
    name: "QuickBooks Desktop",
    icon: HardDrive,
    description: "QuickBooks Desktop IIF dosyasını yükleyin",
    mode: "file",
  },
  {
    source: "CIN7",
    name: "Cin7 Core",
    icon: Factory,
    description: "Cin7 Core API anahtarınızla doğrudan bağlanın",
    mode: "api",
    credentialsHint:
      'JSON formatında Cin7 Core API anahtarı:\n{\n  "apiKey": "...",\n  "accountId": "...",\n  "baseUrl": "https://..."\n}',
  },
  {
    source: "SOS_INVENTORY",
    name: "SOS Inventory",
    icon: Receipt,
    description: "SOS Inventory OAuth token'ıyla bağlanın",
    mode: "api",
    credentialsHint:
      'JSON formatında OAuth credential:\n{\n  "accessToken": "...",\n  "refreshToken": "...",\n  "companyId": "..."\n}',
  },
  {
    source: "QUICKBOOKS_ONLINE",
    name: "QuickBooks Online",
    icon: FileSpreadsheet,
    description: "Mevcut QBO entegrasyonu ya da yeni OAuth",
    mode: "api",
    credentialsHint:
      'JSON — ya mevcut bağlantıyı kullan:\n{ "useExistingIntegration": true, "realmId": "..." }\n\nya da yeni credential yapıştır:\n{\n  "accessToken": "...",\n  "refreshToken": "...",\n  "realmId": "..."\n}',
  },
];

function getSourceMeta(source: MigrationSource | null): SourceMeta | null {
  return MIGRATION_SOURCES.find((s) => s.source === source) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Wizard state
// ─────────────────────────────────────────────────────────────────────────────

type WizardStep =
  | "source"
  | "upload"
  | "credentials"
  | "mapping"
  | "scope"
  | "validate"
  | "confirm";

interface WizardState {
  step: WizardStep;
  source: MigrationSource | null;
  migrationJobId: string | null;
  files: File[];
  credentialsJson: string;
  fieldMappings: FieldMapping[];
  detections: Array<{ fileRef: string; entity: string; confidence: number }>;
  scopeOptions: MigrationScopeOptions;
  validationReport: {
    issues: Array<{ severity: string; code: string; message: string; entity: string }>;
    totals: Record<string, { rows: number; errors: number; warnings: number }>;
  } | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: WizardState = {
  step: "source",
  source: null,
  migrationJobId: null,
  files: [],
  credentialsJson: "",
  fieldMappings: [],
  detections: [],
  scopeOptions: defaultScopeOptions(),
  validationReport: null,
  isLoading: false,
  error: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// Step indicator
// ─────────────────────────────────────────────────────────────────────────────

function stepsForMode(mode: "file" | "api"): WizardStep[] {
  return mode === "file"
    ? ["source", "upload", "mapping", "scope", "validate", "confirm"]
    : ["source", "credentials", "scope", "validate", "confirm"];
}

const STEP_LABELS: Record<WizardStep, string> = {
  source: "Kaynak",
  upload: "Dosya",
  credentials: "Bağlantı",
  mapping: "Eşleme",
  scope: "Kapsam",
  validate: "Doğrulama",
  confirm: "Onay",
};

function StepIndicator({ steps, current }: { steps: WizardStep[]; current: WizardStep }) {
  const currentIdx = steps.indexOf(current);
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2">
      {steps.map((s, i) => {
        const isActive = s === current;
        const isDone = i < currentIdx;
        return (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : isDone
                    ? "bg-success text-success-foreground"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {isDone ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`text-xs ${isActive ? "font-medium" : "text-muted-foreground"}`}>
              {STEP_LABELS[s]}
            </span>
            {i < steps.length - 1 && <div className="h-px w-6 bg-border" />}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function NewMigrationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSource = (searchParams.get("source") as MigrationSource | null) ?? null;

  const [state, setState] = useState<WizardState>({
    ...initialState,
    source: initialSource,
  });

  const sourceMeta = getSourceMeta(state.source);
  const mode = sourceMeta?.mode ?? "file";
  const steps = stepsForMode(mode);

  // ─── Source picked from URL ────────────────────────────────────────
  // biome-ignore lint/correctness/useExhaustiveDependencies: fires once on mount to auto-advance if ?source= was present
  useEffect(() => {
    if (!initialSource || state.migrationJobId || state.isLoading) return;
    void pickSource(initialSource);
  }, []);

  // ─── Helpers ───────────────────────────────────────────────────────

  function setError(msg: string | null) {
    setState((s) => ({ ...s, error: msg, isLoading: false }));
  }

  async function pickSource(source: MigrationSource) {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const result = await createMigrationJobAction(source);
      const meta = getSourceMeta(source);
      setState((s) => ({
        ...s,
        migrationJobId: result.id,
        source,
        step: meta?.mode === "api" ? "credentials" : "upload",
        isLoading: false,
      }));
    } catch (err) {
      // Keep user on source-selection screen so they can retry or pick another
      setState((s) => ({
        ...s,
        source: null,
        isLoading: false,
        error: err instanceof Error ? err.message : "Kaynak oluşturulamadı.",
      }));
    }
  }

  function resetWizard() {
    setState({ ...initialState });
    router.push("/migrations/new");
  }

  // ─── Upload step ───────────────────────────────────────────────────

  async function uploadFilesAndDetect() {
    if (!state.migrationJobId || state.files.length === 0) return;
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      // POST /upload
      const fd = new FormData();
      for (const f of state.files) fd.append("file", f);
      const upRes = await fetch(`/api/migrations/${state.migrationJobId}/upload`, {
        method: "POST",
        body: fd,
      });
      if (!upRes.ok) {
        const j = await upRes.json().catch(() => ({}));
        throw new Error(j.message || `Yükleme başarısız (${upRes.status})`);
      }

      // POST /detect
      const detRes = await fetch(`/api/migrations/${state.migrationJobId}/detect`, {
        method: "POST",
      });
      if (!detRes.ok) {
        const j = await detRes.json().catch(() => ({}));
        throw new Error(j.message || `Dosya analizi başarısız (${detRes.status})`);
      }
      const det = await detRes.json();
      setState((s) => ({
        ...s,
        detections: det.detections ?? [],
        fieldMappings: det.suggestedMappings ?? [],
        step: "mapping",
        isLoading: false,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yükleme sırasında hata.");
    }
  }

  // ─── Credentials step ──────────────────────────────────────────────

  async function saveCredentials() {
    if (!state.migrationJobId) return;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(state.credentialsJson);
    } catch {
      setError("Geçerli JSON giriniz.");
      return;
    }
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      // API-mode: we stash credentials in fieldMappings via PUT /mapping with empty array
      const res = await fetch(`/api/migrations/${state.migrationJobId}/mapping`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldMappings: [],
          scopeOptions: state.scopeOptions,
          credentials: parsed,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || `Credential kaydedilemedi (${res.status})`);
      }
      setState((s) => ({ ...s, step: "scope", isLoading: false }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Credential hatası.");
    }
  }

  // ─── Mapping step ──────────────────────────────────────────────────

  async function saveMapping() {
    if (!state.migrationJobId) return;
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const res = await fetch(`/api/migrations/${state.migrationJobId}/mapping`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldMappings: state.fieldMappings,
          scopeOptions: state.scopeOptions,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || `Mapping kaydedilemedi (${res.status})`);
      }
      setState((s) => ({ ...s, step: "scope", isLoading: false }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mapping hatası.");
    }
  }

  // ─── Scope → Validate ──────────────────────────────────────────────

  async function saveScopeAndValidate() {
    if (!state.migrationJobId) return;
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      // Save scope via mapping endpoint
      await fetch(`/api/migrations/${state.migrationJobId}/mapping`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldMappings: state.fieldMappings,
          scopeOptions: state.scopeOptions,
        }),
      });

      // Validate
      const res = await fetch(`/api/migrations/${state.migrationJobId}/validate`, {
        method: "POST",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || `Doğrulama başarısız (${res.status})`);
      }
      const data = await res.json();
      setState((s) => ({
        ...s,
        validationReport: data.validationReport,
        step: "validate",
        isLoading: false,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Doğrulama hatası.");
    }
  }

  // ─── Start import ──────────────────────────────────────────────────

  async function startImport() {
    if (!state.migrationJobId) return;
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const res = await fetch(`/api/migrations/${state.migrationJobId}/start`, {
        method: "POST",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || `Başlatılamadı (${res.status})`);
      }
      router.push(`/migrations/${state.migrationJobId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "İçe aktarma başlatılamadı.");
    }
  }

  // ─── Render helpers ────────────────────────────────────────────────

  const renderStepIndicator = () =>
    state.source ? <StepIndicator steps={steps} current={state.step} /> : null;

  const renderError = () =>
    state.error ? (
      <Card variant="destructive">
        <CardContent className="pt-6 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-destructive">Bir sorun oluştu</p>
            <p className="text-sm text-muted-foreground mt-1">{state.error}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    ) : null;

  // ───────────────────────────────────────────────────────────────────
  // Step: Source selection — render whenever on source step regardless
  // of transient source value, so a failed createJob doesn't leave a
  // blank screen.
  // ───────────────────────────────────────────────────────────────────

  if (state.step === "source") {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Yeni Göç Başlat"
          description="Rakipten veri taşımak için kaynağı seçin"
        />
        {renderError()}
        {state.isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Migration oluşturuluyor...
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {MIGRATION_SOURCES.map((src) => {
            const Icon = src.icon;
            return (
              <button
                key={src.source}
                type="button"
                onClick={() => pickSource(src.source)}
                disabled={state.isLoading}
                className="text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Card className="hover:border-primary hover:shadow-md transition h-full">
                  <CardContent className="pt-6 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-sm">{src.name}</h3>
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {src.mode === "file" ? "CSV/IIF" : "API"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {src.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────
  // Step: Upload (file mode)
  // ───────────────────────────────────────────────────────────────────

  if (state.step === "upload") {
    return (
      <div className="space-y-6">
        <PageHeader title={`${sourceMeta?.name} Göçü`} description="Dosyalarınızı yükleyin" />
        {renderStepIndicator()}
        {renderError()}
        <UploadStep
          files={state.files}
          onFilesChange={(files) => setState((s) => ({ ...s, files }))}
          onBack={resetWizard}
          onNext={uploadFilesAndDetect}
          isLoading={state.isLoading}
          source={state.source}
        />
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────
  // Step: Credentials (API mode)
  // ───────────────────────────────────────────────────────────────────

  if (state.step === "credentials") {
    return (
      <div className="space-y-6">
        <PageHeader title={`${sourceMeta?.name} Göçü`} description="API bağlantı bilgileri" />
        {renderStepIndicator()}
        {renderError()}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div>
              <label htmlFor="credentials-json" className="text-sm font-medium block mb-1.5">
                Credential JSON
              </label>
              <Textarea
                id="credentials-json"
                rows={8}
                placeholder={sourceMeta?.credentialsHint ?? "{}"}
                value={state.credentialsJson}
                onChange={(e) => setState((s) => ({ ...s, credentialsJson: e.target.value }))}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Credential'lar sunucuda AES-256-GCM ile şifrelenerek saklanır.
              </p>
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={resetWizard}>
                <ChevronLeft className="h-4 w-4" />
                Geri
              </Button>
              <Button
                onClick={saveCredentials}
                disabled={state.isLoading || !state.credentialsJson.trim()}
              >
                {state.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Devam
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────
  // Step: Mapping (file mode only)
  // ───────────────────────────────────────────────────────────────────

  if (state.step === "mapping") {
    return (
      <div className="space-y-6">
        <PageHeader title={`${sourceMeta?.name} Göçü`} description="Alan eşlemesini inceleyin" />
        {renderStepIndicator()}
        {renderError()}
        <MappingStep
          detections={state.detections}
          mappings={state.fieldMappings}
          onMappingsChange={(m) => setState((s) => ({ ...s, fieldMappings: m }))}
          onBack={() => setState((s) => ({ ...s, step: "upload" }))}
          onNext={saveMapping}
          isLoading={state.isLoading}
        />
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────
  // Step: Scope options
  // ───────────────────────────────────────────────────────────────────

  if (state.step === "scope") {
    return (
      <div className="space-y-6">
        <PageHeader title={`${sourceMeta?.name} Göçü`} description="Göç kapsamını belirleyin" />
        {renderStepIndicator()}
        {renderError()}
        <div className="max-w-2xl">
          <ScopeOptionsStep
            value={state.scopeOptions}
            onChange={(v) => setState((s) => ({ ...s, scopeOptions: v }))}
            onBack={() =>
              setState((s) => ({ ...s, step: mode === "file" ? "mapping" : "credentials" }))
            }
            onNext={saveScopeAndValidate}
            isLoading={state.isLoading}
          />
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────
  // Step: Validate results
  // ───────────────────────────────────────────────────────────────────

  if (state.step === "validate") {
    return (
      <div className="space-y-6">
        <PageHeader title={`${sourceMeta?.name} Göçü`} description="Doğrulama sonuçları" />
        {renderStepIndicator()}
        {renderError()}
        <ValidateStep
          report={state.validationReport}
          onBack={() => setState((s) => ({ ...s, step: "scope" }))}
          onNext={() => setState((s) => ({ ...s, step: "confirm" }))}
        />
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────
  // Step: Confirm & start
  // ───────────────────────────────────────────────────────────────────

  if (state.step === "confirm") {
    return (
      <div className="space-y-6">
        <PageHeader title={`${sourceMeta?.name} Göçü`} description="Son onay ve başlat" />
        {renderStepIndicator()}
        {renderError()}
        <ConfirmStep
          report={state.validationReport}
          source={sourceMeta?.name ?? state.source}
          onBack={() => setState((s) => ({ ...s, step: "validate" }))}
          onStart={startImport}
          isLoading={state.isLoading}
        />
      </div>
    );
  }

  // Fallback — should never hit in practice, but prevents blank screen
  return (
    <div className="space-y-6">
      <PageHeader title="Yeni Göç Başlat" description="Beklenmeyen durum" />
      {renderError()}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Sihirbaz bilinmeyen bir duruma ({state.step}) düştü. Sıfırdan başlamak için:
          </p>
          <Button onClick={resetWizard}>Baştan Başla</Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function UploadStep({
  files,
  onFilesChange,
  onBack,
  onNext,
  isLoading,
  source,
}: {
  files: File[];
  onFilesChange: (files: File[]) => void;
  onBack: () => void;
  onNext: () => void;
  isLoading: boolean;
  source: MigrationSource | null;
}) {
  const [dragOver, setDragOver] = useState(false);

  const accept = source === "QUICKBOOKS_DESKTOP" ? ".iif,.IIF,.xml,.qbxml" : ".csv,.CSV";
  const hint =
    source === "QUICKBOOKS_DESKTOP"
      ? "IIF veya QBXML dosyaları kabul edilir"
      : source === "FISHBOWL"
        ? "Fishbowl CSV veya IIF dosyalarını yükleyin"
        : source === "INFLOW"
          ? "Products.csv, Vendors.csv, StockLevels.csv"
          : "CSV dosyası seçin (max 10 dosya)";

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const dropped = Array.from(e.dataTransfer.files);
      onFilesChange([...files, ...dropped].slice(0, 10));
    },
    [files, onFilesChange],
  );

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div
          onDrop={onDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragOver ? "border-primary bg-primary/5" : "border-border"
          }`}
        >
          <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">Dosyaları buraya sürükleyin</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">{hint}</p>
          <label className="inline-block">
            <input
              type="file"
              multiple
              accept={accept}
              className="sr-only"
              onChange={(e) => {
                const selected = Array.from(e.target.files ?? []);
                onFilesChange([...files, ...selected].slice(0, 10));
              }}
            />
            <span className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded-md cursor-pointer hover:bg-muted">
              Dosya seç
            </span>
          </label>
        </div>

        {files.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              {files.length} dosya seçildi
            </p>
            <ul className="space-y-1">
              {files.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  className="flex items-center justify-between text-sm px-3 py-2 bg-muted/30 rounded"
                >
                  <div className="truncate">
                    <span className="font-medium">{f.name}</span>
                    <span className="text-muted-foreground ml-2">
                      {(f.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onFilesChange(files.filter((_, j) => j !== i))}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Dosyayı kaldır"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-between pt-2">
          <Button variant="outline" onClick={onBack}>
            <ChevronLeft className="h-4 w-4" />
            Geri
          </Button>
          <Button onClick={onNext} disabled={isLoading || files.length === 0}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Yükle ve Analiz Et
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MappingStep({
  detections,
  mappings,
  onMappingsChange,
  onBack,
  onNext,
  isLoading,
}: {
  detections: Array<{ fileRef: string; entity: string; confidence: number }>;
  mappings: FieldMapping[];
  onMappingsChange: (m: FieldMapping[]) => void;
  onBack: () => void;
  onNext: () => void;
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        <div>
          <h3 className="font-semibold text-sm mb-3">Algılanan Dosyalar</h3>
          <div className="space-y-2">
            {detections.length === 0 ? (
              <p className="text-sm text-muted-foreground">Hiçbir dosya tanınamadı.</p>
            ) : (
              detections.map((d) => (
                <div
                  key={d.fileRef}
                  className="flex items-center justify-between text-sm p-3 border rounded"
                >
                  <div>
                    <p className="font-medium">{d.fileRef}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {d.entity} · güven: {(d.confidence * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-sm mb-3">
            Alan Eşlemesi{" "}
            <span className="text-muted-foreground font-normal">
              ({mappings.length} mapping otomatik tespit edildi)
            </span>
          </h3>
          {mappings.length === 0 ? (
            <p className="text-sm text-muted-foreground">Otomatik mapping bulunamadı.</p>
          ) : (
            <div className="space-y-1 max-h-80 overflow-y-auto pr-2">
              {mappings.map((m, i) => (
                <div
                  key={`${m.sourceField}-${i}`}
                  className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center text-xs p-2 bg-muted/30 rounded"
                >
                  <code className="font-mono">{m.sourceField}</code>
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  <code className="font-mono text-primary">{m.targetField}</code>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            Şu an otomatik mapping kullanılıyor. Manuel edit sonraki sürümde.
          </p>
        </div>

        <div className="flex justify-between pt-2">
          <Button variant="outline" onClick={onBack}>
            <ChevronLeft className="h-4 w-4" />
            Geri
          </Button>
          <Button onClick={onNext} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Devam
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ValidateStep({
  report,
  onBack,
  onNext,
}: {
  report: WizardState["validationReport"];
  onBack: () => void;
  onNext: () => void;
}) {
  if (!report) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Henüz doğrulama yapılmadı.</p>
        </CardContent>
      </Card>
    );
  }

  const errors = report.issues.filter((i) => i.severity === "ERROR");
  const warnings = report.issues.filter((i) => i.severity === "WARNING");
  const hasErrors = errors.length > 0;

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile label="Varlık Türleri" value={Object.keys(report.totals).length} />
          <StatTile label="Hata" value={errors.length} variant={hasErrors ? "error" : "ok"} />
          <StatTile
            label="Uyarı"
            value={warnings.length}
            variant={warnings.length > 0 ? "warn" : "ok"}
          />
        </div>

        {Object.keys(report.totals).length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Özet</h4>
            <div className="space-y-1.5 text-sm">
              {Object.entries(report.totals).map(([entity, stats]) => (
                <div
                  key={entity}
                  className="flex items-center justify-between p-2 bg-muted/30 rounded"
                >
                  <span className="font-medium capitalize">{entity}</span>
                  <span className="text-xs text-muted-foreground">
                    {stats.rows} satır · {stats.errors} hata · {stats.warnings} uyarı
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {report.issues.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2">İlk 10 Sorun</h4>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
              {report.issues.slice(0, 10).map((issue, i) => (
                <div
                  key={i}
                  className={`text-xs border-l-2 pl-3 py-1 ${
                    issue.severity === "ERROR"
                      ? "border-destructive"
                      : issue.severity === "WARNING"
                        ? "border-warning"
                        : "border-muted"
                  }`}
                >
                  <p className="font-medium">
                    {issue.entity} · {issue.code}
                  </p>
                  <p className="text-muted-foreground">{issue.message}</p>
                </div>
              ))}
              {report.issues.length > 10 && (
                <p className="text-xs text-muted-foreground">
                  +{report.issues.length - 10} daha sorun var
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-between pt-2">
          <Button variant="outline" onClick={onBack}>
            <ChevronLeft className="h-4 w-4" />
            Geri
          </Button>
          <Button onClick={onNext} disabled={hasErrors}>
            {hasErrors ? "Hataları düzeltin" : "İçe aktarmayı başlat"}
            {!hasErrors && <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ConfirmStep({
  report,
  source,
  onBack,
  onStart,
  isLoading,
}: {
  report: WizardState["validationReport"];
  source: string | null;
  onBack: () => void;
  onStart: () => void;
  isLoading: boolean;
}) {
  const totalRows = report ? Object.values(report.totals).reduce((s, t) => s + t.rows, 0) : 0;

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm">
            <strong>{source}</strong> kaynağından yaklaşık <strong>{totalRows}</strong> satır içeri
            aktarılacak.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            İçeri aktarma arka planda çalışır. İlerlemeyi detay sayfasından izleyebilirsiniz.
            {/* P1-2 (audit v1.0 §5.7): rollback is suspended for v1 — migrations are one-way. */}
            Bu sürümde içe aktarma tek yönlüdür; geri almak için destek ekibiyle iletişime geçmeniz
            gerekir.
          </p>
        </div>

        <div className="flex justify-between pt-2">
          <Button variant="outline" onClick={onBack}>
            <ChevronLeft className="h-4 w-4" />
            Geri
          </Button>
          <Button onClick={onStart} disabled={isLoading} size="lg">
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Başlatılıyor...
              </>
            ) : (
              <>İçe Aktarmayı Başlat</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StatTile({
  label,
  value,
  variant = "ok",
}: {
  label: string;
  value: number;
  variant?: "ok" | "warn" | "error";
}) {
  const color =
    variant === "error"
      ? "text-destructive"
      : variant === "warn"
        ? "text-warning"
        : "text-foreground";
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${color}`}>{value}</p>
    </div>
  );
}
