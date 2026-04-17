/**
 * Phase E: Integration sync orchestrator.
 *
 * Manages the general flow of syncing data between OneAce and external systems:
 * - Entity mapping and transformation
 * - Bi-directional sync coordination (push/pull)
 * - Change detection and conflict resolution
 * - Batch processing with checkpointing
 * - Error recovery and retry logic
 *
 * Provider-specific sync logic lives in per-provider files (qbo-sync.ts, etc.).
 */

import type { IntegrationProvider, SyncDirection } from "@/generated/prisma";
import { ConflictResolver } from "@/lib/integrations/conflict-resolver";
import { logger } from "@/lib/logger";

export interface SyncEntity {
  id: string;
  externalId?: string;
  data: Record<string, unknown>;
  lastModified?: Date;
  checksum?: string;
}

export interface SyncBatch {
  totalCount: number;
  processedCount: number;
  failedCount: number;
  lastCheckpoint?: string;
  startedAt: Date;
}

export interface SyncResult {
  success: boolean;
  provider: IntegrationProvider;
  direction: SyncDirection;
  entityType: string;
  itemsSynced: number;
  itemsFailed: number;
  itemsSkipped: number;
  duration: number;
  checkpoint?: string;
  errors: Array<{
    itemId: string;
    error: string;
  }>;
}

export interface SyncContext {
  organizationId: string;
  integrationId: string;
  provider: IntegrationProvider;
  direction: SyncDirection;
  entityType: string;
  batchSize?: number;
  dryRun?: boolean;
  checkpointAfter?: boolean;
}

/**
 * Abstract base for provider-specific sync implementations.
 */
export abstract class SyncEngine {
  protected conflictResolver: ConflictResolver;
  protected batchSize = 100;
  protected checkpoint: string | null = null;

  constructor() {
    this.conflictResolver = new ConflictResolver();
  }

  /**
   * Start a sync operation.
   * Subclasses override to implement provider-specific logic.
   */
  abstract sync(context: SyncContext): Promise<SyncResult>;

  /**
   * Fetch entities from the external system.
   */
  protected abstract fetchExternalEntities(
    context: SyncContext,
    checkpoint?: string,
  ): Promise<SyncEntity[]>;

  /**
   * Transform external entity to OneAce model.
   */
  protected abstract transformToLocal(external: SyncEntity): SyncEntity;

  /**
   * Transform OneAce entity to external format.
   */
  protected abstract transformToExternal(local: SyncEntity): SyncEntity;

  /**
   * Push local changes to external system.
   */
  protected abstract pushToExternal(
    entities: SyncEntity[],
    context: SyncContext,
  ): Promise<SyncEntity[]>;

  /**
   * Pull external changes to local system.
   */
  protected abstract pullFromExternal(
    entities: SyncEntity[],
    context: SyncContext,
  ): Promise<SyncEntity[]>;

  /**
   * Detect conflicts between local and external versions.
   */
  protected detectConflict(local: SyncEntity, external: SyncEntity): boolean {
    // Simple checksum-based detection
    const localChecksum = this.computeChecksum(local);
    const externalChecksum = this.computeChecksum(external);

    return localChecksum !== externalChecksum;
  }

  /**
   * Compute a checksum for change detection.
   */
  protected computeChecksum(entity: SyncEntity): string {
    const json = JSON.stringify(entity.data);
    // Simple hash - in production, use crypto.subtle.digest
    let hash = 0;
    for (let i = 0; i < json.length; i++) {
      const char = json.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Process a batch of entities with error handling.
   */
  protected async processBatch(
    entities: SyncEntity[],
    context: SyncContext,
    processor: (entity: SyncEntity) => Promise<void>,
  ): Promise<{
    processed: number;
    failed: number;
    skipped: number;
    errors: Array<{ itemId: string; error: string }>;
  }> {
    let processed = 0;
    let failed = 0;
    let skipped = 0;
    const errors: Array<{ itemId: string; error: string }> = [];

    for (const entity of entities) {
      try {
        if (context.dryRun) {
          logger.info("Dry run: would process entity", {
            entityId: entity.id,
            externalId: entity.externalId,
          });
          skipped++;
          continue;
        }

        await processor(entity);
        processed++;
      } catch (error) {
        failed++;
        errors.push({
          itemId: entity.id,
          error: error instanceof Error ? error.message : "Unknown error",
        });

        logger.warn("Failed to process entity", {
          entityId: entity.id,
          error,
        });
      }
    }

    return { processed, failed, skipped, errors };
  }

  /**
   * Generic two-way sync implementation.
   */
  protected async twoWaySync(context: SyncContext): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: true,
      provider: context.provider,
      direction: context.direction,
      entityType: context.entityType,
      itemsSynced: 0,
      itemsFailed: 0,
      itemsSkipped: 0,
      duration: 0,
      errors: [],
    };

    try {
      // Fetch from both sides
      const externalEntities = await this.fetchExternalEntities(context);

      // Process based on sync direction
      if (context.direction === "OUTBOUND") {
        // Push local to external
        const pushed = await this.pushToExternal(externalEntities, context);
        result.itemsSynced = pushed.length;
      } else if (context.direction === "INBOUND") {
        // Pull external to local
        const pulled = await this.pullFromExternal(externalEntities, context);
        result.itemsSynced = pulled.length;
      } else {
        // BIDIRECTIONAL - push first, then pull
        const pushed = await this.pushToExternal(externalEntities, context);
        result.itemsSynced += pushed.length;

        // Fetch again after push
        const refreshedExternal = await this.fetchExternalEntities(context);
        const pulled = await this.pullFromExternal(refreshedExternal, context);
        result.itemsSynced += pulled.length;
      }
    } catch (error) {
      result.success = false;
      result.errors.push({
        itemId: "sync",
        error: error instanceof Error ? error.message : "Unknown error",
      });

      logger.error("Sync operation failed", {
        provider: context.provider,
        entityType: context.entityType,
        error,
      });
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Get current checkpoint for resumable syncs.
   */
  getCheckpoint(): string | null {
    return this.checkpoint;
  }

  /**
   * Set checkpoint for resumable syncs.
   */
  setCheckpoint(checkpoint: string | null): void {
    this.checkpoint = checkpoint;
  }
}

export default SyncEngine;
