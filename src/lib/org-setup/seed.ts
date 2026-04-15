import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { ReasonCategory } from "@/generated/prisma";

/**
 * Phase L9 — Organization seeding utility.
 *
 * Called from the onboarding flow (src/app/api/onboarding/organization/route.ts)
 * immediately after organization creation. Sets up default seed data so new
 * organizations have working configurations out of the box.
 *
 * Failures in seeding are soft misses — they do not block org creation.
 * The onboarding endpoint wraps this in try/catch so seed failure is logged
 * but does not roll back the org creation.
 */

interface DefaultReasonCodeDef {
  code: string;
  name: string;
  category: ReasonCategory;
  description?: string;
}

/**
 * The 10 default reason codes created for every new organization.
 *
 * Each has isDefault=true so users know they're system-provided and can
 * choose not to use them, but the system won't require deletion.
 */
const DEFAULT_REASON_CODES: DefaultReasonCodeDef[] = [
  {
    code: "DMG",
    name: "Damage",
    category: "VARIANCE",
    description: "Item damaged during handling or storage",
  },
  {
    code: "THEFT",
    name: "Theft-Shrinkage",
    category: "VARIANCE",
    description: "Item lost to theft or unexplained shrinkage",
  },
  {
    code: "MISPICK",
    name: "Mispick",
    category: "VARIANCE",
    description: "Item picked incorrectly or placed in wrong location",
  },
  {
    code: "RCV_ERR",
    name: "Receiving Error",
    category: "VARIANCE",
    description: "Discrepancy during purchase order receipt",
  },
  {
    code: "EXPIRED",
    name: "Expired Stock",
    category: "DISPOSAL",
    description: "Item expired and must be disposed",
  },
  {
    code: "COUNT_ERR",
    name: "Count Error",
    category: "COUNT",
    description: "Error identified during physical count reconciliation",
  },
  {
    code: "WRONG_LOC",
    name: "Wrong Location",
    category: "ADJUSTMENT",
    description: "Item found in wrong warehouse or bin location",
  },
  {
    code: "RETURN",
    name: "Customer Return",
    category: "RETURN",
    description: "Item returned by customer",
  },
  {
    code: "SCRAP",
    name: "Scrapped-Damaged",
    category: "DISPOSAL",
    description: "Item scrapped or deemed unrepairable",
  },
  {
    code: "OTHER",
    name: "Other",
    category: "OTHER",
    description: "Other reason not listed above",
  },
];

/**
 * Seed default reason codes for a new organization.
 *
 * Creates the 10 standard reason codes with isDefault=true. If any
 * reason code already exists for this org (should not happen in normal flow),
 * it is skipped silently.
 */
async function seedDefaultReasonCodes(organizationId: string): Promise<void> {
  for (const def of DEFAULT_REASON_CODES) {
    try {
      await db.reasonCode.create({
        data: {
          organizationId,
          code: def.code,
          name: def.name,
          category: def.category,
          description: def.description,
          isDefault: true,
          isActive: true,
          sortOrder: DEFAULT_REASON_CODES.indexOf(def),
        },
      });
    } catch (err) {
      // Swallow "unique constraint" errors — reason code may already exist
      // from a concurrent seed attempt or earlier partial run. Log and continue.
      if (
        err instanceof Error &&
        err.message.includes("Unique constraint")
      ) {
        logger.debug(`reason code ${def.code} already exists for org ${organizationId}`);
      } else {
        // Unexpected error — log and continue (don't fail the entire seed)
        logger.warn(`failed to create reason code ${def.code} for org ${organizationId}`, {
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
}

/**
 * Seed a new organization with default configuration and data.
 *
 * Called from the onboarding flow immediately after org creation.
 * Sets up:
 *   a) OrgSettings with default configuration
 *   b) Default ReasonCodes (10 system-provided codes)
 *
 * Failures are logged but do not block org creation — this is a soft-miss
 * design so seeding does not risk breaking the onboarding UX.
 */
export async function seedOrganization(organizationId: string): Promise<void> {
  try {
    // Create or get OrgSettings with defaults
    await db.orgSettings.upsert({
      where: { organizationId },
      create: {
        organizationId,
        transferNumberPrefix: "TRF",
        transferNumberSequence: 1,
        salesOrderPrefix: "SO",
        salesOrderSequence: 1,
        assetTagPrefix: "FA",
        assetTagSequence: 1,
        batchNumberPrefix: "LOT",
        batchNumberSequence: 1,
        requireCountApproval: false,
        varianceThreshold: "5.00",
        recountOnThreshold: true,
        defaultCountMethodology: "FULL",
        allowNegativeStock: false,
        defaultStockStatus: "AVAILABLE",
        dateFormat: "MM/DD/YYYY",
        currencySymbol: "$",
      },
      update: {}, // no-op update for existing rows
    });

    // Seed default reason codes
    await seedDefaultReasonCodes(organizationId);

    logger.info(`seeded organization ${organizationId}`);
  } catch (err) {
    // Log the error but do not re-throw — seed failure is a soft miss.
    logger.error(`failed to seed organization ${organizationId}`, {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}
