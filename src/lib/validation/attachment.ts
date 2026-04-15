import { z } from "zod";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const ALLOWED_FILE_TYPES = [
  "IMAGE",
  "DOCUMENT",
  "DATASHEET",
  "CERTIFICATE",
  "OTHER",
];

export const uploadAttachmentSchema = z.object({
  itemId: z.string().cuid({ message: "Invalid item ID" }),
  fileName: z
    .string()
    .trim()
    .min(1, { message: "File name is required" })
    .max(255, { message: "File name must be 255 characters or fewer" }),
  fileUrl: z
    .string()
    .url({ message: "Invalid file URL" }),
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
  attachmentIds: z.array(z.string().cuid()).min(1, { message: "At least one attachment ID is required" }),
});

export type ReorderAttachmentsInput = z.input<typeof reorderAttachmentsSchema>;
export type ReorderAttachmentsOutput = z.output<typeof reorderAttachmentsSchema>;
