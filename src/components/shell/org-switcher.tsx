"use client";

import { Building2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { switchOrganizationAction } from "@/app/(app)/organizations/actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type OrgSwitcherOption = {
  id: string;
  name: string;
};

type OrgSwitcherProps = {
  options: OrgSwitcherOption[];
  activeId: string;
  label: string;
};

/**
 * Compact organization switcher rendered in the app header. Renders as a
 * read-only label when the user only belongs to a single organization
 * (which is the common case today, and avoids giving the false impression
 * that a dropdown affordance exists).
 *
 * On change we call `switchOrganizationAction` inside a transition and
 * then `router.refresh()` so the server layout re-runs and picks up the
 * new active membership. We avoid `router.push` because we want to stay
 * on the current URL — the user's expectation when switching orgs is
 * "show me the same page, but for the other org", not "bounce me back
 * to the dashboard".
 */
export function OrgSwitcher({ options, activeId, label }: OrgSwitcherProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(activeId);

  if (options.length <= 1) {
    const only = options[0];
    if (!only) return null;
    return (
      <div className="hidden md:flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
        <Building2 className="text-muted-foreground h-4 w-4" />
        <span className="text-muted-foreground">{label}:</span>
        <span className="font-medium">{only.name}</span>
      </div>
    );
  }

  function handleChange(next: string) {
    if (next === value) return;
    setValue(next);
    startTransition(async () => {
      const result = await switchOrganizationAction(next);
      if (!result.ok) {
        setValue(activeId);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="hidden md:block">
      <Select value={value} onValueChange={handleChange} disabled={isPending}>
        <SelectTrigger className="h-9 min-w-[10rem] text-sm" aria-label={label}>
          <Building2 className="text-muted-foreground mr-1 h-4 w-4" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.id} value={opt.id}>
              {opt.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
