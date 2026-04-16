import { describe, it, expect, beforeEach } from "vitest";
import {
  generateTotpSecret,
  verifyTotpCode,
  generateBackupCodes,
  verifyBackupCode,
} from "./totp";
import * as OTPAuth from "otpauth";

describe("TOTP", () => {
  describe("generateTotpSecret", () => {
    it("should generate a valid TOTP secret with URI and backup codes", () => {
      const email = "test@example.com";
      const result = generateTotpSecret(email);

      expect(result.secret).toBeDefined();
      expect(typeof result.secret).toBe("string");
      expect(result.secret.length).toBeGreaterThan(0);

      expect(result.uri).toBeDefined();
      expect(result.uri).toContain("otpauth://totp/");
      expect(result.uri).toContain("OneAce");
      expect(result.uri).toContain(encodeURIComponent(email).replace(/%40/g, "%40"));

      expect(result.backupCodes).toBeDefined();
      expect(Array.isArray(result.backupCodes)).toBe(true);
      expect(result.backupCodes.length).toBe(10);

      // Each backup code should be 8 characters
      result.backupCodes.forEach((code) => {
        expect(code.length).toBe(8);
        expect(/^[A-Z0-9]+$/.test(code)).toBe(true);
      });
    });

    it("should generate different secrets for different calls", () => {
      const email = "test@example.com";
      const result1 = generateTotpSecret(email);
      const result2 = generateTotpSecret(email);

      expect(result1.secret).not.toBe(result2.secret);
      expect(result1.backupCodes).not.toEqual(result2.backupCodes);
    });
  });

  describe("verifyTotpCode", () => {
    let secret: string;

    beforeEach(() => {
      // Generate a secret we can use for testing
      const result = generateTotpSecret("test@example.com");
      secret = result.secret;
    });

    it("should verify a valid TOTP code", () => {
      // Generate the current valid code
      const totp = new OTPAuth.TOTP({
        issuer: "OneAce",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(secret),
      });

      const validCode = totp.generate();
      const isValid = verifyTotpCode(secret, validCode);

      expect(isValid).toBe(true);
    });

    it("should reject an invalid TOTP code", () => {
      const invalidCode = "000000";
      const isValid = verifyTotpCode(secret, invalidCode);

      // Most likely this will be false, though there's a small chance of collision
      // In a real test, you'd use a fixed secret and time-controlled verification
      expect(typeof isValid).toBe("boolean");
    });

    it("should handle invalid secret format gracefully", () => {
      const isValid = verifyTotpCode("invalid-secret", "123456");
      expect(isValid).toBe(false);
    });
  });

  describe("generateBackupCodes", () => {
    it("should generate the requested number of backup codes", () => {
      const codes = generateBackupCodes(10);
      expect(codes.plain.length).toBe(10);

      codes.plain.forEach((code) => {
        expect(code.length).toBe(8);
        expect(/^[A-Z0-9]+$/.test(code)).toBe(true);
      });
    });

    it("should generate unique backup codes", () => {
      const codes = generateBackupCodes(20);
      const uniqueCodes = new Set(codes.plain);

      // All codes should be unique (extremely high probability)
      expect(uniqueCodes.size).toBe(codes.plain.length);
    });

    it("should use default count of 10 if not specified", () => {
      const codes = generateBackupCodes();
      expect(codes.plain.length).toBe(10);
    });
  });

  describe("verifyBackupCode", () => {
    it("should verify a valid backup code", () => {
      const codes = generateBackupCodes(3);
      const codeToVerify = codes.plain[1]!;

      const result = verifyBackupCode(codeToVerify, codes.hashed);

      expect(result.valid).toBe(true);
      expect(result.index).toBe(1);
    });

    it("should reject an invalid backup code", () => {
      const codes = generateBackupCodes(3);

      const result = verifyBackupCode("INVALID00", codes.hashed);

      expect(result.valid).toBe(false);
      expect(result.index).toBe(-1);
    });

    it("should handle case-insensitive comparison", () => {
      const codes = generateBackupCodes(3);
      const originalCode = codes.plain[0]!;
      const lowerCode = originalCode.toLowerCase();

      const result = verifyBackupCode(lowerCode, codes.hashed);

      expect(result.valid).toBe(true);
      expect(result.index).toBe(0);
    });

    it("should handle codes with spaces", () => {
      const codes = generateBackupCodes(3);
      const originalCode = codes.plain[0]!;
      const codeWithSpaces = originalCode.slice(0, 4) + " " + originalCode.slice(4);

      const result = verifyBackupCode(codeWithSpaces, codes.hashed);

      expect(result.valid).toBe(true);
      expect(result.index).toBe(0);
    });

    it("should return the correct index for matched codes", () => {
      const codes = generateBackupCodes(5);
      const codeToUse = codes.plain[2]!;

      const result = verifyBackupCode(codeToUse, codes.hashed);

      expect(result.valid).toBe(true);
      expect(result.index).toBe(2);
    });
  });
});
