# Migration baseline — operator runbook

**Audience:** whoever first runs `prisma migrate` against a Neon branch
that was populated by `prisma db push` during the first 41 sprints, i.e.
every dev branch and the single staging branch that currently exists.

**Scope:** this runbook is Phase 6A / P1. It covers the *mechanics* of
introducing a baseline migration and replaying Phase 5A on top of it.
It does **not** redesign the deployment pipeline, add a production
environment, or automate any of this in CI — those are deferred.

---

## Why a baseline is needed

Up to and including Sprint 41, the repo had **zero** migration history:
schema changes were applied live to the Neon dev branch via
`prisma db push`. Phase 5A shipped the first real migration
(`phase5a_additive_domain_model/`). If we let `prisma migrate deploy`
run that migration against a database that already has every
pre-Phase-5A table (because `db push` created them), one of two things
happens:

1. `prisma migrate deploy` notices the `_prisma_migrations` table
   doesn't exist, decides this is a virgin database, and tries to
   execute the Phase 5A `ALTER TABLE` statements against tables that
   *already have* those columns — and fails with "relation already
   exists" or "column already exists" type errors.
2. Worse: someone runs `prisma migrate reset`, which drops and
   recreates every table from scratch — **destroying dev data**.

A baseline migration is the idiomatic Prisma answer. We generate a
single migration that represents "every piece of DDL that would be
needed to produce the schema as it stood *immediately before* Phase 5A",
mark it as already-applied on every existing database, and let
`prisma migrate deploy` handle Phase 5A (and everything after it) in
the normal way.

---

## What's in this commit

Two new files:

* `prisma/migrations/00000000000000_baseline/migration.sql` — the full
  pre-Phase-5A schema as DDL. Generated deterministically by
  `prisma migrate diff --from-empty --to-schema-datamodel <reconstructed>`
  against a stripped copy of `prisma/schema.prisma` with the four
  Phase 5A additive changes reversed:
  * `StockMovement.purchaseOrderLineId` + `stockCountId` + their
    relations and indexes removed.
  * `CountEntry` composite FK (`CountEntrySnapshot` relation) removed.
  * `Membership.deactivatedAt` removed.
  * Back-relation stubs on `CountSnapshot`, `StockCount`, and
    `PurchaseOrderLine` removed.
* `prisma/migrations/migration_lock.toml` — Prisma's provider lock file
  (`postgresql`). Required by `prisma migrate` so a future accidental
  switch to a different datasource provider is caught at tool level.

The pre-existing Phase 5A migration stays in place:
`prisma/migrations/phase5a_additive_domain_model/migration.sql`. It is
hand-written and includes operator commentary that
`prisma migrate diff` cannot produce, so we keep the human-authored
version rather than overwrite it with a regenerated one. The *shape* of
that migration matches the canonical diff — cross-checked with:

```sh
npx prisma migrate diff \
  --from-schema-datamodel <reconstructed-baseline>.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script
```

and the column set, FK targets, cascade modes, and index names line up
with the hand-authored file. See `## Determinism cross-check` below for
the exact command if you want to re-verify.

---

## Migration folder ordering

Prisma `migrate deploy` applies migrations in lexicographic order by
folder name. We rely on:

```
00000000000000_baseline/           <-- sorts first
phase5a_additive_domain_model/     <-- sorts after
```

Using `00000000000000_` as the baseline prefix (fourteen zeros, Prisma's
convention for "before anything else") means any future
timestamp-prefixed migration folder (`20260501120000_…`) will slot
between the baseline and Phase 5A without re-ordering — which is fine,
because those migrations will have been generated against a schema that
already has Phase 5A applied. The ordering rule we actually want is
just "baseline first", and this achieves it.

> **Note.** The Phase 5A folder does not have a timestamp prefix. Prisma
> tolerates this — it accepts any folder name starting with an
> alphanumeric — but it is **not** the convention. New migrations from
> this point on MUST use the `YYYYMMDDHHMMSS_name` format
> (`prisma migrate dev --create-only --name foo` generates this
> automatically). We keep the Phase 5A name as-is because it's already
> committed and tagged.

---

## How to apply this on an existing Neon dev branch

This is the happy path for the dev branch where Sprint 0–41 live. The
database already has every pre-Phase-5A table (from `db push`) but
**does not yet** have the Phase 5A columns, FKs, or `deactivatedAt`
column, because Phase 5A has not been migrated yet.

### Step 1 — sanity-check that the database matches the baseline

Run `prisma db pull` against a disposable copy (never against a shared
branch directly). If the pulled schema differs materially from
`prisma/schema.prisma` with the Phase 5A changes *excluded*, stop and
diagnose before continuing.

```sh
# against a disposable Neon branch, not dev:
DATABASE_URL="…" npx prisma db pull --schema=/tmp/pulled.prisma
diff /tmp/pulled.prisma prisma/schema.prisma
```

Differences you expect to see:
* The four Phase 5A additions — they're in `prisma/schema.prisma` but
  not yet in the database.
* Ordering of fields inside a model, `@@index`/`@@unique` position —
  cosmetic only, ignorable.
* Comments — `db pull` strips them; ignorable.

Any **other** drift (a missing table, an extra column, a different
type, a different default) means the `db push`-era schema has drifted
from what `schema.prisma` says. Resolve that drift **before** baselining.

### Step 2 — mark the baseline as already-applied

This is the key step. It tells Prisma's migration tracking table
(`_prisma_migrations`) that the baseline migration has already been
executed on this database — even though `prisma migrate deploy` has
never run here — so it won't try to execute `CREATE TABLE` statements
against tables that already exist.

```sh
DATABASE_URL="…" DIRECT_URL="…" \
  npx prisma migrate resolve --applied 00000000000000_baseline
```

Prisma will create the `_prisma_migrations` table if it doesn't exist
and insert a single row marking `00000000000000_baseline` as applied at
the current timestamp.

### Step 3 — apply Phase 5A on top of the baseline

Now `prisma migrate deploy` has exactly one pending migration
(`phase5a_additive_domain_model`) and will apply it cleanly:

```sh
DATABASE_URL="…" DIRECT_URL="…" \
  npx prisma migrate deploy
```

Before running Phase 5A, run the P4 pre-flight orphan check from the
top of that migration's comment header:

```sql
SELECT COUNT(*) AS orphans
FROM "CountEntry" ce
LEFT JOIN "CountSnapshot" cs
  ON  cs."countId"     = ce."countId"
  AND cs."itemId"      = ce."itemId"
  AND cs."warehouseId" = ce."warehouseId"
WHERE cs."id" IS NULL;
```

Expected result: `0`. If anything else, stop and escalate — the
Phase 5A `CountEntry` composite FK will fail to add otherwise, and
the fix is not to delete orphan rows.

### Step 4 — verify

```sh
DATABASE_URL="…" npx prisma migrate status
```

Expected output: "Database schema is up to date!" with two migrations
listed, both in "applied" state.

---

## How to apply this on a brand-new database

This is the easy path — every new environment from this point on:

```sh
DATABASE_URL="…" DIRECT_URL="…" \
  npx prisma migrate deploy
```

Runs the baseline from empty (`CREATE TABLE` everything) and then
Phase 5A on top. No manual `migrate resolve` required.

---

## Determinism cross-check

If you ever need to re-generate the baseline SQL (for example after a
later migration adds a new table and you want to move the "baseline
snapshot" forward to include it), the procedure is:

1. Copy `prisma/schema.prisma` to a temporary file.
2. Reverse every schema change that belongs to the migrations you want
   to keep *out* of the baseline. For Phase 5A that means the four
   changes listed in the "What's in this commit" section above.
3. Run `prisma migrate diff --from-empty --to-schema-datamodel
   <tempfile> --script > /tmp/baseline.sql`.
4. Replace `prisma/migrations/00000000000000_baseline/migration.sql`
   with `/tmp/baseline.sql`.

The command is pure and will produce byte-identical output given the
same input schema — there is no hidden state. Commit the regenerated
file alongside the schema change that prompted the refresh.

---

## What this runbook intentionally does NOT cover

The following were reviewed as part of Phase 6 and explicitly deferred
out of Phase 6A by the owning team. Each is a known follow-up:

* **Automated migration apply in CI**. Today this is a two-person
  checklist; Phase 6B may wire it into a dedicated workflow step with
  a shadow-database check.
* **Production environment provisioning**. There is no production
  database yet; this runbook is written against the single Neon dev
  branch and generalizes to staging when that is created.
* **`prisma migrate dev` vs `prisma migrate deploy` policy**. Teams
  should use `migrate deploy` *only* in CI and shared environments;
  `migrate dev` is for local schema-change authoring. We have not
  enforced this as a CI guard yet.
* **Rollback of Phase 5A on a live DB**. Phase 5A is strictly additive
  and nullable so a forward-only approach is safe; a documented
  rollback procedure is a Post-MVP item.
* **Shadow database configuration**. Optional on managed Postgres and
  currently unconfigured. Prisma will use a temporary database on
  `migrate dev`; configure `shadowDatabaseUrl` in the datasource block
  only if you want deterministic shadow behavior on CI.

---

## Links

* Prisma baseline docs:
  https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining
* `prisma migrate diff` CLI reference:
  https://www.prisma.io/docs/orm/reference/prisma-cli-reference#migrate-diff
* `prisma migrate resolve --applied` reference:
  https://www.prisma.io/docs/orm/reference/prisma-cli-reference#migrate-resolve
