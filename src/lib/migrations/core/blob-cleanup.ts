/**
 * Phase MIG-S10 — Migration Blob cleanup utilities.
 *
 * Handles deletion of Vercel Blob objects associated with migrations.
 * Used by both the rollback pipeline (after ItemAttachment deletion)
 * and the scheduled cleanup cron (for orphaned blobs and stale sourceFiles).
 */

import type { PrismaClient } from "@/generated/prisma";
import { logger } from "@/lib/logger";

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const BLOB_CLEANUP_CONCURRENCY = 5;

// ─────────────────────────────────────────────────────────────────────────────
// Worker pool for concurrent blob deletion
// ─────────────────────────────────────────────────────────────────────────────

async function deleteBlob(url: string): Promise<{ url: string; ok: boolean; error?: string }> {
  try {
    // Dynamically import @vercel/blob to match pattern from attachments.ts
    let del: typeof import("@vercel/blob").del;
    try {
      const blobModule = await import("@vercel/blob");
      del = blobModule.del;
    } catch {
      return {
        url,
        ok: false,
        error: "@vercel/blob package not found",
      };
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      return {
        url,
        ok: false,
        error: "BLOB_READ_WRITE_TOKEN environment variable not set",
      };
    }

    // Call del() with the token
    await del(url, { token });

    return { url, ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return {
      url,
      ok: false,
      error,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Delete a single blob by URL.
 * Returns success/failure; failures are logged but do not throw.
 */
export async function deleteMigrationBlob(url: string): Promise<{ ok: boolean; error?: string }> {
  const result = await deleteBlob(url);
  if (!result.ok) {
    logger.warn("Failed to delete migration blob", {
      url,
      error: result.error,
    });
  } else {
    logger.info("Deleted migration blob", { url });
  }
  return { ok: result.ok, error: result.error };
}

/**
 * Delete multiple blobs with concurrency control.
 * Returns counts of deleted vs failed; failures do not throw.
 *
 * @param urls Array of blob URLs to delete
 * @param opts Optional config (concurrency limit)
 */
export async function deleteMigrationBlobs(
  urls: string[],
  opts?: { concurrency?: number }
): Promise<{ deleted: number; failed: Array<{ url: string; error: string }> }> {
  const concurrency = opts?.concurrency ?? BLOB_CLEANUP_CONCURRENCY;
  const failed: Array<{ url: string; error: string }> = [];

  // Process in batches to respect concurrency limit
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const results = await Promise.all(batch.map((url) => deleteBlob(url)));

    for (const result of results) {
      if (!result.ok && result.error) {
        failed.push({ url: result.url, error: result.error });
      }
    }
  }

  const deleted = urls.length - failed.length;

  if (failed.length > 0) {
    logger.warn("Some migration blobs failed to delete", {
      total: urls.length,
      deleted,
      failed: failed.length,
      failures: failed.slice(0, 10), // Log first 10 failures for troubleshooting
    });
  } else if (deleted > 0) {
    logger.info("Successfully deleted migration blobs", {
      count: deleted,
    });
  }

  return { deleted, failed };
}

/**
 * Extract and delete all blobs for a migration job.
 *
 * For ItemAttachments created during the migration (from ATTACHMENTS phase):
 * 1. Read the job's importResults
 * 2. Extract createdIds from the ATTACHMENTS phase
 * 3. Query ItemAttachment rows for their URLs
 * 4. Delete the blobs (concurrently)
 *
 * Returns counts; does not throw on blob failures.
 *
 * NOTE: This function only deletes blobs associated with ItemAttachment rows.
 * Blobs in sourceFiles are handled separately (see cleanup cron).
 */
export async function deleteMigrationBlobsForJob(
  db: PrismaClient,
  migrationJobId: string
): Promise<{ deleted: number; failed: Array<{ url: string; error: string }> }> {
  try {
    // Fetch the job and parse importResults
    const job = await db.migrationJob.findUnique({
      where: { id: migrationJobId },
      select: {
        importResults: true,
        organizationId: true,
      },
    });

    if (!job) {
      logger.warn("MigrationJob not found for blob cleanup", {
        migrationJobId,
      });
      return { deleted: 0, failed: [] };
    }

    // Parse importResults to find ATTACHMENTS phase
    let attachmentIds: string[] = [];
    if (job.importResults && typeof job.importResults === "object") {
      const importResults = job.importResults as { version?: number; phases?: Array<{ phase?: string; createdIds?: string[] }> };
      if (importResults.version === 1 && Array.isArray(importResults.phases)) {
        const attachmentsPhase = importResults.phases.find((p) => p.phase === "ATTACHMENTS");
        if (attachmentsPhase && Array.isArray(attachmentsPhase.createdIds)) {
          attachmentIds = attachmentsPhase.createdIds;
        }
      }
    }

    if (attachmentIds.length === 0) {
      logger.debug("No attachment IDs found in migration job", {
        migrationJobId,
      });
      return { deleted: 0, failed: [] };
    }

    // Query ItemAttachment rows for their URLs
    const attachments = await db.itemAttachment.findMany({
      where: {
        id: { in: attachmentIds },
        organizationId: job.organizationId,
      },
      select: { id: true, fileUrl: true },
    });

    const blobUrls = attachments
      .map((a) => a.fileUrl)
      .filter((url) => {
        // Only delete blobs that belong to migrations (safety check)
        // Migration blobs follow pattern: *.vercel-storage.com/migrations/{orgId}/...
        return url.includes("/migrations/");
      });

    if (blobUrls.length === 0) {
      logger.debug("No migration blob URLs found for deletion", {
        migrationJobId,
        attachmentCount: attachments.length,
      });
      return { deleted: 0, failed: [] };
    }

    // Delete blobs
    return await deleteMigrationBlobs(blobUrls);
  } catch (err) {
    logger.error("Error deleting migration job blobs", {
      error: err instanceof Error ? err.message : String(err),
      migrationJobId,
    });
    return { deleted: 0, failed: [] };
  }
}

/**
 * Extract Vercel Blob URLs from sourceFiles JSON.
 *
 * sourceFiles is an array of StoredFile objects:
 *   {
 *     mode: "blob" | "inline",
 *     filename: string,
 *     size: number,
 *     mimeType?: string,
 *     blobUrl?: string,     // populated if mode === "blob"
 *     base64?: string       // populated if mode === "inline"
 *   }
 *
 * Returns URLs of blobs that belong to migrations (safety check).
 */
export function extractSourceFileBlobUrls(sourceFiles: unknown): string[] {
  if (!sourceFiles || typeof sourceFiles !== "object") {
    return [];
  }

  if (!Array.isArray(sourceFiles)) {
    return [];
  }

  const urls: string[] = [];

  for (const file of sourceFiles) {
    if (typeof file !== "object" || !file) continue;

    const f = file as Record<string, unknown>;
    if (f.mode === "blob" && typeof f.blobUrl === "string") {
      // Safety: only include URLs that belong to migrations
      if (f.blobUrl.includes("/migrations/")) {
        urls.push(f.blobUrl);
      }
    }
  }

  return urls;
}
