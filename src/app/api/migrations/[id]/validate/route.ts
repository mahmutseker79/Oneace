/**
 * Phase MIG-S2 — Validation endpoint.
 *
 * POST /api/migrations/[id]/validate  — run adapter.parse + adapter.validate
 */

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getAdapterFor } from "@/lib/migrations/core/adapter";
import { parseScopeOptions } from "@/lib/migrations/core/scope-options";
import { loadStoredFiles } from "@/lib/migrations/core/source-file-store";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";
import { type NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { session, membership } = await requireActiveMembership();

    // Check permission
    if (!hasCapability(membership.role, "integrations.connect")) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Insufficient permissions" },
        { status: 403 },
      );
    }

    // Fetch migration job
    const job = await db.migrationJob.findUnique({
      where: { id },
    });

    if (!job) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Migration not found" },
        { status: 404 },
      );
    }

    // Tenant check
    if (job.organizationId !== membership.organizationId) {
      return NextResponse.json({ error: "FORBIDDEN", message: "Access denied" }, { status: 403 });
    }

    // State check: MAPPING_REVIEW or FAILED (allow retry)
    if (!["MAPPING_REVIEW", "FAILED"].includes(job.status)) {
      return NextResponse.json(
        {
          error: "INVALID_STATE",
          message: "Cannot validate in current state",
          currentStatus: job.status,
        },
        { status: 409 },
      );
    }

    // API-mode sources don't have uploaded files; they pull from external API
    // using credentials stashed in fieldMappings. File-mode sources need the
    // uploaded artifacts. We load files but tolerate empty for API mode.
    const API_SOURCES = new Set(["CIN7", "SOS_INVENTORY", "QUICKBOOKS_ONLINE", "INFLOW_API"]);
    const isApiMode = API_SOURCES.has(job.sourcePlatform);

    const uploadedFiles = await loadStoredFiles({ db }, membership.organizationId, id);

    if (!isApiMode && (!uploadedFiles || uploadedFiles.length === 0)) {
      return NextResponse.json(
        { error: "BAD_REQUEST", message: "No files found in migration" },
        { status: 400 },
      );
    }

    // Get adapter and parse. File-mode adapters use `adapter.parse(files)`,
    // API-mode adapters may implement `parseWithScope(files, fieldMappings, scope)`.
    // We pass fieldMappings as the optional 2nd arg to `parse` too (file-mode
    // adapters ignore it) so API adapters can extract credentials.
    const adapter = await getAdapterFor(job.sourcePlatform);
    const fieldMappingsRaw = (job.fieldMappings as Record<string, unknown>) ?? {};
    const scope = parseScopeOptions(job.scopeOptions);
    const files = uploadedFiles ?? [];

    // biome-ignore lint/suspicious/noExplicitAny: adapter signatures vary per source
    const adapterAny = adapter as any;
    const snapshot = adapterAny.parseWithScope
      ? await adapterAny.parseWithScope(files, fieldMappingsRaw, scope)
      : await adapterAny.parse(files, fieldMappingsRaw);

    // Parse stored mappings and scope options
    const fieldMappings = job.fieldMappings as any[];
    const scopeOptions = parseScopeOptions(job.scopeOptions);

    // Run validation
    const validationReport = await Promise.resolve(
      adapter.validate(snapshot, fieldMappings, scopeOptions),
    );

    // Check for errors
    const hasErrors = validationReport.issues.some((i) => i.severity === "ERROR");

    // Update job: VALIDATING → VALIDATED or FAILED
    // Store validationReport only; snapshot is re-parsed on demand to save storage
    const nextStatus = hasErrors ? "FAILED" : "VALIDATED";
    const updated = await db.migrationJob.update({
      where: { id },
      data: {
        status: nextStatus,
        validationReport: validationReport,
      },
    });

    // Audit log
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "migration.validation_complete",
      entityType: "migration_job",
      entityId: id,
      metadata: {
        resultStatus: nextStatus,
        errorCount: validationReport.issues.filter((i) => i.severity === "ERROR").length,
      },
    });

    return NextResponse.json({ migration: updated, validationReport }, { status: 200 });
  } catch (error) {
    console.error("POST /api/migrations/[id]/validate error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Validation failed" },
      { status: 500 },
    );
  }
}
