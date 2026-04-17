/**
 * Phase S7 — Attachment upload to Vercel Blob.
 *
 * Handles the download/validation/upload flow for item attachments during
 * migration. Each attachment is fetched (or used directly if inlined),
 * validated for size, and uploaded to Vercel Blob under the migrations/
 * namespace.
 */

import type { RawAttachment } from "@/lib/migrations/core/types";

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024; // 20 MB
const FETCH_TIMEOUT_MS = 15_000; // 15 seconds

// ─────────────────────────────────────────────────────────────────────────────
// Error class
// ─────────────────────────────────────────────────────────────────────────────

export class AttachmentUploadError extends Error {
  constructor(
    message: string,
    public code: "FETCH_FAILED" | "TOO_LARGE" | "BLOB_UPLOAD_FAILED" | "UNSUPPORTED_PATH",
    public cause?: unknown,
  ) {
    super(message);
    this.name = "AttachmentUploadError";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MIME type detection
// ─────────────────────────────────────────────────────────────────────────────

function detectMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";

  const mimeMap: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    pdf: "application/pdf",
  };

  return mimeMap[ext] || "application/octet-stream";
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch with timeout and size guards
// ─────────────────────────────────────────────────────────────────────────────

async function fetchAttachmentBuffer(url: string): Promise<{ buffer: Buffer; size: number }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      // Prevent redirect loops and limit hops
      redirect: "follow",
    });

    if (!response.ok) {
      throw new AttachmentUploadError(
        `HTTP ${response.status} when fetching ${url}`,
        "FETCH_FAILED",
      );
    }

    // Check Content-Length header before reading body
    const contentLength = response.headers.get("content-length");
    if (contentLength) {
      const size = Number.parseInt(contentLength, 10);
      if (size > MAX_ATTACHMENT_BYTES) {
        throw new AttachmentUploadError(
          `Content-Length ${size} exceeds max ${MAX_ATTACHMENT_BYTES}`,
          "TOO_LARGE",
        );
      }
    }

    // Read body and enforce size limit
    const buffer = await response.arrayBuffer();
    const size = buffer.byteLength;

    if (size > MAX_ATTACHMENT_BYTES) {
      throw new AttachmentUploadError(
        `Downloaded size ${size} exceeds max ${MAX_ATTACHMENT_BYTES}`,
        "TOO_LARGE",
      );
    }

    return { buffer: Buffer.from(buffer), size };
  } catch (err) {
    if (err instanceof AttachmentUploadError) throw err;

    if (err instanceof Error && err.name === "AbortError") {
      throw new AttachmentUploadError(
        `Fetch timeout (${FETCH_TIMEOUT_MS}ms) for ${url}`,
        "FETCH_FAILED",
        err,
      );
    }

    throw new AttachmentUploadError(
      `Failed to fetch ${url}: ${err instanceof Error ? err.message : String(err)}`,
      "FETCH_FAILED",
      err,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Blob upload
// ─────────────────────────────────────────────────────────────────────────────

async function uploadToBlob(buffer: Buffer, path: string, contentType: string): Promise<string> {
  // Dynamically import @vercel/blob to allow graceful degradation if missing
  let put: typeof import("@vercel/blob").put;
  try {
    const blobModule = await import("@vercel/blob");
    put = blobModule.put;
  } catch {
    throw new AttachmentUploadError(
      "@vercel/blob package not found. Install via npm install @vercel/blob",
      "BLOB_UPLOAD_FAILED",
    );
  }

  // Check for auth token
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new AttachmentUploadError(
      "BLOB_READ_WRITE_TOKEN environment variable not set",
      "BLOB_UPLOAD_FAILED",
    );
  }

  try {
    const result = await put(path, buffer, {
      access: "public",
      addRandomSuffix: true,
      contentType,
    });

    return result.url;
  } catch (err) {
    throw new AttachmentUploadError(
      `Vercel Blob upload failed: ${err instanceof Error ? err.message : String(err)}`,
      "BLOB_UPLOAD_FAILED",
      err,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upload a migration attachment to Vercel Blob.
 *
 * If inlineBuffer is provided, use it directly. Otherwise, fetch from sourceRef
 * (http(s) URL only; relative paths are not supported by this function and
 * should be resolved by the adapter).
 *
 * @param raw The raw attachment metadata
 * @param ctx Context with orgId and itemExternalId for path construction
 * @returns Object with the public Blob URL and file size
 * @throws AttachmentUploadError on fetch, size, or upload failures
 */
export async function uploadMigrationAttachment(
  raw: RawAttachment,
  ctx: { orgId: string; itemExternalId: string },
): Promise<{ url: string; size: number }> {
  let buffer: Buffer;
  let size: number;

  if (raw.inlineBuffer) {
    // Use the buffer directly
    buffer = Buffer.from(raw.inlineBuffer);
    size = buffer.length;

    if (size > MAX_ATTACHMENT_BYTES) {
      throw new AttachmentUploadError(
        `Inline buffer size ${size} exceeds max ${MAX_ATTACHMENT_BYTES}`,
        "TOO_LARGE",
      );
    }
  } else if (raw.sourceRef.startsWith("http://") || raw.sourceRef.startsWith("https://")) {
    // Fetch from URL
    const result = await fetchAttachmentBuffer(raw.sourceRef);
    buffer = result.buffer;
    size = result.size;
  } else {
    // Relative path — unsupported by this function
    throw new AttachmentUploadError(
      `Relative path '${raw.sourceRef}' not supported. Adapter must resolve ZIP-internal paths or provide absolute URLs.`,
      "UNSUPPORTED_PATH",
    );
  }

  // Generate blob path: migrations/{orgId}/{itemExternalId}/{timestamp}-{filename}
  const timestamp = Date.now();
  const blobPath = `migrations/${ctx.orgId}/${ctx.itemExternalId}/${timestamp}-${raw.filename}`;

  // Detect MIME type from filename; use provided mimeType as fallback hint
  const contentType = detectMimeType(raw.filename);

  // Upload to Vercel Blob
  const url = await uploadToBlob(buffer, blobPath, contentType);

  return { url, size };
}
