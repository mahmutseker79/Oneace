// Sprint 40 — audit log retention script.
//
// Run with `npm run audit:prune` (or `tsx src/scripts/prune-audit.ts`
// directly). Reads `AUDIT_RETENTION_DAYS` from the Sprint 37 env
// schema (default 365, min 1) and deletes every `AuditEvent` row
// older than that cutoff across all organizations.
//
// Design decisions — all inherited from the governance posture the
// audit log was built with in Sprint 36:
//
//   1. **Tenant-by-tenant, not global.** The delete runs per
//      organization so the self-audit `audit.pruned` row can
//      accurately attribute the count to that tenant. A single
//      global `deleteMany` would be ~10% faster at MVP scale but
//      would force us to write the audit row with a synthetic
//      "all orgs" entityId, losing the per-tenant provenance a
//      reviewer needs.
//
//   2. **The prune writes its own audit row.** Missing this row is
//      its own alarm signal: "the log is short because nothing
//      happened" vs "the log is short because prune ran" should be
//      distinguishable without external tooling. The self-audit
//      writes AFTER the delete so if the delete fails partway
//      through, no misleading "pruned" row is created.
//
//   3. **Cutoff is computed once, at script start.** Every tenant
//      uses the same cutoff date. If the script takes minutes to
//      run, rows created during that window will still be kept (we
//      don't want a slow prune to silently bite newer data).
//
//   4. **Self-audit rows are exempt from the prune.** We
//      deliberately don't try to avoid deleting old `audit.pruned`
//      rows — if the retention window is a year and a prune ran
//      two years ago, that prune row is allowed to fall out of
//      the window naturally. The goal isn't permanent provenance;
//      the goal is that any given retention window shows its own
//      prune row if one occurred.
//
//   5. **No transaction.** `deleteMany` + `auditEvent.create` can't
//      be usefully atomic here because the delete is unbounded and
//      our main pragma is "never let audit writes block the path
//      forward". A crash between delete and audit-write just means
//      the next run will re-see fewer rows to delete; the tenant
//      still loses the 'audit.pruned' row for that run, which is
//      acceptable given how rarely prune runs.
//
//   6. **Exit code is 0 on success, 1 on any failure.** External
//      cron wrappers rely on this. A zero-delete run is still a
//      success (common case in small installs).
//
// Invocation shapes supported:
//
//   npm run audit:prune                      # default 365 days
//   AUDIT_RETENTION_DAYS=90 npm run audit:prune
//   tsx src/scripts/prune-audit.ts
//
// The script does NOT accept CLI flags; the env var is the only
// knob. This keeps the interface uniform across local, cron, and
// one-off invocations, and matches how every other knob in the
// codebase is tuned (Sprint 37 env schema is the single source of
// truth for runtime configuration).

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

async function main(): Promise<void> {
  const retentionDays = env.AUDIT_RETENTION_DAYS;
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  logger.info("audit:prune starting", {
    retentionDays,
    cutoffIso: cutoffDate.toISOString(),
  });

  // Collect org ids that actually have audit rows older than the
  // cutoff. A `groupBy` keyed on organizationId with `where:
  // createdAt < cutoff` gives us exactly the tenants that need
  // work, avoiding a full table scan per tenant when most orgs
  // have nothing to delete. If this ever gets slow we'll swap in
  // a distinct-by-org query that walks an index, but at MVP
  // scale `groupBy` is perfectly fine.
  const stale = await db.auditEvent.groupBy({
    by: ["organizationId"],
    where: { createdAt: { lt: cutoffDate } },
    _count: { _all: true },
  });

  if (stale.length === 0) {
    logger.info("audit:prune no rows to delete", { retentionDays });
    return;
  }

  let totalDeleted = 0;
  let orgsProcessed = 0;

  for (const group of stale) {
    const { organizationId, _count } = group;
    const expected = _count._all;

    // Per-tenant delete. Using `deleteMany` with an indexed
    // `(organizationId, createdAt)` composite means the DB walks
    // exactly the rows we want and nothing else.
    const result = await db.auditEvent.deleteMany({
      where: {
        organizationId,
        createdAt: { lt: cutoffDate },
      },
    });
    totalDeleted += result.count;
    orgsProcessed += 1;

    // Self-audit row. Writing via the raw `create` (not
    // `recordAudit`) is deliberate: `recordAudit` swallows errors
    // and this is a script where we want loud failures. Actor is
    // null (system-initiated). EntityType is "organization" and
    // entityId is the tenant so the row surfaces under the org's
    // own audit timeline on /audit.
    try {
      await db.auditEvent.create({
        data: {
          organizationId,
          actorId: null,
          action: "audit.pruned",
          entityType: "organization",
          entityId: organizationId,
          metadata: {
            retentionDays,
            cutoffDate: cutoffDate.toISOString(),
            deletedCount: result.count,
            expectedCount: expected,
          },
        },
      });
    } catch (err) {
      // Log-and-continue: a failed self-audit write is a bad
      // smell but not a reason to abort a prune run that already
      // deleted rows for this tenant. Subsequent tenants still
      // get their chance.
      logger.error("audit:prune failed to write self-audit row", {
        organizationId,
        err,
      });
    }

    logger.info("audit:prune tenant done", {
      organizationId,
      deleted: result.count,
    });
  }

  logger.info("audit:prune complete", {
    retentionDays,
    orgsProcessed,
    totalDeleted,
  });
}

main()
  .catch((err) => {
    logger.error("audit:prune failed", { err });
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
