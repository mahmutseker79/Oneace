/**
 * Phase MIG-S2 — Import start endpoint (background execution).
 *
 * POST /api/migrations/[id]/start  — kick off runMigrationImport in background, respond immediately
 */

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getAdapterFor } from "@/lib/migrations/core/adapter";
import { runMigrationImport } from "@/lib/migrations/core/importer";
import { defaultScopeOptions, parseScopeOptions } from "@/lib/migrations/core/scope-options";
import { loadStoredFiles } from "@/lib/migrations/core/source-file-store";
import { hasCapability } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import { requireActiveMembership } from "@/lib/session";
import { type NextRequest, NextResponse } from "next/server";

// Vercel: extend max execution from the 10s default so small imports
// (up to a few thousand rows) finish in-request. Larger imports still
// need a job queue — this just raises the synchronous ceiling.
export const maxDuration = 300;

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

    // Rate limit: max 10 starts per org per 24h
    const rateLimitKey = `migration:start:${membership.organizationId}`;
    const rl = await rateLimit(rateLimitKey, {
      max: 10,
      windowSeconds: 86400,
    });
    if (!rl.ok) {
      return NextResponse.json(
        {
          error: "RATE_LIMIT",
          message: "Too many import attempts. Try again later.",
          retryAfter: rl.reset,
        },
        { status: 429, headers: { "Retry-After": String(rl.reset) } },
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

    // State check: VALIDATED or FAILED (retry)
    if (!["VALIDATED", "FAILED"].includes(job.status)) {
      return NextResponse.json(
        {
          error: "INVALID_STATE",
          message: "Migration must be validated before starting",
          currentStatus: job.status,
        },
        { status: 409 },
      );
    }

    // Mark as IMPORTING
    await db.migrationJob.update({
      where: { id },
      data: { status: "IMPORTING", startedAt: new Date() },
    });

    // Audit fix (Critical-3): MigrationJob has NO `snapshot` column —
    // only sourceFiles, fieldMappings, validationReport, importResults,
    // scopeOptions. The only path from stored artefacts → ParsedSnapshot
    // goes through the adapter: load the files, then call adapter.parse.
    // scopeOptions comes off the job but MUST be re-validated through
    // `parseScopeOptions` before use (defence against bad/stale JSON).
    const uploadedFiles = await loadStoredFiles({ db }, membership.organizationId, id);
    const scope = parseScopeOptions(job.scopeOptions ?? defaultScopeOptions());

    // Run import synchronously within the request lifetime. Vercel
    // serverless functions terminate as soon as the handler returns, so
    // fire-and-forget would silently drop imports. For small CSVs this
    // finishes well within the function budget; large imports will need
    // a proper job queue.
    try {
      const adapter = await getAdapterFor(job.sourcePlatform);
      const fieldMappings = (job.fieldMappings ?? {}) as Record<string, unknown>;
      if (fieldMappings.credentials && typeof fieldMappings.credentials === "object") {
        (fieldMappings.credentials as Record<string, unknown>).organizationId =
          membership.organizationId;
      }
      // biome-ignore lint/suspicious/noExplicitAny: adapter signatures vary per source
      const adapterAny = adapter as any;
      const snapshot = adapterAny.parseWithScope
        ? await adapterAny.parseWithScope(uploadedFiles, fieldMappings, scope)
        : await adapterAny.parse(uploadedFiles, fieldMappings);

      const result = await runMigrationImport({
        db,
        migrationJobId: id,
        organizationId: membership.organizationId,
        snapshot,
        scopeOptions: scope,
        auditUserId: session.user.id,
      });

      await recordAudit({
        organizationId: membership.organizationId,
        actorId: session.user.id,
        action: result.success ? "migration.completed" : "migration.failed",
        entityType: "migration_job",
        entityId: id,
        metadata: {
          source: job.sourcePlatform,
          phaseCount: result.phases.length,
          success: result.success,
        },
      });
    } catch (err) {
      console.error("Migration import failed:", err);
      await db.migrationJob.update({
        where: { id },
        data: {
          status: "FAILED",
          notes: `Import error: ${err instanceof Error ? err.message : "Unknown error"}`,
        },
      });
      return NextResponse.json(
        {
          error: "IMPORT_FAILED",
          message: err instanceof Error ? err.message : "Unknown error",
        },
        { status: 500 },
      );
    }

    // Audit log — same signature fix as inside the background closure.
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "migration.started",
      entityType: "migration_job",
      entityId: id,
      metadata: { source: job.sourcePlatform, via: "http" },
    });

    return NextResponse.json({ migration: { id, status: "IMPORTING" } }, { status: 202 });
  } catch (error) {
    console.error("POST /api/migrations/[id]/start error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to start migration" },
      { status: 500 },
    );
  }
}
