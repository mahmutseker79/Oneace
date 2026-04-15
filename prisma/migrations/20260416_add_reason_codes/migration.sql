-- Add ReasonCode model and FK columns on StockMovement + CountEntry
-- These fields exist in schema.prisma but were never migrated to production.

-- ============================================================================
-- ReasonCode table
-- ============================================================================
CREATE TABLE "ReasonCode" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReasonCode_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: code must be unique per organization
CREATE UNIQUE INDEX "ReasonCode_organizationId_code_key" ON "ReasonCode"("organizationId", "code");

-- FK to Organization
ALTER TABLE "ReasonCode" ADD CONSTRAINT "ReasonCode_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- StockMovement.reasonCodeId FK
-- ============================================================================
ALTER TABLE "StockMovement" ADD COLUMN "reasonCodeId" TEXT;

ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_reasonCodeId_fkey"
    FOREIGN KEY ("reasonCodeId") REFERENCES "ReasonCode"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- CountEntry.reasonCodeId FK
-- ============================================================================
ALTER TABLE "CountEntry" ADD COLUMN "reasonCodeId" TEXT;

ALTER TABLE "CountEntry" ADD CONSTRAINT "CountEntry_reasonCodeId_fkey"
    FOREIGN KEY ("reasonCodeId") REFERENCES "ReasonCode"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
