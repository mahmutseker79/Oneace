/**
 * Phase E: Import workflow server actions.
 *
 * Handle import job creation, file processing, and status tracking.
 */

"use server";

import type { ImportStatus } from "@/generated/prisma";import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type ActionResult<T = unknown> = { ok: true; data: T } | { ok: false; error: string };

const createImportJobSchema = z.object({
  entity: z.enum([
    "ITEM",
    "SUPPLIER",
    "PURCHASE_ORDER",
    "STOCK_LEVEL",
    "CATEGORY",
    "WAREHOUSE",
    "CUSTOMER",
  ]),
  templateId: z.string().cuid().optional(),
  source: z.enum(["CSV", "EXCEL"]),
});

const startImportSchema = z.object({
  jobId: z.string().cuid(),
  fileUrl: z.string().url(),
  fieldMappings: z.array(
    z.object({
      columnIndex: z.number(),
      columnName: z.string(),
      targetField: z.string(),
    }),
  ),
});

const cancelImportSchema = z.object({
  jobId: z.string().cuid(),
});

/**
 * Create an import job.
 */
export async function createImportJobAction(
  input: unknown,
): Promise<ActionResult<{ jobId: string }>> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "imports.create")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = createImportJobSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input" };
  }

  const { entity, templateId, source } = parsed.data;

  try {
    // Create import job
    const importJob = await db.importJob.create({
      data: {
        organizationId: membership.organizationId,
        entityType: entity as any,
        source,
        templateId,
        status: "PENDING",
        createdByUserId: session.user.id,
        processedRows: 0,
        successRows: 0,
        errorRows: 0,
      },
    });

    // Record audit event
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "import_job.started",
      entityType: "import_job",
      entityId: importJob.id,
      metadata: {
        entity,
        source,
      },
    });

    revalidatePath("/import");

    return { ok: true, data: { jobId: importJob.id } };
  } catch (error) {
    console.error("Failed to create import job", error);
    return { ok: false, error: "Failed to create import job" };
  }
}

/**
 * Start import processing.
 */
export async function startImportAction(
  input: unknown,
): Promise<ActionResult<{ message: string }>> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "imports.create")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = startImportSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input" };
  }

  const { jobId, fieldMappings } = parsed.data;

  try {
    // Verify job ownership
    const importJob = await db.importJob.findUnique({
      where: { id: jobId },
    });

    if (!importJob || importJob.organizationId !== membership.organizationId) {
      return { ok: false, error: "Import job not found" };
    }

    // Update job status
    await db.importJob.update({
      where: { id: jobId },
      data: {
        status: "PROCESSING",
      },
    });

    // TODO: Queue async import job (background job queue)
    // ImportEngine.executeImport(...)

    // Record audit event
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "import_job.started",
      entityType: "import_job",
      entityId: jobId,
      metadata: {
        entity: importJob.entityType,
      },
    });

    revalidatePath(`/import/${jobId}`);

    return { ok: true, data: { message: "Import started" } };
  } catch (error) {
    console.error("Failed to start import", error);
    return { ok: false, error: "Failed to start import" };
  }
}

/**
 * Cancel an import job.
 */
export async function cancelImportAction(input: unknown): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "imports.cancel")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = cancelImportSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input" };
  }

  const { jobId } = parsed.data;

  try {
    // Verify job ownership
    const importJob = await db.importJob.findUnique({
      where: { id: jobId },
    });

    if (!importJob || importJob.organizationId !== membership.organizationId) {
      return { ok: false, error: "Import job not found" };
    }

    // Can only cancel jobs that are not completed
    if (importJob.status.includes("COMPLETED") || importJob.status === "FAILED") {
      return { ok: false, error: "Cannot cancel completed job" };
    }

    // Update job status
    await db.importJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED" as ImportStatus,
        completedAt: new Date(),
      },
    });

    // Record audit event
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "import_job.cancelled",
      entityType: "import_job",
      entityId: jobId,
      metadata: {
        reason: "Cancelled by user",
      },
    });

    revalidatePath(`/import/${jobId}`);
    revalidatePath("/import");

    return { ok: true, data: {} };
  } catch (error) {
    console.error("Failed to cancel import", error);
    return { ok: false, error: "Failed to cancel import" };
  }
}

/**
 * Get import job status.
 */
export async function getImportJobStatusAction(jobId: string): Promise<
  ActionResult<{
    status: ImportStatus;
    processedRows: number;
    successfulRows: number;
    failedRows: number;
    completedAt: Date | null;
  }>
> {
  const { membership } = await requireActiveMembership();

  try {
    const importJob = await db.importJob.findUnique({
      where: { id: jobId },
    });

    if (!importJob || importJob.organizationId !== membership.organizationId) {
      return { ok: false, error: "Import job not found" };
    }

    return {
      ok: true,
      data: {
        status: importJob.status as ImportStatus,
        processedRows: importJob.processedRows,
        successfulRows: importJob.successRows,
        failedRows: importJob.errorRows,
        completedAt: importJob.completedAt,
      },
    };
  } catch (_error) {
    return { ok: false, error: "Failed to get import status" };
  }
}
