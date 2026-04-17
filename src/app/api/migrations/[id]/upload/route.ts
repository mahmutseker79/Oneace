/**
 * Phase MIG-S2 — File upload endpoint.
 *
 * POST /api/migrations/[id]/upload  — accept multipart file upload, store in sourceFiles
 */

import { db } from "@/lib/db";
import { requireActiveMembership } from "@/lib/session";
import { hasCapability } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { storeUploadedFiles } from "@/lib/migrations/core/source-file-store";
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

    // Rate limit: max 10 uploads per org per 24h
    const rateLimitKey = `migration:upload:${membership.organizationId}`;
    const rl = await rateLimit(rateLimitKey, {
      max: 10,
      windowSeconds: 86400,
    });
    if (!rl.ok) {
      return NextResponse.json(
        {
          error: "RATE_LIMIT",
          message: "Too many uploads. Try again later.",
          retryAfter: rl.reset,
        },
        { status: 429, headers: { "Retry-After": String(rl.reset) } }
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

    // State check: PENDING or FILES_UPLOADED
    if (!["PENDING", "FILES_UPLOADED"].includes(job.status)) {
      return NextResponse.json(
        {
          error: "INVALID_STATE",
          message: "Cannot upload files in current state",
          currentStatus: job.status,
        },
        { status: 409 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const files = formData.getAll("file");

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "BAD_REQUEST", message: "No files provided" },
        { status: 400 }
      );
    }

    // Convert File[] to UploadedFile[]
    const uploadedFiles = await Promise.all(
      files.map(async (file) => {
        if (!(file instanceof File)) {
          throw new Error("Invalid file object");
        }
        return {
          filename: file.name,
          mimeType: file.type || undefined,
          buffer: Buffer.from(await file.arrayBuffer()),
        };
      })
    );

    // Store files (handles blob upload or inline base64)
    const storedFiles = await storeUploadedFiles(
      { db },
      job.organizationId,
      id,
      uploadedFiles
    );

    // Update job status and sourceFiles
    const updated = await db.migrationJob.update({
      where: { id },
      data: {
        status: "FILES_UPLOADED",
        sourceFiles: storedFiles,
      },
    });

    // Audit log
    await recordAudit({
      db,
      organizationId: membership.organizationId,
      action: "migration.files_uploaded",
      actor: user,
      entity: { type: "MigrationJob", id },
      metadata: { fileCount: files.length },
    });

    return NextResponse.json({ migration: updated }, { status: 200 });
  } catch (error) {
    console.error("POST /api/migrations/[id]/upload error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to upload files" },
      { status: 500 }
    );
  }
}
