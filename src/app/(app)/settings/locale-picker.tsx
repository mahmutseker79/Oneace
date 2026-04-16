"use client";

import { useState, useTransition } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { setLocaleAction } from "./actions";

export type LocaleOption = { code: string; label: string };

type LocalePickerProps = {
  options: LocaleOption[];
  initial: string;
  savedLabel: string;
};

export function LocalePicker({ options, initial, savedLabel }: LocalePickerProps) {
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(next: string) {
    setValue(next);
    setSaved(false);
    setError(null);
    startTransition(async () => {
      const result = await setLocaleAction(next);
      if (!result.ok) {
        setError(result.error);
        setValue(initial);
        return;
      }
      setSaved(true);
    });
  }

  return (
    <div className="space-y-2">
      <Select value={value} onValueChange={handleChange} disabled={isPending}>
        <SelectTrigger className="md:max-w-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.code} value={opt.code}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {saved ? <p className="text-xs text-success">{savedLabel}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
