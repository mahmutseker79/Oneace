/**
 * Phase MIG-S1 — Core types for the competitor migration pipeline.
 *
 * These types describe the normalized "mid-state" between a competitor's
 * raw export (CSV, API JSON, ZIP of files) and OneAce's Prisma models.
 * Each adapter (Sortly, inFlow, Fishbowl, Cin7 Core, SOS Inventory) is
 * responsible for producing a `ParsedSnapshot` from whatever the source
 * system hands us; the core `importer.ts` is responsible for writing a
 * snapshot into the database in the correct dependency order.
 *
 * Design rule: Raw* types MUST be serializable as JSON (so we can persist
 * them on MigrationJob for resumability) and MUST NOT contain OneAce
 * database IDs. The id-map layer resolves externalId → internalId at
 * write time.
 */
import type {
  CustomFieldType,
  ItemStatus,
  MigrationSource,
  PurchaseOrderStatus,
} from "@/generated/prisma";

// ─────────────────────────────────────────────────────────────────────────────
// Canonical normalized entities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A category row from the source system. `parentExternalId` must point to
 * another `RawCategory.externalId` in the same snapshot; topological
 * ordering is the importer's responsibility, not the adapter's.
 */
export interface RawCategory {
  /** Stable ID in the source system — never an OneAce cuid. */
  externalId: string;
  name: string;
  parentExternalId: string | null;
  /** Optional free-text description; source systems that lack this pass null. */
  description?: string | null;
}

export interface RawSupplier {
  externalId: string;
  name: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  /** e.g. USD, EUR — defaults to org currency if missing. */
  currency?: string | null;
  notes?: string | null;
}

export interface RawWarehouse {
  externalId: string;
  name: string;
  code?: string | null;
  address?: string | null;
  isDefault?: boolean;
}

/**
 * A location / bin within a warehouse. Sortly calls these "folders",
 * inFlow calls them "sublocations", Fishbowl calls them "tag" or
 * "location groups". Normalized to warehouse-scoped name + optional code.
 */
export interface RawLocation {
  externalId: string;
  warehouseExternalId: string;
  name: string;
  code?: string | null;
  parentLocationExternalId?: string | null;
}

export interface RawItem {
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
  status?: ItemStatus | null;
  /** Resolves to OneAce Category during import via id-map. */
  categoryExternalId?: string | null;
  /** Resolves to OneAce Supplier during import via id-map. */
  preferredSupplierExternalId?: string | null;
  /**
   * Key → Value mapping of custom fields. The import engine creates
   * `CustomFieldDefinition` rows lazily based on the union of keys
   * observed across RawItems for a given source.
   */
  customFieldValues?: Record<string, RawCustomFieldValue> | null;
}

/**
 * Intermediate shape for a single custom-field value on a raw item.
 * Carries the inferred type so the importer can route it to the right
 * typed column on ItemCustomFieldValue without re-inspecting.
 */
export interface RawCustomFieldValue {
  fieldType: CustomFieldType;
  /** Populated exactly one: text / number / date / boolean / json. */
  valueText?: string | null;
  valueNumber?: number | null;
  valueDate?: string | null; // ISO 8601
  valueBoolean?: boolean | null;
  /** For MULTI_SELECT — array of selected option keys. */
  valueJson?: unknown;
}

/**
 * Definitions declared up-front by a source system (Sortly and Cin7 expose
 * custom field schemas via dedicated endpoints). Adapters that only see
 * values in item rows may leave this array empty; the importer infers
 * definitions from the observed value set.
 */
export interface RawCustomFieldDef {
  externalId: string;
  name: string;
  fieldKey: string;
  fieldType: CustomFieldType;
  /** SELECT / MULTI_SELECT options (strings). */
  options?: string[] | null;
  isRequired?: boolean;
  defaultValue?: string | null;
  sortOrder?: number | null;
}

export interface RawStockLevel {
  itemExternalId: string;
  warehouseExternalId: string;
  /** Bin/location within the warehouse, if the source tracks sub-location. */
  locationExternalId?: string | null;
  /** Source systems allow negatives; we keep them and warn in validation. */
  quantity: number;
}

export interface RawPurchaseOrder {
  externalId: string;
  /** Source-assigned PO number, e.g. "PO-2024-0042". */
  poNumber: string;
  supplierExternalId: string;
  status: PurchaseOrderStatus | string;
  /** ISO 8601. */
  orderDate?: string | null;
  expectedDate?: string | null;
  currency?: string | null;
  notes?: string | null;
  lines: RawPurchaseOrderLine[];
}

export interface RawPurchaseOrderLine {
  itemExternalId: string;
  quantity: number;
  unitCost?: number | null;
}

/**
 * An attachment (product photo / spec sheet) tied to an item. URLs may
 * be absolute (http(s)) or relative to a ZIP/blob the adapter is able
 * to resolve later. The importer downloads and re-uploads to Vercel
 * Blob so the final stored URL is under OneAce control.
 */
export interface RawAttachment {
  itemExternalId: string;
  /** Either a URL or a path inside the uploaded archive. */
  sourceRef: string;
  filename: string;
  mimeType?: string | null;
  /** Bytes, if already extracted in-memory by the adapter. */
  inlineBuffer?: Uint8Array;
}

// ─────────────────────────────────────────────────────────────────────────────
// The snapshot the adapter produces
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The normalized, OneAce-agnostic dump the adapter hands to the importer.
 * Ordering within each array is unimportant — the importer handles
 * parent-child and cross-entity sequencing.
 */
export interface ParsedSnapshot {
  source: MigrationSource;
  /** ISO 8601 — when the adapter produced this snapshot. */
  parsedAt: string;
  categories: RawCategory[];
  suppliers: RawSupplier[];
  warehouses: RawWarehouse[];
  locations: RawLocation[];
  customFieldDefs: RawCustomFieldDef[];
  items: RawItem[];
  stockLevels: RawStockLevel[];
  purchaseOrders: RawPurchaseOrder[];
  attachments: RawAttachment[];
  /**
   * Notes the adapter wants the UI to surface (e.g. "12 rows skipped
   * because they had no SKU"). These don't block the import.
   */
  adapterWarnings: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Field detection & mapping
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Multi-file exports (Sortly ZIP, inFlow multi-CSV, Fishbowl dump) need
 * to be routed to the right entity parser. Adapters implement this via
 * filename heuristics and column sniffing.
 */
export interface FileDetectionResult {
  /** The original File / archive-entry identifier. */
  fileRef: string;
  /** Which entity this file appears to carry. */
  entity:
    | "CATEGORY"
    | "SUPPLIER"
    | "WAREHOUSE"
    | "LOCATION"
    | "ITEM"
    | "STOCK_LEVEL"
    | "PURCHASE_ORDER"
    | "CUSTOM_FIELD_DEF"
    | "ATTACHMENT"
    | "UNKNOWN";
  /** 0..1 — how sure the detector is. Below 0.5 we ask the user. */
  confidence: number;
  /** Which header hint matched, for UI transparency. */
  matchedHeaders?: string[];
}

/**
 * A single field mapping edited (or auto-suggested) in the wizard:
 * "Sortly's `Item Name` column → OneAce's `Item.name` field".
 *
 * Persisted on MigrationJob.fieldMappings so an import can be resumed
 * or audited after the fact.
 */
export interface FieldMapping {
  sourceField: string;
  /** Dot-path into the Raw* target, e.g. "item.name", "stockLevel.quantity". */
  targetField: string;
  /**
   * Optional transform — one of a small canonical set that the UI can
   * expose. The importer loads the actual transform fn by key.
   */
  transformKey?:
    | "trim"
    | "uppercase"
    | "lowercase"
    | "parseNumber"
    | "parseIsoDate"
    | "parseBoolean"
    | "splitPipe"
    | "splitComma";
  /** Per-mapping notes for the auditor. */
  note?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation & import reports
// ─────────────────────────────────────────────────────────────────────────────

export type ValidationSeverity = "ERROR" | "WARNING" | "INFO";

export interface ValidationIssue {
  severity: ValidationSeverity;
  entity: string;
  /** External ID of the offending row, when available. */
  externalId?: string | null;
  /** The field the issue is about, e.g. "sku" or "stockLevel.quantity". */
  field?: string | null;
  code: string; // machine-readable, e.g. "DUPLICATE_SKU"
  message: string; // human-readable
}

export interface ValidationReport {
  generatedAt: string;
  totals: Record<string, { rows: number; errors: number; warnings: number }>;
  issues: ValidationIssue[];
}

/**
 * Result of a finished (successful or failed) import phase. We store
 * enough detail on MigrationJob.importResults to enable rollback.
 */
export interface PhaseResult {
  phase: ImportPhase;
  startedAt: string;
  completedAt: string;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  /** cuids of rows created in this phase; used by rollback. */
  createdIds: string[];
  errors: ValidationIssue[];
}

export type ImportPhase =
  | "CATEGORIES"
  | "SUPPLIERS"
  | "WAREHOUSES"
  | "LOCATIONS"
  | "CUSTOM_FIELD_DEFS"
  | "ITEMS"
  | "CUSTOM_FIELD_VALUES"
  | "STOCK_LEVELS"
  | "ATTACHMENTS"
  | "PURCHASE_ORDERS";

export interface MigrationImportResult {
  success: boolean;
  migrationJobId: string;
  startedAt: string;
  completedAt: string;
  phases: PhaseResult[];
  /** Summary for quick UI display. */
  totals: {
    items: number;
    categories: number;
    suppliers: number;
    warehouses: number;
    locations: number;
    stockLevels: number;
    purchaseOrders: number;
    attachments: number;
    customFieldDefs: number;
    customFieldValues: number;
  };
}
