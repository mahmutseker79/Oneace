/**
 * Phase MIG-S1 — externalId ↔ internalId index.
 *
 * During a migration we walk the parsed snapshot phase-by-phase. Each
 * phase resolves foreign keys using external IDs from the source system
 * (e.g. "this Sortly item belongs to Sortly category abc123"). The
 * IdMap is the single place that answers: "given an external id for
 * this entity, what is the OneAce cuid?".
 *
 * Design:
 *   - One map per entity kind, namespaced so there is zero chance of
 *     category-id/item-id collision even if the source reuses slugs.
 *   - An `upsert` helper that first tries the DB (via the unique
 *     (organizationId, externalSource, externalId) index) before
 *     inserting — this is what makes the whole pipeline idempotent.
 *     Re-running a completed migration doesn't duplicate rows.
 *   - No persistence — the map lives for the duration of one import
 *     orchestration. Rehydrate by re-querying the DB (the unique index
 *     guarantees we find the same internalId).
 *
 * Note: this module is database-aware (imports PrismaClient) but stays
 * type-only at the Prisma layer — we inject the client so tests can
 * pass a mock.
 */
import type { MigrationSource, PrismaClient } from "@/generated/prisma";

export type IdMapKind =
  | "CATEGORY"
  | "SUPPLIER"
  | "WAREHOUSE"
  | "LOCATION"
  | "ITEM"
  | "CUSTOM_FIELD_DEF";

/** Lightweight in-memory lookup with a small API surface. */
export class IdMap {
  // kind → externalId → internalId (cuid)
  private readonly tables = new Map<IdMapKind, Map<string, string>>();

  /** Record a resolved (external → internal) mapping. */
  set(kind: IdMapKind, externalId: string, internalId: string): void {
    let table = this.tables.get(kind);
    if (!table) {
      table = new Map();
      this.tables.set(kind, table);
    }
    table.set(externalId, internalId);
  }

  /**
   * Look up an internal cuid by external id. Returns `null` (not
   * undefined) so call sites can check with a single comparison.
   */
  get(kind: IdMapKind, externalId: string | null | undefined): string | null {
    if (!externalId) return null;
    return this.tables.get(kind)?.get(externalId) ?? null;
  }

  /**
   * Throws a descriptive error if the id is missing. Use when a
   * missing id is a bug in the adapter or a snapshot-integrity
   * violation (e.g. a stock level referencing an unknown item).
   */
  require(kind: IdMapKind, externalId: string): string {
    const id = this.get(kind, externalId);
    if (!id) {
      throw new Error(
        `IdMap miss: no internal id for ${kind} externalId=${externalId}. ` +
          `This is a snapshot integrity error — every referenced entity must ` +
          `be imported before its dependents.`,
      );
    }
    return id;
  }

  /**
   * Cardinality snapshot — useful for phase completion logs.
   */
  size(kind: IdMapKind): number {
    return this.tables.get(kind)?.size ?? 0;
  }

  /** Iterate all (externalId, internalId) pairs for a kind. */
  entries(kind: IdMapKind): IterableIterator<[string, string]> {
    const table = this.tables.get(kind);
    return (table ?? new Map<string, string>()).entries();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Idempotent upsert primitives
// ─────────────────────────────────────────────────────────────────────────────
//
// These helpers encapsulate the core "find-by-external-identity, else
// create" pattern. They all take the Prisma client and return the OneAce
// internal cuid. They DO NOT populate the IdMap themselves — the caller
// (the phase-specific importer) does that so the orchestrator stays
// explicit about what got mapped and when.
//
// Each helper relies on the unique index added in the MIG-S1 migration:
//   @@unique([organizationId, externalSource, externalId])
// on Item and CustomFieldDefinition. Category, Supplier, Warehouse,
// Location are handled by name+org lookup since they don't carry the
// external provenance columns yet (V2 schema extension).
// ─────────────────────────────────────────────────────────────────────────────

export interface UpsertContext {
  db: PrismaClient;
  organizationId: string;
  source: MigrationSource;
}

/**
 * Upsert an Item by its (organizationId, externalSource, externalId)
 * identity. Returns the OneAce cuid, creating the row on first call
 * and updating (lightly — only the mutable fields the adapter owns)
 * on subsequent calls.
 *
 * Does NOT touch customFieldValues, stockLevels, or attachments —
 * those are managed by later phases.
 */
export async function upsertItemByExternal(
  ctx: UpsertContext,
  input: {
    externalId: string;
    sku: string;
    name: string;
    barcode?: string | null;
    description?: string | null;
    unit?: string | null;
    costPrice?: number | null;
    salePrice?: number | null;
    currency?: string | null;
    reorderPoint?: number | null;
    reorderQty?: number | null;
    categoryInternalId?: string | null;
    preferredSupplierInternalId?: string | null;
  },
): Promise<string> {
  const existing = await ctx.db.item.findFirst({
    where: {
      organizationId: ctx.organizationId,
      externalSource: ctx.source,
      externalId: input.externalId,
    },
    select: { id: true },
  });

  if (existing) {
    await ctx.db.item.update({
      where: { id: existing.id },
      data: {
        sku: input.sku,
        name: input.name,
        barcode: input.barcode ?? undefined,
        description: input.description ?? undefined,
        unit: input.unit ?? undefined,
        costPrice: input.costPrice ?? undefined,
        salePrice: input.salePrice ?? undefined,
        currency: input.currency ?? undefined,
        reorderPoint: input.reorderPoint ?? undefined,
        reorderQty: input.reorderQty ?? undefined,
        categoryId: input.categoryInternalId ?? undefined,
        preferredSupplierId: input.preferredSupplierInternalId ?? undefined,
      },
    });
    return existing.id;
  }

  const created = await ctx.db.item.create({
    data: {
      organizationId: ctx.organizationId,
      externalSource: ctx.source,
      externalId: input.externalId,
      sku: input.sku,
      name: input.name,
      barcode: input.barcode,
      description: input.description,
      unit: input.unit ?? "each",
      costPrice: input.costPrice,
      salePrice: input.salePrice,
      currency: input.currency ?? "USD",
      reorderPoint: input.reorderPoint ?? 0,
      reorderQty: input.reorderQty ?? 0,
      categoryId: input.categoryInternalId,
      preferredSupplierId: input.preferredSupplierInternalId,
    },
    select: { id: true },
  });
  return created.id;
}

/**
 * Upsert a CustomFieldDefinition by its (organizationId, externalSource,
 * externalId) identity. If the adapter didn't supply an externalId
 * (e.g. Sortly inferred the field from item columns), fall back to
 * matching on (organizationId, entityType, fieldKey).
 */
export async function upsertCustomFieldDefinitionByExternal(
  ctx: UpsertContext,
  input: {
    externalId: string | null;
    entityType: "ITEM" | "SUPPLIER" | "WAREHOUSE" | "PURCHASE_ORDER";
    name: string;
    fieldKey: string;
    fieldType:
      | "TEXT"
      | "NUMBER"
      | "DATE"
      | "BOOLEAN"
      | "SELECT"
      | "MULTI_SELECT"
      | "URL";
    options?: string[] | null;
    isRequired?: boolean;
    defaultValue?: string | null;
    sortOrder?: number | null;
  },
): Promise<string> {
  const findBy = input.externalId
    ? {
        organizationId: ctx.organizationId,
        externalSource: ctx.source,
        externalId: input.externalId,
      }
    : {
        organizationId: ctx.organizationId,
        entityType: input.entityType,
        fieldKey: input.fieldKey,
      };

  const existing = await ctx.db.customFieldDefinition.findFirst({
    where: findBy,
    select: { id: true },
  });

  if (existing) {
    await ctx.db.customFieldDefinition.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        fieldType: input.fieldType,
        options: input.options ? (input.options as unknown as object) : undefined,
        isRequired: input.isRequired ?? undefined,
        defaultValue: input.defaultValue ?? undefined,
        sortOrder: input.sortOrder ?? undefined,
      },
    });
    return existing.id;
  }

  const created = await ctx.db.customFieldDefinition.create({
    data: {
      organizationId: ctx.organizationId,
      entityType: input.entityType,
      name: input.name,
      fieldKey: input.fieldKey,
      fieldType: input.fieldType,
      options: input.options ? (input.options as unknown as object) : undefined,
      isRequired: input.isRequired ?? false,
      defaultValue: input.defaultValue,
      sortOrder: input.sortOrder ?? 0,
      externalSource: input.externalId ? ctx.source : null,
      externalId: input.externalId,
    },
    select: { id: true },
  });
  return created.id;
}
