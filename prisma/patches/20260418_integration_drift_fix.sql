-- ─────────────────────────────────────────────────────────────────────────────
-- STANDALONE PATCH — Integration schema drift fix
-- ─────────────────────────────────────────────────────────────────────────────
-- Fixes BUG-004: /integrations, /integrations/shopify, /integrations/quickbooks
-- all crash with "prisma:error Invalid `prisma.integration.findMany()`
-- The column `public.Integration.syncFrequency` does not exist..."
--
-- Root cause: commit 15482de ("enterprise-grade integrations system") added
-- 19 new columns to Integration and 4 new related tables, but no Prisma
-- migration was generated, so the production DB (set up originally via
-- `db push`) never got those columns/tables.
--
-- This patch is FULLY IDEMPOTENT — running it twice is a no-op. Apply it
-- directly in the Neon SQL editor (or via `psql $DATABASE_URL < ...`). After
-- it runs, the live app works immediately — no redeploy needed because the
-- Prisma client types already expect these columns.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. Enums --------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE "SyncDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'BIDIRECTIONAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SyncFrequency" AS ENUM (
    'MANUAL', 'REALTIME', 'EVERY_5_MIN', 'EVERY_15_MIN', 'EVERY_30_MIN',
    'HOURLY', 'EVERY_6_HOURS', 'DAILY', 'WEEKLY'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ConflictPolicy" AS ENUM (
    'REMOTE_WINS', 'LOCAL_WINS', 'NEWEST_WINS', 'MANUAL_REVIEW', 'SKIP'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "RetryPolicy" AS ENUM ('NONE', 'LINEAR', 'EXPONENTIAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SyncRuleAction" AS ENUM ('SYNC', 'SKIP', 'TRANSFORM', 'FLAG_REVIEW');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Integration: add missing columns -----------------------------------------

ALTER TABLE "Integration"
  ADD COLUMN IF NOT EXISTS "syncFrequency"    "SyncFrequency"   NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS "syncDirection"    "SyncDirection"   NOT NULL DEFAULT 'BIDIRECTIONAL',
  ADD COLUMN IF NOT EXISTS "conflictPolicy"   "ConflictPolicy"  NOT NULL DEFAULT 'REMOTE_WINS',
  ADD COLUMN IF NOT EXISTS "retryPolicy"      "RetryPolicy"     NOT NULL DEFAULT 'EXPONENTIAL',
  ADD COLUMN IF NOT EXISTS "maxRetries"       INTEGER           NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS "rateLimitPerMin"  INTEGER           NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS "syncItems"        BOOLEAN           NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "syncOrders"       BOOLEAN           NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "syncSuppliers"    BOOLEAN           NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "syncCategories"   BOOLEAN           NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "syncStockLevels"  BOOLEAN           NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "syncPrices"       BOOLEAN           NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "syncImages"       BOOLEAN           NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "syncCustomers"    BOOLEAN           NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "syncFilterJson"   JSONB,
  ADD COLUMN IF NOT EXISTS "externalAccountId" TEXT,
  ADD COLUMN IF NOT EXISTS "externalStoreName" TEXT,
  ADD COLUMN IF NOT EXISTS "webhookSecret"    TEXT,
  ADD COLUMN IF NOT EXISTS "webhookUrl"       TEXT;

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

-- 7. Verify -------------------------------------------------------------------
-- Sanity-check the new columns exist. This raises an exception if anything
-- is still missing, which aborts the transaction so you can see the error
-- instead of silently shipping a half-applied patch.

DO $$
DECLARE
  missing TEXT;
BEGIN
  SELECT string_agg(col, ', ') INTO missing
  FROM (VALUES
    ('syncFrequency'), ('syncDirection'), ('conflictPolicy'),
    ('retryPolicy'), ('maxRetries'), ('rateLimitPerMin'),
    ('syncItems'), ('syncOrders'), ('syncSuppliers'), ('syncCategories'),
    ('syncStockLevels'), ('syncPrices'), ('syncImages'), ('syncCustomers'),
    ('syncFilterJson'), ('externalAccountId'), ('externalStoreName'),
    ('webhookSecret'), ('webhookUrl')
  ) AS required(col)
  WHERE col NOT IN (
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Integration'
  );

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Integration drift fix incomplete — still missing: %', missing;
  END IF;
END $$;

COMMIT;
