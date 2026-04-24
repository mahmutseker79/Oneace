-- MIGRATION-TYPE: EXPAND
-- ─────────────────────────────────────────────────────────────────────────────
-- Audit v1.3 §5.53 F-09 — IntegrationTask durable work queue + DLQ.
-- ─────────────────────────────────────────────────────────────────────────────
-- 15+ adapters under src/lib/integrations/ (shopify, quickbooks, amazon,
-- bigcommerce, magento, odoo, wix, woocommerce, xero, zoho, …) had no
-- shared durable state for webhook / sync tasks. A 500 from Shopify
-- threw an exception, the sync-engine logged and exited, and the task
-- was gone. SyncLog records the aggregate sync outcome — it is not a
-- retry queue. This table is the retry queue.
--
-- Lifecycle (see src/lib/integrations/task-queue.ts):
--
--   enqueue → status='pending', nextAttemptAt=now
--   cron    → claim rows with status='pending' AND nextAttemptAt <= now()
--           → mark status='in_progress' (atomic via UPDATE … RETURNING)
--   handler ok  → status='done'
--   handler err → retryCount++, nextAttemptAt = now() + backoff(retryCount)
--   retryCount reaches MAX_RETRIES (3) → status='dead', notify owner
--
-- Idempotent: safe to re-apply on any DB shape.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "IntegrationTask" (
  "id"              TEXT NOT NULL,
  "organizationId"  TEXT NOT NULL,
  -- Matches the directory name under src/lib/integrations/ so the
  -- dispatcher can route purely off the column value.
  "integrationKind" TEXT NOT NULL,
  -- Adapter-defined work kind: "sync_products", "webhook_received", …
  "taskKind"        TEXT NOT NULL,
  -- Adapter-shaped payload. Kept as JSONB so new task kinds can ship
  -- without another migration.
  "payload"         JSONB NOT NULL,
  -- "pending" | "in_progress" | "done" | "dead". String instead of
  -- enum because adapters keep landing; the app-level union type
  -- in task-queue.ts is the compile-time fence.
  "status"          TEXT NOT NULL DEFAULT 'pending',
  "retryCount"      INTEGER NOT NULL DEFAULT 0,
  -- Next claim-eligible timestamp. NULL for "claim now" and for
  -- terminal (done / dead) rows.
  "nextAttemptAt"   TIMESTAMP(3),
  "lastError"       TEXT,
  -- Classifier bucket: "auth" | "rate-limit" | "5xx" | "4xx" |
  -- "schema-mismatch" | "transport" | "unknown". Drives per-kind
  -- dashboards and alerting.
  "lastErrorKind"   TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "IntegrationTask_pkey" PRIMARY KEY ("id")
);

-- Organization cascade delete: if an org is removed the queue goes
-- with it, same shape as Integration.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'IntegrationTask_organizationId_fkey'
  ) THEN
    ALTER TABLE "IntegrationTask"
      ADD CONSTRAINT "IntegrationTask_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

-- Primary claim-path index. The cron consumer filters by
-- (status, nextAttemptAt) so this composite lets Postgres walk only
-- the pending rows whose timer has elapsed.
CREATE INDEX IF NOT EXISTS "IntegrationTask_status_nextAttemptAt_idx"
  ON "IntegrationTask"("status", "nextAttemptAt");

-- Admin DLQ view filter path.
CREATE INDEX IF NOT EXISTS "IntegrationTask_organizationId_integrationKind_idx"
  ON "IntegrationTask"("organizationId", "integrationKind");
