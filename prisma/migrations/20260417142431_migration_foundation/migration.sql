-- ─────────────────────────────────────────────────────────────────────────────
-- Phase MIG-S1: Migration foundation
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds the schema surface that lets OneAce ingest data from Sortly, inFlow,
-- Fishbowl, Cin7 Core, and SOS Inventory. Pure additive — no column drops,
-- no default changes on existing hot paths.
--
--   1. MigrationSource enum: add SOS_INVENTORY
--   2. CustomFieldEntity / CustomFieldType enums (new)
--   3. Organization:  onboardingStep, onboardingCompletedAt, migrationSourceHint
--   4. Item:          externalId, externalSource + (org, source, id) unique
--                     + (org, externalSource) index
--   5. MigrationJob:  scopeOptions (Json)
--   6. CustomFieldDefinition + ItemCustomFieldValue (new tables)
--
-- All columns on existing tables are nullable or have defaults so this
-- migration is safe to run on a live prod database with concurrent writes.
-- All new indexes are plain (not CONCURRENTLY) because Prisma Migrate wraps
-- the file in a transaction; for a truly zero-downtime production roll this
-- should be reapplied via `CREATE INDEX CONCURRENTLY` in a follow-up.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. MigrationSource: SOS_INVENTORY ------------------------------------------
-- `IF NOT EXISTS` so re-running the migration (e.g. in shadow DB rebuild)
-- does not fail.
ALTER TYPE "MigrationSource" ADD VALUE IF NOT EXISTS 'SOS_INVENTORY';

-- 2. CustomFieldEntity / CustomFieldType enums -------------------------------
CREATE TYPE "CustomFieldEntity" AS ENUM (
  'ITEM',
  'SUPPLIER',
  'WAREHOUSE',
  'PURCHASE_ORDER'
);

CREATE TYPE "CustomFieldType" AS ENUM (
  'TEXT',
  'NUMBER',
  'DATE',
  'BOOLEAN',
  'SELECT',
  'MULTI_SELECT',
  'URL'
);

-- 3. Organization: onboarding + migration hint -------------------------------
ALTER TABLE "Organization"
  ADD COLUMN "onboardingStep"        INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3),
  ADD COLUMN "migrationSourceHint"   "MigrationSource";

-- 4. Item: external provenance ------------------------------------------------
ALTER TABLE "Item"
  ADD COLUMN "externalId"     TEXT,
  ADD COLUMN "externalSource" "MigrationSource";

-- Idempotent re-import contract: the same (org, source, externalId) always
-- maps back to the same OneAce row. Null externalId rows (native items) are
-- excluded by Postgres' default NULLS NOT DISTINCT behavior in older
-- versions, so we keep the constraint partial for safety.
CREATE UNIQUE INDEX "ux_item_external_source_id"
  ON "Item" ("organizationId", "externalSource", "externalId")
  WHERE "externalId" IS NOT NULL;

CREATE INDEX "Item_organizationId_externalSource_idx"
  ON "Item" ("organizationId", "externalSource");

-- 5. MigrationJob: scope options ---------------------------------------------
ALTER TABLE "MigrationJob"
  ADD COLUMN "scopeOptions" JSONB;

-- 6. CustomFieldDefinition ----------------------------------------------------
CREATE TABLE "CustomFieldDefinition" (
  "id"             TEXT                 NOT NULL,
  "organizationId" TEXT                 NOT NULL,
  "entityType"     "CustomFieldEntity"  NOT NULL,
  "name"           TEXT                 NOT NULL,
  "fieldKey"       TEXT                 NOT NULL,
  "fieldType"      "CustomFieldType"    NOT NULL,
  "options"        JSONB,
  "isRequired"     BOOLEAN              NOT NULL DEFAULT false,
  "defaultValue"   TEXT,
  "sortOrder"      INTEGER              NOT NULL DEFAULT 0,
  "externalSource" "MigrationSource",
  "externalId"     TEXT,
  "createdAt"      TIMESTAMP(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3)         NOT NULL,

  CONSTRAINT "CustomFieldDefinition_pkey" PRIMARY KEY ("id")
);

-- API surface stability: fieldKey is the URL/query key.
CREATE UNIQUE INDEX "ux_cfdef_org_entity_key"
  ON "CustomFieldDefinition" ("organizationId", "entityType", "fieldKey");

-- Migration idempotency mirror of the Item approach.
CREATE UNIQUE INDEX "ux_cfdef_external"
  ON "CustomFieldDefinition" ("organizationId", "externalSource", "externalId")
  WHERE "externalId" IS NOT NULL;

CREATE INDEX "CustomFieldDefinition_organizationId_entityType_idx"
  ON "CustomFieldDefinition" ("organizationId", "entityType");

ALTER TABLE "CustomFieldDefinition"
  ADD CONSTRAINT "CustomFieldDefinition_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 7. ItemCustomFieldValue -----------------------------------------------------
CREATE TABLE "ItemCustomFieldValue" (
  "id"           TEXT          NOT NULL,
  "itemId"       TEXT          NOT NULL,
  "definitionId" TEXT          NOT NULL,
  "valueText"    TEXT,
  "valueNumber"  DECIMAL(20,6),
  "valueDate"    TIMESTAMP(3),
  "valueBoolean" BOOLEAN,
  "valueJson"    JSONB,
  "createdAt"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3)  NOT NULL,

  CONSTRAINT "ItemCustomFieldValue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ux_cfval_item_def"
  ON "ItemCustomFieldValue" ("itemId", "definitionId");

CREATE INDEX "ItemCustomFieldValue_definitionId_idx"
  ON "ItemCustomFieldValue" ("definitionId");

CREATE INDEX "ItemCustomFieldValue_itemId_idx"
  ON "ItemCustomFieldValue" ("itemId");

ALTER TABLE "ItemCustomFieldValue"
  ADD CONSTRAINT "ItemCustomFieldValue_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "Item"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ItemCustomFieldValue"
  ADD CONSTRAINT "ItemCustomFieldValue_definitionId_fkey"
  FOREIGN KEY ("definitionId") REFERENCES "CustomFieldDefinition"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
