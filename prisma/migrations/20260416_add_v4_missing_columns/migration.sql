-- Add Phase V4 columns missing from production DB.
-- These scalar FK columns exist in schema.prisma but were never migrated.
-- FK constraints are omitted because the referenced tables (SerialNumber,
-- ItemBatch) don't exist yet — they'll be added in a future V4 migration.
-- The columns are nullable so existing rows are unaffected.

-- StockMovement: serialNumberId, batchId
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "serialNumberId" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "batchId" TEXT;

-- StockCount: Phase 17+ columns referenced in schema
ALTER TABLE "StockCount" ADD COLUMN IF NOT EXISTS "scope" TEXT NOT NULL DEFAULT 'FULL';
ALTER TABLE "StockCount" ADD COLUMN IF NOT EXISTS "departmentId" TEXT;
ALTER TABLE "StockCount" ADD COLUMN IF NOT EXISTS "parentCountId" TEXT;
ALTER TABLE "StockCount" ADD COLUMN IF NOT EXISTS "templateId" TEXT;
ALTER TABLE "StockCount" ADD COLUMN IF NOT EXISTS "requiresApproval" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StockCount" ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT;
ALTER TABLE "StockCount" ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMP(3);
ALTER TABLE "StockCount" ADD COLUMN IF NOT EXISTS "lockedByUserId" TEXT;
