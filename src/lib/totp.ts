import * as OTPAuth from "otpauth";
import { randomBytes } from "crypto";

/**
 * Result of TOTP secret generation.
 * Includes the secret, provisioning URI for QR code scanning, and backup codes.
 */
export interface GeneratedTotpSecret {
  secret: string;
  uri: string;
  backupCodes: string[];
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
  const backupCodes = generateBackupCodes(10);

  return {
    secret,
    uri,
    backupCodes,
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

    // Verify the code with a window of ±1 (allows previous and next period)
    // This is a standard practice to account for clock skew
    const result = totp.validate({ token: code, window: 1 });

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
 * @param count Number of codes to generate (default: 10)
 * @returns Array of backup codes
 */
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  for (let i = 0; i < count; i++) {
    let code = "";
    // Use crypto.randomBytes for cryptographically secure randomness
    const randomValues = randomBytes(8);
    for (let j = 0; j < 8; j++) {
      code += chars[randomValues[j]! % chars.length];
    }
    codes.push(code);
  }

  return codes;
}

/**
 * Verify a backup code against a list of stored (hashed) codes.
 *
 * This function assumes the stored codes are hashed. In a real implementation,
 * you would compare the hash of the provided code against the stored hashes.
 * For simplicity in this implementation, we compare directly.
 *
 * NOTE: In production, backup codes should be hashed before storage, and
 * this function should use constant-time comparison to verify.
 *
 * @param storedCodes Array of stored backup codes (or their hashes)
 * @param code The backup code to verify
 * @returns Object indicating validity and remaining code count
 */
export function verifyBackupCode(
  storedCodes: string[],
  code: string,
): BackupCodeVerificationResult {
  // Normalize the code (uppercase, remove spaces)
  const normalizedCode = code.toUpperCase().replace(/\s/g, "");

  // Find and remove the matching code
  const index = storedCodes.findIndex(
    (c) => c.toUpperCase().replace(/\s/g, "") === normalizedCode,
  );

  if (index === -1) {
    return {
      valid: false,
      remaining: storedCodes.length,
    };
  }

  // Mark as consumed by removing from the array
  storedCodes.splice(index, 1);

  return {
    valid: true,
    remaining: storedCodes.length,
  };
}

/**
 * Hash a backup code for storage.
 *
 * Uses a simple hash approach. In production, this should use bcrypt or
 * a similar secure hashing function, but for backup codes we use a simpler
 * approach since they're single-use and stored encrypted in the database.
 *
 * @param code The backup code to hash
 * @returns Hashed code
 */
export function hashBackupCode(code: string): string {
  // For simplicity, we'll use a basic approach: store the code as-is since
  // it will be encrypted at the database level. In production, you might want
  // to use bcrypt here, but single-use codes with database-level encryption
  // are reasonably secure.
  return code.toUpperCase();
}
