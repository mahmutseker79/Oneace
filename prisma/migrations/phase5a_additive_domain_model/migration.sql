-- Phase 5A — additive domain-model migration
--
-- Scope (approved):
--   P2  StockMovement source-document FKs
--   P4  CountEntry -> CountSnapshot composite FK
--   P5  Membership.deactivatedAt (schema only, not wired)
--   P6  AuditEvent documentation (schema comments only; no DDL)
--
-- Deferred out of this migration (approved): P1 reservedQty, P3 barcode
-- uniqueness, variants, lot/batch/expiry/serial, decimal quantities/UoM,
-- per-warehouse reorder thresholds, multi-sourcing, ReceiveEvent, role
-- history, externalId/externalSource, attachments, custom fields,
-- outbound events, FX, any non-additive redesign.
--
-- Hard rules:
--   * Additive only. No DROP, no ALTER on existing types, no backfill.
--   * All new columns are NULLABLE. Historical rows will carry NULL
--     for every new column; no code path reinterprets their meaning.
--   * All new FKs use ON DELETE SET NULL on the ledger-side backrefs
--     (StockMovement source-doc pointers) so the append-only ledger
--     survives deletion of source documents. The CountEntry FK uses
--     ON DELETE CASCADE to match the existing row-level cascade from
--     CountEntry.count -> StockCount.
--   * This migration creates indexes CONCURRENTLY-safe-in-spirit but
--     Prisma migrate will run them in a transaction. If the tables
--     are already large in prod, split the CREATE INDEX statements
--     out of this file and run them by hand with CONCURRENTLY before
--     re-running `prisma migrate resolve`.
--
-- ============================================================================
-- P4 PRE-FLIGHT — orphan-entry check (MUST be run BEFORE this migration)
-- ============================================================================
-- The P4 step below adds a hard composite FK from CountEntry to
-- CountSnapshot. If any existing CountEntry row has no matching
-- CountSnapshot, the ALTER TABLE will fail. Code-level analysis of
-- `writeCountEntry` (src/app/(app)/stock-counts/actions.ts lines
-- 237-318) confirms the current write path hard-gates on an explicit
-- CountSnapshot.findFirst, so no application code path can produce
-- orphans — but this migration script still ships with a guard query
-- the operator should run before `prisma migrate deploy`:
--
--   SELECT COUNT(*) AS orphans
--   FROM "CountEntry" ce
--   LEFT JOIN "CountSnapshot" cs
--     ON  cs."countId"      = ce."countId"
--     AND cs."itemId"       = ce."itemId"
--     AND cs."warehouseId"  = ce."warehouseId"
--   WHERE cs."id" IS NULL;
--
-- If this returns anything other than 0, STOP and report. Do NOT
-- manually delete orphan rows; the owning team must decide whether
-- those entries represent real count work that should be preserved
-- in a snapshot.
--
-- ============================================================================
-- P2 — StockMovement source-document FKs
-- ============================================================================

ALTER TABLE "StockMovement"
  ADD COLUMN "purchaseOrderLineId" TEXT,
  ADD COLUMN "stockCountId"        TEXT;

-- ON DELETE SET NULL — the ledger is append-only; deleting a PO line
-- must not delete the receipt movements that already reduced stock.
ALTER TABLE "StockMovement"
  ADD CONSTRAINT "StockMovement_purchaseOrderLineId_fkey"
    FOREIGN KEY ("purchaseOrderLineId")
    REFERENCES "PurchaseOrderLine"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ON DELETE SET NULL — same rationale; if a stock count is ever
-- physically deleted (post-retention), the adjustment movements it
-- generated must remain and be re-classifiable as manual.
ALTER TABLE "StockMovement"
  ADD CONSTRAINT "StockMovement_stockCountId_fkey"
    FOREIGN KEY ("stockCountId")
    REFERENCES "StockCount"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "StockMovement_organizationId_purchaseOrderLineId_idx"
  ON "StockMovement"("organizationId", "purchaseOrderLineId");

CREATE INDEX "StockMovement_organizationId_stockCountId_idx"
  ON "StockMovement"("organizationId", "stockCountId");

-- ============================================================================
-- P4 — CountEntry -> CountSnapshot composite FK
-- ============================================================================
--
-- This is a SECOND foreign key over the three scalar columns
-- (countId, itemId, warehouseId). The existing single-column FK
-- CountEntry.countId -> StockCount.id remains in place and still
-- owns the row-level cascade from a deleted count. The new composite
-- FK targets CountSnapshot's `@@unique([countId, itemId, warehouseId])`
-- and enforces, at the database level, that every entry is anchored
-- to a real snapshot row — which is the actual integrity rule the
-- product relies on for variance calculation.
--
-- ON DELETE CASCADE — matches the semantic "the entry cannot exist
-- without its snapshot." Deleting a snapshot row is already only
-- possible by deleting the parent StockCount (since CountSnapshot has
-- no standalone delete path); this cascade just makes the invariant
-- explicit so future code can't create an orphan by any route.

ALTER TABLE "CountEntry"
  ADD CONSTRAINT "CountEntry_countId_itemId_warehouseId_fkey"
    FOREIGN KEY ("countId", "itemId", "warehouseId")
    REFERENCES "CountSnapshot"("countId", "itemId", "warehouseId")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- P5 — Membership.deactivatedAt (schema only, not wired)
-- ============================================================================
--
-- Reserving the namespace so a future "soft-disable teammate" feature
-- does not need another migration against a potentially larger table.
-- NULL = active (all historical rows). The column is not read by any
-- code path today; when the feature ships, every requireActiveMembership
-- and membership-list query must add an explicit `deactivatedAt IS NULL`
-- filter in the SAME commit that introduces a way to set the column.

ALTER TABLE "Membership"
  ADD COLUMN "deactivatedAt" TIMESTAMP(3);

-- ============================================================================
-- P6 — AuditEvent documentation
-- ============================================================================
-- No DDL. The Phase 5A load-bearing comments are on the Prisma schema
-- model block, not the database. They codify the vocabulary-sync
-- contract between:
--   1. The AuditAction / AuditEntityType TypeScript unions in
--      src/lib/audit.ts
--   2. The `audit.actions.*` i18n catalog entries in
--      src/lib/i18n/messages/en.ts
--   3. The recordAudit() emission sites.
-- Any new action string requires edits in all three places in the
-- same commit. Failing to extend the i18n catalog surfaces as a
-- Record<AuditAction, string> exhaustiveness failure at `tsc` time,
-- which is the enforced-at-build-time guard we rely on.

-- ============================================================================
-- End of Phase 5A migration.
-- ============================================================================
