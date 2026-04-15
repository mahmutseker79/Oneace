-- Security Audit Sprint 0+1: CHECK constraints + composite indexes
-- Date: 2026-04-15
-- Addresses: Negative quantity prevention, query performance optimization

-- ═══════════════════════════════════════════════════════════════
-- CHECK CONSTRAINTS — prevent invalid data at database level
-- ═══════════════════════════════════════════════════════════════

-- Prevent negative stock quantities
ALTER TABLE "StockLevel" ADD CONSTRAINT "StockLevel_quantity_non_negative"
  CHECK ("quantity" >= 0);

ALTER TABLE "StockLevel" ADD CONSTRAINT "StockLevel_reservedQty_non_negative"
  CHECK ("reservedQty" >= 0);

-- Prevent negative reorder settings
ALTER TABLE "Item" ADD CONSTRAINT "Item_reorderPoint_non_negative"
  CHECK ("reorderPoint" >= 0);

ALTER TABLE "Item" ADD CONSTRAINT "Item_reorderQty_non_negative"
  CHECK ("reorderQty" >= 0);

-- Prevent invalid PO line quantities
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_orderedQty_positive"
  CHECK ("orderedQty" > 0);

ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_receivedQty_non_negative"
  CHECK ("receivedQty" >= 0);


-- ═══════════════════════════════════════════════════════════════
-- COMPOSITE INDEXES — optimize common query patterns
-- ═══════════════════════════════════════════════════════════════

-- StockLevel: aggregation queries (dashboard KPI, stock value, low-stock)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "StockLevel_org_item_qty_idx"
  ON "StockLevel" ("organizationId", "itemId", "quantity");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "StockLevel_org_warehouse_qty_idx"
  ON "StockLevel" ("organizationId", "warehouseId", "quantity");

-- Item: listing with status filter + date sort
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Item_org_status_created_idx"
  ON "Item" ("organizationId", "status", "createdAt" DESC);

-- Item: barcode scanner lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Item_org_barcode_idx"
  ON "Item" ("organizationId", "barcode")
  WHERE "barcode" IS NOT NULL;

-- Item: low-stock report (active items with reorder points)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Item_org_active_reorder_idx"
  ON "Item" ("organizationId", "reorderPoint" DESC)
  WHERE "status" = 'ACTIVE' AND "reorderPoint" > 0;

-- StockMovement: dashboard trend chart + movement history
CREATE INDEX CONCURRENTLY IF NOT EXISTS "StockMovement_org_created_type_idx"
  ON "StockMovement" ("organizationId", "createdAt" DESC, "type");

-- StockMovement: per-item movement aggregation (top items chart)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "StockMovement_org_item_created_idx"
  ON "StockMovement" ("organizationId", "itemId", "createdAt" DESC);

-- StockCount: state + date listing
CREATE INDEX CONCURRENTLY IF NOT EXISTS "StockCount_org_state_created_idx"
  ON "StockCount" ("organizationId", "state", "createdAt" DESC);

-- PurchaseOrder: listing with status filter
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PurchaseOrder_org_status_created_idx"
  ON "PurchaseOrder" ("organizationId", "status", "createdAt" DESC);
