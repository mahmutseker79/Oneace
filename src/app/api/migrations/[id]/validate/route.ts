/**
 * Phase MIG-S2 — Validation endpoint.
 *
 * POST /api/migrations/[id]/validate  — run adapter.parse + adapter.validate
 */

import { db } from "@/lib/db";
import { requireActiveMembership } from "@/lib/session";
import { hasCapability } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { getAdapterFor } from "@/lib/migrations/core/adapter";
import { loadStoredFiles } from "@/lib/migrations/core/source-file-store";
import {
  parseScopeOptions,
} from "@/lib/migrations/core/scope-options";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params;
    const { membership, user } = await requireActiveMembership();

    // Check permission
    if (!hasCapability(membership.role, "integrations.connect")) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Fetch migration job
    const job = await db.migrationJob.findUnique({
      where: { id },
    });

    if (!job) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Migration not found" },
        { status: 404 }
      );
    }

    // Tenant check
    if (job.organizationId !== membership.organizationId) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Access denied" },
        { status: 403 }
      );
    }

    // State check: MAPPING_REVIEW or FAILED (allow retry)
    if (!["MAPPING_REVIEW", "FAILED"].includes(job.status)) {
      return NextResponse.json(
        {
          error: "INVALID_STATE",
          message: "Cannot validate in current state",
          currentStatus: job.status,
        },
        { status: 409 }
      );
    }

    // Load files
    const uploadedFiles = await loadStoredFiles(
      { db },
      membership.organizationId,
      id
    );

    if (!uploadedFiles || uploadedFiles.length === 0) {
      return NextResponse.json(
        { error: "BAD_REQUEST", message: "No files found in migration" },
        { status: 400 }
      );
    }

    // Get adapter and parse
    const adapter = await getAdapterFor(job.sourcePlatform);
    const snapshot = await adapter.parse(uploadedFiles);

    // Parse stored mappings and scope options
    const fieldMappings = job.fieldMappings as any[];
    const scopeOptions = parseScopeOptions(job.scopeOptions);

    // Run validation
    const validationReport = await Promise.resolve(
      adapter.validate(snapshot, fieldMappings, scopeOptions)
    );

    // Check for errors
    const hasErrors = validationReport.issues.some((i) => i.severity === "ERROR");

    // Update job: VALIDATING → VALIDATED or FAILED
    const nextStatus = hasErrors ? "FAILED" : "VALIDATED";
    const updated = await db.migrationJob.update({
      where: { id },
      data: {
        status: nextStatus,
        snapshot: snapshot,
        validationReport: validationReport,
      },
    });

    // Audit log
    await recordAudit({
      db,
      organizationId: membership.organizationId,
      action: "migration.validation_complete",
      actor: user,
      entity: { type: "MigrationJob", id },
      metadata: {
        resultStatus: nextStatus,
        errorCount: validationReport.issues.filter(
          (i) => i.severity === "ERROR"
        ).length,
      },
    });

    return NextResponse.json(
      { migration: updated, validationReport },
      { status: 200 }
    );
  } catch (error) {
    console.error("POST /api/migrations/[id]/validate error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Validation failed" },
      { status: 500 }
    );
  }
}
