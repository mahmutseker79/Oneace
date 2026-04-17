/**
 * Phase S7 — Item attachment import.
 *
 * Downloads and uploads attachments to Vercel Blob, then creates ItemAttachment
 * rows pointing at the blob URLs. Non-blocking failures (network, size, upload)
 * are logged as WARNINGs and the import continues.
 */

import type { PrismaClient } from "@/generated/prisma";

import {
  AttachmentUploadError,
  uploadMigrationAttachment,
} from "@/lib/migrations/core/attachments";
import type { IdMap } from "@/lib/migrations/core/id-map";
import type {
  MigrationScopeOptions,
  ParsedSnapshot,
  PhaseResult,
  ValidationIssue,
} from "@/lib/migrations/core/types";

// ─────────────────────────────────────────────────────────────────────────────
// Phase context (matches importer.ts PhaseContext interface)
// ─────────────────────────────────────────────────────────────────────────────

export interface AttachmentPhaseContext {
  db: PrismaClient;
  organizationId: string;
  migrationJobId: string;
  snapshot: ParsedSnapshot;
  scope: MigrationScopeOptions;
  idMap: IdMap;
}

// ─────────────────────────────────────────────────────────────────────────────
// Simple worker pool for controlled parallelism
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A simple queue-based worker pool that processes items with bounded
 * concurrency. Useful for rate-limiting external API calls.
 */
class WorkerPool<T> {
  private readonly concurrency: number;
  private running = 0;
  private readonly queue: Array<() => Promise<T>> = [];
  private readonly results: T[] = [];
  private readonly errors: Error[] = [];
  private resolve?: (value: T[]) => void;
  private reject?: (err: Error) => void;

  constructor(concurrency = 5) {
    this.concurrency = concurrency;
  }

  async run(tasks: Array<() => Promise<T>>): Promise<T[]> {
    this.queue.push(...tasks);
    this.results = [];
    this.errors = [];

    return new Promise<T[]>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
      this.drain();
    });
  }

  private drain = async () => {
    while (this.running < this.concurrency && this.queue.length > 0) {
      this.running++;
      const task = this.queue.shift()!;

      try {
        const result = await task();
        this.results.push(result);
      } catch (err) {
        this.errors.push(err instanceof Error ? err : new Error(String(err)));
      }

      this.running--;
      this.drain();
    }

    if (this.running === 0 && this.queue.length === 0) {
      if (this.errors.length > 0) {
        // Collect all errors or resolve with results
        // For now, resolve with results and let caller handle errors
        this.resolve?.(this.results);
      } else {
        this.resolve?.(this.results);
      }
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase implementation
// ─────────────────────────────────────────────────────────────────────────────

export async function importAttachmentsPhase(
  ctx: AttachmentPhaseContext,
): Promise<PhaseResult> {
  const startedAt = new Date();

  // Early return if attachments are excluded from scope
  if (!ctx.scope.includeAttachments) {
    const completedAt = new Date();
    return {
      phase: "ATTACHMENTS",
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      created: 0,
      updated: 0,
      skipped: ctx.snapshot.attachments.length,
      failed: 0,
      createdIds: [],
      errors: [],
    };
  }

  let created = 0;
  let failed = 0;
  const createdIds: string[] = [];
  const errors: ValidationIssue[] = [];

  // Build a list of upload tasks with their metadata
  interface UploadTask {
    index: number;
    attachment: (typeof ctx.snapshot.attachments)[0];
  }

  const tasks = ctx.snapshot.attachments.map((attachment, index) => {
    return async () => {
      try {
        // Resolve itemExternalId -> itemInternalId
        const itemInternalId = ctx.idMap.get("ITEM", attachment.itemExternalId);
        if (!itemInternalId) {
          console.warn(
            `[ATTACHMENTS] Skipping attachment for missing item ${attachment.itemExternalId}`,
          );
          errors.push({
            severity: "WARNING",
            entity: "ItemAttachment",
            externalId: attachment.itemExternalId,
            field: "itemId",
            code: "ITEM_NOT_FOUND",
            message: `Item ${attachment.itemExternalId} was not imported; attachment skipped.`,
          });
          return null;
        }

        // Upload the attachment
        const { url, size } = await uploadMigrationAttachment(attachment, {
          orgId: ctx.organizationId,
          itemExternalId: attachment.itemExternalId,
        });

        // Determine AttachmentType from MIME type or filename
        type AttachmentType = "IMAGE" | "DOCUMENT" | "DATASHEET" | "CERTIFICATE" | "OTHER";
        let attachmentType: AttachmentType = "OTHER";

        const mimeType = attachment.mimeType || "";
        const filename = attachment.filename.toLowerCase();

        if (
          mimeType.startsWith("image/") ||
          filename.endsWith(".png") ||
          filename.endsWith(".jpg") ||
          filename.endsWith(".jpeg") ||
          filename.endsWith(".gif") ||
          filename.endsWith(".webp")
        ) {
          attachmentType = "IMAGE";
        } else if (filename.endsWith(".pdf")) {
          attachmentType = "DOCUMENT";
        } else if (
          filename.includes("datasheet") ||
          filename.includes("spec")
        ) {
          attachmentType = "DATASHEET";
        } else if (
          filename.includes("cert") ||
          filename.includes("compliance")
        ) {
          attachmentType = "CERTIFICATE";
        }

        // Create ItemAttachment row
        const itemAttachment = await ctx.db.itemAttachment.create({
          data: {
            organizationId: ctx.organizationId,
            itemId: itemInternalId,
            fileName: attachment.filename,
            fileUrl: url,
            fileType: attachmentType,
            fileSize: size,
            sortOrder: 0,
          },
          select: { id: true },
        });

        created++;
        createdIds.push(itemAttachment.id);
        return itemAttachment.id;
      } catch (err) {
        failed++;

        if (err instanceof AttachmentUploadError) {
          errors.push({
            severity: "WARNING",
            entity: "ItemAttachment",
            externalId: attachment.itemExternalId,
            field: "sourceRef",
            code: err.code,
            message: `${err.code}: ${err.message}`,
          });
        } else {
          errors.push({
            severity: "WARNING",
            entity: "ItemAttachment",
            externalId: attachment.itemExternalId,
            code: "UNKNOWN_ERROR",
            message: `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
          });
        }

        return null;
      }
    };
  });

  // Run uploads with controlled parallelism (5 at a time)
  const pool = new WorkerPool<string | null>(5);
  await pool.run(tasks);

  const completedAt = new Date();

  return {
    phase: "ATTACHMENTS",
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    created,
    updated: 0,
    skipped: ctx.snapshot.attachments.length - created - failed,
    failed,
    createdIds,
    errors,
  };
}
