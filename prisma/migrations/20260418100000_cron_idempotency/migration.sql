-- ─────────────────────────────────────────────────────────────────────────────
-- P2-5 §5.27: CronRun idempotency ledger.
-- ─────────────────────────────────────────────────────────────────────────────
-- Audit v1.1 §5.27 — Vercel Cron delivery is at-least-once. Without a
-- ledger, a 5xx retry re-enters the cron body and we get double-effects:
-- stock-count templates fire twice, cleanup-notifications batches run
-- twice, audit log writes duplicate. The `withCronIdempotency` helper
-- uses this table as the source of truth per UTC day.
--
-- `runId` is the primary key: `cron:<name>:<YYYY-MM-DD>`. Upsert on
-- start; set `completedAt` on success. If the row already has
-- `completedAt != null`, the helper short-circuits.
--
-- Idempotent: safe to reapply on any DB shape.

CREATE TABLE IF NOT EXISTS "CronRun" (
  "runId"       TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "startedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "error"       TEXT,
  "result"      JSONB,

  CONSTRAINT "CronRun_pkey" PRIMARY KEY ("runId")
);

CREATE INDEX IF NOT EXISTS "CronRun_name_idx"       ON "CronRun"("name");
CREATE INDEX IF NOT EXISTS "CronRun_startedAt_idx"  ON "CronRun"("startedAt");
