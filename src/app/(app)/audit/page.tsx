// Sprint 36 — /audit page.
// Sprint 40 — filter bar + CSV export + cursor pagination carries filter state.
//
// Read-only viewer for the append-only AuditEvent log. Three properties
// matter for this page and informed every design choice below:
//
//   1. Admins only. OWNER and ADMIN can read it; MANAGER / MEMBER /
//      VIEWER cannot. This matches the existing users-table gating
//      (Sprint 20/32): anything that exposes who-did-what is a team
//      governance surface, not a daily-workflow surface.
//
//   2. Cursor-paginated, newest-first. The audit log grows monotonically
//      and scales past a simple offset cleanly. We fetch PAGE_SIZE + 1
//      rows to detect a next-page, render the first PAGE_SIZE, and emit
//      a "Load more" link carrying the last row's id as the `cursor`
//      query param. Next.js 15 treats this as a fresh server render with
//      a stable URL (nice for back-button behaviour) and avoids a
//      client bundle. Sprint 40 preserves this pattern: the `cursor`
//      rides alongside the filter params so "Load more" continues the
//      same filtered view rather than resetting to the full log.
//
//   3. Filterable by axis (Sprint 40). Reviewers asked for "show me
//      everything in purchase orders last week" and "everyone touched
//      by [user] last quarter" — both are table-stakes for compliance
//      review. The filter bar is pure read state (URL is the source of
//      truth), the parser lives in `./filter.ts` (shared with the
//      /audit/export route so CSV always matches on-screen results),
//      and the actor dropdown is pre-populated from a small distinct
//      query so admins can pick without typing a cuid.
//
// The actor join on the main query is `include: { actor: ... }` so a
// deleted user still shows as "Deleted user" rather than 404ing the
// row — the AuditEvent schema uses `onDelete: SetNull` on the actor FK
// for exactly this.

import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Role } from "@/generated/prisma";
import type { AuditAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { getMessages, getRegion } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";

import { AuditFilterBar } from "./audit-filter-bar";
import {
  AUDIT_ACTION_VALUES,
  AUDIT_ENTITY_TYPE_VALUES,
  type AuditSearchParams,
  buildAuditWhere,
  filterToParams,
  hasAnyAuditFilter,
  parseAuditFilter,
} from "./filter";

type SearchParams = Promise<AuditSearchParams>;

// Deliberately modest — a warehouse OWNER eyeballing "what happened
// today?" rarely needs more than the top 50. With the filter bar
// shipped in Sprint 40 a narrower page size hurts less: reviewers
// who need to see hundreds of rows either narrow the filter or
// export the CSV.
const PAGE_SIZE = 50;

// Distinct-actor query cap. The dropdown shows everyone who's ever
// acted in this org's audit log, not the current member roster —
// ex-members who were later removed still appear in history and
// we want reviewers to filter by them too. Capped at 200 because
// anything larger than a `<select>` length humans can scan is a
// sign that the filter bar has outgrown its UI shape, and we'd
// rather add a search-as-you-type picker at that point than quietly
// truncate.
const ACTOR_DROPDOWN_CAP = 200;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.audit.metaTitle };
}

// Small helper: given an action string, look up the human-readable
// label from the i18n catalog, falling back to the raw action if we
// somehow encounter an unknown value (new action added to recordAudit
// without a matching catalog key — the type system should prevent this
// but we keep the render robust).
function actionLabel(action: string, catalog: Record<AuditAction, string>): string {
  return (catalog as Record<string, string | undefined>)[action] ?? action;
}

// Render a metadata JSON blob as a terse "key: value" inline list. We
// deliberately don't pretty-print nested objects — the goal is that
// the reviewer can scan a page and spot anomalies, not inspect full
// diffs. The detail page for an entity (items, orgs, etc.) is where
// full structured payloads belong.
function renderMetadata(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw !== "object") return String(raw);
  const parts: string[] = [];
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value == null) continue;
    if (typeof value === "object") {
      // Nested object — just show the keys so the reader sees "before,
      // after" without a wall of JSON.
      parts.push(`${key}: {${Object.keys(value as object).join(", ")}}`);
    } else {
      parts.push(`${key}: ${String(value)}`);
    }
  }
  return parts.join(" · ");
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();
  const region = await getRegion();

  // Admins only. Short-circuits before the DB query.
  if (membership.role !== Role.OWNER && membership.role !== Role.ADMIN) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{t.audit.heading}</h1>
          <p className="text-muted-foreground">{t.audit.subtitle}</p>
        </div>
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            {t.audit.forbidden}
          </CardContent>
        </Card>
      </div>
    );
  }

  const filter = await parseAuditFilter(searchParams ?? Promise.resolve({}));
  const filterActive = hasAnyAuditFilter(filter);

  // Cursor lives on searchParams but is not part of the filter axes
  // (it's ephemeral pagination state). Read it separately so the
  // filter serialization helper doesn't have to know about it.
  const rawCursor: AuditSearchParams = await (searchParams ??
    Promise.resolve({} as AuditSearchParams));
  const cursor = Array.isArray(rawCursor.cursor) ? rawCursor.cursor[0] : rawCursor.cursor;

  // Fetch actor options in parallel with the main query. This is the
  // list the filter bar's actor dropdown shows. We deliberately ask
  // Prisma for all distinct `actorId` values in the org's audit log
  // (including nulls, which we then filter out), capped at
  // ACTOR_DROPDOWN_CAP, then join back to User for display. A member
  // roster join would miss ex-members whose history we still need to
  // surface for compliance review.
  const whereForResults = {
    organizationId: membership.organizationId,
    ...buildAuditWhere(filter),
  };

  const [rows, actorRows] = await Promise.all([
    db.auditEvent.findMany({
      where: whereForResults,
      include: {
        actor: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: PAGE_SIZE + 1,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
    }),
    // `distinct` on actorId gives us unique actors without a GROUP BY.
    // The join to User is handled by a second `findMany` below keyed
    // on the ids we collect here — simpler than a raw SQL query and
    // still bounded to ACTOR_DROPDOWN_CAP rows.
    db.auditEvent.findMany({
      where: { organizationId: membership.organizationId },
      distinct: ["actorId"],
      select: { actorId: true },
      take: ACTOR_DROPDOWN_CAP,
    }),
  ]);

  const actorIds = actorRows.map((r) => r.actorId).filter((id): id is string => id !== null);
  const actorUsers =
    actorIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
  const actorOptions = actorUsers
    .map((u) => ({ id: u.id, label: u.name ?? u.email ?? u.id }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const hasMore = rows.length > PAGE_SIZE;
  const visibleRows = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const lastId = visibleRows.at(-1)?.id;

  const dateTimeFmt = new Intl.DateTimeFormat(region.numberLocale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  // Build a filter-preserving URL for "Load more" and "Download CSV".
  // The filter params are identical across both, which is the whole
  // reason we have `filterToParams` — it's the shared contract.
  const filterQueryString = filterToParams(filter).toString();
  const loadMoreHref = (() => {
    if (!hasMore || !lastId) return null;
    const params = filterToParams(filter);
    params.set("cursor", lastId);
    return `/audit?${params.toString()}`;
  })();
  const exportHref =
    filterQueryString.length > 0 ? `/audit/export?${filterQueryString}` : "/audit/export";

  // Action + entity-type options for the filter bar come directly
  // from the union-derived arrays in `./filter`. We hand over the
  // full label bag so the client component never has to reach into
  // the i18n module itself — keeps the client bundle small and the
  // label source-of-truth on the server.
  const actionOptions = AUDIT_ACTION_VALUES.map((value) => ({
    value,
    label: actionLabel(value, t.audit.actions),
  }));
  const entityTypeOptions = AUDIT_ENTITY_TYPE_VALUES.map((value) => ({
    value,
    label: t.audit.entityTypes[value],
  }));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t.audit.heading}</h1>
        <p className="text-muted-foreground">{t.audit.subtitle}</p>
      </div>

      <AuditFilterBar
        initialAction={filter.rawAction}
        initialEntityType={filter.rawEntityType}
        initialActor={filter.rawActor}
        initialFrom={filter.rawFrom}
        initialTo={filter.rawTo}
        actionOptions={actionOptions}
        entityTypeOptions={entityTypeOptions}
        actorOptions={actorOptions}
        labels={{
          heading: t.audit.filter.heading,
          actionLabel: t.audit.filter.actionLabel,
          actionAll: t.audit.filter.actionAll,
          entityTypeLabel: t.audit.filter.entityTypeLabel,
          entityTypeAll: t.audit.filter.entityTypeAll,
          actorLabel: t.audit.filter.actorLabel,
          actorAll: t.audit.filter.actorAll,
          fromLabel: t.audit.filter.fromLabel,
          toLabel: t.audit.filter.toLabel,
          apply: t.audit.filter.apply,
          clear: t.audit.filter.clear,
          invalidRange: t.audit.filter.invalidRange,
        }}
      />

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>{t.audit.heading}</CardTitle>
            <CardDescription>{t.audit.subtitle}</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <a href={exportHref} rel="nofollow">
              {t.audit.exportButton}
            </a>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {visibleRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {filterActive ? t.audit.filter.emptyFiltered : t.audit.empty}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.audit.columnWhen}</TableHead>
                    <TableHead>{t.audit.columnActor}</TableHead>
                    <TableHead>{t.audit.columnAction}</TableHead>
                    <TableHead>{t.audit.columnEntity}</TableHead>
                    <TableHead>{t.audit.columnDetails}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRows.map((row) => {
                    const actorLabelText = row.actor
                      ? (row.actor.name ?? row.actor.email)
                      : row.actorId
                        ? t.audit.deletedUser
                        : t.audit.systemActor;
                    const details = renderMetadata(row.metadata);
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {dateTimeFmt.format(row.createdAt)}
                        </TableCell>
                        <TableCell className="text-sm">{actorLabelText}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-normal">
                            {actionLabel(row.action, t.audit.actions)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.entityType}
                          {row.entityId ? ` · ${row.entityId.slice(0, 8)}` : ""}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-md truncate">
                          {details || t.audit.noEntity}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {loadMoreHref ? (
            <div className="flex justify-center pt-2">
              <Link
                href={loadMoreHref}
                className="text-sm font-medium text-primary hover:underline"
              >
                {t.audit.loadMore}
              </Link>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
