// Sprint 36 — /audit page.
//
// Read-only viewer for the append-only AuditEvent log. Two properties
// matter for this page and informed every design choice below:
//
//   1. Admins only. OWNER and ADMIN can read it; MANAGER / MEMBER /
//      VIEWER cannot. This matches the existing users-table gating
//      (Sprint 20/32): anything that exposes who-did-what is a team
//      governance surface, not a daily-workflow surface.
//
//   2. Cursor-paginated, newest-first. The audit log grows monotonically
//      and a filter-and-sort UI is out of scope for Sprint 36 — it's
//      MVP triage, not a BI tool. We fetch PAGE_SIZE + 1 rows to detect
//      a next-page, render the first PAGE_SIZE, and emit a "Load more"
//      link carrying the last row's id as the `cursor` query param.
//      Next.js 15 treats this as a fresh server render with a stable
//      URL (nice for back-button behaviour) and avoids a client bundle.
//
// The actor join is `include: { actor: ... }` so a deleted user still
// shows as "Deleted user" rather than 404ing the row — the AuditEvent
// schema uses `onDelete: SetNull` on the actor FK for exactly this.

import { History } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Role } from "@/generated/prisma";
import type { AuditAction } from "@/lib/audit";
import { db } from "@/lib/db";
import { getMessages, getRegion } from "@/lib/i18n";
import { hasPlanCapability } from "@/lib/plans";
import { requireActiveMembership } from "@/lib/session";

// Phase 3 — audit log filters.
type SearchParams = Promise<{
  cursor?: string;
  action?: string; // action prefix: "billing" | "item" | "warehouse" | etc.
  from?: string; // ISO date string (inclusive)
  to?: string; // ISO date string (inclusive)
}>;

// Deliberately modest — a warehouse OWNER eyeballing "what happened
// today?" rarely needs more than the top 50. Bumping this is cheap
// (single index read), but bigger pages hurt mobile layout more than
// they help.
const PAGE_SIZE = 50;

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

  // Phase 13.2 — audit log requires BUSINESS plan
  const auditPlan = membership.organization.plan as "FREE" | "PRO" | "BUSINESS";
  if (!hasPlanCapability(auditPlan, "auditLog")) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{t.audit.heading}</h1>
          <p className="text-muted-foreground">{t.audit.subtitle}</p>
        </div>
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            The audit log is available on the Business plan. Upgrade to access your full activity
            history.{" "}
            <Link href="/settings/billing" className="text-primary hover:underline">
              Upgrade now
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

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

  const params = (await searchParams) ?? {};
  const cursor = params.cursor;
  const actionFilter = params.action?.trim() ?? "";
  const fromFilter = params.from?.trim() ?? "";
  const toFilter = params.to?.trim() ?? "";

  // Phase 3 — build filter where clause.
  const auditWhere = {
    organizationId: membership.organizationId,
    ...(actionFilter ? { action: { startsWith: actionFilter } } : {}),
    ...(fromFilter || toFilter
      ? {
          createdAt: {
            ...(fromFilter ? { gte: new Date(fromFilter) } : {}),
            ...(toFilter ? { lte: new Date(`${toFilter}T23:59:59.999Z`) } : {}),
          },
        }
      : {}),
  };

  // Fetch PAGE_SIZE + 1 rows so we can detect whether there's a next
  // page without a second count query. `cursor` is the id of the last
  // row from the previous page; Prisma's `cursor + skip: 1` idiom
  // continues from the record *after* that id on the composite
  // (createdAt desc, id) order.
  const rows = await db.auditEvent.findMany({
    where: auditWhere,
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
  });

  const hasMore = rows.length > PAGE_SIZE;
  const visibleRows = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const lastId = visibleRows.at(-1)?.id;

  const dateTimeFmt = new Intl.DateTimeFormat(region.numberLocale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t.audit.heading}</h1>
        <p className="text-muted-foreground">{t.audit.subtitle}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.audit.heading}</CardTitle>
          <CardDescription>{t.audit.subtitle}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Phase 3 — filter bar (GET form, server-side filtering) */}
          <form method="GET" className="flex flex-wrap gap-3 border-b pb-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Action type</Label>
              <Select name="action" defaultValue={actionFilter || "all"}>
                <SelectTrigger className="h-8 w-40 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  <SelectItem value="billing">Billing</SelectItem>
                  <SelectItem value="item">Items</SelectItem>
                  <SelectItem value="warehouse">Warehouses</SelectItem>
                  <SelectItem value="stock_count">Stock counts</SelectItem>
                  <SelectItem value="stock_movement">Movements</SelectItem>
                  <SelectItem value="purchase_order">Purchase orders</SelectItem>
                  <SelectItem value="member">Members</SelectItem>
                  <SelectItem value="organization">Organization</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">From date</Label>
              <Input
                name="from"
                type="date"
                defaultValue={fromFilter}
                className="h-8 w-36 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">To date</Label>
              <Input name="to" type="date" defaultValue={toFilter} className="h-8 w-36 text-xs" />
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit" size="sm" variant="outline" className="h-8 text-xs">
                Apply
              </Button>
              {actionFilter || fromFilter || toFilter ? (
                <Button asChild size="sm" variant="ghost" className="h-8 text-xs">
                  <Link href="/audit">Clear</Link>
                </Button>
              ) : null}
            </div>
          </form>

          {visibleRows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <History className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">{t.audit.empty}</p>
            </div>
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
                    const actorLabel = row.actor
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
                        <TableCell className="text-sm">{actorLabel}</TableCell>
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

          {hasMore && lastId ? (
            <div className="flex justify-center pt-2">
              {(() => {
                const sp = new URLSearchParams();
                sp.set("cursor", lastId);
                if (actionFilter) sp.set("action", actionFilter);
                if (fromFilter) sp.set("from", fromFilter);
                if (toFilter) sp.set("to", toFilter);
                return (
                  <Link
                    href={`/audit?${sp.toString()}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {t.audit.loadMore}
                  </Link>
                );
              })()}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
