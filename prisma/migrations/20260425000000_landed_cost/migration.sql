-- MIGRATION-TYPE: EXPAND
-- ─────────────────────────────────────────────────────────────────────────────
-- GOD MODE roadmap 2026-04-23 — P0-04 Landed Cost (ADR-002).
-- ─────────────────────────────────────────────────────────────────────────────
-- Additive schema delta. All column adds are nullable so pre-P0-04
-- POs and movements keep their meaning (NULL = "not tracked"
-- rather than 0 = "tracked but nil"). Two new enums + one new
-- table.
--
-- Idempotent: re-applying on a partially-migrated DB (dev env that
-- ran `prisma db push` first) is safe. Every CREATE is guarded;
-- every ADD COLUMN uses IF NOT EXISTS.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. New enums.
DO $$ BEGIN
  CREATE TYPE "AllocationBasis" AS ENUM ('BY_VALUE', 'BY_QTY', 'BY_WEIGHT', 'BY_VOLUME');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AllocationType" AS ENUM ('FREIGHT', 'DUTY', 'INSURANCE', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. PurchaseOrder header columns.
ALTER TABLE "PurchaseOrder"
  ADD COLUMN IF NOT EXISTS "freightCost"           DECIMAL(18, 4),
  ADD COLUMN IF NOT EXISTS "dutyCost"              DECIMAL(18, 4),
  ADD COLUMN IF NOT EXISTS "insuranceCost"         DECIMAL(18, 4),
  ADD COLUMN IF NOT EXISTS "otherLandedCost"       DECIMAL(18, 4),
  ADD COLUMN IF NOT EXISTS "landedCostCurrency"    TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS "landedAllocationBasis" "AllocationBasis" NOT NULL DEFAULT 'BY_VALUE';

-- 3. StockMovement cost audit columns.
ALTER TABLE "StockMovement"
  ADD COLUMN IF NOT EXISTS "purchaseUnitCost" DECIMAL(18, 6),
  ADD COLUMN IF NOT EXISTS "landedUnitCost"   DECIMAL(18, 6);

-- 4. LandedCostAllocation table — per-movement per-cost-type audit log.
CREATE TABLE IF NOT EXISTS "LandedCostAllocation" (
  "id"               TEXT NOT NULL,
  "organizationId"   TEXT NOT NULL,
  "purchaseOrderId"  TEXT,
  "sourceMovementId" TEXT NOT NULL,
  "allocationType"   "AllocationType" NOT NULL,
  "allocationBasis"  "AllocationBasis" NOT NULL,
  "allocatedAmount"  DECIMAL(18, 6) NOT NULL,
  "isRevaluation"    BOOLEAN NOT NULL DEFAULT false,
  "appliedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "appliedByUserId"  TEXT,
  "notes"            TEXT,

  CONSTRAINT "LandedCostAllocation_pkey" PRIMARY KEY ("id")
);

-- 5. Foreign keys (guarded so re-runs are safe).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LandedCostAllocation_organizationId_fkey') THEN
    ALTER TABLE "LandedCostAllocation"
      ADD CONSTRAINT "LandedCostAllocation_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LandedCostAllocation_purchaseOrderId_fkey') THEN
    ALTER TABLE "LandedCostAllocation"
      ADD CONSTRAINT "LandedCostAllocation_purchaseOrderId_fkey"
      FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LandedCostAllocation_sourceMovementId_fkey') THEN
    ALTER TABLE "LandedCostAllocation"
      ADD CONSTRAINT "LandedCostAllocation_sourceMovementId_fkey"
      FOREIGN KEY ("sourceMovementId") REFERENCES "StockMovement"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LandedCostAllocation_appliedByUserId_fkey') THEN
    ALTER TABLE "LandedCostAllocation"
      ADD CONSTRAINT "LandedCostAllocation_appliedByUserId_fkey"
      FOREIGN KEY ("appliedByUserId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 6. Indexes (IF NOT EXISTS).
CREATE INDEX IF NOT EXISTS "LandedCostAllocation_organizationId_purchaseOrderId_idx"
  ON "LandedCostAllocation"("organizationId", "purchaseOrderId");
CREATE INDEX IF NOT EXISTS "LandedCostAllocation_organizationId_sourceMovementId_idx"
  ON "LandedCostAllocation"("organizationId", "sourceMovementId");
CREATE INDEX IF NOT EXISTS "LandedCostAllocation_organizationId_allocationType_appliedAt_idx"
  ON "LandedCostAllocation"("organizationId", "allocationType", "appliedAt");
