// Sprint 40 — GET /audit/export
//
// CSV snapshot of the audit log for the active org, optionally
// filtered by the same axes the /audit page exposes. The parser
// comes from the shared `../filter` module so the CSV matches
// what the user sees on screen row-for-row (modulo the cap).
//
// Access control: admins only, same as the /audit page. MANAGER /
// MEMBER / VIEWER roles get a 403 here — the gate lives on the
// server, not on the link visibility, because URLs are shareable.
//
// Row cap: unfiltered 2,000, filtered 10,000. Same shape as the
// Sprint 16 PO export. A year of real-world audit activity sits
// comfortably under 10k rows per org; if someone actually needs a
// multi-year dump they should run the prune script first (or ask
// for a second-pass export). We'd rather hand back a bounded
// response body than stream megabytes of JSON-metadata cells.

import { NextResponse } from "next/server";

import { Role } from "@/generated/prisma";
import type { AuditAction, AuditEntityType } from "@/lib/audit";
import { type CsvColumn, csvResponse, serializeCsv, todayIsoDate } from "@/lib/csv";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";

import {
  type AuditSearchParams,
  buildAuditWhere,
  hasAnyAuditFilter,
  parseAuditFilter,
} from "../filter";

const UNFILTERED_LIMIT = 2000;
const FILTERED_LIMIT = 10000;

type ExportRow = {
  when: string;
  actor: string;
  actorEmail: string;
  action: string;
  actionLabel: string;
  entityType: string;
  entityId: string;
  metadata: string;
};

const columns: CsvColumn<ExportRow>[] = [
  { header: "When (UTC)", value: (r) => r.when },
  { header: "Actor", value: (r) => r.actor },
  { header: "Actor email", value: (r) => r.actorEmail },
  { header: "Action", value: (r) => r.action },
  { header: "Action label", value: (r) => r.actionLabel },
  { header: "Entity type", value: (r) => r.entityType },
  { header: "Entity id", value: (r) => r.entityId },
  { header: "Metadata", value: (r) => r.metadata },
];

// Render metadata to a single-line key:value string that round-trips
// cleanly through a CSV cell. Identical output to what the /audit
// page shows in the truncated "Details" column, so a downloaded CSV
// lines up visually with the on-screen table.
function renderMetadataForCsv(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw !== "object") return String(raw);
  const parts: string[] = [];
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value == null) continue;
    if (typeof value === "object") {
      parts.push(`${key}={${Object.keys(value as object).join(",")}}`);
    } else {
      parts.push(`${key}=${String(value)}`);
    }
  }
  return parts.join(" | ");
}

export async function GET(request: Request) {
  const { membership } = await requireActiveMembership();

  // Same gate as the page. A 403 here is the canonical "you can't
  // export this" — the UI already hides the button from non-admins
  // because the page itself short-circuits on the forbidden path,
  // but we defend on the server too for direct URL access.
  if (membership.role !== Role.OWNER && membership.role !== Role.ADMIN) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const url = new URL(request.url);
  const rawParams: AuditSearchParams = {
    action: url.searchParams.get("action") ?? undefined,
    entityType: url.searchParams.get("entityType") ?? undefined,
    actor: url.searchParams.get("actor") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  };
  const filter = await parseAuditFilter(Promise.resolve(rawParams));
  const limit = hasAnyAuditFilter(filter) ? FILTERED_LIMIT : UNFILTERED_LIMIT;

  const events = await db.auditEvent.findMany({
    where: {
      organizationId: membership.organizationId,
      ...buildAuditWhere(filter),
    },
    include: {
      actor: { select: { name: true, email: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
  });

  // Pull the label bag once so we can render the "Action label"
  // column in the reviewer's locale without a lookup per row.
  const t = await getMessages();
  const actionLabels = t.audit.actions as Record<AuditAction, string>;

  const rows: ExportRow[] = events.map((ev) => {
    const actorName = ev.actor?.name ?? ev.actor?.email ?? (ev.actorId ? "Deleted user" : "System");
    const actorEmail = ev.actor?.email ?? "";
    // `ev.action` is a plain string at this level (Prisma stores it
    // as a SQL string), so we narrow with a cast at the label lookup
    // site. Fallback to the raw action if a row somehow carries a
    // value outside the current AuditAction union (e.g. a row
    // written by an older deploy before the union was extended).
    const label = (actionLabels as Record<string, string | undefined>)[ev.action] ?? ev.action;
    return {
      when: ev.createdAt.toISOString(),
      actor: actorName,
      actorEmail,
      action: ev.action,
      actionLabel: label,
      entityType: ev.entityType as AuditEntityType,
      entityId: ev.entityId ?? "",
      metadata: renderMetadataForCsv(ev.metadata),
    };
  });

  const csv = serializeCsv(rows, columns);
  return csvResponse(`oneace-audit-${todayIsoDate()}.csv`, csv);
}
