-- ─────────────────────────────────────────────────────────────────────────────
-- GOD MODE roadmap 2026-04-23 — P0-02 IdempotencyKey table.
-- ─────────────────────────────────────────────────────────────────────────────
-- Request-level deduplication for the SO ship + PO receive + transfer
-- ship/receive cluster. Without this table a network-timeout retry or
-- a double-click produced two stock movements (double-COGS, negative
-- stock on edge cases). The middleware at src/lib/idempotency/middleware.ts
-- is the single writer; this migration creates the bounded cache table
-- it reads from / writes to.
--
-- Lifecycle (see middleware.ts):
--
--   new request        → INSERT state='IN_FLIGHT'
--   handler ok         → UPDATE state='COMPLETED', responseJson, completedAt
--   handler err        → UPDATE state='FAILED', completedAt
--   replay, COMPLETED  → serve cached responseJson (if fingerprint matches)
--   replay, fingerprint mismatch → throw IdempotencyConflictError (409)
--   replay, IN_FLIGHT  → throw IdempotencyInProgressError (409)
--
-- TTL: expiresAt is set by the middleware (24h default, overridable).
-- A sweep cron — tracked as a follow-up, not a blocker — evicts
-- expired rows so the table stays bounded.
--
-- Idempotent: safe to re-apply on any DB shape. CREATE TABLE IF NOT
-- EXISTS / guarded ALTER TABLE so a dev that ran `prisma db push`
-- first can still land this cleanly.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "IdempotencyKey" (
  "id"                 TEXT NOT NULL,
  "organizationId"     TEXT NOT NULL,
  -- sha256(`${actionName}:${key}`) — keeps arbitrarily long keys
  -- compact and uniform; the raw key never lives at rest.
  "keyHash"            TEXT NOT NULL,
  -- Dotted identifier, e.g. "shipSalesOrder" | "receivePurchaseOrder".
  -- Two actions can safely reuse the same raw key without colliding.
  "actionName"         TEXT NOT NULL,
  -- sha256 of the canonicalized request payload. Detects "same key,
  -- different body" — 409 semantics instead of silent stale response.
  "requestFingerprint" TEXT NOT NULL,
  -- Cached response body. JSONB because action results are arbitrary
  -- shapes. Null on IN_FLIGHT and FAILED rows.
  "responseJson"       JSONB,
  -- "IN_FLIGHT" | "COMPLETED" | "FAILED". String-as-enum follows the
  -- IntegrationTask precedent (keeps new states from forcing an enum
  -- migration each time).
  "state"              TEXT NOT NULL DEFAULT 'IN_FLIGHT',
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt"        TIMESTAMP(3),
  "expiresAt"          TIMESTAMP(3) NOT NULL,

  CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- Organization cascade: if an org is removed, its idempotency cache
-- goes with it (same shape as IntegrationTask on line 2045 of schema).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'IdempotencyKey_organizationId_fkey'
  ) THEN
    ALTER TABLE "IdempotencyKey"
      ADD CONSTRAINT "IdempotencyKey_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Primary lookup: (org, keyHash) unique.
CREATE UNIQUE INDEX IF NOT EXISTS "IdempotencyKey_organizationId_keyHash_key"
  ON "IdempotencyKey"("organizationId", "keyHash");

-- TTL sweep cron scans by expiresAt.
CREATE INDEX IF NOT EXISTS "IdempotencyKey_expiresAt_idx"
  ON "IdempotencyKey"("expiresAt");

-- Admin queries group by action within an org, newest first.
CREATE INDEX IF NOT EXISTS "IdempotencyKey_organizationId_actionName_createdAt_idx"
  ON "IdempotencyKey"("organizationId", "actionName", "createdAt");
