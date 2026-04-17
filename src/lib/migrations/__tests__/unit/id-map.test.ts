import { IdMap } from "@/lib/migrations/core/id-map";
import { describe, expect, it } from "vitest";

describe("IdMap", () => {
  describe("set and get", () => {
    it("round-trip sets and gets values by kind", () => {
      const map = new IdMap();
      map.set("CATEGORY", "ext-cat-1", "cuid-cat-1");
      map.set("ITEM", "ext-item-1", "cuid-item-1");

      expect(map.get("CATEGORY", "ext-cat-1")).toBe("cuid-cat-1");
      expect(map.get("ITEM", "ext-item-1")).toBe("cuid-item-1");
    });

    it("returns null for missing kind", () => {
      const map = new IdMap();
      map.set("CATEGORY", "ext-cat-1", "cuid-cat-1");
      expect(map.get("SUPPLIER", "ext-cat-1")).toBeNull();
    });

    it("returns null for missing externalId", () => {
      const map = new IdMap();
      map.set("CATEGORY", "ext-cat-1", "cuid-cat-1");
      expect(map.get("CATEGORY", "ext-cat-missing")).toBeNull();
    });

    it("handles null/undefined externalId gracefully", () => {
      const map = new IdMap();
      map.set("CATEGORY", "ext-cat-1", "cuid-cat-1");
      expect(map.get("CATEGORY", null)).toBeNull();
      expect(map.get("CATEGORY", undefined)).toBeNull();
    });

    it("namespaces ids by kind — no collision across kinds", () => {
      const map = new IdMap();
      const id = "same-external-id";
      map.set("CATEGORY", id, "cuid-cat");
      map.set("ITEM", id, "cuid-item");

      expect(map.get("CATEGORY", id)).toBe("cuid-cat");
      expect(map.get("ITEM", id)).toBe("cuid-item");
    });
  });

  describe("require", () => {
    it("returns value if found", () => {
      const map = new IdMap();
      map.set("CATEGORY", "ext-cat-1", "cuid-cat-1");
      expect(map.require("CATEGORY", "ext-cat-1")).toBe("cuid-cat-1");
    });

    it("throws descriptive error if not found", () => {
      const map = new IdMap();
      expect(() => map.require("CATEGORY", "missing-id")).toThrow(
        /IdMap miss: no internal id for CATEGORY externalId=missing-id/,
      );
    });

    it("error message mentions snapshot integrity", () => {
      const map = new IdMap();
      expect(() => map.require("ITEM", "ext-item-missing")).toThrow(/snapshot integrity error/);
    });
  });

  describe("size", () => {
    it("returns count of mapped ids for a kind", () => {
      const map = new IdMap();
      map.set("CATEGORY", "ext-cat-1", "cuid-cat-1");
      map.set("CATEGORY", "ext-cat-2", "cuid-cat-2");
      map.set("ITEM", "ext-item-1", "cuid-item-1");

      expect(map.size("CATEGORY")).toBe(2);
      expect(map.size("ITEM")).toBe(1);
    });

    it("returns 0 for unmapped kind", () => {
      const map = new IdMap();
      expect(map.size("SUPPLIER")).toBe(0);
    });
  });

  describe("entries", () => {
    it("iterates (externalId, internalId) pairs for a kind", () => {
      const map = new IdMap();
      map.set("CATEGORY", "ext-cat-1", "cuid-cat-1");
      map.set("CATEGORY", "ext-cat-2", "cuid-cat-2");

      const entries = Array.from(map.entries("CATEGORY"));
      expect(entries).toHaveLength(2);
      expect(entries).toContainEqual(["ext-cat-1", "cuid-cat-1"]);
      expect(entries).toContainEqual(["ext-cat-2", "cuid-cat-2"]);
    });

    it("returns empty iterator for unmapped kind", () => {
      const map = new IdMap();
      const entries = Array.from(map.entries("SUPPLIER"));
      expect(entries).toHaveLength(0);
    });

    it("maintains insertion order", () => {
      const map = new IdMap();
      map.set("ITEM", "ext-item-1", "cuid-item-1");
      map.set("ITEM", "ext-item-2", "cuid-item-2");
      map.set("ITEM", "ext-item-3", "cuid-item-3");

      const entries = Array.from(map.entries("ITEM"));
      expect(entries[0]?.[0]).toBe("ext-item-1");
      expect(entries[1]?.[0]).toBe("ext-item-2");
      expect(entries[2]?.[0]).toBe("ext-item-3");
    });
  });
});
