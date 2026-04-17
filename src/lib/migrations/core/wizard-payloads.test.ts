/**
 * Tests for wizard payload shapes — validate that the scope-options +
 * field-mappings payloads conform to the API contract.
 */

import {
  type MigrationScopeOptions,
  MigrationScopeOptionsSchema,
  defaultScopeOptions,
  parseScopeOptions,
} from "@/lib/migrations/core/scope-options";
import type { FieldMapping } from "@/lib/migrations/core/types";
import { describe, expect, it } from "vitest";
import { z } from "zod";

describe("Wizard Payloads", () => {
  describe("MigrationScopeOptions validation", () => {
    it("should parse default scope options", () => {
      const defaults = defaultScopeOptions();
      expect(defaults).toEqual({
        poHistory: "LAST_12_MONTHS",
        includeCustomFields: true,
        includeAttachments: true,
        includeArchivedItems: false,
      });
    });

    it("should parse a valid scope options object", () => {
      const input = {
        poHistory: "ALL",
        includeCustomFields: false,
        includeAttachments: true,
        includeArchivedItems: true,
      };
      const result = parseScopeOptions(input);
      expect(result).toEqual(input);
    });

    it("should reject invalid poHistory values", () => {
      const input = {
        poHistory: "YESTERDAY", // Invalid
        includeCustomFields: true,
        includeAttachments: true,
        includeArchivedItems: false,
      };
      expect(() => parseScopeOptions(input)).toThrow();
    });

    it("should accept OPEN_ONLY as valid poHistory", () => {
      const input = {
        poHistory: "OPEN_ONLY",
        includeCustomFields: true,
        includeAttachments: true,
        includeArchivedItems: false,
      };
      const result = parseScopeOptions(input);
      expect(result.poHistory).toBe("OPEN_ONLY");
    });

    it("should accept SKIP as valid poHistory", () => {
      const input = {
        poHistory: "SKIP",
        includeCustomFields: false,
        includeAttachments: false,
        includeArchivedItems: false,
      };
      const result = parseScopeOptions(input);
      expect(result.poHistory).toBe("SKIP");
    });

    it("should fill in missing fields with defaults", () => {
      const input: Partial<MigrationScopeOptions> = {
        poHistory: "ALL",
      };
      const result = MigrationScopeOptionsSchema.parse(input);
      expect(result.includeCustomFields).toBe(true);
      expect(result.includeAttachments).toBe(true);
      expect(result.includeArchivedItems).toBe(false);
    });

    it("should reject extra fields (strict mode)", () => {
      const input = {
        poHistory: "LAST_12_MONTHS",
        includeCustomFields: true,
        includeAttachments: true,
        includeArchivedItems: false,
        unknownField: "should fail", // Extra field
      };
      expect(() => parseScopeOptions(input)).toThrow();
    });
  });

  describe("saveMappingAction payload shape", () => {
    // Simulate the SaveMappingSchema from route.ts
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

    it("should accept valid fieldMappings + scopeOptions payload", () => {
      const payload = {
        fieldMappings: [
          {
            sourceField: "Product Name",
            targetField: "item.name",
            transformKey: "trim" as const,
            note: "Trim whitespace",
          },
          {
            sourceField: "Cost",
            targetField: "item.costPrice",
            transformKey: "parseNumber" as const,
          },
        ],
        scopeOptions: {
          poHistory: "LAST_12_MONTHS" as const,
          includeCustomFields: true,
          includeAttachments: true,
          includeArchivedItems: false,
        },
      };

      const result = SaveMappingSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fieldMappings).toHaveLength(2);
        expect(result.data.scopeOptions?.poHistory).toBe("LAST_12_MONTHS");
      }
    });

    it("should accept payload with no scopeOptions", () => {
      const payload = {
        fieldMappings: [
          {
            sourceField: "SKU",
            targetField: "item.sku",
          },
        ],
      };

      const result = SaveMappingSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.scopeOptions).toBeUndefined();
      }
    });

    it("should accept empty fieldMappings array", () => {
      const payload = {
        fieldMappings: [],
        scopeOptions: defaultScopeOptions(),
      };

      const result = SaveMappingSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it("should reject fieldMappings without sourceField", () => {
      const payload = {
        fieldMappings: [
          {
            // Missing sourceField
            targetField: "item.name",
          },
        ],
      };

      const result = SaveMappingSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("should reject invalid transformKey", () => {
      const payload = {
        fieldMappings: [
          {
            sourceField: "Name",
            targetField: "item.name",
            transformKey: "invalidTransform", // Invalid
          },
        ],
      };

      const result = SaveMappingSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("should allow note as null", () => {
      const payload = {
        fieldMappings: [
          {
            sourceField: "Name",
            targetField: "item.name",
            note: null,
          },
        ],
      };

      const result = SaveMappingSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  });

  describe("Scope options + field mappings together", () => {
    it("should validate a complete wizard state", () => {
      const state = {
        scopeOptions: {
          poHistory: "OPEN_ONLY" as const,
          includeCustomFields: false,
          includeAttachments: true,
          includeArchivedItems: true,
        },
        fieldMappings: [
          {
            sourceField: "Item ID",
            targetField: "item.sku",
            transformKey: "trim" as const,
          },
          {
            sourceField: "Item Name",
            targetField: "item.name",
          },
          {
            sourceField: "Unit Cost",
            targetField: "item.costPrice",
            transformKey: "parseNumber" as const,
            note: "Convert string to decimal",
          },
        ],
      };

      // Validate scope options
      expect(() => parseScopeOptions(state.scopeOptions)).not.toThrow();

      // Validate field mappings schema
      const mappingsSchema = z.array(
        z.object({
          sourceField: z.string(),
          targetField: z.string(),
          transformKey: z.string().optional(),
          note: z.string().nullable().optional(),
        }),
      );

      const result = mappingsSchema.safeParse(state.fieldMappings);
      expect(result.success).toBe(true);
    });
  });

  describe("Default scope options guard", () => {
    it("should never have undefined poHistory", () => {
      const defaults = defaultScopeOptions();
      expect(defaults.poHistory).toBeDefined();
      expect(defaults.poHistory).toBe("LAST_12_MONTHS");
    });

    it("should allow user to proceed with defaults without changes", () => {
      const defaults = defaultScopeOptions();
      expect(() => parseScopeOptions(defaults)).not.toThrow();
    });
  });
});
