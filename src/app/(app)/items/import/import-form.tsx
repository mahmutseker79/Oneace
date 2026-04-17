"use client";

import { AlertTriangle, CheckCircle2, Download, FileUp, Loader2, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";

import { useUnsavedWarning } from "@/hooks/use-unsaved-warning";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { autoMapHeaders, parseCsv } from "@/lib/csv/parse";
import {
  IMPORT_FIELD_ALIASES,
  type ImportValidationIssue,
  validateImportRows,
} from "@/lib/validation/item-import";

import { importItemsAction } from "../actions";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type ImportFieldKey =
  | "sku"
  | "name"
  | "description"
  | "barcode"
  | "unit"
  | "costPrice"
  | "salePrice"
  | "currency"
  | "reorderPoint"
  | "reorderQty"
  | "status";

const FIELD_ORDER: ImportFieldKey[] = [
  "sku",
  "name",
  "description",
  "barcode",
  "unit",
  "costPrice",
  "salePrice",
  "currency",
  "reorderPoint",
  "reorderQty",
  "status",
];

const REQUIRED_FIELDS: ImportFieldKey[] = ["sku", "name"];

const UNMAPPED_VALUE = "__unmapped__";
const MAX_ROWS = 5000;
const PREVIEW_LIMIT = 50;

export type ImportItemsLabels = {
  steps: {
    upload: string;
    map: string;
    preview: string;
    done: string;
  };
  upload: {
    title: string;
    help: string;
    pickFile: string;
    dropHint: string;
    template: string;
    templateHint: string;
    parseError: string;
    fileTooLarge: string;
    noRowsFound: string;
  };
  map: {
    title: string;
    help: string;
    sourceColumn: string;
    targetField: string;
    unmapped: string;
    requiredMissing: string;
    continue: string;
    back: string;
    fields: Record<ImportFieldKey, string>;
  };
  preview: {
    title: string;
    help: (ready: number, rejected: number) => string;
    readyTab: string;
    rejectedTab: string;
    conflictsTab: string;
    conflictsHelp: string;
    noConflicts: string;
    commit: string;
    back: string;
    empty: string;
    rowNumber: string;
    sku: string;
    name: string;
    unit: string;
    cost: string;
    sale: string;
    status: string;
    errors: string;
  };
  success: {
    title: string;
    body: (inserted: number) => string;
    skipped: (invalid: number, conflicts: number) => string;
    viewItems: string;
    importMore: string;
  };
  errors: {
    noRows: string;
    tooManyRows: string;
    allRowsInvalid: string;
    allRowsConflict: string;
    commitFailed: string;
    genericError: string;
  };
};

type Step = "upload" | "map" | "preview" | "done";

// Shape of the mapped preview row — one entry per row of the CSV.
type PreviewRow = {
  rowIndex: number;
  mapped: Record<string, unknown>;
  ok: boolean;
  errors: string[];
  sku: string | null;
};

type SuccessState = {
  inserted: number;
  skippedInvalid: number;
  skippedConflicts: number;
  conflictSkus: string[];
};

// ---------------------------------------------------------------------------
// Template CSV — downloaded by the "starter template" button so the user
// always has a working reference when building their file.
// ---------------------------------------------------------------------------
const TEMPLATE_CSV = [
  "sku,name,description,barcode,unit,costPrice,salePrice,currency,reorderPoint,reorderQty,status",
  'WDGT-001,Widget Mk1,"Our classic widget, red",0123456789012,each,4.50,9.99,USD,10,50,ACTIVE',
  'WDGT-002,Widget Mk2,"Upgraded widget, blue",0123456789029,each,5.25,12.50,USD,5,25,ACTIVE',
].join("\n");

// ---------------------------------------------------------------------------

export function ImportItemsForm({ labels }: { labels: ImportItemsLabels }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState<Step>("upload");
  // Phase 10.5 — unsaved changes: warn when file is loaded but not yet imported.
  // We use the hook directly without setDirty wiring because isDirty
  // is managed from the file-chosen step below.
  const [fileName, setFileName] = useState<string | null>(null);
  const [header, setHeader] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<ImportFieldKey, number | null>>(() =>
    emptyMapping(),
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [isPending, startTransition] = useTransition();
  const { reset: resetImportUnsaved, setDirty: setImportDirty } = useUnsavedWarning();

  // ---- STEP 1: Upload --------------------------------------------------

  function triggerFilePick() {
    fileInputRef.current?.click();
  }

  async function handleFileChosen(file: File) {
    setError(null);
    try {
      const text = await file.text();
      const parsed = parseCsv(text, { hasHeader: true, maxRows: MAX_ROWS + 1 });

      if (parsed.header === null || parsed.header.length === 0) {
        setError(labels.upload.noRowsFound);
        return;
      }
      if (parsed.rows.length === 0) {
        setError(labels.upload.noRowsFound);
        return;
      }
      if (parsed.rows.length > MAX_ROWS) {
        setError(labels.upload.fileTooLarge);
        return;
      }

      // Auto-map the source headers to canonical fields. Any field we can't
      // auto-match stays null and the user has to pick one (or skip).
      const auto = autoMapHeaders(parsed.header, IMPORT_FIELD_ALIASES);
      const next: Record<ImportFieldKey, number | null> = emptyMapping();
      for (const field of FIELD_ORDER) {
        const idx = auto[field];
        if (typeof idx === "number") {
          next[field] = idx;
        }
      }

      setFileName(file.name);
      setHeader(parsed.header);
      setRawRows(parsed.rows);
      setMapping(next);
      setStep("map");
      setImportDirty(true); // File loaded — warn if user navigates away
    } catch (caught) {
      console.error("[ImportItemsForm] parse failed", caught);
      setError(labels.upload.parseError);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "oneace-items-template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ---- STEP 2: Map -----------------------------------------------------

  function setFieldMapping(field: ImportFieldKey, sourceIdx: number | null) {
    setMapping((prev) => ({ ...prev, [field]: sourceIdx }));
  }

  const missingRequired = useMemo(
    () => REQUIRED_FIELDS.some((f) => mapping[f] === null),
    [mapping],
  );

  function goToPreview() {
    setError(null);
    if (missingRequired) {
      setError(labels.map.requiredMissing);
      return;
    }
    setStep("preview");
  }

  // ---- STEP 3: Preview -------------------------------------------------

  // Build the canonical record array from the raw CSV rows using the chosen
  // column mapping, then validate client-side to partition into ready /
  // rejected. The same validation runs on the server — this is only for
  // preview. We do NOT trust this on the server.
  const previewData = useMemo(() => {
    if (step !== "preview" && step !== "done") {
      return {
        rows: [] as PreviewRow[],
        ready: 0,
        rejected: 0,
        invalid: [] as ImportValidationIssue[],
      };
    }
    const mapped: Record<string, unknown>[] = rawRows.map((row) => {
      const obj: Record<string, unknown> = {};
      for (const field of FIELD_ORDER) {
        const idx = mapping[field];
        if (idx !== null && idx !== undefined && idx >= 0 && idx < row.length) {
          obj[field] = row[idx];
        }
      }
      return obj;
    });

    const result = validateImportRows(mapped);
    const invalidByIndex = new Map<number, ImportValidationIssue>();
    for (const issue of result.invalid) {
      invalidByIndex.set(issue.rowIndex, issue);
    }

    const rows: PreviewRow[] = mapped.map((m, rowIndex) => {
      const issue = invalidByIndex.get(rowIndex);
      return {
        rowIndex,
        mapped: m,
        ok: !issue,
        errors: issue ? issue.errors : [],
        sku: typeof m.sku === "string" ? m.sku : null,
      };
    });

    return {
      rows,
      ready: result.valid.length,
      rejected: result.invalid.length,
      invalid: result.invalid,
    };
  }, [rawRows, mapping, step]);

  function commitImport() {
    setError(null);
    const payload = previewData.rows.map((r) => r.mapped);
    startTransition(async () => {
      const result = await importItemsAction({ rows: payload });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess({
        inserted: result.inserted,
        skippedInvalid: result.skippedInvalid,
        skippedConflicts: result.skippedConflicts,
        conflictSkus: result.conflictSkus,
      });
      setStep("done");
      resetImportUnsaved(); // Import complete — no longer unsaved
      router.refresh();
    });
  }

  function resetWizard() {
    setStep("upload");
    setFileName(null);
    setHeader([]);
    setRawRows([]);
    setMapping(emptyMapping());
    setError(null);
    setSuccess(null);
    resetImportUnsaved();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ---- Render ----------------------------------------------------------

  return (
    <div className="space-y-6">
      <StepIndicator current={step} labels={labels.steps} />

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {step === "upload" ? (
        <UploadStep
          labels={labels.upload}
          onFile={handleFileChosen}
          onTriggerPick={triggerFilePick}
          onDownloadTemplate={downloadTemplate}
          fileInputRef={fileInputRef}
        />
      ) : null}

      {step === "map" ? (
        <MapStep
          labels={labels.map}
          fileName={fileName}
          header={header}
          mapping={mapping}
          onChange={setFieldMapping}
          onBack={resetWizard}
          onContinue={goToPreview}
          missingRequired={missingRequired}
        />
      ) : null}

      {step === "preview" ? (
        <PreviewStep
          labels={labels.preview}
          data={previewData}
          isPending={isPending}
          onBack={() => setStep("map")}
          onCommit={commitImport}
        />
      ) : null}

      {step === "done" && success !== null ? (
        <SuccessStep labels={labels.success} state={success} onImportMore={resetWizard} />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StepIndicator({
  current,
  labels,
}: {
  current: Step;
  labels: ImportItemsLabels["steps"];
}) {
  const order: Step[] = ["upload", "map", "preview", "done"];
  const currentIdx = order.indexOf(current);
  const entries: { key: Step; label: string }[] = [
    { key: "upload", label: labels.upload },
    { key: "map", label: labels.map },
    { key: "preview", label: labels.preview },
    { key: "done", label: labels.done },
  ];

  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm">
      {entries.map((entry, idx) => {
        const isDone = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        return (
          <li key={entry.key} className="flex items-center gap-2">
            <span
              className={
                isCurrent
                  ? "rounded-md border border-primary bg-primary/10 px-3 py-1 font-medium text-primary"
                  : isDone
                    ? "rounded-md border border-border bg-muted/40 px-3 py-1 text-muted-foreground"
                    : "rounded-md border border-border px-3 py-1 text-muted-foreground"
              }
            >
              {entry.label}
            </span>
            {idx < entries.length - 1 ? <span className="text-muted-foreground">→</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

function UploadStep({
  labels,
  onFile,
  onTriggerPick,
  onDownloadTemplate,
  fileInputRef,
}: {
  labels: ImportItemsLabels["upload"];
  onFile: (file: File) => void;
  onTriggerPick: () => void;
  onDownloadTemplate: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>{labels.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{labels.help}</p>
          <button
            type="button"
            onClick={onTriggerPick}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) onFile(file);
            }}
            className={`flex w-full flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-10 text-sm transition-colors ${
              isDragging
                ? "border-primary bg-primary/5 text-primary"
                : "border-border text-muted-foreground hover:border-primary/50 hover:bg-muted/30"
            }`}
          >
            <Upload className="h-8 w-8" />
            <span className="font-medium text-foreground">{labels.pickFile}</span>
            <span className="text-xs">{labels.dropHint}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv,application/vnd.ms-excel"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFile(file);
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileUp className="h-4 w-4" />
            {labels.template}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{labels.templateHint}</p>
          <Button type="button" variant="outline" onClick={onDownloadTemplate}>
            <Download className="h-4 w-4" />
            {labels.template}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function MapStep({
  labels,
  fileName,
  header,
  mapping,
  onChange,
  onBack,
  onContinue,
  missingRequired,
}: {
  labels: ImportItemsLabels["map"];
  fileName: string | null;
  header: string[];
  mapping: Record<ImportFieldKey, number | null>;
  onChange: (field: ImportFieldKey, sourceIdx: number | null) => void;
  onBack: () => void;
  onContinue: () => void;
  missingRequired: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{labels.title}</CardTitle>
        {fileName ? <p className="text-sm text-muted-foreground">{fileName}</p> : null}
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-muted-foreground">{labels.help}</p>

        <div className="grid gap-3 md:grid-cols-2">
          {FIELD_ORDER.map((field) => {
            const current = mapping[field];
            const value =
              current === null || current === undefined ? UNMAPPED_VALUE : String(current);
            return (
              <div key={field} className="space-y-1">
                <label htmlFor={`map-${field}`} className="text-sm font-medium text-foreground">
                  {labels.fields[field]}
                </label>
                <Select
                  value={value}
                  onValueChange={(next) => {
                    if (next === UNMAPPED_VALUE) {
                      onChange(field, null);
                    } else {
                      onChange(field, Number(next));
                    }
                  }}
                >
                  <SelectTrigger id={`map-${field}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNMAPPED_VALUE}>{labels.unmapped}</SelectItem>
                    {header.map((h, idx) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: CSV column index is the value
                      <SelectItem key={idx} value={String(idx)}>
                        {h || `Column ${idx + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-3">
          <Button type="button" variant="ghost" onClick={onBack}>
            {labels.back}
          </Button>
          <Button type="button" onClick={onContinue} disabled={missingRequired}>
            {labels.continue}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PreviewStep({
  labels,
  data,
  isPending,
  onBack,
  onCommit,
}: {
  labels: ImportItemsLabels["preview"];
  data: {
    rows: PreviewRow[];
    ready: number;
    rejected: number;
    invalid: ImportValidationIssue[];
  };
  isPending: boolean;
  onBack: () => void;
  onCommit: () => void;
}) {
  const readyRows = data.rows.filter((r) => r.ok).slice(0, PREVIEW_LIMIT);
  const rejectedRows = data.rows.filter((r) => !r.ok).slice(0, PREVIEW_LIMIT);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{labels.title}</CardTitle>
        <p className="text-sm text-muted-foreground">{labels.help(data.ready, data.rejected)}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue="ready">
          <TabsList>
            <TabsTrigger value="ready">
              {labels.readyTab} ({data.ready})
            </TabsTrigger>
            <TabsTrigger value="rejected">
              {labels.rejectedTab} ({data.rejected})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="ready" className="mt-4">
            {readyRows.length === 0 ? (
              <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                {labels.empty}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-14">{labels.rowNumber}</TableHead>
                      <TableHead>{labels.sku}</TableHead>
                      <TableHead>{labels.name}</TableHead>
                      <TableHead>{labels.unit}</TableHead>
                      <TableHead className="text-right">{labels.cost}</TableHead>
                      <TableHead className="text-right">{labels.sale}</TableHead>
                      <TableHead>{labels.status}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {readyRows.map((row) => (
                      <TableRow key={row.rowIndex}>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.rowIndex + 2}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {asText(row.mapped.sku)}
                        </TableCell>
                        <TableCell>{asText(row.mapped.name)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {asText(row.mapped.unit) || "each"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-xs">
                          {asText(row.mapped.costPrice)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-xs">
                          {asText(row.mapped.salePrice)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {asText(row.mapped.status) || "ACTIVE"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
          <TabsContent value="rejected" className="mt-4">
            {rejectedRows.length === 0 ? (
              <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                {labels.empty}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-14">{labels.rowNumber}</TableHead>
                      <TableHead>{labels.sku}</TableHead>
                      <TableHead>{labels.errors}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rejectedRows.map((row) => (
                      <TableRow key={row.rowIndex}>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.rowIndex + 2}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{row.sku ?? "—"}</TableCell>
                        <TableCell className="text-xs text-destructive">
                          {row.errors.join("; ")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-between gap-3">
          <Button type="button" variant="ghost" onClick={onBack} disabled={isPending}>
            {labels.back}
          </Button>
          <Button type="button" onClick={onCommit} disabled={isPending || data.ready === 0}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {labels.commit}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SuccessStep({
  labels,
  state,
  onImportMore,
}: {
  labels: ImportItemsLabels["success"];
  state: SuccessState;
  onImportMore: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">{labels.title}</h2>
          <p className="text-sm text-muted-foreground">{labels.body(state.inserted)}</p>
          {state.skippedInvalid > 0 || state.skippedConflicts > 0 ? (
            <p className="text-xs text-muted-foreground">
              {labels.skipped(state.skippedInvalid, state.skippedConflicts)}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button asChild>
            <Link href="/items">{labels.viewItems}</Link>
          </Button>
          <Button type="button" variant="outline" onClick={onImportMore}>
            {labels.importMore}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyMapping(): Record<ImportFieldKey, number | null> {
  return {
    sku: null,
    name: null,
    description: null,
    barcode: null,
    unit: null,
    costPrice: null,
    salePrice: null,
    currency: null,
    reorderPoint: null,
    reorderQty: null,
    status: null,
  };
}

function asText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}
