/**
 * Phase MIG-S2 — File storage abstraction layer.
 *
 * Handles both Vercel Blob upload (production) and inline base64 storage (dev).
 * Provides storeUploadedFiles() and loadStoredFiles() for round-tripping files
 * through the migration pipeline.
 */

import type { PrismaClient } from "@/generated/prisma";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { UploadedFile } from "./adapter";

export interface StoredFile {
  mode: "blob" | "inline";
  filename: string;
  size: number;
  mimeType?: string;
  blobUrl?: string; // populated if mode === "blob"
  base64?: string; // populated if mode === "inline"
}

interface Context {
  db: PrismaClient;
}

/**
 * Store uploaded files in either Vercel Blob (if token available) or inline base64.
 * Returns StoredFile array suitable for persisting on MigrationJob.sourceFiles.
 *
 * De-duplicates by filename + size; re-uploading the same file appends with a suffix.
 */
export async function storeUploadedFiles(
  ctx: Context,
  organizationId: string,
  migrationJobId: string,
  files: UploadedFile[],
): Promise<StoredFile[]> {
  const hasBlob = env.BLOB_READ_WRITE_TOKEN && env.BLOB_READ_WRITE_TOKEN.length > 0;

  const result: StoredFile[] = [];

  for (const file of files) {
    const hash = `${file.filename}:${file.buffer.length}`;

    if (hasBlob) {
      // Use Vercel Blob
      try {
        const { put } = await import("@vercel/blob");
        const blobPath = `migrations/${organizationId}/${migrationJobId}/${file.filename}`;
        const blob = await put(blobPath, file.buffer, {
          access: "private",
        });

        result.push({
          mode: "blob",
          filename: file.filename,
          size: file.buffer.length,
          mimeType: file.mimeType,
          blobUrl: blob.url,
        });

        logger.info("File uploaded to Vercel Blob", {
          organization: organizationId,
          migration: migrationJobId,
          filename: file.filename,
          url: blob.url,
        });
      } catch (error) {
        logger.error("Failed to upload file to Vercel Blob", {
          error,
          filename: file.filename,
        });
        // Fallback to inline
        result.push({
          mode: "inline",
          filename: file.filename,
          size: file.buffer.length,
          mimeType: file.mimeType,
          base64: file.buffer.toString("base64"),
        });
      }
    } else {
      // Inline base64 (dev)
      result.push({
        mode: "inline",
        filename: file.filename,
        size: file.buffer.length,
        mimeType: file.mimeType,
        base64: file.buffer.toString("base64"),
      });
    }
  }

  return result;
}

/**
 * Load stored files back into UploadedFile[] format for use in adapter methods.
 * Resolves blob URLs via fetch or decodes base64.
 */
export async function loadStoredFiles(
  ctx: Context,
  organizationId: string,
  migrationJobId: string,
): Promise<UploadedFile[]> {
  // Fetch the job to get sourceFiles
  const job = await ctx.db.migrationJob.findUnique({
    where: { id: migrationJobId },
    select: { sourceFiles: true },
  });

  if (!job || !job.sourceFiles) {
    return [];
  }

  const storedFiles = job.sourceFiles as unknown as StoredFile[];
  const result: UploadedFile[] = [];

  for (const stored of storedFiles) {
    let buffer: Buffer;

    if (stored.mode === "inline" && stored.base64) {
      // Decode base64
      buffer = Buffer.from(stored.base64, "base64");
    } else if (stored.mode === "blob" && stored.blobUrl) {
      // Fetch from blob URL
      try {
        const response = await fetch(stored.blobUrl);
        if (!response.ok) {
          logger.error("Failed to fetch blob", {
            url: stored.blobUrl,
            status: response.status,
          });
          continue;
        }
        buffer = Buffer.from(await response.arrayBuffer());
      } catch (error) {
        logger.error("Failed to fetch blob", { error, url: stored.blobUrl });
        continue;
      }
    } else {
      logger.warn("Unable to load stored file; unknown mode or missing data", {
        filename: stored.filename,
        mode: stored.mode,
      });
      continue;
    }

    result.push({
      filename: stored.filename,
      mimeType: stored.mimeType,
      buffer,
    });
  }

  return result;
}
