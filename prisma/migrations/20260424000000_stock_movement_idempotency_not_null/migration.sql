-- ─────────────────────────────────────────────────────────────────────────────
-- GOD MODE roadmap 2026-04-23 — P0-03 StockMovement.idempotencyKey NOT NULL.
-- ─────────────────────────────────────────────────────────────────────────────
-- StockMovement.idempotencyKey was nullable. Postgres treats NULL != NULL
-- inside a unique index, so two writes without a key both succeeded —
-- defeating the purpose of the @@unique([organizationId, idempotencyKey])
-- index. A webhook retry that omitted a submission nonce could double-book
-- a receipt without any constraint tripping. See roadmap P0-03.
--
-- Safety:
--   1. Every *new* write now passes through the postMovement seam, which
--      defaults a runtime UUID when the caller omits one (rc1 shipped
--      this — commit v1.6.2-rc1-idempotency-key-foundation). Before this
--      migration runs, the app layer is already producing non-null
--      keys for every fresh insert.
--
--   2. Pre-existing rows that were inserted before the seam landed may
--      still carry NULL. This migration backfills them with a reserved
--      sentinel: `LEGACY:${id}`. The sentinel is distinct per row, so
--      the unique index is preserved; the `LEGACY:` prefix is reserved
--      so a future write cannot accidentally collide.
--
--   3. The seam rejects new writes that start with `LEGACY:`, so a
--      developer cannot mint a sentinel-shaped key by accident.
--
-- Ordering: backfill FIRST, ALTER SECOND. If the ALTER ran first the
-- column flip would fail on the NULL rows.
--
-- Idempotent: safe to re-apply. The UPDATE no-ops once every row has a
-- key; the ALTER is wrapped in a DO block that only fires if the column
-- is still nullable.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Backfill pre-existing NULL rows with the sentinel.
--
-- `LEGACY:` || id is distinct per row (id is @id @default(cuid)) so the
-- unique index is preserved. This UPDATE is safe to re-run because the
-- WHERE clause filters to rows that still carry NULL — after the first
-- run there are none.
UPDATE "StockMovement"
SET "idempotencyKey" = 'LEGACY:' || "id"
WHERE "idempotencyKey" IS NULL;

-- 2. Flip the column to NOT NULL.
--
-- Wrapped in a DO block so a re-run on an already-flipped column is a
-- no-op (information_schema check). Postgres' ALTER COLUMN ... SET NOT
-- NULL fails cleanly if any row still carries NULL, which protects us
-- against a partial backfill.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'StockMovement'
       AND column_name  = 'idempotencyKey'
       AND is_nullable  = 'YES'
  ) THEN
    ALTER TABLE "StockMovement"
      ALTER COLUMN "idempotencyKey" SET NOT NULL;
  END IF;
END $$;

-- The existing @@unique([organizationId, idempotencyKey]) index stays in
-- place. Before this migration it was effectively a partial unique
-- (Postgres doesn't constrain across NULLs); after this migration it's
-- a full unique. No explicit INDEX DDL needed — the constraint object
-- is unchanged.
