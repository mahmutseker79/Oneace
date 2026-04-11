// Sprint 41 — client component for the notification preferences form.
//
// One row per (NotificationType × cadence selector). At MVP there is
// only a single type (LOW_STOCK_DIGEST), but the form is built as a
// loop over `rows` so adding PO_STATUS_CHANGED / STOCK_COUNT_COMPLETED
// in a later sprint is a one-line change on the server side.
//
// The frequency picker uses the existing shadcn Select. Save is
// triggered on change (no explicit submit button) and ackowledged
// with a "Saved" flash next to the label — same ergonomic pattern as
// the Sprint 19 locale picker.

"use client";

import { useState, useTransition } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { updateNotificationPreferenceAction } from "./actions";

export type PreferenceRow = {
  type: string;
  title: string;
  description: string;
  frequency: string;
};

export type FrequencyOption = {
  value: string;
  label: string;
};

type PreferencesFormProps = {
  rows: PreferenceRow[];
  frequencyOptions: FrequencyOption[];
  labels: {
    frequencyAria: string;
    saved: string;
    saving: string;
    errorFallback: string;
  };
};

export function PreferencesForm({ rows, frequencyOptions, labels }: PreferencesFormProps) {
  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <PreferenceRowControl
          key={row.type}
          row={row}
          frequencyOptions={frequencyOptions}
          labels={labels}
        />
      ))}
    </div>
  );
}

type PreferenceRowControlProps = {
  row: PreferenceRow;
  frequencyOptions: FrequencyOption[];
  labels: PreferencesFormProps["labels"];
};

function PreferenceRowControl({ row, frequencyOptions, labels }: PreferenceRowControlProps) {
  const [value, setValue] = useState(row.frequency);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(next: string) {
    setValue(next);
    setSaved(false);
    setError(null);
    startTransition(async () => {
      const form = new FormData();
      form.set("type", row.type);
      form.set("frequency", next);
      try {
        const result = await updateNotificationPreferenceAction(form);
        if (result.ok) {
          setSaved(true);
          // Let the "Saved" flash linger for a beat so the user sees
          // it even on very fast local networks. 1.8s is the same
          // duration the locale picker uses.
          setTimeout(() => setSaved(false), 1800);
        } else {
          setError(result.error);
        }
      } catch (_err) {
        setError(labels.errorFallback);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <p className="text-sm font-medium">{row.title}</p>
        <p className="text-muted-foreground text-sm">{row.description}</p>
        <div className="text-muted-foreground text-xs">
          {isPending ? labels.saving : saved ? labels.saved : error ? error : null}
        </div>
      </div>
      <div className="min-w-[180px]">
        <Select value={value} onValueChange={handleChange}>
          <SelectTrigger aria-label={labels.frequencyAria}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {frequencyOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
