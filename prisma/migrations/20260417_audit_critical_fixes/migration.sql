-- Audit Critical Fixes Migration
-- 1. Add createdAt to StockLevel
-- 2. Add locationLevelId FK + index on StockLevel
-- 3. Add variantId FK on CountEntry

-- StockLevel: add createdAt with default now()
ALTER TABLE "StockLevel" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- StockLevel: add FK for locationLevel (locationLevelId column already exists)
CREATE INDEX IF NOT EXISTS "StockLevel_locationLevelId_idx" ON "StockLevel"("locationLevelId");
ALTER TABLE "StockLevel"
  DROP CONSTRAINT IF EXISTS "StockLevel_locationLevelId_fkey";
ALTER TABLE "StockLevel"
  ADD CONSTRAINT "StockLevel_locationLevelId_fkey"
  FOREIGN KEY ("locationLevelId") REFERENCES "LocationLevel"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CountEntry: add FK for variant (variantId column already exists)
ALTER TABLE "CountEntry"
  DROP CONSTRAINT IF EXISTS "CountEntry_variantId_fkey";
ALTER TABLE "CountEntry"
  ADD CONSTRAINT "CountEntry_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ItemVariant"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
