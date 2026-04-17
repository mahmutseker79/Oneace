"use client";

/**
 * Phase C3.1 — Label Canvas
 *
 * Interactive label preview that renders a physically accurate mock-up of
 * the label at its configured dimensions, with toggleable fields and
 * barcode format. State is local; the parent page passes initial values
 * and reads final values back for persistence via server action.
 *
 * Units: we do all math in millimeters internally and convert to CSS px
 * at a fixed scale (3 px/mm gives a readable preview on desktop and maps
 * cleanly back to the 72-dpi PDF generator at print time).
 */

import { GripVertical, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label as UILabel } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PX_PER_MM = 3;

export type LabelType = "BIN" | "ITEM" | "WAREHOUSE" | "CUSTOM";

export type BarcodeFormat = "CODE128" | "CODE39" | "EAN13" | "UPC_A" | "ITF14" | "QR";

export type LabelFieldKind = "barcode" | "sku" | "name" | "binCode" | "warehouseCode" | "custom";

export interface LabelField {
  id: string;
  kind: LabelFieldKind;
  label: string;
  // Normalized (0..1) position within the label — independent of mm size.
  x: number;
  y: number;
  fontSize: number;
}

export interface LabelCanvasValue {
  name: string;
  type: LabelType;
  widthMm: number;
  heightMm: number;
  barcodeFormat: BarcodeFormat;
  fields: LabelField[];
}

export interface LabelCanvasProps {
  initial?: Partial<LabelCanvasValue>;
  /** Fired on every change so the parent can persist or mirror state. */
  onChange?: (value: LabelCanvasValue) => void;
  /** Optional sample values to drive preview text (e.g. a real SKU). */
  sample?: Partial<Record<LabelFieldKind, string>>;
}

const DEFAULT_FIELDS: LabelField[] = [
  { id: "f-sku", kind: "sku", label: "SKU", x: 0.05, y: 0.1, fontSize: 11 },
  { id: "f-barcode", kind: "barcode", label: "Barcode", x: 0.05, y: 0.4, fontSize: 10 },
  { id: "f-name", kind: "name", label: "Name", x: 0.05, y: 0.8, fontSize: 9 },
];

const SAMPLE_DEFAULTS: Record<LabelFieldKind, string> = {
  barcode: "||||| ||| |||| || |||",
  sku: "SKU-12345",
  name: "Sample Item Name",
  binCode: "A-01-03",
  warehouseCode: "WH-MAIN",
  custom: "Custom text",
};

const FIELD_KINDS: Array<{ value: LabelFieldKind; label: string }> = [
  { value: "barcode", label: "Barcode" },
  { value: "sku", label: "SKU" },
  { value: "name", label: "Item name" },
  { value: "binCode", label: "Bin code" },
  { value: "warehouseCode", label: "Warehouse code" },
  { value: "custom", label: "Custom text" },
];

export function LabelCanvas({ initial, onChange, sample }: LabelCanvasProps) {
  const [name, setName] = useState<string>(initial?.name ?? "Standard Label");
  const [type, setType] = useState<LabelType>(initial?.type ?? "BIN");
  const [widthMm, setWidthMm] = useState<number>(initial?.widthMm ?? 50);
  const [heightMm, setHeightMm] = useState<number>(initial?.heightMm ?? 30);
  const [barcodeFormat, setBarcodeFormat] = useState<BarcodeFormat>(
    initial?.barcodeFormat ?? "CODE128",
  );
  const [fields, setFields] = useState<LabelField[]>(
    initial?.fields && initial.fields.length > 0 ? initial.fields : DEFAULT_FIELDS,
  );

  const value: LabelCanvasValue = useMemo(
    () => ({ name, type, widthMm, heightMm, barcodeFormat, fields }),
    [name, type, widthMm, heightMm, barcodeFormat, fields],
  );

  // Call onChange on every state mutation via the useEffect-ish pattern:
  // fire synchronously inside each setter so parents stay in sync.
  function commit(next: LabelCanvasValue) {
    onChange?.(next);
  }

  function updateField(id: string, patch: Partial<LabelField>) {
    const next = fields.map((f) => (f.id === id ? { ...f, ...patch } : f));
    setFields(next);
    commit({ ...value, fields: next });
  }

  function removeField(id: string) {
    const next = fields.filter((f) => f.id !== id);
    setFields(next);
    commit({ ...value, fields: next });
  }

  function addField() {
    const id = `f-${Date.now()}`;
    const next: LabelField[] = [
      ...fields,
      { id, kind: "custom", label: "Custom", x: 0.05, y: 0.5, fontSize: 10 },
    ];
    setFields(next);
    commit({ ...value, fields: next });
  }

  function moveField(id: string, direction: -1 | 1) {
    const index = fields.findIndex((f) => f.id === id);
    if (index === -1) return;
    const swapWith = index + direction;
    if (swapWith < 0 || swapWith >= fields.length) return;
    const next = [...fields];
    const current = next[index];
    const other = next[swapWith];
    if (!current || !other) return;
    next[index] = other;
    next[swapWith] = current;
    setFields(next);
    commit({ ...value, fields: next });
  }

  const pxWidth = widthMm * PX_PER_MM;
  const pxHeight = heightMm * PX_PER_MM;
  const sampleText = { ...SAMPLE_DEFAULTS, ...sample };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Left column — configuration */}
      <div className="space-y-6 lg:col-span-1">
        <section className="space-y-4 rounded-md border p-4">
          <h3 className="text-sm font-semibold">Template settings</h3>
          <div className="space-y-2">
            <UILabel htmlFor="lbl-name">Name</UILabel>
            <Input
              id="lbl-name"
              value={name}
              maxLength={120}
              onChange={(e) => {
                setName(e.target.value);
                commit({ ...value, name: e.target.value });
              }}
            />
          </div>
          <div className="space-y-2">
            <UILabel htmlFor="lbl-type">Type</UILabel>
            <Select
              value={type}
              onValueChange={(v) => {
                const next = v as LabelType;
                setType(next);
                commit({ ...value, type: next });
              }}
            >
              <SelectTrigger id="lbl-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BIN">Bin label</SelectItem>
                <SelectItem value="ITEM">Item label</SelectItem>
                <SelectItem value="WAREHOUSE">Warehouse label</SelectItem>
                <SelectItem value="CUSTOM">Custom label</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <UILabel htmlFor="lbl-w">Width (mm)</UILabel>
              <Input
                id="lbl-w"
                type="number"
                min={10}
                max={500}
                step={0.5}
                value={widthMm}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (!Number.isFinite(n)) return;
                  setWidthMm(n);
                  commit({ ...value, widthMm: n });
                }}
              />
            </div>
            <div className="space-y-2">
              <UILabel htmlFor="lbl-h">Height (mm)</UILabel>
              <Input
                id="lbl-h"
                type="number"
                min={10}
                max={500}
                step={0.5}
                value={heightMm}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (!Number.isFinite(n)) return;
                  setHeightMm(n);
                  commit({ ...value, heightMm: n });
                }}
              />
            </div>
          </div>
          <div className="space-y-2">
            <UILabel htmlFor="lbl-bc">Barcode format</UILabel>
            <Select
              value={barcodeFormat}
              onValueChange={(v) => {
                const next = v as BarcodeFormat;
                setBarcodeFormat(next);
                commit({ ...value, barcodeFormat: next });
              }}
            >
              <SelectTrigger id="lbl-bc">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CODE128">Code 128</SelectItem>
                <SelectItem value="CODE39">Code 39</SelectItem>
                <SelectItem value="EAN13">EAN-13</SelectItem>
                <SelectItem value="UPC_A">UPC-A</SelectItem>
                <SelectItem value="ITF14">ITF-14</SelectItem>
                <SelectItem value="QR">QR Code</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>

        <section className="space-y-3 rounded-md border p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Fields</h3>
            <Button size="sm" variant="outline" onClick={addField}>
              <Plus className="mr-1 h-3 w-3" />
              Add
            </Button>
          </div>
          <ul className="space-y-2">
            {fields.map((field, index) => (
              <li key={field.id} className="space-y-2 rounded-md border bg-muted/30 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-3 w-3 text-muted-foreground" />
                    <Select
                      value={field.kind}
                      onValueChange={(v) => updateField(field.id, { kind: v as LabelFieldKind })}
                    >
                      <SelectTrigger className="h-7 w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_KINDS.map((k) => (
                          <SelectItem key={k.value} value={k.value}>
                            {k.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Move up"
                      disabled={index === 0}
                      onClick={() => moveField(field.id, -1)}
                    >
                      ↑
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Move down"
                      disabled={index === fields.length - 1}
                      onClick={() => moveField(field.id, 1)}
                    >
                      ↓
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Remove"
                      onClick={() => removeField(field.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <NumberField
                    label="x %"
                    value={Math.round(field.x * 100)}
                    onChange={(v) => updateField(field.id, { x: clamp01(v / 100) })}
                  />
                  <NumberField
                    label="y %"
                    value={Math.round(field.y * 100)}
                    onChange={(v) => updateField(field.id, { y: clamp01(v / 100) })}
                  />
                  <NumberField
                    label="font"
                    value={field.fontSize}
                    onChange={(v) => updateField(field.id, { fontSize: clamp(v, 6, 48) })}
                  />
                </div>
              </li>
            ))}
          </ul>
          {fields.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No fields yet. Click &quot;Add&quot; to place one.
            </p>
          )}
        </section>
      </div>

      {/* Right column — preview */}
      <div className="lg:col-span-2">
        <div className="rounded-md border bg-muted/20 p-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Preview · {widthMm}mm × {heightMm}mm · {barcodeFormat}
            </p>
            <p className="text-xs text-muted-foreground">{fields.length} field(s)</p>
          </div>
          <div className="flex justify-center">
            <div
              className="relative overflow-hidden border border-dashed border-muted-foreground/60 bg-white shadow-sm"
              style={{
                width: `${pxWidth}px`,
                height: `${pxHeight}px`,
              }}
            >
              {fields.map((field) => {
                const left = `${field.x * 100}%`;
                const top = `${field.y * 100}%`;
                const text = sampleText[field.kind] ?? field.label;
                const isBarcode = field.kind === "barcode";
                return (
                  <div
                    key={field.id}
                    className="absolute whitespace-nowrap font-mono text-black"
                    style={{
                      left,
                      top,
                      fontSize: `${field.fontSize}px`,
                      letterSpacing: isBarcode ? "-0.5px" : undefined,
                      fontFamily: isBarcode ? "Libre Barcode 128, monospace" : undefined,
                    }}
                  >
                    {text}
                  </div>
                );
              })}
              {fields.length === 0 && (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  Empty label — add a field on the left.
                </div>
              )}
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Preview renders at {PX_PER_MM}px/mm. Actual print will match physical dimensions.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <Input
        type="number"
        value={value}
        className="h-7 text-xs"
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
      />
    </div>
  );
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function clamp01(n: number): number {
  return clamp(n, 0, 1);
}
