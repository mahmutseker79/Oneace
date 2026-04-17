/**
 * Phase MIG-S2 — File detection and field suggestion endpoint.
 *
 * POST /api/migrations/[id]/detect  — run adapter.detectFiles + adapter.suggestMappings
 */

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getAdapterFor } from "@/lib/migrations/core/adapter";
import { loadStoredFiles } from "@/lib/migrations/core/source-file-store";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";
import { type NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { membership, user } = await requireActiveMembership();

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

    // State check: FILES_UPLOADED
    if (job.status !== "FILES_UPLOADED") {
      return NextResponse.json(
        {
          error: "INVALID_STATE",
          message: "Files must be uploaded first",
          currentStatus: job.status,
        },
        { status: 409 },
      );
    }

    // Load files from storage
    const uploadedFiles = await loadStoredFiles({ db }, membership.organizationId, id);

    if (!uploadedFiles || uploadedFiles.length === 0) {
      return NextResponse.json(
        { error: "BAD_REQUEST", message: "No files found in migration" },
        { status: 400 },
      );
    }

    // Get adapter
    const adapter = await getAdapterFor(job.sourcePlatform);

    // Run detection
    const detections = await adapter.detectFiles(uploadedFiles);

    // Parse snapshot to get field suggestions
    const snapshot = await adapter.parse(uploadedFiles);
    const fieldMappings = adapter.suggestMappings(snapshot);

    // Transition to MAPPING_REVIEW
    const updated = await db.migrationJob.update({
      where: { id },
      data: {
        status: "MAPPING_REVIEW",
        detectedFiles: detections,
        fieldMappings,
      },
    });

    // Audit log
    await recordAudit({
      db,
      organizationId: membership.organizationId,
      action: "migration.detection_complete",
      actor: user,
      entity: { type: "MigrationJob", id },
      metadata: { detectedFileCount: detections.length },
    });

    return NextResponse.json(
      {
        migration: updated,
        detections,
        suggestedMappings: fieldMappings,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("POST /api/migrations/[id]/detect error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "File detection failed" },
      { status: 500 },
    );
  }
}
