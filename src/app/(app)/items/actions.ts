"use server";

import { Prisma } from "@/generated/prisma";
import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";
import { itemInputSchema } from "@/lib/validation/item";
import {
  type ImportItemRowOutput,
  type ImportValidationIssue,
  validateImportRows,
} from "@/lib/validation/item-import";

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function createItemAction(formData: FormData): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  const parsed = itemInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: t.items.errors.createFailed,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const input = parsed.data;

  try {
    const item = await db.item.create({
      data: {
        organizationId: membership.organizationId,
        sku: input.sku,
        barcode: input.barcode,
        name: input.name,
        description: input.description,
        categoryId: input.categoryId,
        preferredSupplierId: input.preferredSupplierId,
        unit: input.unit,
        costPrice: input.costPrice !== null ? new Prisma.Decimal(input.costPrice) : null,
        salePrice: input.salePrice !== null ? new Prisma.Decimal(input.salePrice) : null,
        currency: input.currency,
        reorderPoint: input.reorderPoint,
        reorderQty: input.reorderQty,
        status: input.status,
        imageUrl: input.imageUrl,
      },
      select: { id: true },
    });

    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "item.created",
      entityType: "item",
      entityId: item.id,
      metadata: { sku: input.sku, name: input.name, status: input.status },
    });

    revalidatePath("/items");
    return { ok: true, id: item.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        ok: false,
        error: t.items.errors.skuExists,
        fieldErrors: { sku: [t.items.errors.skuExists] },
      };
    }
    return { ok: false, error: t.items.errors.createFailed };
  }
}

export async function updateItemAction(id: string, formData: FormData): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  const parsed = itemInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: t.items.errors.updateFailed,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const input = parsed.data;

  // Snapshot the before-values so the audit row can carry a minimal
  // diff of the fields a reviewer is most likely to care about. We
  // deliberately skip wide columns (description, imageUrl) and the
  // decimal money fields — the latter would need Prisma.Decimal
  // equality handling for an honest diff, and the audit log isn't the
  // right place for price-change history anyway.
  const before = await db.item.findFirst({
    where: { id, organizationId: membership.organizationId },
    select: {
      sku: true,
      name: true,
      barcode: true,
      status: true,
      categoryId: true,
      reorderPoint: true,
      reorderQty: true,
    },
  });

  try {
    const updated = await db.item.update({
      where: {
        id,
        organizationId: membership.organizationId,
      },
      data: {
        sku: input.sku,
        barcode: input.barcode,
        name: input.name,
        description: input.description,
        categoryId: input.categoryId,
        preferredSupplierId: input.preferredSupplierId,
        unit: input.unit,
        costPrice: input.costPrice !== null ? new Prisma.Decimal(input.costPrice) : null,
        salePrice: input.salePrice !== null ? new Prisma.Decimal(input.salePrice) : null,
        currency: input.currency,
        reorderPoint: input.reorderPoint,
        reorderQty: input.reorderQty,
        status: input.status,
        imageUrl: input.imageUrl,
      },
      select: { id: true },
    });

    // If `before` is null the update would have already thrown P2025,
    // so in practice we always have a snapshot to diff against here.
    if (before) {
      const after = {
        sku: input.sku,
        name: input.name,
        barcode: input.barcode,
        status: input.status,
        categoryId: input.categoryId,
        reorderPoint: input.reorderPoint,
        reorderQty: input.reorderQty,
      };
      // Build a minimal changed-keys list so the reviewer sees at a
      // glance what moved, not 7 unchanged fields per row.
      const changed: Record<string, { from: unknown; to: unknown }> = {};
      for (const key of Object.keys(after) as (keyof typeof after)[]) {
        if (before[key] !== after[key]) {
          changed[key] = { from: before[key], to: after[key] };
        }
      }
      // Skip the write entirely on a no-op resubmit — same-page double
      // submit shouldn't spam the log. Matches the users.role_changed
      // early return from Sprint 36.
      if (Object.keys(changed).length > 0) {
        await recordAudit({
          organizationId: membership.organizationId,
          actorId: session.user.id,
          action: "item.updated",
          entityType: "item",
          entityId: updated.id,
          metadata: { sku: after.sku, changed },
        });
      }
    }

    revalidatePath("/items");
    revalidatePath(`/items/${id}`);
    return { ok: true, id: updated.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return {
          ok: false,
          error: t.items.errors.skuExists,
          fieldErrors: { sku: [t.items.errors.skuExists] },
        };
      }
      if (error.code === "P2025") {
        return { ok: false, error: t.items.errors.notFound };
      }
    }
    return { ok: false, error: t.items.errors.updateFailed };
  }
}

// --- CSV / bulk import ------------------------------------------------------

export type ImportItemsResult =
  | {
      ok: true;
      inserted: number;
      skippedInvalid: number;
      skippedConflicts: number;
      invalid: ImportValidationIssue[];
      conflictSkus: string[];
    }
  | {
      ok: false;
      error: string;
      invalid?: ImportValidationIssue[];
      conflictSkus?: string[];
    };

// Hard cap per import to keep the transaction bounded and avoid surprising
// timeouts on Neon's pgbouncer pool. A Sortly/inFlow "starter" seed rarely
// needs more than a few thousand rows; larger tenants can re-run the import.
const IMPORT_ROW_HARD_CAP = 5000;

export async function importItemsAction(input: {
  rows: Record<string, unknown>[];
}): Promise<ImportItemsResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!Array.isArray(input.rows) || input.rows.length === 0) {
    return { ok: false, error: t.itemsImport.errors.noRows };
  }
  if (input.rows.length > IMPORT_ROW_HARD_CAP) {
    return { ok: false, error: t.itemsImport.errors.tooManyRows };
  }

  // Phase 1 — in-memory validation + in-file SKU dedup.
  const validation = validateImportRows(input.rows);
  if (validation.valid.length === 0) {
    return {
      ok: false,
      error: t.itemsImport.errors.allRowsInvalid,
      invalid: validation.invalid,
    };
  }

  // Phase 2 — database-level dedup against existing SKUs in this tenant.
  const candidateSkus = validation.valid.map((entry) => entry.row.sku);
  const existing = await db.item.findMany({
    where: {
      organizationId: membership.organizationId,
      sku: { in: candidateSkus },
    },
    select: { sku: true },
  });
  const existingSet = new Set(existing.map((row) => row.sku));
  const conflictSkus: string[] = [];

  const toInsert: ImportItemRowOutput[] = [];
  for (const entry of validation.valid) {
    if (existingSet.has(entry.row.sku)) {
      conflictSkus.push(entry.row.sku);
      continue;
    }
    toInsert.push(entry.row);
  }

  if (toInsert.length === 0) {
    return {
      ok: false,
      error: t.itemsImport.errors.allRowsConflict,
      invalid: validation.invalid,
      conflictSkus,
    };
  }

  // Phase 3 — single transactional bulk insert. createMany skips the
  // per-row "select" round-trip that creates a noisy query log, and its
  // `skipDuplicates` gives us belt-and-suspenders protection against a
  // concurrent import racing us between the findMany above and now.
  try {
    const result = await db.item.createMany({
      data: toInsert.map((row) => ({
        organizationId: membership.organizationId,
        sku: row.sku,
        barcode: row.barcode,
        name: row.name,
        description: row.description,
        unit: row.unit,
        costPrice: row.costPrice !== null ? new Prisma.Decimal(row.costPrice) : null,
        salePrice: row.salePrice !== null ? new Prisma.Decimal(row.salePrice) : null,
        currency: row.currency,
        reorderPoint: row.reorderPoint,
        reorderQty: row.reorderQty,
        status: row.status,
      })),
      skipDuplicates: true,
    });

    revalidatePath("/items");

    // If createMany's count is lower than toInsert.length, a concurrent
    // import raced us between the findMany above and now. skipDuplicates
    // swallowed those rows silently. We surface them in aggregate so the
    // UI total adds up, but we don't enumerate which SKUs lost the race
    // because the information is no longer actionable (they exist now).
    const raced = Math.max(0, toInsert.length - result.count);

    // One audit row per bulk import — not per row. A 5 000-row CSV
    // should not generate 5 000 audit events. The metadata carries
    // the aggregate counts so a reviewer can reconstruct the batch.
    // `entityId` is null because an import spans many items; the PO
    // delete helper's "metadata over entityId" convention applies.
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "item.imported",
      entityType: "item",
      entityId: null,
      metadata: {
        inserted: result.count,
        skippedInvalid: validation.invalid.length,
        skippedConflicts: conflictSkus.length + raced,
      },
    });

    return {
      ok: true,
      inserted: result.count,
      skippedInvalid: validation.invalid.length,
      skippedConflicts: conflictSkus.length + raced,
      invalid: validation.invalid,
      conflictSkus,
    };
  } catch (error) {
    console.error("[importItemsAction] createMany failed", error);
    return { ok: false, error: t.itemsImport.errors.commitFailed };
  }
}

// --- delete -----------------------------------------------------------------

export async function deleteItemAction(id: string): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  // Read the sku/name BEFORE the delete so the audit row can carry
  // them as metadata. The entityId survives on the row but — as the
  // PO `deleted` convention from Sprint 36 notes — a deleted row's id
  // is useless for future lookups, so the human-readable fields go in
  // metadata instead. If the select comes back empty we let the
  // delete itself throw P2025 and short-circuit the audit write.
  const snapshot = await db.item.findFirst({
    where: { id, organizationId: membership.organizationId },
    select: { sku: true, name: true },
  });

  try {
    await db.item.delete({
      where: {
        id,
        organizationId: membership.organizationId,
      },
    });
    if (snapshot) {
      await recordAudit({
        organizationId: membership.organizationId,
        actorId: session.user.id,
        action: "item.deleted",
        entityType: "item",
        entityId: id,
        metadata: { sku: snapshot.sku, name: snapshot.name },
      });
    }
    revalidatePath("/items");
    return { ok: true, id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { ok: false, error: t.items.errors.notFound };
    }
    return { ok: false, error: t.items.errors.deleteFailed };
  }
}
