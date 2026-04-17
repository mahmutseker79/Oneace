"use client";

import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import type { FieldMapping } from "@/lib/migrations/core/types";
import { ArrowRight } from "lucide-react";
import { useMemo } from "react";

interface FieldMappingTableProps {
  sourceHeaders: string[];
  targetSchema: Record<string, string>;
  mappings: FieldMapping[];
  onChange: (mappings: FieldMapping[]) => void;
  previewRows: (string | null)[][];
}

const TRANSFORMS = [
  { key: "none", label: "None" },
  { key: "trim", label: "Trim whitespace" },
  { key: "uppercase", label: "UPPERCASE" },
  { key: "lowercase", label: "lowercase" },
  { key: "parseNumber", label: "Parse number" },
  { key: "parseIsoDate", label: "Parse ISO date" },
  { key: "parseBoolean", label: "Parse boolean" },
  { key: "splitPipe", label: "Split by | (array)" },
  { key: "splitComma", label: "Split by , (array)" },
] as const;

export function FieldMappingTable({
  sourceHeaders,
  targetSchema,
  mappings,
  onChange,
  previewRows,
}: FieldMappingTableProps) {
  const suggestedMappings = useMemo(() => {
    const suggested = new Map<string, string>();
    const targetKeys = Object.keys(targetSchema);

    sourceHeaders.forEach((source) => {
      const sourceLower = source.toLowerCase();
      const match = targetKeys.find((t) =>
        t.toLowerCase().includes(sourceLower),
      );
      if (match) {
        suggested.set(source, match);
      }
    });

    return suggested;
  }, [sourceHeaders, targetSchema]);

  const getPreviewForField = (sourceHeader: string): string[] => {
    const colIndex = sourceHeaders.indexOf(sourceHeader);
    if (colIndex === -1) return [];
    return previewRows
      .map((row) => row[colIndex])
      .filter((v): v is string => v !== null)
      .slice(0, 3);
  };

  const handleMappingChange = (
    sourceField: string,
    targetField: string | undefined,
  ) => {
    const newMappings = mappings.filter((m) => m.sourceField !== sourceField);
    if (targetField) {
      newMappings.push({
        sourceField,
        targetField,
      });
    }
    onChange(newMappings);
  };

  const handleTransformChange = (
    sourceField: string,
    transformKey: string | undefined,
  ) => {
    const mapping = mappings.find((m) => m.sourceField === sourceField);
    if (!mapping) return;

    const updated = mappings.map((m) =>
      m.sourceField === sourceField
        ? {
            ...m,
            transformKey:
              transformKey && transformKey !== "none"
                ? (transformKey as FieldMapping["transformKey"])
                : undefined,
          }
        : m,
    );
    onChange(updated);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b">
            <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
              Source Field
            </th>
            <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">
              Map To
            </th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
              Transform
            </th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
              Preview
            </th>
          </tr>
        </thead>
        <tbody>
          {sourceHeaders.map((header) => {
            const mapping = mappings.find((m) => m.sourceField === header);
            const suggested = suggestedMappings.get(header);
            const preview = getPreviewForField(header);

            return (
              <tr key={header} className="border-b hover:bg-muted/50">
                <td className="px-3 py-3 text-sm font-medium">{header}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center justify-center">
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </td>
                <td className="px-3 py-3">
                  <select
                    value={mapping?.targetField || suggested || ""}
                    onChange={(e) =>
                      handleMappingChange(header, e.target.value || undefined)
                    }
                    className="rounded border bg-background px-2 py-1 text-sm"
                  >
                    <option value="">Select target field...</option>
                    {Object.entries(targetSchema).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-3">
                  {mapping && (
                    <select
                      value={mapping.transformKey || "none"}
                      onChange={(e) =>
                        handleTransformChange(header, e.target.value)
                      }
                      className="rounded border bg-background px-2 py-1 text-sm"
                    >
                      {TRANSFORMS.map((t) => (
                        <option key={t.key} value={t.key}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="px-3 py-3">
                  {preview.length > 0 && (
                    <div className="space-y-1">
                      {preview.map((val, i) => (
                        <Badge key={i} variant="outline" className="text-[10px]">
                          {val.substring(0, 30)}
                          {val.length > 30 ? "..." : ""}
                        </Badge>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
