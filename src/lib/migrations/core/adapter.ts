/**
 * Phase MIG-S2 — Migration adapter interface.
 *
 * Every source system (Sortly, inFlow, Fishbowl, Cin7 Core, SOS Inventory)
 * implements this interface. The orchestrator is source-agnostic; it calls
 * the adapter's methods in a predictable sequence:
 *
 *   1. detectFiles(uploadedFiles) → FileDetectionResult[]
 *   2. parse(uploadedFiles) → ParsedSnapshot
 *   3. suggestMappings(snapshot) → FieldMapping[]
 *   4. validate(snapshot, mappings, scope) → ValidationReport
 *   5. (during import) importer calls runMigrationImport(snapshot)
 */

import type { MigrationSource } from "@/generated/prisma";
import type {
  FieldMapping,
  FileDetectionResult,
  ParsedSnapshot,
  ValidationReport,
} from "@/lib/migrations/core/types";

/**
 * A file uploaded by the user, with metadata.
 * Buffer is the raw bytes; filename and mimeType are from the HTTP upload.
 */
export interface UploadedFile {
  filename: string;
  mimeType?: string;
  buffer: Buffer;
}

/**
 * Contract that every migration source must implement.
 * Source adapters live in src/lib/migrations/{sortly,inflow}/.
 */
export interface MigrationAdapter {
  /**
   * The source system this adapter handles (SORTLY, INFLOW, etc.).
   */
  readonly source: MigrationSource;

  /**
   * Method: CSV, API, or HYBRID (e.g. HYBRID if we fetch metadata via API
   * but download data as CSV for efficiency).
   */
  readonly method: "CSV" | "API" | "HYBRID";

  /**
   * Filenames this adapter expects (regex patterns or glob-like strings).
   * Used by the upload UI to hint at what files to look for.
   * E.g. ["items.csv", "vendors.csv", "stock_levels.csv"] for inFlow.
   */
  readonly supportedFiles: string[];

  /**
   * Inspect the uploaded files and report what was found.
   * Returns a list of detected files with confidence levels, so the UI can
   * warn if critical files are missing (e.g. "Products.csv not found").
   *
   * Must not throw; invalid files → FileDetectionResult with severity=WARNING.
   */
  detectFiles(files: UploadedFile[]): Promise<FileDetectionResult[]>;

  /**
   * Parse the uploaded files into the canonical ParsedSnapshot format.
   * The snapshot is OneAce-agnostic; it contains only the raw entities
   * that came from the source system (externalIds, not OneAce cuids).
   *
   * Throws on unrecoverable errors (missing critical file, corrupt CSV, etc.).
   * Recoverable issues (invalid values, missing optional fields) are logged
   * but do NOT stop parsing.
   *
   * The optional `fieldMappings` arg is the raw `MigrationJob.fieldMappings`
   * JSON. CSV adapters usually ignore it (mapping is applied by the
   * importer). API adapters (Cin7, SOS, QBO, inFlow-API) read their
   * `credentials` sub-object from it — they have no files to parse.
   */
  parse(
    files: UploadedFile[],
    fieldMappings?: Record<string, unknown>,
  ): Promise<ParsedSnapshot>;

  /**
   * Given a snapshot, suggest field mappings for custom fields.
   * Called after parse() so the UI can show "we found these custom fields
   * in your export; here's what we think they map to".
   *
   * Returns an array of { externalFieldKey, suggestedOneAceField, confidence }.
   * Empty array is valid if there are no custom fields or the adapter can't guess.
   */
  suggestMappings(snapshot: ParsedSnapshot): FieldMapping[];

  /**
   * Validate the snapshot + mappings + scope options before import.
   * This is the user's last chance to see errors before we write to the DB.
   *
   * Performs checks like:
   *   - Category parent cycle detection
   *   - SKU collision warnings
   *   - Missing required fields (e.g. every item must have a SKU)
   *   - Warehouse reference validity
   *   - Date format correctness
   *
   * Returns a ValidationReport with issues categorized as ERROR / WARNING / INFO.
   * The import is allowed to proceed even with WARNINGs, but not ERRORs.
   */
  validate(
    snapshot: ParsedSnapshot,
    mappings: FieldMapping[],
    scope: any, // MigrationScopeOptions — imported here to avoid circular deps
  ): ValidationReport;
}

/**
 * Factory function — given a source, return the adapter.
 * Lazy-loads the adapter module so importing this file is cheap.
 *
 * For INFLOW, this returns the CSV adapter. To use API mode, the caller
 * must explicitly request INFLOW_API mode or check fieldMappings.credentials.
 */
export async function getAdapterFor(
  source: MigrationSource,
): Promise<MigrationAdapter> {
  switch (source) {
    case "SORTLY":
      return (
        await import("@/lib/migrations/sortly/adapter")
      ).SORTLY_ADAPTER;
    case "INFLOW":
      // Dispatcher: check if fieldMappings has credentials to decide CSV vs API
      // For now, return CSV adapter. Orchestrator will switch to API if needed.
      return (
        await import("@/lib/migrations/inflow/adapter")
      ).INFLOW_ADAPTER;
    case "CIN7":
      return (
        await import("@/lib/migrations/cin7/adapter")
      ).CIN7_ADAPTER;
    case "SOS_INVENTORY":
      return (
        await import("@/lib/migrations/sos-inventory/adapter")
      ).SOS_INVENTORY_ADAPTER;
    case "FISHBOWL":
      return (
        await import("@/lib/migrations/fishbowl/adapter")
      ).FISHBOWL_ADAPTER;
    case "QUICKBOOKS_ONLINE":
      return (
        await import("@/lib/migrations/quickbooks-online/adapter")
      ).QBO_MIGRATION_ADAPTER;
    case "QUICKBOOKS_DESKTOP":
      return (
        await import("@/lib/migrations/quickbooks-desktop/adapter")
      ).QBD_ADAPTER;
    default:
      throw new Error(`No adapter for migration source: ${source}`);
  }
}

/**
 * Get the inFlow API mode adapter explicitly.
 * Called when the user chooses "Enter API credentials" instead of uploading files.
 */
export async function getInflowApiAdapter(): Promise<MigrationAdapter> {
  return (
    await import("@/lib/migrations/inflow-api/adapter")
  ).INFLOW_API_ADAPTER;
}
