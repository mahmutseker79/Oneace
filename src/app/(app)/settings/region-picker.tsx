"use client";

import { useMemo, useState, useTransition } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { setRegionAction } from "./actions";

export type RegionOption = {
  code: string;
  label: string;
  currency: string;
  timeZone: string;
};

type RegionPickerProps = {
  options: RegionOption[];
  initial: string;
  labels: { currency: string; timeZone: string; saved: string };
};

export function RegionPicker({ options, initial, labels }: RegionPickerProps) {
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => options.find((o) => o.code === value) ?? options[0],
    [options, value],
  );

  function handleChange(next: string) {
    setValue(next);
    setSaved(false);
    setError(null);
    startTransition(async () => {
      const result = await setRegionAction(next);
      if (!result.ok) {
        setError(result.error);
        setValue(initial);
        return;
      }
      setSaved(true);
    });
  }

  return (
    <div className="space-y-3">
      <Select value={value} onValueChange={handleChange} disabled={isPending}>
        <SelectTrigger className="md:max-w-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.code} value={opt.code}>
              {opt.label} · {opt.currency}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selected ? (
        <dl className="grid gap-2 text-sm md:grid-cols-2 md:max-w-md">
          <div>
            <dt className="text-xs text-muted-foreground">{labels.currency}</dt>
            <dd className="font-mono">{selected.currency}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{labels.timeZone}</dt>
            <dd className="font-mono">{selected.timeZone}</dd>
          </div>
        </dl>
      ) : null}

      {saved ? <p className="text-xs text-success">{labels.saved}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
