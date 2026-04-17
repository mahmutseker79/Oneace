-- AlterEnum
ALTER TYPE "StockMovementType" ADD VALUE 'BIN_TRANSFER';

-- DropIndex
DROP INDEX "StockLevel_itemId_warehouseId_key";

-- AlterTable
ALTER TABLE "CountEntry" ADD COLUMN     "binId" TEXT;

-- AlterTable
ALTER TABLE "StockLevel" ADD COLUMN     "binId" TEXT;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "binId" TEXT,
ADD COLUMN     "toBinId" TEXT;

-- CreateTable
CREATE TABLE "Bin" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT,
    "description" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Bin_warehouseId_idx" ON "Bin"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "Bin_warehouseId_code_key" ON "Bin"("warehouseId", "code");

-- CreateIndex
CREATE INDEX "StockLevel_binId_idx" ON "StockLevel"("binId");

-- CreateIndex
CREATE UNIQUE INDEX "StockLevel_itemId_warehouseId_binId_key" ON "StockLevel"("itemId", "warehouseId", "binId");

-- AddForeignKey
ALTER TABLE "Bin" ADD CONSTRAINT "Bin_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLevel" ADD CONSTRAINT "StockLevel_binId_fkey" FOREIGN KEY ("binId") REFERENCES "Bin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_binId_fkey" FOREIGN KEY ("binId") REFERENCES "Bin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_toBinId_fkey" FOREIGN KEY ("toBinId") REFERENCES "Bin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountEntry" ADD CONSTRAINT "CountEntry_binId_fkey" FOREIGN KEY ("binId") REFERENCES "Bin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
