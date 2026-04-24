-- AlterTable (idempotent guard — hotfix 2026-04-24)
--
-- Pre-existing ordering bug: this migration (timestamp 031406) runs
-- BEFORE `20260415120000_add_two_factor_auth` on scratch Postgres,
-- but the ALTER assumes the table already exists. The later
-- migration is the one that creates it. On prod the sequence ran
-- against an already-populated DB so both applied cleanly; scratch
-- CI (introduced by the P1-04 migration gate) exposes the gap.
--
-- Wrapping the ALTER in an IF EXISTS guard makes it a safe no-op
-- when the table doesn't exist yet (scratch / fresh-clone case)
-- and the expected DROP DEFAULT when it does (prod case).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'TwoFactorAuth' AND table_schema = 'public'
  ) THEN
    ALTER TABLE "TwoFactorAuth" ALTER COLUMN "backupCodes" DROP DEFAULT;
  END IF;
END $$;
