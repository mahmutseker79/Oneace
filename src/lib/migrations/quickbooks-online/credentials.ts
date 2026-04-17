/**
 * Phase MIG-QBO — QuickBooks Online credential resolution.
 *
 * Handles two credential modes:
 *   1. "Reuse existing" — fetch from Integration.credentials where provider=QUICKBOOKS_ONLINE
 *   2. "Paste new" — user provides OAuth tokens directly
 *
 * Credential lifecycle:
 *   - At migration start, resolve credentials from either source
 *   - During parsing, detect token expiry (401 responses)
 *   - On expiry, refresh via OAuth token endpoint (in-memory cache to avoid races)
 *   - Write refreshed token back to the source (Integration.credentials or MigrationJob)
 */

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { PrismaClient } from "@/generated/prisma";

export type QboCredentialMode = "reuse-integration" | "paste";

export interface ResolvedQboCredentials {
  accessToken: string;
  refreshToken?: string;
  realmId: string;
  expiresAt?: Date;
  mode: QboCredentialMode;
  source?: {
    integrationId?: string;
    migrationJobId?: string;
  };
}

/**
 * In-memory token cache to prevent concurrent refresh requests for the same realmId.
 * Key: realmId, Value: promise of refreshed token.
 * This prevents N concurrent requests all hitting 401 and all trying to refresh.
 */
const tokenRefreshCache = new Map<string, Promise<ResolvedQboCredentials>>();

/**
 * Resolve QBO credentials for a migration.
 * Supports two modes:
 *   1. Reuse existing Integration connection (if connected)
 *   2. Use credentials pasted into the migration job
 *
 * @param db Prisma client
 * @param migrationJobId Migration job ID (for accessing fieldMappings)
 * @param organizationId Organization ID (for querying Integration)
 * @returns Resolved credentials with mode indicator
 */
export async function resolveQboCredentials(opts: {
  db: PrismaClient;
  migrationJobId: string;
  organizationId: string;
}): Promise<ResolvedQboCredentials> {
  const { db: prisma, migrationJobId, organizationId } = opts;

  // Fetch the migration job to access fieldMappings.credentials
  const job = await prisma.migrationJob.findUnique({
    where: { id: migrationJobId },
    select: {
      fieldMappings: true,
    },
  });

  if (!job || !job.fieldMappings) {
    throw new Error(
      `Migration job ${migrationJobId} not found or has no fieldMappings`
    );
  }

  const fieldMappings = job.fieldMappings as Record<string, unknown>;
  const credentialsData = fieldMappings.credentials as Record<string, unknown> | undefined;

  if (!credentialsData) {
    throw new Error("No credentials found in migration job fieldMappings");
  }

  // Mode 1: Reuse existing Integration connection
  if (credentialsData.useExistingIntegration === true) {
    const integration = await prisma.integration.findFirst({
      where: {
        organizationId,
        provider: "QUICKBOOKS_ONLINE",
        status: "CONNECTED",
      },
      select: {
        id: true,
        credentials: true,
      },
    });

    if (!integration || !integration.credentials) {
      throw new Error(
        "No connected QuickBooks Online integration found. Please reconnect in Settings → Integrations."
      );
    }

    const storedCreds = integration.credentials as Record<string, unknown>;
    const realmId = credentialsData.realmId as string;

    if (!realmId) {
      throw new Error("realmId required even when reusing existing integration");
    }

    return {
      accessToken: String(storedCreds.accessToken || ""),
      refreshToken: storedCreds.refreshToken
        ? String(storedCreds.refreshToken)
        : undefined,
      realmId,
      expiresAt: storedCreds.expiresAt
        ? new Date(Number(storedCreds.expiresAt))
        : undefined,
      mode: "reuse-integration",
      source: {
        integrationId: integration.id,
      },
    };
  }

  // Mode 2: Direct credentials provided by user
  if (typeof credentialsData.accessToken === "string") {
    return {
      accessToken: credentialsData.accessToken,
      refreshToken: credentialsData.refreshToken
        ? String(credentialsData.refreshToken)
        : undefined,
      realmId: String(credentialsData.realmId || ""),
      expiresAt: credentialsData.expiresAt
        ? new Date(Number(credentialsData.expiresAt))
        : undefined,
      mode: "paste",
      source: {
        migrationJobId,
      },
    };
  }

  throw new Error("Invalid credentials format in migration job");
}

/**
 * Refresh a QBO OAuth token and write it back to the source.
 * Uses in-memory promise cache to prevent concurrent refresh race conditions.
 *
 * @param credentials Current resolved credentials
 * @param db Prisma client
 * @param opts Refresh config (clientId, clientSecret required)
 * @returns Updated credentials with new accessToken and expiresAt
 *
 * Throws on unrecoverable errors (no refreshToken, network failure).
 * Caller should treat as fatal for that realm.
 */
export async function refreshQboToken(
  credentials: ResolvedQboCredentials,
  db: PrismaClient,
  opts: {
    clientId: string;
    clientSecret: string;
    tokenUrl?: string;
  }
): Promise<ResolvedQboCredentials> {
  const { realmId } = credentials;

  // Check cache first
  const cached = tokenRefreshCache.get(realmId);
  if (cached) {
    return cached;
  }

  // Create new refresh promise and cache it
  const refreshPromise = (async () => {
    if (!credentials.refreshToken) {
      throw new Error(
        "REFRESH_FAILED: No refresh token available; user must reconnect in Settings"
      );
    }

    const tokenUrl =
      opts.tokenUrl || "https://oauth.platform.intuit.com/oauth2/tokens";

    try {
      const response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: credentials.refreshToken,
          client_id: opts.clientId,
          client_secret: opts.clientSecret,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `QBO token refresh failed: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
        scope?: string;
      };

      const newRefreshToken = data.refresh_token || credentials.refreshToken;
      const newExpiresAt = new Date(
        Date.now() + (data.expires_in || 3600) * 1000
      );

      const updated: ResolvedQboCredentials = {
        ...credentials,
        accessToken: data.access_token,
        refreshToken: newRefreshToken,
        expiresAt: newExpiresAt,
      };

      // Write back to source
      if (credentials.source?.integrationId) {
        await db.integration.update({
          where: { id: credentials.source.integrationId },
          data: {
            credentials: {
              accessToken: data.access_token,
              refreshToken: newRefreshToken,
              expiresAt: newExpiresAt.getTime(),
            },
          },
        });

        logger.info("QBO migration: token refreshed and persisted to Integration", {
          integrationId: credentials.source.integrationId,
          realmId,
        });
      } else if (credentials.source?.migrationJobId) {
        // Update the MigrationJob fieldMappings
        const job = await db.migrationJob.findUnique({
          where: { id: credentials.source.migrationJobId },
          select: { fieldMappings: true },
        });

        if (job && typeof job.fieldMappings === "object" && job.fieldMappings !== null) {
          const fieldMappings = job.fieldMappings as Record<string, unknown>;
          const currentCreds =
            (fieldMappings.credentials as Record<string, unknown>) || {};

          await db.migrationJob.update({
            where: { id: credentials.source.migrationJobId },
            data: {
              fieldMappings: {
                ...fieldMappings,
                credentials: {
                  ...currentCreds,
                  accessToken: data.access_token,
                  refreshToken: newRefreshToken,
                  expiresAt: newExpiresAt.getTime(),
                  refreshedAt: new Date().toISOString(),
                },
              } as any,
            },
          });

          logger.info("QBO migration: token refreshed and persisted to MigrationJob", {
            migrationJobId: credentials.source.migrationJobId,
            realmId,
          });
        }
      }

      return updated;
    } catch (error) {
      logger.error("QBO token refresh failed", {
        realmId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  })();

  tokenRefreshCache.set(realmId, refreshPromise);

  try {
    return await refreshPromise;
  } finally {
    // Clear cache after completion (success or failure)
    // On failure, next attempt will retry the refresh
    tokenRefreshCache.delete(realmId);
  }
}

/**
 * Check if a credential is expired or expiring soon.
 * Returns true if within 5 minutes of expiry.
 */
export function isTokenExpiringSoon(
  credentials: ResolvedQboCredentials,
  bufferMs: number = 5 * 60 * 1000
): boolean {
  if (!credentials.expiresAt) {
    return false; // No expiry info, assume valid
  }

  const now = Date.now();
  const expiresAtMs = credentials.expiresAt.getTime();
  return expiresAtMs - now < bufferMs;
}
