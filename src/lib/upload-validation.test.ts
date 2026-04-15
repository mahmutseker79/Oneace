import { describe, expect, it } from "vitest";

// ── Upload validation logic tests ───────────────────────────────────

// File type validation
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_DOCUMENT_TYPES = ["application/pdf", "text/csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024; // 20MB

interface ValidationResult {
  valid: boolean;
  error?: string;
}

function validateImageFile(type: string, size: number): ValidationResult {
  if (!ALLOWED_IMAGE_TYPES.includes(type)) {
    return { valid: false, error: "Invalid image type. Allowed: JPEG, PNG, WebP" };
  }
  if (size > MAX_IMAGE_SIZE) {
    return { valid: false, error: "Image file too large. Max size: 5MB" };
  }
  if (size <= 0) {
    return { valid: false, error: "File size must be greater than 0" };
  }
  return { valid: true };
}

function validateDocumentFile(type: string, size: number): ValidationResult {
  if (!ALLOWED_DOCUMENT_TYPES.includes(type)) {
    return { valid: false, error: "Invalid document type. Allowed: PDF, CSV, XLS, XLSX" };
  }
  if (size > MAX_DOCUMENT_SIZE) {
    return { valid: false, error: "Document file too large. Max size: 20MB" };
  }
  if (size <= 0) {
    return { valid: false, error: "File size must be greater than 0" };
  }
  return { valid: true };
}

describe("Image upload validation", () => {
  describe("allowed formats", () => {
    it("should accept JPEG files", () => {
      const result = validateImageFile("image/jpeg", 1024);
      expect(result.valid).toBe(true);
    });

    it("should accept PNG files", () => {
      const result = validateImageFile("image/png", 2048);
      expect(result.valid).toBe(true);
    });

    it("should accept WebP files", () => {
      const result = validateImageFile("image/webp", 512);
      expect(result.valid).toBe(true);
    });
  });

  describe("rejected formats", () => {
    it("should reject GIF files", () => {
      const result = validateImageFile("image/gif", 1024);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid image type");
    });

    it("should reject SVG files", () => {
      const result = validateImageFile("image/svg+xml", 1024);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid image type");
    });

    it("should reject TIFF files", () => {
      const result = validateImageFile("image/tiff", 1024);
      expect(result.valid).toBe(false);
    });

    it("should reject generic binary type", () => {
      const result = validateImageFile("application/octet-stream", 1024);
      expect(result.valid).toBe(false);
    });
  });

  describe("size validation", () => {
    it("should accept files under 5MB", () => {
      const result = validateImageFile("image/jpeg", 4 * 1024 * 1024);
      expect(result.valid).toBe(true);
    });

    it("should accept files exactly at 5MB", () => {
      const result = validateImageFile("image/jpeg", 5 * 1024 * 1024);
      expect(result.valid).toBe(true);
    });

    it("should reject files over 5MB", () => {
      const result = validateImageFile("image/jpeg", 6 * 1024 * 1024);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("too large");
    });

    it("should reject zero-size files", () => {
      const result = validateImageFile("image/jpeg", 0);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("greater than 0");
    });

    it("should reject negative-size files", () => {
      const result = validateImageFile("image/jpeg", -1024);
      expect(result.valid).toBe(false);
    });
  });

  describe("combined validation", () => {
    it("should reject invalid format regardless of size", () => {
      const result = validateImageFile("text/plain", 1024);
      expect(result.valid).toBe(false);
    });

    it("should reject large size even with valid format", () => {
      const result = validateImageFile("image/png", 10 * 1024 * 1024);
      expect(result.valid).toBe(false);
    });
  });
});

describe("Document upload validation", () => {
  describe("allowed formats", () => {
    it("should accept PDF files", () => {
      const result = validateDocumentFile("application/pdf", 1024);
      expect(result.valid).toBe(true);
    });

    it("should accept CSV files", () => {
      const result = validateDocumentFile("text/csv", 2048);
      expect(result.valid).toBe(true);
    });

    it("should accept XLS files", () => {
      const result = validateDocumentFile("application/vnd.ms-excel", 1024);
      expect(result.valid).toBe(true);
    });

    it("should accept XLSX files", () => {
      const result = validateDocumentFile("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 1024);
      expect(result.valid).toBe(true);
    });
  });

  describe("rejected formats", () => {
    it("should reject image files", () => {
      const result = validateDocumentFile("image/jpeg", 1024);
      expect(result.valid).toBe(false);
    });

    it("should reject executable files", () => {
      const result = validateDocumentFile("application/x-executable", 1024);
      expect(result.valid).toBe(false);
    });
  });

  describe("size validation", () => {
    it("should accept files under 20MB", () => {
      const result = validateDocumentFile("application/pdf", 15 * 1024 * 1024);
      expect(result.valid).toBe(true);
    });

    it("should accept files exactly at 20MB", () => {
      const result = validateDocumentFile("text/csv", 20 * 1024 * 1024);
      expect(result.valid).toBe(true);
    });

    it("should reject files over 20MB", () => {
      const result = validateDocumentFile("application/pdf", 21 * 1024 * 1024);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("too large");
    });
  });
});

describe("Type checking", () => {
  it("should handle case-sensitive MIME types", () => {
    // MIME types are case-insensitive in spec, but typically lowercase
    const result = validateImageFile("image/jpeg", 1024);
    expect(result.valid).toBe(true);
  });

  it("should handle MIME types with charset", () => {
    // Some browsers may include charset, but we expect exact match
    const result = validateDocumentFile("text/csv; charset=utf-8", 1024);
    expect(result.valid).toBe(false);
  });
});
