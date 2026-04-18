/**
 * @openapi-tag: /upload/image
 *
 * P3-4 (audit v1.1 §5.32) — the tag above is the canonical route
 * path. docs/openapi.yaml MUST declare the same path with every
 * HTTP method this file exports. `src/lib/openapi-parity.test.ts`
 * pins the two in lockstep.
 */
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { requireActiveMembership } from "@/lib/session";
import { NextResponse } from "next/server";

/**
 * POST /api/upload/image
 *
 * File upload endpoint for item images.
 *
 * P1-8 (audit v1.0 §5.14) — tenant-scoped storage path.
 *
 * Before this change, files were stored as
 *   public/uploads/items/{randomHex}.{ext}
 * and served publicly by Next.js static middleware. The URL was
 * unguessable in practice (96-bit random id), but there was no
 * audit trail from URL → organisation and no way for a serving
 * layer to enforce tenancy without extra lookups.
 *
 * After: files are stored under a per-org directory
 *   public/uploads/items/{orgId}/{randomHex}.{ext}
 * and the returned URL preserves that structure. This gives us:
 *   - reviewable tenant attribution from the URL alone,
 *   - a server-side validator (see src/lib/validation/attachment.ts)
 *     that rejects cross-tenant URL substitution in the attachment
 *     server action,
 *   - a natural migration path when we move storage out of public/
 *     and behind an authenticated serving route (P3 follow-up).
 *
 * - Accepts: image/jpeg, image/png, image/webp only
 * - Max size: 5MB
 * - Validates magic bytes (not just extension)
 * - Rate limited: 20 per minute per user
 */

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const UPLOAD_ROOT = join(process.cwd(), "public", "uploads", "items");

/**
 * Whitelist of characters allowed in the organisation-id path
 * segment. `cuid()` produces `[a-z0-9]+` with no dashes/dots so we
 * accept that set verbatim. Any other character would indicate a
 * malicious id (path traversal, directory escape) and we refuse.
 */
const ORG_ID_PATTERN = /^[a-z0-9]{10,40}$/i;

// Magic bytes for file type detection
const MAGIC_BYTES: Record<string, Uint8Array> = {
  "image/jpeg": new Uint8Array([0xff, 0xd8, 0xff]),
  "image/png": new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
  "image/webp": new Uint8Array([0x52, 0x49, 0x46, 0x46]), // RIFF
};

async function verifyMimeType(buffer: ArrayBuffer, declaredMime: string): Promise<boolean> {
  const bytes = new Uint8Array(buffer);

  // Special handling for WebP (RIFF format)
  if (declaredMime === "image/webp") {
    if (bytes.length < 12) return false;
    // Check RIFF signature
    if (bytes[0] !== 0x52 || bytes[1] !== 0x49 || bytes[2] !== 0x46 || bytes[3] !== 0x46) {
      return false;
    }
    // Check WEBP signature at offset 8
    if (bytes[8] !== 0x57 || bytes[9] !== 0x45 || bytes[10] !== 0x42 || bytes[11] !== 0x50) {
      return false;
    }
    return true;
  }

  const magicBytes = MAGIC_BYTES[declaredMime];
  if (!magicBytes) return false;

  if (buffer.byteLength < magicBytes.length) return false;

  for (let i = 0; i < magicBytes.length; i++) {
    if (bytes[i] !== magicBytes[i]) return false;
  }

  return true;
}

export async function POST(request: Request) {
  try {
    const { session, membership } = await requireActiveMembership();

    // Defense-in-depth: the only caller that reaches here is an
    // authenticated user with an active membership, and org ids come
    // from a DB lookup — but the id is about to become a filesystem
    // path segment so we re-validate its shape anyway. A rogue id with
    // a `../` in it would let someone write outside of UPLOAD_ROOT.
    const orgId = membership.organizationId;
    if (!ORG_ID_PATTERN.test(orgId)) {
      logger.error("Image upload rejected: organization id failed sanitisation", {
        orgId,
        userId: session.user.id,
      });
      return NextResponse.json({ error: "Invalid organization" }, { status: 400 });
    }

    // Rate limit: 20 per minute per user
    const result = await rateLimit(`upload:image:${session.user.id}`, {
      max: 20,
      windowSeconds: 60,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Maximum 20 uploads per minute." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.max(0, result.reset - Math.floor(Date.now() / 1000))),
          },
        },
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, and WebP images are allowed" },
        { status: 400 },
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Image must be under 5MB" }, { status: 400 });
    }

    // Read file buffer
    const buffer = await file.arrayBuffer();

    // Verify magic bytes
    const isValidFile = await verifyMimeType(buffer, file.type);
    if (!isValidFile) {
      return NextResponse.json(
        { error: "Invalid file. File content does not match declared type." },
        { status: 400 },
      );
    }

    // Generate unique filename
    const ext = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
    const uniqueId = randomBytes(12).toString("hex");
    const filename = `${uniqueId}.${ext}`;

    // Ensure the org-scoped directory exists. We intentionally do NOT
    // leak the orgId outside of UPLOAD_ROOT — `join` normalises path
    // separators, and the ORG_ID_PATTERN check above guarantees no
    // traversal characters made it into the segment.
    const uploadDir = join(UPLOAD_ROOT, orgId);
    await mkdir(uploadDir, { recursive: true });

    // Write file
    const filePath = join(uploadDir, filename);
    await writeFile(filePath, Buffer.from(buffer));

    // Return public URL — matches the on-disk layout under public/, so
    // Next.js static serving finds the file without any custom route.
    // The orgId segment is what lets `validateAttachmentUrl` reject
    // cross-tenant substitution when attachments are later recorded.
    return NextResponse.json({ url: `/uploads/items/${orgId}/${filename}` }, { status: 200 });
  } catch (err) {
    logger.error("Image upload failed:", { error: err });
    return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
  }
}
