# OneAce Migrations — Architecture Overview

**Last updated: 2026-04-17**

## What is the Migrations Subsystem?

OneAce Migrations enables one-time imports from five competitor inventory management systems into OneAce's PostgreSQL database. The subsystem handles schema normalization, dependency sequencing, attachment uploads, custom field resolution, and rollback.

### Supported Sources

| Source | Method | Files | Status |
|--------|--------|-------|--------|
| **Sortly** | CSV | Single ZIP with items.csv + images/ | ✓ Stable (S2) |
| **inFlow** | CSV or REST API | Multi-CSV exports or token-based fetch | ✓ Stable (S2+S5) |
| **Fishbowl** | CSV | Multi-file exports (Items, Vendors, POs) | ✓ Stable (S6) |
| **Cin7 Core** | REST API | OAuth token (Cin7 app credentials) | ✓ Stable (S5) |
| **SOS Inventory** | OAuth or Token | QuickBooks-native SMB tool | ✓ Stable (S5) |
| **QuickBooks Online** | OAuth API | Access + Refresh tokens, Realm ID | ✓ Stable (QB Wave) |
| **QuickBooks Desktop** | IIF Export | `.iif` file from QBD export utility | ✓ Stable (QB Wave) |

---

## Nine-Phase Import Pipeline

Every migration flows through the same deterministic sequence. Phases run in serial, each in its own Prisma transaction. If any phase fails, the job halts and earlier phases' results are retained (for rollback).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       MIGRATION IMPORT PIPELINE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Phase 1: CATEGORIES                                                       │
│  ├─ Topological sort (self-referential parent → child)                    │
│  └─ Idempotency: externalSource + externalId → deduplicate               │
│                                                                             │
│  Phase 2: SUPPLIERS + WAREHOUSES (parallel, no FK dependency)              │
│  ├─ Both created in independent write transactions                         │
│  └─ Supplier → PurchaseOrder; Warehouse → StockLevel                       │
│                                                                             │
│  Phase 3: LOCATIONS                                                        │
│  ├─ Per-warehouse sublocation hierarchy (bin labels)                      │
│  └─ Parent-location FK resolution via id-map                              │
│                                                                             │
│  Phase 4: CUSTOM_FIELD_DEFS [optional, if scope.includeCustomFields]       │
│  ├─ Defines schema for item extended attributes                           │
│  └─ Type: TEXT / NUMBER / DATE / BOOLEAN / SELECT / MULTI_SELECT / URL    │
│                                                                             │
│  Phase 5: ITEMS                                                            │
│  ├─ Requires: CATEGORIES, SUPPLIERS (via FK)                              │
│  ├─ Resolves: externalId → Category.id, Supplier.id                       │
│  └─ Validates: SKU must be unique per org + non-null                      │
│                                                                             │
│  Phase 6: CUSTOM_FIELD_VALUES [optional, if scope.includeCustomFields]     │
│  ├─ Item-scoped attribute values (one row per item+field)                 │
│  └─ Type validation: valueText, valueNumber, valueDate, etc.              │
│                                                                             │
│  Phase 7: STOCK_LEVELS                                                     │
│  ├─ Requires: ITEMS, WAREHOUSES, LOCATIONS                                │
│  ├─ Allows: negative quantities (flagged as WARNING)                      │
│  └─ Can include bin-level granularity if source provides it               │
│                                                                             │
│  Phase 8: ATTACHMENTS [optional, if scope.includeAttachments]              │
│  ├─ Downloads from source URLs or extracts from ZIP                       │
│  ├─ Uploads to Vercel Blob (non-blocking: failures → warnings)            │
│  └─ Supported: PNG, JPG, PDF, CSV, XLS                                    │
│                                                                             │
│  Phase 9: PURCHASE_ORDERS [optional, conditional on scope.poHistory]       │
│  ├─ Requires: ITEMS, SUPPLIERS, WAREHOUSES                                │
│  ├─ Status mapping: source → OneAce PurchaseOrderStatus enum              │
│  └─ Date filtering: ALL / LAST_12_MONTHS / OPEN_ONLY                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Invariants

1. **Idempotency**: Each row is identified by `externalSource` + `externalId`. Re-running an import does not double-create rows.
2. **Per-Phase Transactions**: If phase N fails, phases 1..N-1 are persisted; phases N+1..9 do not run. Rollback can undo all created rows.
3. **Non-Blocking Attachments**: If an attachment URL is unreachable, the phase logs a WARNING but continues.
4. **Scope-Based Skipping**: If scope excludes custom fields, CUSTOM_FIELD_DEFS and CUSTOM_FIELD_VALUES phases are skipped. If `poHistory: "SKIP"`, PURCHASE_ORDERS is skipped.
5. **Custom Field Laziness**: Field definitions can be declared up-front (Sortly, Cin7) or inferred from observed values in items (inFlow CSV, Fishbowl).

---

## MigrationJob State Machine

```
                   ┌─── FILES_UPLOADED
                   │         ↓
   PENDING  ──→  FILES_UPLOADED  ──→  MAPPING_REVIEW  ──→  VALIDATING
                                                              ↓
                                                        VALIDATED  ──→  IMPORTING  ──→  COMPLETED
                                                              ↓              ↓
                                                           FAILED ←────────┘
                                                              ↑
                                                        CANCELLED
```

| Status | Meaning | Allowed Actions |
|--------|---------|-----------------|
| **PENDING** | Job created, no files uploaded. | Upload files → FILES_UPLOADED |
| **FILES_UPLOADED** | ZIP/CSV files stored in Vercel Blob. | Detect + parse → MAPPING_REVIEW |
| **MAPPING_REVIEW** | User reviews field mappings and scope options. | Validate → VALIDATING |
| **VALIDATING** | API is running pre-import checks. | (internal) |
| **VALIDATED** | All checks passed; ready to import. | Start import → IMPORTING |
| **IMPORTING** | Phases 1–9 running. | (internal; can cancel) |
| **COMPLETED** | All 9 phases succeeded. | View results; rollback (soft-delete) |
| **FAILED** | A phase failed mid-import. | View error report; retry (→ VALIDATED) or rollback |
| **CANCELLED** | User cancelled during IMPORTING. | Rollback (undo created rows) |

---

## Architecture: File Organization

```
src/lib/migrations/
├── core/                            # Shared logic (no source-specific code)
│   ├── types.ts                     # ParsedSnapshot, RawItem, RawCategory, etc.
│   ├── adapter.ts                   # MigrationAdapter interface
│   ├── importer.ts                  # runMigrationImport() orchestrator
│   ├── scope-options.ts             # MigrationScopeOptions schema + parsing
│   ├── rollback.ts                  # rollbackMigration() engine
│   ├── id-map.ts                    # externalId → internalId resolution
│   ├── csv-utils.ts                 # CSV parsing, delimiter sniffing
│   ├── date-utils.ts                # ISO 8601 parsing
│   ├── attachments.ts               # Vercel Blob upload + handling
│   ├── conflict-resolver.ts         # SKU collision detection
│   ├── topological-sort.ts          # Category parent-child ordering
│   └── phases/                      # Phase implementations
│       ├── categories.ts
│       ├── suppliers.ts
│       ├── warehouses.ts
│       ├── locations.ts
│       ├── custom-field-defs.ts
│       ├── items.ts
│       ├── custom-field-values.ts
│       ├── stock-levels.ts
│       ├── attachments.ts
│       └── purchase-orders.ts
│
├── sortly/                          # Sortly CSV adapter
│   ├── adapter.ts                   # SORTLY_ADAPTER implementation
│   ├── csv-parser.ts                # Parse Sortly items.csv → ParsedSnapshot
│   └── default-mappings.ts          # Keyword-based field mapping suggestions
│
├── inflow/                          # inFlow adapter (CSV + API)
│   ├── adapter.ts                   # INFLOW_ADAPTER (dispatcher)
│   ├── parser.ts                    # CSV parser
│   ├── api-client.ts                # REST API client
│   └── default-mappings.ts
│
├── fishbowl/                        # Fishbowl CSV adapter
│   ├── adapter.ts                   # FISHBOWL_ADAPTER
│   ├── csv-parser.ts
│   ├── status-map.ts                # PO status → PurchaseOrderStatus
│   └── default-mappings.ts
│
├── cin7/                            # Cin7 Core API adapter
│   ├── adapter.ts                   # CIN7_ADAPTER
│   ├── api-client.ts                # Cin7 API v2 client
│   └── default-mappings.ts
│
└── sos-inventory/                   # SOS Inventory OAuth adapter
    ├── adapter.ts                   # SOS_INVENTORY_ADAPTER
    ├── api-client.ts                # QuickBooks/SOS OAuth + API
    └── default-mappings.ts

src/app/api/migrations/
├── route.ts                         # POST /api/migrations → create job
├── [id]/
│   ├── route.ts                     # GET/DELETE for job details
│   ├── upload/route.ts              # POST [id]/upload → store files
│   ├── detect/route.ts              # POST [id]/detect → file detection
│   ├── mapping/route.ts             # POST [id]/mapping → auto-suggest mappings
│   ├── validate/route.ts            # POST [id]/validate → pre-flight checks
│   ├── start/route.ts               # POST [id]/start → begin IMPORTING
│   ├── status/route.ts              # GET [id]/status → progress polling
│   ├── cancel/route.ts              # POST [id]/cancel → abort IMPORTING
│   └── rollback/route.ts            # POST [id]/rollback → undo created rows
```

---

## Prisma Schema Models

### Core Migration Models

**MigrationJob**
- `id` (String, primary key, cuid)
- `organizationId` (String, FK → Organization)
- `source` (Enum: SORTLY, INFLOW, FISHBOWL, CIN7, SOS_INVENTORY, ...)
- `status` (Enum: PENDING, FILES_UPLOADED, MAPPING_REVIEW, VALIDATING, VALIDATED, IMPORTING, COMPLETED, FAILED, CANCELLED)
- `sourceFiles` (String, nullable; Vercel Blob URL or base64-encoded ZIP)
- `parsedSnapshot` (JSON; the canonicalized ParsedSnapshot)
- `fieldMappings` (JSON array; user-edited FieldMapping[])
- `scopeOptions` (JSON; validated MigrationScopeOptions)
- `importResults` (JSON array; PhaseResult[] from each of 9 phases)
- `importedAt` (DateTime, nullable; when import completed)
- `rollbackedAt` (DateTime, nullable; when rollback was executed)
- `createdAt`, `updatedAt` (DateTime)

**CustomFieldDefinition**
- `id`, `organizationId` (FK), `externalSource` (MigrationSource), `externalId`
- `name`, `fieldKey` (unique per org + externalSource)
- `fieldType` (Enum: TEXT, NUMBER, DATE, BOOLEAN, SELECT, MULTI_SELECT, URL)
- `entity` (CustomFieldEntity; currently ITEM only)
- `isRequired`, `options` (for SELECT/MULTI_SELECT)

**ItemCustomFieldValue**
- `id`, `itemId` (FK → Item), `customFieldDefinitionId` (FK)
- `valueText`, `valueNumber`, `valueDate`, `valueBoolean`, `valueJson` (exactly one is non-null)

---

## How to Use the Migrations System

### For End-Users

1. **Step 1: Onboarding** — During wizard Step 3 ("Where is your inventory?"), select a migration source.
2. **Step 2: File Upload** — Upload your export (ZIP for Sortly, CSVs for inFlow/Fishbowl, credentials for Cin7/SOS).
3. **Step 3: Review Mappings** — Map source columns to OneAce fields. Auto-suggestions provided.
4. **Step 4: Scope & Validate** — Choose: import all POs or just recent ones? Include attachments? Custom fields?
5. **Step 5: Import** — Click "Start Migration" and monitor progress.
6. **Step 6: Verify** — Check OneAce dashboard for your items, suppliers, warehouses. If needed, rollback and retry.

### For Operators

- **Monitor active migrations**: Query `MigrationJob WHERE status = 'IMPORTING'`.
- **Inspect failures**: Read `importResults` JSON for per-phase error details.
- **Manual rollback**: Call `POST /api/migrations/:id/rollback` or execute `rollbackMigration()` directly.
- **Cleanup**: After successful COMPLETED migrations, source files in Vercel Blob can be purged (prefix `migrations/{orgId}/`).

---

## Quick Reference: Enum Values

### MigrationStatus
```
PENDING, FILES_UPLOADED, MAPPING_REVIEW, VALIDATING, VALIDATED, IMPORTING, COMPLETED, FAILED, CANCELLED
```

### MigrationSource
```
SORTLY, INFLOW, FISHBOWL, CIN7, SOS_INVENTORY
(Also in schema: ODOO, ZOHO_INVENTORY, KATANA, LIGHTSPEED, QUICKBOOKS_COMMERCE, DEAR_SYSTEMS, GENERIC_CSV)
```

### CustomFieldType
```
TEXT, NUMBER, DATE, BOOLEAN, SELECT, MULTI_SELECT, URL
```

### PoHistoryScope (scope-options)
```
ALL, LAST_12_MONTHS, OPEN_ONLY, SKIP
```

---

## Next Steps

- **Sortly Guide**: [sortly.md](./sortly.md) — Step-by-step export & import walkthrough
- **inFlow Guide**: [inflow.md](./inflow.md) — CSV vs. API mode, credential setup
- **Fishbowl Guide**: [fishbowl.md](./fishbowl.md) — Multi-file export, UOM handling
- **Cin7 Core Guide**: [cin7.md](./cin7.md) — OAuth token generation
- **SOS Inventory Guide**: [sos-inventory.md](./sos-inventory.md) — QuickBooks integration
- **Field Mapping Reference**: [field-mapping-reference.md](./field-mapping-reference.md) — Source field → OneAce mapping tables
- **Operational Runbook**: [runbook.md](./runbook.md) — On-call procedures, monitoring, manual interventions

---

## Additional Resources

- **Adapter Interface**: `src/lib/migrations/core/adapter.ts`
- **Type Definitions**: `src/lib/migrations/core/types.ts`
- **Importer Orchestrator**: `src/lib/migrations/core/importer.ts`
- **API Routes**: `src/app/api/migrations/`
- **Prisma Schema**: `prisma/schema.prisma` (search for `model MigrationJob`, `model CustomFieldDefinition`, etc.)
