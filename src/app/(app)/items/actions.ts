"use server";

import { Prisma } from "@/generated/prisma";
import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { logger } from "@/lib/logger";
import { hasCapability } from "@/lib/permissions";
// Phase 6A / P2 — narrow rate-limit surface for bulk import. See
// `src/lib/rate-limit.ts` for the design note on fail-open behavior.
import { rateLimit } from "@/lib/rate-limit";
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

  if (!hasCapability(membership.role, "items.create")) {
    return { ok: false, error: t.permissions.forbidden };
  }

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

    revalidatePath("/items");
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "item.created",
      entityType: "item",
      entityId: item.id,
      metadata: { sku: input.sku, name: input.name, status: input.status },
    });
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

  if (!hasCapability(membership.role, "items.edit")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  const parsed = itemInputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: t.items.errors.updateFailed,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const input = parsed.data;

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

    revalidatePath("/items");
    revalidatePath(`/items/${id}`);
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "item.updated",
      entityType: "item",
      entityId: updated.id,
      metadata: { sku: input.sku, name: input.name, status: input.status },
    });
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

  if (!hasCapability(membership.role, "items.import")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  // Phase 6A / P2 — bulk import is cheap per row but expensive at
  // scale because every call spins up the validate-then-insert path
  // against up to IMPORT_ROW_HARD_CAP rows. Cap at 3 imports per
  // user per 5 minutes, which is enough for a human running 2–3
  // spreadsheet passes in a row to fix column mappings but nothing
  // close to an automated abuse loop.
  const rate = await rateLimit(`items:import:user:${session.user.id}`, {
    max: 3,
    windowSeconds: 300,
  });
  if (!rate.ok) {
    return { ok: false, error: t.common.rateLimited };
  }

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
        totalRows: input.rows.length,
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
    logger.error("items: import createMany failed", {
      tag: "items.import",
      err: error,
    });
    return { ok: false, error: t.itemsImport.errors.commitFailed };
  }
}

// --- delete -----------------------------------------------------------------

export async function deleteItemAction(id: string): Promise<ActionResult> {
  const { session, membership } = await requireActiveMembership();
  const t = await getMessages();

  if (!hasCapability(membership.role, "items.delete")) {
    return { ok: false, error: t.permissions.forbidden };
  }

  try {
    await db.item.delete({
      where: {
        id,
        organizationId: membership.organizationId,
      },
    });
    revalidatePath("/items");
    // entityId intentionally omitted — the Item row is gone. The id
    // we were given is still useful for cross-referencing audit logs
    // to other tables (e.g. stockMovement.itemId in older rows) so
    // we park it in metadata rather than dropping it.
    await recordAudit({
      organizationId: membership.organizationId,
      actorId: session.user.id,
      action: "item.deleted",
      entityType: "item",
      entityId: null,
      metadata: { itemId: id },
    });
    return { ok: true, id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { ok: false, error: t.items.errors.notFound };
    }
    return { ok: false, error: t.items.errors.deleteFailed };
  }
}
