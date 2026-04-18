-- ─────────────────────────────────────────────────────────────────────────────
-- P2-6 §5.28: Email deliverability status (Resend webhook integration).
-- ─────────────────────────────────────────────────────────────────────────────
-- Audit v1.1 §5.28 — before this migration there was no persisted record
-- of bounces/complaints; our sender kept emailing dead addresses which
-- erodes the sending-domain reputation with Resend (send-to-invalid
-- ratio caps at ~5% before throttling kicks in).
--
-- Changes:
--   1. New enum `EmailStatus` with ACTIVE/BOUNCED/COMPLAINED/UNSUBSCRIBED.
--   2. `User.emailStatus` — default ACTIVE; updated by webhook handler.
--   3. `User.emailStatusUpdatedAt` — audit timestamp for admin UI.
--
-- Backfill: every existing row is implicitly ACTIVE via the column
-- default. No data rewrite needed.
--
-- Idempotent: all DDL uses IF NOT EXISTS guards so re-apply is safe.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EmailStatus') THEN
    CREATE TYPE "EmailStatus" AS ENUM ('ACTIVE', 'BOUNCED', 'COMPLAINED', 'UNSUBSCRIBED');
  END IF;
END$$;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "emailStatus" "EmailStatus" NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "emailStatusUpdatedAt" TIMESTAMP(3);

-- Index on emailStatus because the typical admin query is
-- "show me users currently bouncing" — this makes it cheap.
CREATE INDEX IF NOT EXISTS "User_emailStatus_idx" ON "User"("emailStatus");
