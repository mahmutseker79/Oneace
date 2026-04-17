-- Sprint 2: Performance Indexes
-- Composite and partial indexes for dashboard and reporting queries

-- Composite index for dashboard movement queries (type filtering + ordering by date)
CREATE INDEX IF NOT EXISTS "StockMovement_org_type_created_idx"
ON "StockMovement" ("organizationId", "type", "createdAt" DESC);

-- Composite index for stock count list with status filter
CREATE INDEX IF NOT EXISTS "StockCount_org_state_created_idx"
ON "StockCount" ("organizationId", "state", "createdAt" DESC);

-- Composite index for low-stock item queries (filters on status and reorderPoint)
CREATE INDEX IF NOT EXISTS "Item_org_status_reorder_idx"
ON "Item" ("organizationId", "status", "reorderPoint")
WHERE "reorderPoint" > 0;

-- Partial index for active alerts only (most queries filter on ACTIVE status)
CREATE INDEX IF NOT EXISTS "Alert_org_active_idx"
ON "Alert" ("organizationId", "itemId", "type")
WHERE "status" = 'ACTIVE';
