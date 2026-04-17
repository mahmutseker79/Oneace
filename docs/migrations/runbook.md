# Migration Operations Runbook

**Last updated: 2026-04-17**

For on-call engineers and ops staff. All commands assume PostgreSQL CLI (`psql`) or Prisma Studio access.

---

## 1. List Active Migrations

### SQL Query

```sql
SELECT id, "organizationId", source, status, "createdAt", "updatedAt"
FROM "MigrationJob"
WHERE status IN ('IMPORTING', 'VALIDATING', 'FILES_UPLOADED', 'MAPPING_REVIEW')
ORDER BY "createdAt" DESC;
```

### Prisma CLI

```bash
npx prisma studio
# Navigate to MigrationJob table, filter by status
```

### Expected Output

```
                    id                 | organizationId |  source  |   status   |      createdAt       |     updatedAt      
───────────────────────────────────────┼────────────────┼──────────┼────────────┼──────────────────────┼─────────────────────
 clh7abcd1234567890abcdef | org_001        | SORTLY   | IMPORTING | 2026-04-17 14:30:00 | 2026-04-17 14:31:00
```

---

## 2. View Migration Details

### Get Full Job State

```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://oneace-app.vercel.app/api/migrations/<MIGRATION_JOB_ID>
```

Returns:

```json
{
  "migration": {
    "id": "clh7abcd...",
    "organizationId": "org_001",
    "source": "SORTLY",
    "status": "IMPORTING",
    "sourceFiles": "blob://vercel-blob-url/...",
    "parsedSnapshot": { /* 9 phases of data */ },
    "fieldMappings": [ /* user-edited mappings */ ],
    "scopeOptions": { "poHistory": "LAST_12_MONTHS", "includeCustomFields": true },
    "importResults": [ /* PhaseResult[] — one per phase completed */ ],
    "importedAt": null,
    "rollbackedAt": null,
    "createdAt": "2026-04-17T14:30:00Z",
    "updatedAt": "2026-04-17T14:31:45Z"
  }
}
```

### View Import Results (Per Phase)

```sql
SELECT 
  id, 
  source, 
  status,
  (importResults::jsonb)::text AS results
FROM "MigrationJob"
WHERE id = '<MIGRATION_JOB_ID>';
```

Example `importResults`:

```json
[
  {
    "phase": "CATEGORIES",
    "startedAt": "2026-04-17T14:31:00Z",
    "completedAt": "2026-04-17T14:31:05Z",
    "created": 42,
    "updated": 0,
    "skipped": 0,
    "failed": 0,
    "createdIds": ["cat_001", "cat_002", ...],
    "errors": []
  },
  {
    "phase": "SUPPLIERS",
    "startedAt": "2026-04-17T14:31:05Z",
    "completedAt": "2026-04-17T14:31:10Z",
    "created": 18,
    "updated": 0,
    "skipped": 0,
    "failed": 0,
    "createdIds": ["sup_001", ...],
    "errors": []
  },
  {
    "phase": "ITEMS",
    "startedAt": "2026-04-17T14:31:25Z",
    "completedAt": null,
    "created": 523,
    "updated": 0,
    "skipped": 12,
    "failed": 3,
    "createdIds": ["item_001", "item_002", ...],
    "errors": [
      {
        "severity": "ERROR",
        "entity": "Item",
        "externalId": "sortly_sku_999",
        "field": "sku",
        "code": "DUPLICATE_SKU",
        "message": "SKU already exists in organization"
      }
    ]
  }
]
```

---

## 3. Cancel an In-Flight Migration

### Via API

```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  https://oneace-app.vercel.app/api/migrations/<MIGRATION_JOB_ID>/cancel
```

Returns:

```json
{
  "migration": {
    "id": "clh7abcd...",
    "status": "CANCELLED",
    "updatedAt": "2026-04-17T14:35:00Z"
  }
}
```

### Via SQL (Force)

If the API is unreachable:

```sql
UPDATE "MigrationJob"
SET status = 'CANCELLED', "updatedAt" = NOW()
WHERE id = '<MIGRATION_JOB_ID>';
```

**Important**: Cancelling does NOT automatically delete already-created rows. You must manually rollback (see section 4).

---

## 4. Rollback a Migration

### Via API

```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' \
  https://oneace-app.vercel.app/api/migrations/<MIGRATION_JOB_ID>/rollback
```

Returns:

```json
{
  "rollback": {
    "migrationJobId": "clh7abcd...",
    "startedAt": "2026-04-17T14:35:00Z",
    "completedAt": "2026-04-17T14:35:15Z",
    "deletedCounts": {
      "CATEGORIES": 42,
      "SUPPLIERS": 18,
      "WAREHOUSES": 5,
      "LOCATIONS": 30,
      "CUSTOM_FIELD_DEFS": 8,
      "ITEMS": 523,
      "CUSTOM_FIELD_VALUES": 600,
      "STOCK_LEVELS": 523,
      "ATTACHMENTS": 127,
      "PURCHASE_ORDERS": 15
    },
    "errors": [],
    "success": true
  }
}
```

### Via Prisma (Direct)

If API is unreachable:

```typescript
import { db } from "@/lib/db";
import { rollbackMigration } from "@/lib/migrations/core/rollback";

const result = await rollbackMigration({
  db,
  migrationJobId: "<MIGRATION_JOB_ID>",
  organizationId: "<ORG_ID>",
  userId: "<ACTOR_USER_ID>",
  force: true,
});

console.log(result); // RollbackResult with deletedCounts
```

### Safety Guarantees

- ✓ Tenant-scoped: Only deletes rows in the organization
- ✓ Provenance-scoped: Only deletes rows with `externalSource = <source>`
- ✓ Idempotent: Re-running on an already-rolled-back job is safe (0 rows deleted)
- ✓ Audit trail preserved: MigrationJob record is kept for forensics

### Cleanup: Vercel Blob Files

**Warning**: Rollback does NOT delete source files from Vercel Blob.

After rollback, clean up:

```bash
# List all migration files
curl https://blob.vercel-storage.com \
  -H "Authorization: Bearer $BLOB_TOKEN" \
  | grep "migrations/<ORG_ID>/"

# Delete a specific file
curl -X DELETE \
  -H "Authorization: Bearer $BLOB_TOKEN" \
  https://blob.vercel-storage.com/migrations/<ORG_ID>/<FILE_NAME>
```

Or use the Vercel dashboard: Storage → Blob → Delete by prefix `migrations/{orgId}/`.

---

## 5. Resume a FAILED Migration

Failed migrations can be retried **only** if status is `FAILED`.

### Via API

```bash
# First, transition FAILED → VALIDATED
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "VALIDATED"}' \
  https://oneace-app.vercel.app/api/migrations/<MIGRATION_JOB_ID>

# Then start the import again
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  https://oneace-app.vercel.app/api/migrations/<MIGRATION_JOB_ID>/start
```

### What Happens?

1. Importer re-reads `parsedSnapshot` and `scopeOptions` from the job
2. **Runs only failed phases** (via `importResults` state)
3. If phase succeeded in prior run, it's skipped
4. Updated phase results are appended to `importResults`

---

## 6. Monitor Audit Events

Migration events are logged to `AuditEvent` table.

### SQL

```sql
SELECT id, action, "entityId", metadata, "createdAt"
FROM "AuditEvent"
WHERE 
  action IN ('migration.started', 'migration.completed', 'migration.failed', 'migration.rollback')
  AND "organizationId" = '<ORG_ID>'
ORDER BY "createdAt" DESC
LIMIT 20;
```

### Expected Actions

```
migration.started      → Import phase 1–9 beginning
migration.completed    → All phases succeeded
migration.failed       → A phase failed
migration.rollback     → Rollback completed
```

Example metadata:

```json
{
  "source": "SORTLY",
  "itemCount": 523,
  "supplierCount": 18,
  "warehouseCount": 5,
  "phase": "ITEMS",
  "created": 520,
  "failed": 3,
  "errors": [{ "code": "DUPLICATE_SKU", "externalId": "..." }]
}
```

---

## 7. Check Database Size (MigrationJob Tables)

### Total Rows Imported

```sql
SELECT 
  source,
  COUNT(*) as job_count,
  SUM((importResults::jsonb -> 0 -> 'created')::int) as total_created
FROM "MigrationJob"
WHERE status = 'COMPLETED'
GROUP BY source;
```

### Storage Used by sourceFiles

```sql
SELECT 
  id,
  source,
  LENGTH("sourceFiles"::bytea) / 1024 / 1024 as size_mb,
  "createdAt"
FROM "MigrationJob"
WHERE "sourceFiles" IS NOT NULL
ORDER BY size_mb DESC;
```

If `sourceFiles` are inlined (base64), they can be large. Consider cleaning up old COMPLETED migrations:

```sql
UPDATE "MigrationJob"
SET "sourceFiles" = NULL
WHERE status IN ('COMPLETED', 'CANCELLED') AND "createdAt" < NOW() - INTERVAL '30 days';
```

---

## 8. Add a New Migration Source

To add support for a new source (e.g., ODOO, ZOHO_INVENTORY):

### Step 1: Update Prisma Schema

```prisma
enum MigrationSource {
  SORTLY
  INFLOW
  FISHBOWL
  CIN7
  SOS_INVENTORY
  ODOO  # ← Add here
}
```

Create schema migration:
```bash
npx prisma migrate dev --name add_odoo_migration_source
```

### Step 2: Create Adapter Folder

```bash
mkdir -p src/lib/migrations/odoo
```

### Step 3: Implement MigrationAdapter

Create `src/lib/migrations/odoo/adapter.ts`:

```typescript
import type { MigrationAdapter } from "@/lib/migrations/core/adapter";

export const ODOO_ADAPTER: MigrationAdapter = {
  source: "ODOO",
  method: "CSV", // or "API" or "HYBRID"
  supportedFiles: ["products.csv", "vendors.csv", ...],
  
  async detectFiles(files) { /* ... */ },
  async parse(files) { /* ... */ },
  suggestMappings(snapshot) { /* ... */ },
  validate(snapshot, mappings, scope) { /* ... */ },
};
```

### Step 4: Register Adapter

Update `src/lib/migrations/core/adapter.ts`:

```typescript
export async function getAdapterFor(source: MigrationSource) {
  switch (source) {
    case "SORTLY":
      return (await import("@/lib/migrations/sortly/adapter")).SORTLY_ADAPTER;
    case "ODOO":  // ← Add here
      return (await import("@/lib/migrations/odoo/adapter")).ODOO_ADAPTER;
    // ...
    default:
      throw new Error(`No adapter for migration source: ${source}`);
  }
}
```

### Step 5: Add UI Card

Update the migration picker (Onboarding Step 3 or Integrations Hub):

```tsx
<MigrationSourceCard 
  source="ODOO"
  label="Odoo"
  icon={OdooIcon}
  description="Import from Odoo ERP inventory module"
  onClick={() => startMigration("ODOO")}
/>
```

### Step 6: Add Documentation

Create `docs/migrations/odoo.md` (bilingual, TR + EN).

### Step 7: Test

```bash
npm run test -- src/lib/migrations/odoo
npm run build
```

---

## 9. Common Troubleshooting

| Symptom | Diagnosis | Fix |
|---------|-----------|-----|
| **"Migration stuck in IMPORTING"** | Job process crashed mid-phase | Cancel job + Rollback, then retry |
| **"DUPLICATE_SKU error"** | SKU collision with existing items | User must de-dupe source data or delete conflicting items in OneAce |
| **"Invalid UTF-8 in CSV"** | Source system used wrong encoding | Re-export from source in UTF-8; Fishbowl often uses Windows-1252 |
| **"Photos not uploaded"** | Vercel Blob auth failed or URL unreachable | Check Vercel Blob credentials; verify attachment URLs are public |
| **"Phase ITEMS failed, rest skipped"** | Item import failed, blocking downstream | Fix validation errors (SKU, category refs); restart import |
| **"Custom field type mismatch"** | Text value for NUMBER field | Re-export with correct types; manually fix mapping |
| **"Attachment URL 404"** | Source server deleted file or auth expired | Rollback and re-export with working URLs |

---

## 10. Capacity Planning

### Typical Migration Sizes

| Source | Items | Suppliers | Warehouses | POs | Attachments | Typical Duration |
|--------|-------|-----------|------------|-----|-------------|------------------|
| Sortly (SMB) | 500–2K | 10–50 | 1–5 | 0–100 | 100–500 | 2–5 min |
| inFlow (SMB) | 1K–5K | 20–100 | 2–10 | 50–300 | 200–1K | 5–15 min |
| Fishbowl (Mid) | 5K–20K | 100–500 | 5–20 | 500–2K | 1K–5K | 15–45 min |
| Cin7 (SMB) | 2K–10K | 50–300 | 2–10 | 100–500 | 200–2K | 10–30 min |
| SOS Inv (SMB) | 1K–5K | 20–100 | 1–5 | 50–200 | 100–500 | 5–15 min |

### Server Resources During Import

- **CPU**: Minimal (parsing + validation is I/O-bound)
- **Memory**: ~50–200 MB per job (depends on parsedSnapshot size)
- **PostgreSQL**: Each phase runs in a transaction; no long-held locks
- **Vercel Blob**: Rate-limited by Blob storage API; plan for slow uploads

### Recommendations

- Run migrations during off-peak hours if possible
- Limit concurrent migrations to **1 per organization** (queuing) to avoid DB contention
- Set timeout to 30 minutes for Vercel serverless function
- Monitor Postgres connection pool; set `max_connections` to account for migration workers

---

## 11. QuickBooks-Specific Operations

### QBO: Refresh Expired Access Token

If a migration fails with "401 Unauthorized" on QBO API:

```bash
# Assuming refresh token is stored in the MigrationJob
curl -X POST https://quickbooks.api.intuit.com/oauth2/tokens/oauth2 \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=refresh_token" \
  -d "refresh_token=$REFRESH_TOKEN" \
  -d "client_id=$CLIENT_ID" \
  -d "client_secret=$CLIENT_SECRET"
```

Copy the new `access_token` and `refresh_token` to the MigrationJob record:

```sql
UPDATE "MigrationJob"
SET "fieldMappings" = jsonb_set(
  "fieldMappings", 
  '{qboAccessToken}', 
  '"new-access-token"'::jsonb
)
WHERE id = '<MIGRATION_JOB_ID>';
```

Then retry the migration.

### QBO: Monitor Rate Limiting

QB Online API limit: **500 requests/minute** per realm.

If rate-limited mid-import:

```sql
SELECT (importResults::jsonb ->> 'lastPhase') AS phase, 
       (importResults::jsonb ->> 'errorMessage') AS error
FROM "MigrationJob"
WHERE id = '<MIGRATION_JOB_ID>';
```

If error includes "429 Too Many Requests", **wait 2 minutes and retry**. OneAce auto-implements exponential backoff.

### QBD: Validate IIF Charset

IIF files exported from QBD use **Windows-1252** (Western European). If import fails with garbled text:

1. Re-export from QBD, ensuring **US/English** regional settings
2. Or: Convert the IIF file to UTF-8 using `iconv`:

```bash
iconv -f WINDOWS-1252 -t UTF-8 original.iif > converted.iif
```

3. Re-upload to OneAce

### QBD: Check for Duplicate Names

IIF migration uses item/vendor **names as identifiers**. If the job fails with "Duplicate item name":

```sql
SELECT name, COUNT(*) as cnt FROM "Item"
WHERE "organizationId" = '<ORG_ID>' 
GROUP BY name HAVING COUNT(*) > 1;
```

If duplicates exist, **manually rename in QBD before exporting IIF**, then re-import.

### QBD: Recover from Partial Import

If a QBD migration completed but was missing data:

1. Check the final phase results:

```sql
SELECT (importResults::jsonb) AS results
FROM "MigrationJob"
WHERE id = '<MIGRATION_JOB_ID>';
```

2. If only one phase failed (e.g., Phase 8: Attachments), you can **rollback** and re-run with `includeAttachments: false` to skip it.

3. Or, manually add missing data via OneAce UI (slower but safer than re-importing).

---

## 12. Cleanup Jobs

### Overview

Two automated cleanup processes run on Vercel Cron:

1. **Rollback Blob Cleanup**: During migration rollback, ItemAttachment blobs are deleted immediately (non-blocking; failures are logged but don't fail the rollback).
2. **Scheduled SourceFiles Cleanup**: Daily at 3 AM UTC, the cleanup cron removes stale sourceFiles and associated blobs.

### Cleanup Schedule

| Job | Frequency | Trigger | Retention |
|-----|-----------|---------|-----------|
| Rollback blobs | On-demand (during rollback) | User clicks "Rollback" | Immediate (during rollback) |
| SourceFiles cleanup | Daily | Cron: `0 3 * * *` (3 AM UTC) | COMPLETED: 30 days; CANCELLED: 7 days |

### Manual Cleanup Trigger

To manually trigger the cleanup (bypass schedule):

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://oneace-app.vercel.app/api/cron/cleanup-migration-files
```

Expected response:

```json
{
  "message": "Cleanup completed",
  "processed": 12,
  "remaining": 3,
  "summary": {
    "sourceFilesCleared": 12,
    "sourceFileBlobsDeleted": 147,
    "sourceFileBlobsFailed": 0,
    "errors": 0
  }
}
```

### Dry Run (Preview Mode)

To see what WOULD be deleted without doing it:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://oneace-app.vercel.app/api/cron/cleanup-migration-files?dryRun=1"
```

Response includes the same summary, but no changes are made to the database.

### Retention Policy

- **COMPLETED migrations**: SourceFiles retained for 30 days after `completedAt`. After 30 days, blobs are deleted and the `sourceFiles` JSON column is set to `NULL`.
- **CANCELLED migrations**: SourceFiles retained for 7 days (rollback has already happened; shorter retention saves quota faster). After 7 days, cleanup runs.
- **FAILED migrations**: SourceFiles are NOT automatically cleaned (admin may want to investigate). Manual rollback must be triggered to delete blobs.

### Blob URL Format (Safety Check)

The cleanup cron only deletes Vercel Blob URLs matching the migration namespace:

```
https://*.vercel-storage.com/migrations/{organizationId}/...
```

Blobs outside this path (e.g., user-uploaded attachments from other sources) are never touched.

### Rollback Blob Cleanup Behavior

When a migration is rolled back:

1. The ATTACHMENTS phase identifies all ItemAttachment rows created during the migration.
2. Before deleting the rows from the database, their `fileUrl` values are collected.
3. Vercel Blob objects are deleted (concurrently, up to 5 at a time).
4. Database rows are then deleted.
5. Blob deletion failures are **logged but do not block DB deletion** — the rollback succeeds even if some blobs remain orphaned.
6. Orphaned blobs are picked up on the next scheduled cleanup run.

The audit log records both DB deletes and blob deletes:

```json
{
  "action": "migration.rollback",
  "metadata": {
    "deletedCounts": { "ATTACHMENTS": 42, ... },
    "blobsDeleted": 42,
    "blobsFailed": 0,
    "totalDeleted": 456
  }
}
```

### Troubleshooting Cleanup Failures

If the cleanup cron logs errors:

```bash
# Check recent audit events
curl -H "Authorization: Bearer $TOKEN" \
  "https://oneace-app.vercel.app/api/audit?action=migration.sourceFiles.cleanup&limit=10"
```

Common causes:

- **BLOB_READ_WRITE_TOKEN not set**: Blobs cannot be deleted. Check environment variables on Vercel dashboard.
- **Blob URL no longer exists**: Already deleted via manual/external action. Cleanup will log and continue.
- **Organization mismatch**: Shouldn't happen (query scoped by org), but if it does, check FK integrity.

### Manual Blob Deletion (Last Resort)

If you need to delete an orphaned blob directly:

```bash
# Using curl + @vercel/blob API (requires token + auth)
# This is NOT recommended — the scheduled cleanup handles this.
# Only use if blob is confirmed orphaned and urgent.

curl -X DELETE \
  -H "Authorization: Bearer $BLOB_READ_WRITE_TOKEN" \
  "https://blob.vercelusercontent.com/delete?url=<full-blob-url>"
```

⚠️ **Warning**: Vercel Blob deletion is **irreversible**. Once deleted, the blob cannot be recovered.

---

## 13. Escalation Contacts

| Issue | Owner | Escalation |
|-------|-------|------------|
| Migration stuck / job crashed | Backend Ops | #eng-migrations on Slack |
| Vercel Blob auth / quota | Infra / DevOps | #infra-oncall |
| Cleanup cron failures / orphaned blobs | Backend Ops | Check BLOB_READ_WRITE_TOKEN + audit logs |
| Custom field mapping bugs | Product / Backend | GitHub issue in Oneace repo |
| Data integrity post-import | QA / Product | Post-mortem with eng team |
| QBO token refresh / rate limit | Backend | #qbo-support channel (if exists) |
| QBD IIF export issues | Customer Success | Provide QBD version + export screenshot |

