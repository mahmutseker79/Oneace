import { z } from "zod";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_FILE_TYPES = ["IMAGE", "DOCUMENT", "DATASHEET", "CERTIFICATE", "OTHER"];

/**
 * P1-8 (audit v1.0 §5.14) — tenant-scoped attachment URL check.
 *
 * The `/api/upload/image` route now writes uploads under
 * `/uploads/items/{orgId}/{file}`. When an action later records an
 * attachment it receives a free-form `fileUrl` from the client, so we
 * must make sure the URL actually points inside the current org's
 * directory before we persist it.
 *
 * Policy:
 *   - URLs starting with `/uploads/items/{orgId}/...` are accepted for
 *     the caller's own org.
 *   - URLs starting with `/uploads/items/<otherOrg>/...` are rejected
 *     (cross-tenant substitution).
 *   - Legacy URLs that match the old flat `/uploads/items/{file}` layout
 *     (no org segment) are tolerated so pre-P1-8 attachments keep
 *     working; they just get no tenancy guarantee — which is fine, they
 *     never had one.
 *   - Absolute URLs (https://…) are accepted as-is. We don't host other
 *     schemes internally and 3rd-party CDN URLs are trusted per-integration.
 */
export function isAttachmentUrlForOrg(fileUrl: string, orgId: string): boolean {
  if (!fileUrl) return false;
  // Absolute URLs don't live in our storage; we can't tenancy-check them.
  if (/^https?:\/\//i.test(fileUrl)) return true;
  const uploadsPrefix = "/uploads/items/";
  if (!fileUrl.startsWith(uploadsPrefix)) {
    // Unknown local prefix — fail closed. Anything we serve to users
    // from this app lives under /uploads/, so a mismatch indicates
    // either a typo or a forged URL.
    return false;
  }
  const remainder = fileUrl.slice(uploadsPrefix.length);
  const firstSegment = remainder.split("/")[0] ?? "";
  // Legacy flat layout: /uploads/items/{file.ext} — no org segment.
  // Extension-bearing first segment means there is only one path
  // component after /items/, so we're looking at an old-style URL.
  if (firstSegment.includes(".")) return true;
  // Modern layout: first segment IS the org id; it must match.
  return firstSegment === orgId;
}

export const uploadAttachmentSchema = z.object({
  itemId: z.string().cuid({ message: "Invalid item ID" }),
  fileName: z
    .string()
    .trim()
    .min(1, { message: "File name is required" })
    .max(255, { message: "File name must be 255 characters or fewer" }),
  fileUrl: z.string().url({ message: "Invalid file URL" }),
  fileType: z.enum(ALLOWED_FILE_TYPES as [string, ...string[]], {
    message: "Invalid file type",
  }),
  fileSize: z
    .number()
    .positive({ message: "File size must be positive" })
    .max(MAX_FILE_SIZE, { message: "File size must not exceed 10MB" }),
});

export type UploadAttachmentInput = z.input<typeof uploadAttachmentSchema>;
export type UploadAttachmentOutput = z.output<typeof uploadAttachmentSchema>;

export const deleteAttachmentSchema = z.object({
  attachmentId: z.string().cuid({ message: "Invalid attachment ID" }),
});

export type DeleteAttachmentInput = z.input<typeof deleteAttachmentSchema>;
export type DeleteAttachmentOutput = z.output<typeof deleteAttachmentSchema>;

export const reorderAttachmentsSchema = z.object({
  itemId: z.string().cuid({ message: "Invalid item ID" }),
  attachmentIds: z
    .array(z.string().cuid())
    .min(1, { message: "At least one attachment ID is required" }),
});

export type ReorderAttachmentsInput = z.input<typeof reorderAttachmentsSchema>;
export type ReorderAttachmentsOutput = z.output<typeof reorderAttachmentsSchema>;
