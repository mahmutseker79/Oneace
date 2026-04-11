"use client";

// Sprint 40 — filter bar for /audit.
//
// Pattern mirrors Sprint 14's `MovementsFilterBar`: pure read state,
// URL is the source of truth, submit via `router.push` rather than a
// server action or a native form GET. The server page reads the
// parsed filter back out of searchParams on the next render.
//
// The only shape difference from movements is the actor axis — the
// list of available actors is populated server-side from a distinct
// query on the audit table itself (not the live member roster), so
// the filter can still surface ex-members whose history matters for
// compliance review. See the comment on the main page for why.

import { Filter, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ActionOption = { value: string; label: string };
type EntityTypeOption = { value: string; label: string };
type ActorOption = { id: string; label: string };

type AuditFilterBarLabels = {
  heading: string;
  actionLabel: string;
  actionAll: string;
  entityTypeLabel: string;
  entityTypeAll: string;
  actorLabel: string;
  actorAll: string;
  fromLabel: string;
  toLabel: string;
  apply: string;
  clear: string;
  invalidRange: string;
};

type AuditFilterBarProps = {
  initialAction: string;
  initialEntityType: string;
  initialActor: string;
  initialFrom: string;
  initialTo: string;
  actionOptions: ActionOption[];
  entityTypeOptions: EntityTypeOption[];
  actorOptions: ActorOption[];
  labels: AuditFilterBarLabels;
};

// Sentinel values for the "All …" options on each Select. The
// Select primitive rejects an empty string as an item value, so
// each axis gets its own distinct token translated to an empty
// query param on submit.
const ACTION_ALL = "__all__";
const ENTITY_ALL = "__all__";
const ACTOR_ALL = "__all__";

export function AuditFilterBar({
  initialAction,
  initialEntityType,
  initialActor,
  initialFrom,
  initialTo,
  actionOptions,
  entityTypeOptions,
  actorOptions,
  labels,
}: AuditFilterBarProps) {
  const router = useRouter();
  const [action, setAction] = useState(initialAction || ACTION_ALL);
  const [entityType, setEntityType] = useState(initialEntityType || ENTITY_ALL);
  const [actor, setActor] = useState(initialActor || ACTOR_ALL);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [error, setError] = useState<string | null>(null);

  const hasFilter = Boolean(
    initialAction || initialEntityType || initialActor || initialFrom || initialTo,
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (from && to && from > to) {
      setError(labels.invalidRange);
      return;
    }

    const params = new URLSearchParams();
    if (action && action !== ACTION_ALL) params.set("action", action);
    if (entityType && entityType !== ENTITY_ALL) params.set("entityType", entityType);
    if (actor && actor !== ACTOR_ALL) params.set("actor", actor);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    router.push(qs ? `/audit?${qs}` : "/audit");
  }

  function handleClear() {
    setAction(ACTION_ALL);
    setEntityType(ENTITY_ALL);
    setActor(ACTOR_ALL);
    setFrom("");
    setTo("");
    setError(null);
    router.push("/audit");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-card flex flex-col gap-3 rounded-lg border p-4"
      aria-label={labels.heading}
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <Filter className="text-muted-foreground h-4 w-4" />
        <span>{labels.heading}</span>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="audit-filter-action" className="text-xs">
            {labels.actionLabel}
          </Label>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger id="audit-filter-action">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ACTION_ALL}>{labels.actionAll}</SelectItem>
              {actionOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="audit-filter-entity" className="text-xs">
            {labels.entityTypeLabel}
          </Label>
          <Select value={entityType} onValueChange={setEntityType}>
            <SelectTrigger id="audit-filter-entity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ENTITY_ALL}>{labels.entityTypeAll}</SelectItem>
              {entityTypeOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="audit-filter-actor" className="text-xs">
            {labels.actorLabel}
          </Label>
          <Select value={actor} onValueChange={setActor}>
            <SelectTrigger id="audit-filter-actor">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ACTOR_ALL}>{labels.actorAll}</SelectItem>
              {actorOptions.map((opt) => (
                <SelectItem key={opt.id} value={opt.id}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <div className="space-y-1">
          <Label htmlFor="audit-filter-from" className="text-xs">
            {labels.fromLabel}
          </Label>
          <Input
            id="audit-filter-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            max={to || undefined}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="audit-filter-to" className="text-xs">
            {labels.toLabel}
          </Label>
          <Input
            id="audit-filter-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            min={from || undefined}
          />
        </div>

        <div className="flex gap-2 md:justify-end">
          <Button type="submit" size="sm">
            {labels.apply}
          </Button>
          {hasFilter ? (
            <Button type="button" size="sm" variant="ghost" onClick={handleClear}>
              <X className="h-3.5 w-3.5" />
              {labels.clear}
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="border-destructive/50 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
        >
          {error}
        </div>
      ) : null}
    </form>
  );
}
