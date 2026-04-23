-- ─────────────────────────────────────────────────────────────────────────────
-- GOD MODE roadmap 2026-04-23 — P1-02 WebhookDeliveryEvent.
-- ─────────────────────────────────────────────────────────────────────────────
-- Cross-provider delivery-dedup table. Pre-P1-02 only Shopify had
-- such a table; QuickBooks ingested every retry as a fresh event
-- and double-applied entity updates. This model plus the
-- (provider, externalId) unique index makes a retry land on P2002.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS + guarded FK + CREATE
-- INDEX IF NOT EXISTS.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "WebhookDeliveryEvent" (
  "id"             TEXT NOT NULL,
  "provider"       TEXT NOT NULL,
  "organizationId" TEXT,
  "externalId"     TEXT NOT NULL,
  "bodyHash"       TEXT,
  "eventType"      TEXT,
  "receivedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WebhookDeliveryEvent_pkey" PRIMARY KEY ("id")
);

-- Org cascade — deleting an org cleans up its delivery ledger;
-- unrouted deliveries (organizationId IS NULL) are unaffected.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WebhookDeliveryEvent_organizationId_fkey'
  ) THEN
    ALTER TABLE "WebhookDeliveryEvent"
      ADD CONSTRAINT "WebhookDeliveryEvent_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Primary dedup index: (provider, externalId) unique.
CREATE UNIQUE INDEX IF NOT EXISTS "WebhookDeliveryEvent_provider_externalId_key"
  ON "WebhookDeliveryEvent"("provider", "externalId");

-- TTL sweep cron scans by (provider, receivedAt).
CREATE INDEX IF NOT EXISTS "WebhookDeliveryEvent_provider_receivedAt_idx"
  ON "WebhookDeliveryEvent"("provider", "receivedAt");

-- Admin queries filter by tenant.
CREATE INDEX IF NOT EXISTS "WebhookDeliveryEvent_organizationId_provider_idx"
  ON "WebhookDeliveryEvent"("organizationId", "provider");
