-- ─────────────────────────────────────────────────────────────────────────────
-- Integration schema drift fix (BUG-004 root cause)
-- ─────────────────────────────────────────────────────────────────────────────
-- The "enterprise-grade integrations" feature (commit 15482de on 2026-04-17)
-- expanded the Integration model with sync config, rate limiting, entity
-- feature flags and added four new related models — but no migration was
-- generated alongside that schema change. The production DB was last touched
-- by `prisma db push`, so it has the old narrow Integration table and is
-- missing all the new columns + related tables.
--
-- Symptom (seen on prod): every Integration read fails with
--   prisma:error Invalid `prisma.integration.findMany()`
--   The column `public.Integration.syncFrequency` does not exist in the
--   current database.
-- …which crashes /integrations, /integrations/shopify, /integrations/quickbooks.
--
-- This migration is fully idempotent (DO/IF NOT EXISTS) so it is safe to
-- reapply on any Integration table shape — missing-columns will be added,
-- already-present columns are a no-op, missing-tables will be created, and
-- already-present tables with the right shape are a no-op.
-- ─────────────────────────────────────────────────────────────────────────────

-- 0. Bootstrap for objects created out-of-band by early `prisma db push`
-- ----------------------------------------------------------------------
-- MIG-CHAIN-AUDIT (v1.13.0, 2026-04-25): the "Integration" table and the
-- "IntegrationProvider" / "IntegrationStatus" enums were never CREATE'd
-- by any migration in this directory — they were created via an early
-- `prisma db push` before the formal migration chain began (ADR-004
-- cutoff 2026-04-19). PROD has them; a fresh scratch Postgres does not,
-- so the ALTER TABLE / ADD COLUMN blocks below fail with
-- `relation "Integration" does not exist`.
-- This block creates them defensively (IF NOT EXISTS for table; DO/
-- duplicate_object catch for enums) so the migration is self-sufficient
-- on a fresh DB and a true no-op on PROD.
DO $$ BEGIN
  CREATE TYPE "IntegrationProvider" AS ENUM (
    'QUICKBOOKS_ONLINE', 'QUICKBOOKS_DESKTOP', 'SHOPIFY', 'WOOCOMMERCE',
    'XERO', 'AMAZON', 'CUSTOM_WEBHOOK', 'BIGCOMMERCE', 'MAGENTO', 'WIX',
    'ODOO', 'ZOHO_INVENTORY'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "IntegrationStatus" AS ENUM (
    'CONNECTED', 'DISCONNECTED', 'ERROR', 'SYNCING'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Integration" (
  "id"             TEXT                  NOT NULL,
  "organizationId" TEXT                  NOT NULL,
  "provider"       "IntegrationProvider" NOT NULL,
  "status"         "IntegrationStatus"   NOT NULL DEFAULT 'DISCONNECTED',
  "credentials"    JSONB,
  "settings"       JSONB,
  "lastSyncAt"     TIMESTAMP(3),
  "lastError"      TEXT,
  "createdAt"      TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3)          NOT NULL,

  CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- 1. Enum types needed by the Integration expansion ---------------------------
-- PostgreSQL has no CREATE TYPE IF NOT EXISTS, so each one is wrapped in a
-- DO block that swallows the duplicate_object exception.

DO $$ BEGIN
  CREATE TYPE "SyncDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'BIDIRECTIONAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SyncFrequency" AS ENUM (
    'MANUAL',
    'REALTIME',
    'EVERY_5_MIN',
    'EVERY_15_MIN',
    'EVERY_30_MIN',
    'HOURLY',
    'EVERY_6_HOURS',
    'DAILY',
    'WEEKLY'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ConflictPolicy" AS ENUM (
    'REMOTE_WINS',
    'LOCAL_WINS',
    'NEWEST_WINS',
    'MANUAL_REVIEW',
    'SKIP'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "RetryPolicy" AS ENUM ('NONE', 'LINEAR', 'EXPONENTIAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SyncRuleAction" AS ENUM ('SYNC', 'SKIP', 'TRANSFORM', 'FLAG_REVIEW');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Integration: add missing columns -----------------------------------------
-- All new columns are either nullable or have a default, so adding them to a
-- populated table is safe without a backfill step.

ALTER TABLE "Integration"
  ADD COLUMN IF NOT EXISTS "syncFrequency"   "SyncFrequency"  NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS "syncDirection"   "SyncDirection"  NOT NULL DEFAULT 'BIDIRECTIONAL',
  ADD COLUMN IF NOT EXISTS "conflictPolicy"  "ConflictPolicy" NOT NULL DEFAULT 'REMOTE_WINS',
  ADD COLUMN IF NOT EXISTS "retryPolicy"     "RetryPolicy"    NOT NULL DEFAULT 'EXPONENTIAL',
  ADD COLUMN IF NOT EXISTS "maxRetries"      INTEGER          NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS "rateLimitPerMin" INTEGER          NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS "syncItems"       BOOLEAN          NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "syncOrders"      BOOLEAN          NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "syncSuppliers"   BOOLEAN          NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "syncCategories"  BOOLEAN          NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "syncStockLevels" BOOLEAN          NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "syncPrices"      BOOLEAN          NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "syncImages"      BOOLEAN          NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "syncCustomers"   BOOLEAN          NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "syncFilterJson"  JSONB,
  ADD COLUMN IF NOT EXISTS "externalAccountId" TEXT,
  ADD COLUMN IF NOT EXISTS "externalStoreName" TEXT,
  ADD COLUMN IF NOT EXISTS "webhookSecret"   TEXT,
  ADD COLUMN IF NOT EXISTS "webhookUrl"      TEXT;

-- 3. IntegrationFieldMapping --------------------------------------------------

CREATE TABLE IF NOT EXISTS "IntegrationFieldMapping" (
  "id"            TEXT        NOT NULL,
  "integrationId" TEXT        NOT NULL,
  "entityType"    "ImportEntity" NOT NULL,
  "localField"    TEXT        NOT NULL,
  "remoteField"   TEXT        NOT NULL,
  "direction"     "SyncDirection" NOT NULL DEFAULT 'BIDIRECTIONAL',
  "transformRule" TEXT,
  "defaultValue"  TEXT,
  "isRequired"    BOOLEAN     NOT NULL DEFAULT false,
  "isActive"      BOOLEAN     NOT NULL DEFAULT true,
  "sortOrder"     INTEGER     NOT NULL DEFAULT 0,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IntegrationFieldMapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IntegrationFieldMapping_integrationId_entityType_localField_key"
  ON "IntegrationFieldMapping" ("integrationId", "entityType", "localField");

CREATE INDEX IF NOT EXISTS "IntegrationFieldMapping_integrationId_idx"
  ON "IntegrationFieldMapping" ("integrationId");

DO $$ BEGIN
  ALTER TABLE "IntegrationFieldMapping"
    ADD CONSTRAINT "IntegrationFieldMapping_integrationId_fkey"
    FOREIGN KEY ("integrationId") REFERENCES "Integration" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. IntegrationSyncRule ------------------------------------------------------

CREATE TABLE IF NOT EXISTS "IntegrationSyncRule" (
  "id"            TEXT        NOT NULL,
  "integrationId" TEXT        NOT NULL,
  "name"          TEXT        NOT NULL,
  "entityType"    "ImportEntity" NOT NULL,
  "condition"     JSONB       NOT NULL,
  "action"        "SyncRuleAction" NOT NULL DEFAULT 'SYNC',
  "priority"      INTEGER     NOT NULL DEFAULT 0,
  "isActive"      BOOLEAN     NOT NULL DEFAULT true,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IntegrationSyncRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "IntegrationSyncRule_integrationId_idx"
  ON "IntegrationSyncRule" ("integrationId");

DO $$ BEGIN
  ALTER TABLE "IntegrationSyncRule"
    ADD CONSTRAINT "IntegrationSyncRule_integrationId_fkey"
    FOREIGN KEY ("integrationId") REFERENCES "Integration" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5. IntegrationWebhookEvent --------------------------------------------------

CREATE TABLE IF NOT EXISTS "IntegrationWebhookEvent" (
  "id"              TEXT        NOT NULL,
  "integrationId"   TEXT        NOT NULL,
  "eventType"       TEXT        NOT NULL,
  "endpointUrl"     TEXT        NOT NULL,
  "isActive"        BOOLEAN     NOT NULL DEFAULT true,
  "secret"          TEXT,
  "lastTriggeredAt" TIMESTAMP(3),
  "failCount"       INTEGER     NOT NULL DEFAULT 0,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IntegrationWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IntegrationWebhookEvent_integrationId_eventType_endpointUrl_key"
  ON "IntegrationWebhookEvent" ("integrationId", "eventType", "endpointUrl");

CREATE INDEX IF NOT EXISTS "IntegrationWebhookEvent_integrationId_idx"
  ON "IntegrationWebhookEvent" ("integrationId");

DO $$ BEGIN
  ALTER TABLE "IntegrationWebhookEvent"
    ADD CONSTRAINT "IntegrationWebhookEvent_integrationId_fkey"
    FOREIGN KEY ("integrationId") REFERENCES "Integration" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6. IntegrationSyncSchedule --------------------------------------------------

CREATE TABLE IF NOT EXISTS "IntegrationSyncSchedule" (
  "id"             TEXT        NOT NULL,
  "integrationId"  TEXT        NOT NULL,
  "entityType"     "ImportEntity" NOT NULL,
  "direction"      "SyncDirection" NOT NULL,
  "cronExpression" TEXT        NOT NULL,
  "isActive"       BOOLEAN     NOT NULL DEFAULT true,
  "lastRunAt"      TIMESTAMP(3),
  "nextRunAt"      TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IntegrationSyncSchedule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IntegrationSyncSchedule_integrationId_entityType_direction_key"
  ON "IntegrationSyncSchedule" ("integrationId", "entityType", "direction");

CREATE INDEX IF NOT EXISTS "IntegrationSyncSchedule_integrationId_idx"
  ON "IntegrationSyncSchedule" ("integrationId");

DO $$ BEGIN
  ALTER TABLE "IntegrationSyncSchedule"
    ADD CONSTRAINT "IntegrationSyncSchedule_integrationId_fkey"
    FOREIGN KEY ("integrationId") REFERENCES "Integration" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
