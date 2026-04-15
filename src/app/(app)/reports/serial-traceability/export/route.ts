import { db } from "@/lib/db";
import { hasPlanCapability } from "@/lib/plans";
import { requireActiveMembership } from "@/lib/session";
import { serializeCsv, csvResponse, todayIsoDate } from "@/lib/csv";
import type { CsvColumn } from "@/lib/csv";

type ExportRow = {
  date: string;
  action: string;
  fromLocation: string;
  toLocation: string;
  user: string;
  reference: string;
  note: string;
};

export async function GET(request: Request) {
  const { membership } = await requireActiveMembership();

  const exportPlan = membership.organization.plan as "FREE" | "PRO" | "BUSINESS";
  if (!hasPlanCapability(exportPlan, "exports")) {
    return new Response(
      JSON.stringify({ error: "Exports are available on Pro and Business plans." }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }

  const url = new URL(request.url);
  const serialNumber = url.searchParams.get("serial");

  if (!serialNumber) {
    const columns: CsvColumn<ExportRow>[] = [
      { header: "Date", value: (r) => r.date },
      { header: "Action", value: (r) => r.action },
      { header: "From Location", value: (r) => r.fromLocation },
      { header: "To Location", value: (r) => r.toLocation },
      { header: "User", value: (r) => r.user },
      { header: "Reference", value: (r) => r.reference },
      { header: "Note", value: (r) => r.note },
    ];
    const csv = serializeCsv([], columns);
    const filename = `serial-traceability-${todayIsoDate()}.csv`;
    return csvResponse(filename, csv);
  }

  const serial = await db.serialNumber.findFirst({
    where: {
      organizationId: membership.organizationId,
      serialNumber: {
        contains: serialNumber,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
    },
  });

  if (!serial) {
    const columns: CsvColumn<ExportRow>[] = [
      { header: "Date", value: (r) => r.date },
      { header: "Action", value: (r) => r.action },
      { header: "From Location", value: (r) => r.fromLocation },
      { header: "To Location", value: (r) => r.toLocation },
      { header: "User", value: (r) => r.user },
      { header: "Reference", value: (r) => r.reference },
      { header: "Note", value: (r) => r.note },
    ];
    const csv = serializeCsv([], columns);
    const filename = `serial-traceability-${todayIsoDate()}.csv`;
    return csvResponse(filename, csv);
  }

  const history = await db.serialHistory.findMany({
    where: { serialNumberId: serial.id },
    select: {
      action: true,
      fromLocation: true,
      toLocation: true,
      performedAt: true,
      performedBy: { select: { name: true } },
      reference: true,
      note: true,
    },
    orderBy: { performedAt: "asc" },
  });

  const dateFmt = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const rows: ExportRow[] = history.map((h) => ({
    date: dateFmt.format(h.performedAt),
    action: h.action,
    fromLocation: h.fromLocation ?? "",
    toLocation: h.toLocation ?? "",
    user: h.performedBy?.name ?? "",
    reference: h.reference ?? "",
    note: h.note ?? "",
  }));

  const columns: CsvColumn<ExportRow>[] = [
    { header: "Date", value: (r) => r.date },
    { header: "Action", value: (r) => r.action },
    { header: "From Location", value: (r) => r.fromLocation },
    { header: "To Location", value: (r) => r.toLocation },
    { header: "User", value: (r) => r.user },
    { header: "Reference", value: (r) => r.reference },
    { header: "Note", value: (r) => r.note },
  ];

  const csv = serializeCsv(rows, columns);
  const filename = `serial-${serialNumber}-${todayIsoDate()}.csv`;

  return csvResponse(filename, csv);
}
