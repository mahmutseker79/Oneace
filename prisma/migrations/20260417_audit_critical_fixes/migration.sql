-- Audit Critical Fixes Migration (idempotent — hotfix 2026-04-24)
-- 1. Add createdAt to StockLevel
-- 2. Add locationLevelId FK + index on StockLevel (guarded on column existence)
-- 3. Add variantId FK on CountEntry (guarded on column existence)
--
-- Original intent assumed `locationLevelId` and `variantId` columns
-- already existed (added by earlier migrations). On scratch Postgres
-- the P1-04 CI gate applies migrations in strict order and the
-- assumed prior column-add doesn't exist in the migration history.
-- Wrapping the index/FK ops in DO $$ IF EXISTS guards makes the
-- migration a safe no-op on scratch (those constraints will be
-- added when the column is added, if ever) and the expected
-- operation on prod (columns exist, full block runs).

-- StockLevel: add createdAt with default now()
ALTER TABLE "StockLevel" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- StockLevel: FK + index for locationLevel — guarded.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'StockLevel' AND column_name = 'locationLevelId' AND table_schema = 'public'
  ) THEN
    CREATE INDEX IF NOT EXISTS "StockLevel_locationLevelId_idx" ON "StockLevel"("locationLevelId");
    ALTER TABLE "StockLevel" DROP CONSTRAINT IF EXISTS "StockLevel_locationLevelId_fkey";
    ALTER TABLE "StockLevel"
      ADD CONSTRAINT "StockLevel_locationLevelId_fkey"
      FOREIGN KEY ("locationLevelId") REFERENCES "LocationLevel"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- CountEntry: FK for variant — guarded.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'CountEntry' AND column_name = 'variantId' AND table_schema = 'public'
  ) THEN
    ALTER TABLE "CountEntry" DROP CONSTRAINT IF EXISTS "CountEntry_variantId_fkey";
    ALTER TABLE "CountEntry"
      ADD CONSTRAINT "CountEntry_variantId_fkey"
      FOREIGN KEY ("variantId") REFERENCES "ItemVariant"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
