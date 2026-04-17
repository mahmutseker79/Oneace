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

    // Fire background import (no await).
    void (async () => {
      try {
        const adapter = await getAdapterFor(job.sourcePlatform);
        // API adapters (Cin7 / SOS / QBO / inFlow-API) read their
        // credentials out of fieldMappings.credentials. The QBO
        // adapter's "reuse existing integration" path also looks for
        // `organizationId` on that credentials blob; inject it here
        // server-side so the client never needs to pass it in.
        const fieldMappings = (job.fieldMappings ?? {}) as Record<string, unknown>;
        if (fieldMappings.credentials && typeof fieldMappings.credentials === "object") {
          (fieldMappings.credentials as Record<string, unknown>).organizationId =
            membership.organizationId;
        }
        const snapshot = await adapter.parse(uploadedFiles, fieldMappings);

        const result = await runMigrationImport({
          db,
          migrationJobId: id,
          organizationId: membership.organizationId,
          snapshot,
          scopeOptions: scope,
          auditUserId: session.user.id,
        });

        // runMigrationImport already writes status + importResults + audit
        // events. This post-fire audit is deliberately a SECOND, distinct
        // event tied to the HTTP request lifecycle so ops can distinguish
        // "import finished" from "the user's /start request was accepted".
        // Audit fix (Critical-2 signature): recordAudit expects flat fields
        // (organizationId, actorId, action, entityType, entityId, metadata),
        // not nested actor/entity objects.
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
        console.error("Background migration import failed:", err);
        // Mark as FAILED
        await db.migrationJob.update({
          where: { id },
          data: {
            status: "FAILED",
            notes: `Import error: ${err instanceof Error ? err.message : "Unknown error"}`,
          },
        });
      }
    })();

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
