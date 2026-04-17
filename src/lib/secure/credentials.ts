/**
 * Credential Encryption Module
 *
 * Provides AES-256-GCM encryption for OAuth tokens, API keys, and other
 * sensitive credentials stored in MigrationJob.fieldMappings.credentials
 * and Integration.credentials.
 *
 * Key features:
 * - AES-256-GCM with 12-byte random IV, 16-byte GCM tag
 * - Versioned payload for future algorithm rotation
 * - Backwards-compatible detection: auto-detects plaintext vs encrypted
 * - Dev-only key derivation when CREDENTIALS_ENCRYPTION_KEY env var is missing
 * - Audit-event emission on decryption
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { recordAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";

// ── Payload Types ────────────────────────────────────────────────────

/**
 * Encrypted credentials blob.
 * Stored as JSON in MigrationJob.fieldMappings.credentials or Integration.credentials.
 *
 * @example
 * {
 *   v: 1,
 *   iv: "base64-12bytes",
 *   tag: "base64-16bytes",
 *   data: "base64-ciphertext"
 * }
 */
export interface EncryptedCredentials {
  /** Schema version for future key rotation. */
  v: 1;
  /** Base64-encoded 12-byte IV. */
  iv: string;
  /** Base64-encoded 16-byte GCM tag. */
  tag: string;
  /** Base64-encoded AES-256-GCM ciphertext. */
  data: string;
}

// ── Key Management ──────────────────────────────────────────────────

/**
 * Get the encryption key from environment or derive a dev-only key.
 *
 * Production (NODE_ENV === 'production'):
 *   - Requires CREDENTIALS_ENCRYPTION_KEY (base64-encoded 32 bytes)
 *   - Throws if missing
 *
 * Development:
 *   - Uses CREDENTIALS_ENCRYPTION_KEY if present
 *   - Otherwise derives from a hardcoded dev string via scrypt
 *   - Logs a warning that this is dev-only
 */
function getEncryptionKey(): Buffer {
  const envKey = process.env.CREDENTIALS_ENCRYPTION_KEY;

  if (envKey) {
    try {
      const key = Buffer.from(envKey, "base64");
      if (key.length !== 32) {
        throw new Error(`CREDENTIALS_ENCRYPTION_KEY must be 32 bytes (base64), got ${key.length}`);
      }
      return key;
    } catch (err) {
      throw new Error(
        `Failed to decode CREDENTIALS_ENCRYPTION_KEY: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "CREDENTIALS_ENCRYPTION_KEY is required in production. Generate one with: " +
        "node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
    );
  }

  // Dev-only: derive a key from a hardcoded string
  logger.warn("Using derived dev-only encryption key. DO NOT USE IN PRODUCTION.", {
    source: "credentials.encryptionKey",
  });

  const devSecret = "oneace-dev-credentials-encryption-key";
  const salt = Buffer.from("oneace-salt-12345", "utf-8");
  return scryptSync(devSecret, salt, 32);
}

// ── Encryption ──────────────────────────────────────────────────────

/**
 * Encrypt a credentials object to an EncryptedCredentials blob.
 *
 * @param plaintext Plain object (e.g., { accessToken, refreshToken, ... })
 * @returns Encrypted blob with version, IV, tag, and ciphertext
 *
 * @throws If encryption fails
 */
export function encryptCredentials(plaintext: Record<string, unknown>): EncryptedCredentials {
  try {
    const key = getEncryptionKey();
    const iv = randomBytes(12);
    const jsonStr = JSON.stringify(plaintext);
    const data = Buffer.from(jsonStr, "utf-8");

    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      v: 1,
      iv: iv.toString("base64"),
      tag: tag.toString("base64"),
      data: encrypted.toString("base64"),
    };
  } catch (err) {
    logger.error("Failed to encrypt credentials", {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * Decrypt an EncryptedCredentials blob back to plaintext.
 *
 * @param encrypted Blob with v, iv, tag, data
 * @returns Decrypted plain object
 *
 * @throws If decryption fails or tag validation fails
 */
export function decryptCredentials(encrypted: EncryptedCredentials): Record<string, unknown> {
  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(encrypted.iv, "base64");
    const tag = Buffer.from(encrypted.tag, "base64");
    const ciphertext = Buffer.from(encrypted.data, "base64");

    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    return JSON.parse(decrypted.toString("utf-8"));
  } catch (err) {
    logger.error("Failed to decrypt credentials", {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

// ── Type Guard ──────────────────────────────────────────────────────

/**
 * Check if a value looks like an EncryptedCredentials blob.
 *
 * @param value Unknown value
 * @returns true if it matches the EncryptedCredentials shape
 */
export function isEncryptedCredentials(value: unknown): value is EncryptedCredentials {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    return (
      obj.v === 1 &&
      typeof obj.iv === "string" &&
      typeof obj.tag === "string" &&
      typeof obj.data === "string"
    );
  }
  return false;
}

// ── Backwards-Compatible Read ──────────────────────────────────────

/**
 * Read credentials from a raw value, auto-detecting encrypted vs plaintext.
 *
 * Supports:
 * 1. EncryptedCredentials (v: 1) → decrypts and returns plaintext
 * 2. Plain object → returns as-is (logs WARNING for migration tracking)
 * 3. null/undefined → returns null
 * 4. Invalid → returns null
 *
 * This allows existing unencrypted rows to still work while new ones
 * are encrypted. Warns on plaintext so we can track migration progress.
 *
 * @param raw Raw value from DB (could be encrypted, plaintext, or null)
 * @returns Decrypted/plain credentials, or null if invalid
 */
export function readCredentials(raw: unknown): Record<string, unknown> | null {
  if (raw === null || raw === undefined) {
    return null;
  }

  // Check if encrypted
  if (isEncryptedCredentials(raw)) {
    try {
      return decryptCredentials(raw);
    } catch (err) {
      logger.error("Failed to read encrypted credentials", {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  // Check if plain object (backwards compat)
  if (typeof raw === "object" && !Array.isArray(raw)) {
    logger.warn("Reading plaintext credentials; consider encrypting", {
      source: "credentials.readCredentials",
      keys: Object.keys(raw as Record<string, unknown>).length,
    });
    return raw as Record<string, unknown>;
  }

  return null;
}

// ── Audit Events ────────────────────────────────────────────────────

/**
 * Emit an audit event when credentials are decrypted for use.
 * Complies with security/audit requirements.
 *
 * @param opts Audit metadata
 */
export async function auditCredentialsDecrypted(opts: {
  organizationId: string;
  migrationJobId?: string;
  integrationId?: string;
  reason: "import" | "refresh" | "validate";
}): Promise<void> {
  try {
    await recordAudit({
      organizationId: opts.organizationId,
      // Credential decryption is a system-initiated event tied to the
      // import/refresh flow, not a specific user action, so actorId=null
      // is correct here. If the caller wants to attribute it, the caller
      // should pass their user id via an extension of this helper.
      actorId: null,
      action: "migration.credentials.decrypted",
      entityType: "migration_job",
      entityId: opts.migrationJobId ?? opts.integrationId ?? null,
      metadata: {
        migrationJobId: opts.migrationJobId,
        integrationId: opts.integrationId,
        reason: opts.reason,
      },
    });
  } catch (err) {
    logger.error("Failed to record audit event for credentials decryption", {
      error: err instanceof Error ? err.message : String(err),
    });
    // Don't re-throw; audit failures should not break the operation
  }
}
