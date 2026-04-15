"use client";

import { Building2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { switchOrganizationAction } from "@/app/(app)/organizations/actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
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
  createLabel: string;
};

// Sentinel value used by the "Create new organization…" item at the
// bottom of the dropdown. We use a double-underscore prefix because
// Prisma cuid ids never start with underscores, so there's no way a
// real org id will collide with this.
const CREATE_SENTINEL = "__create__";

/**
 * Compact organization switcher rendered in the app header. Always
 * renders as a Select (even with a single org) because the dropdown
 * now carries the "Create new organization…" action in addition to
 * the list of memberships — the create affordance should be visible
 * from day one, not only after the user belongs to multiple orgs.
 *
 * On change of an org id we call `switchOrganizationAction` inside a
 * transition and then `router.refresh()` so the server layout re-runs
 * and picks up the new active membership. We avoid `router.push`
 * because the user's expectation when switching orgs is "show me the
 * same page, but for the other org", not "bounce me back to the
 * dashboard".
 *
 * On change to the create sentinel we navigate to `/organizations/new`
 * immediately and do NOT flip the active-org cookie — cookie flip
 * happens in `createOrganizationAction` once the new org actually
 * exists, inside the same request that writes it.
 */
export function OrgSwitcher({ options, activeId, label, createLabel }: OrgSwitcherProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(activeId);

  if (options.length === 0) return null;

  function handleChange(next: string) {
    if (next === CREATE_SENTINEL) {
      // Revert the controlled value so the trigger keeps showing the
      // active org while the navigation is in flight.
      setValue(activeId);
      router.push("/organizations/new");
      return;
    }
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
          <SelectSeparator />
          <SelectItem value={CREATE_SENTINEL}>
            <span className="flex items-center gap-2">
              <Plus className="h-3.5 w-3.5" />
              {createLabel}
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
