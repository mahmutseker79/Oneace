/**
 * Phase MIG-S2 — Field mapping save endpoint.
 *
 * PUT /api/migrations/[id]/mapping  — save field mappings and scope options
 */

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { MigrationScopeOptionsSchema } from "@/lib/migrations/core/scope-options";
import type { FieldMapping } from "@/lib/migrations/core/types";
import { hasCapability } from "@/lib/permissions";
import { encryptCredentials, isEncryptedCredentials } from "@/lib/secure/credentials";
import { requireActiveMembership } from "@/lib/session";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

const SaveMappingSchema = z.object({
  fieldMappings: z.array(
    z.object({
      sourceField: z.string(),
      targetField: z.string(),
      transformKey: z
        .enum([
          "trim",
          "uppercase",
          "lowercase",
          "parseNumber",
          "parseIsoDate",
          "parseBoolean",
          "splitPipe",
          "splitComma",
        ])
        .optional(),
      note: z.string().nullable().optional(),
    }),
  ),
  scopeOptions: MigrationScopeOptionsSchema.optional(),
});

type SaveMappingRequest = z.infer<typeof SaveMappingSchema>;

export async function PUT(request: NextRequest, context: RouteContext) {
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

    // Parse and validate body
    const body = await request.json();
    const parsed = SaveMappingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "BAD_REQUEST", message: "Invalid request body" },
        { status: 400 },
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

    // State check: PENDING (API-mode credential entry), MAPPING_REVIEW (post-upload),
    // or VALIDATED (allow re-edit before import starts).
    if (!["PENDING", "MAPPING_REVIEW", "VALIDATED"].includes(job.status)) {
      return NextResponse.json(
        {
          error: "INVALID_STATE",
          message: "Cannot edit mapping in current state",
          currentStatus: job.status,
        },
        { status: 409 },
      );
    }

    const { fieldMappings, scopeOptions } = parsed.data;

    // Prepare fieldMappings with encrypted credentials if present
    const fieldMappingsObj: Record<string, unknown> = {
      mappings: fieldMappings,
    };

    // Check if there are credentials to encrypt
    const body_typed = body as Record<string, unknown>;
    if (body_typed.credentials && typeof body_typed.credentials === "object") {
      const creds = body_typed.credentials as Record<string, unknown>;
      // Only encrypt if not already encrypted
      if (!isEncryptedCredentials(creds)) {
        fieldMappingsObj.credentials = encryptCredentials(creds);
      } else {
        fieldMappingsObj.credentials = creds;
      }
    }

    // Update job with new mappings and optional scope options
    const updateData: any = {
      fieldMappings: fieldMappingsObj,
    };

    if (scopeOptions) {
      updateData.scopeOptions = scopeOptions;
    }

    // Advance PENDING → MAPPING_REVIEW once credentials are provided
    // (API-mode source jumps straight to mapping without the upload step).
    if (job.status === "PENDING" && fieldMappingsObj.credentials) {
      updateData.status = "MAPPING_REVIEW";
    }

    const updated = await db.migrationJob.update({
      where: { id },
      data: updateData,
    });

    // Audit log
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "migration.mapping_saved",
      entityType: "migration_job",
      entityId: id,
      metadata: { fieldMappingCount: fieldMappings.length },
    });

    return NextResponse.json({ migration: updated }, { status: 200 });
  } catch (error) {
    console.error("PUT /api/migrations/[id]/mapping error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to save mapping" },
      { status: 500 },
    );
  }
}
