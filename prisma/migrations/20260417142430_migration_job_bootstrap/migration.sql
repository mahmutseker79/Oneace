-- ─────────────────────────────────────────────────────────────────────────────
-- Hotfix 2026-04-24 — MigrationJob + MigrationStatus bootstrap
-- ─────────────────────────────────────────────────────────────────────────────
-- Sprint 3 (ci-migration-chain-audit) companion to the MigrationSource
-- bootstrap landed in 20260417142431 (c834241). Both objects below
-- were introduced on prod via an early `prisma db push` (pre-MIG-S1)
-- before the migration chain began tracking them. The subsequent
-- migration 20260417142431_migration_foundation adds the
-- `scopeOptions` JSONB column via ALTER TABLE and
-- presumes MigrationJob already exists with every other column in
-- place — which is true on prod, but false on a fresh scratch
-- Postgres. The P1-04 CI gate (authoritative track) exposes the
-- gap. This bootstrap closes it.
--
-- Idempotent everywhere:
--   - `DO $$ IF NOT EXISTS CREATE TYPE` for MigrationStatus
--   - `CREATE TABLE IF NOT EXISTS` for MigrationJob
--   - `CREATE INDEX IF NOT EXISTS` for the three secondary indexes
--   - `DO $$ IF NOT EXISTS ADD CONSTRAINT` for the two FKs
--
-- The `scopeOptions` column is DELIBERATELY omitted here — the next
-- migration (20260417142431) is the authoritative source for it, so
-- on scratch Postgres it runs ALTER TABLE ADD COLUMN against the
-- bootstrap-created table, and on prod the column already exists
-- (prod skipped this bootstrap conceptually).
-- ─────────────────────────────────────────────────────────────────────────────

-- 0. MigrationSource enum (defensive bootstrap — also created by 142431) ------
-- E2E-MIG-1 fix (v1.12.4, 2026-04-25): on a fresh scratch Postgres
-- this migration runs BEFORE 20260417142431_migration_foundation,
-- and the MigrationJob CREATE TABLE below references the
-- MigrationSource enum. Mirror the IF NOT EXISTS guard from 142431
-- so this migration is self-sufficient. PROD-safe because
-- `prisma migrate deploy` keys off `_prisma_migrations.migration_name`,
-- not the SQL body — the migration is already marked applied and
-- this block never re-runs there. Members match the 142431
-- definition exactly; 142431 then no-ops on its own DO $$ block
-- and proceeds with the additive `ALTER TYPE ADD VALUE
-- 'SOS_INVENTORY' IF NOT EXISTS`.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MigrationSource') THEN
    CREATE TYPE "MigrationSource" AS ENUM (
      'SORTLY', 'INFLOW', 'ODOO', 'ZOHO_INVENTORY', 'FISHBOWL', 'CIN7',
      'KATANA', 'LIGHTSPEED', 'QUICKBOOKS_COMMERCE', 'DEAR_SYSTEMS',
      'GENERIC_CSV'
    );
  END IF;
END $$;

-- 1. MigrationStatus enum ------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MigrationStatus') THEN
    CREATE TYPE "MigrationStatus" AS ENUM (
      'PENDING',
      'FILES_UPLOADED',
      'MAPPING_REVIEW',
      'VALIDATING',
      'VALIDATED',
      'IMPORTING',
      'COMPLETED',
      'FAILED',
      'CANCELLED'
    );
  END IF;
END $$;

-- 2. MigrationJob table (sans scopeOptions — added by 20260417142431) ---------
CREATE TABLE IF NOT EXISTS "MigrationJob" (
  "id"               TEXT              NOT NULL,
  "organizationId"   TEXT              NOT NULL,
  "sourcePlatform"   "MigrationSource" NOT NULL,
  "status"           "MigrationStatus" NOT NULL DEFAULT 'PENDING',
  "sourceFiles"      JSONB,
  "fieldMappings"    JSONB,
  "validationReport" JSONB,
  "importResults"    JSONB,
  "startedAt"        TIMESTAMP(3),
  "completedAt"      TIMESTAMP(3),
  "createdByUserId"  TEXT,
  "notes"            TEXT,
  "createdAt"        TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3)      NOT NULL,
  CONSTRAINT "MigrationJob_pkey" PRIMARY KEY ("id")
);

-- 3. Secondary indexes ---------------------------------------------------------
CREATE INDEX IF NOT EXISTS "MigrationJob_organizationId_status_idx"
  ON "MigrationJob" ("organizationId", "status");

CREATE INDEX IF NOT EXISTS "MigrationJob_organizationId_createdAt_idx"
  ON "MigrationJob" ("organizationId", "createdAt");

CREATE INDEX IF NOT EXISTS "MigrationJob_createdByUserId_idx"
  ON "MigrationJob" ("createdByUserId");

-- 4. Foreign keys (idempotent via pg_constraint lookup) ------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MigrationJob_organizationId_fkey'
  ) THEN
    ALTER TABLE "MigrationJob"
      ADD CONSTRAINT "MigrationJob_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MigrationJob_createdByUserId_fkey'
  ) THEN
    ALTER TABLE "MigrationJob"
      ADD CONSTRAINT "MigrationJob_createdByUserId_fkey"
      FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
