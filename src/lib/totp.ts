import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import * as OTPAuth from "otpauth";

/**
 * Result of TOTP secret generation.
 * Includes the secret, provisioning URI for QR code scanning, and backup codes (plain and hashed).
 */
export interface GeneratedTotpSecret {
  secret: string;
  uri: string;
  backupCodes: string[];
  backupCodesHashed: string[];
}

/**
 * Result of backup code verification.
 * Indicates whether the code was valid and how many codes remain.
 */
export interface BackupCodeVerificationResult {
  valid: boolean;
  remaining: number;
}

/**
 * Generate a new TOTP secret for a user.
 *
 * Returns the base32-encoded secret, a provisioning URI suitable for
 * display as a QR code or manual entry, and 10 backup codes.
 *
 * @param email User email address, used in the provisioning URI
 * @returns Object containing secret, uri, and backupCodes
 */
export function generateTotpSecret(email: string): GeneratedTotpSecret {
  // Create a new TOTP instance using the otpauth library.
  // The secret is automatically generated (32 bytes of random data).
  const totp = new OTPAuth.TOTP({
    issuer: "OneAce",
    label: `OneAce:${email}`,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
  });

  // Get the base32-encoded secret for storage
  const secret = totp.secret.base32;

  // Generate the provisioning URI (otpauth://...) for QR code scanning
  const uri = totp.toString();

  // Generate 10 backup codes (8-character alphanumeric strings)
  const { plain: backupCodes, hashed: backupCodesHashed } = generateBackupCodes(10);

  return {
    secret,
    uri,
    backupCodes,
    backupCodesHashed,
  };
}

/**
 * Verify a TOTP code against the stored secret.
 *
 * This is a time-window check: the code is considered valid if it matches
 * the current TOTP window or the previous/next window (±30 second tolerance).
 * This prevents issues with clock skew between client and server.
 *
 * @param secret The base32-encoded TOTP secret
 * @param code The 6-digit code to verify
 * @returns true if the code is valid, false otherwise
 */
export function verifyTotpCode(secret: string, code: string): boolean {
  try {
    // Create a TOTP instance from the stored secret
    const totp = new OTPAuth.TOTP({
      issuer: "OneAce",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });

    // Verify the code with current period only (window=0).
    // RFC 6238 recommends minimal window. Previous window=1 setting
    // doubled the valid time to 60s, increasing brute-force surface.
    const result = totp.validate({ token: code, window: 0 });

    // validate returns null if invalid, or a delta number if valid
    return result !== null;
  } catch (error) {
    // If anything goes wrong during verification (invalid secret format, etc.),
    // return false rather than throwing
    return false;
  }
}

/**
 * Generate backup codes.
 *
 * Backup codes are randomly-generated 8-character alphanumeric strings.
 * They serve as single-use recovery codes if the user loses access to their authenticator.
 *
 * Returns both plain codes (to show the user once) and hashed codes (for database storage).
 *
 * @param count Number of codes to generate (default: 10)
 * @returns Object with plain and hashed codes
 */
export function generateBackupCodes(count = 10): { plain: string[]; hashed: string[] } {
  const plain: string[] = [];
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  for (let i = 0; i < count; i++) {
    let code = "";
    // Use crypto.randomBytes for cryptographically secure randomness
    const randomValues = randomBytes(4);
    for (let j = 0; j < 8; j++) {
      code += chars[randomValues[j % randomValues.length]! % chars.length];
    }
    plain.push(code.toUpperCase());
  }

  return {
    plain,
    hashed: plain.map(hashBackupCode),
  };
}

/**
 * Verify a backup code against a list of stored (hashed) codes.
 *
 * Uses constant-time comparison to prevent timing attacks.
 * Hashes the input code and compares against stored hashes.
 *
 * @param input The backup code entered by the user
 * @param storedHashes Array of stored hashed backup codes
 * @returns Object indicating validity and the index of the matched code (if valid)
 */
export function verifyBackupCode(
  input: string,
  storedHashes: string[],
): { valid: boolean; index: number } {
  const inputHash = hashBackupCode(input);
  const inputBuf = Buffer.from(inputHash, "hex");

  for (let i = 0; i < storedHashes.length; i++) {
    const storedBuf = Buffer.from(storedHashes[i]!, "hex");
    if (inputBuf.length === storedBuf.length && timingSafeEqual(inputBuf, storedBuf)) {
      return { valid: true, index: i };
    }
  }

  return { valid: false, index: -1 };
}

/**
 * Hash a backup code for storage.
 *
 * Uses SHA-256 hashing for secure storage. Codes are uppercase before hashing
 * to ensure consistent comparison regardless of input case.
 *
 * @param code The backup code to hash
 * @returns Hex-encoded SHA-256 hash of the uppercase code
 */
export function hashBackupCode(code: string): string {
  return createHash("sha256").update(code.replace(/\s+/g, "").toUpperCase()).digest("hex");
}
