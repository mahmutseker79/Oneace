-- ─────────────────────────────────────────────────────────────────────────────
-- Phase MIG-QB: QuickBooks as migration source
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds two values to the MigrationSource enum so Items, Suppliers, POs etc.
-- imported from QuickBooks can be tagged with a provenance distinct from
-- the live QUICKBOOKS_ONLINE integration (which does ongoing two-way sync).
--
-- Migration is additive only — no existing rows are touched, no data is
-- moved, no column types change. Safe to apply on a live prod DB.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TYPE "MigrationSource" ADD VALUE IF NOT EXISTS 'QUICKBOOKS_ONLINE';
ALTER TYPE "MigrationSource" ADD VALUE IF NOT EXISTS 'QUICKBOOKS_DESKTOP';
