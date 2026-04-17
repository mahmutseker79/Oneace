# Credential Encryption Runbook

## Overview

OAuth tokens, API keys, and refresh tokens are now encrypted at rest using AES-256-GCM. This document covers setup, operation, and future key rotation.

## Environment Setup

### Generate Encryption Key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

This outputs a base64-encoded 32-byte key.

### Production Deployment

Set the environment variable before deployment:

```bash
export CREDENTIALS_ENCRYPTION_KEY="<base64-key-from-above>"
```

Verify in your hosting platform (Vercel, etc.) that the variable is:
- Set as a secret (not visible in logs)
- Applied to all environments (Production, Preview, Development)

### Development

**Dev mode** (when `CREDENTIALS_ENCRYPTION_KEY` is missing):
- Uses a derived key from a hardcoded dev string (scrypt)
- Logs a warning on startup
- Safe only for local development

**Production mode** (when `NODE_ENV === 'production'`):
- Requires `CREDENTIALS_ENCRYPTION_KEY` or fails to start
- No fallback key derivation

## Credential Read/Write Flow

### Writing (Encryption)

1. **API mapping save** (`PUT /api/migrations/[id]/mapping`):
   - Client sends plaintext credentials in request body
   - Server checks if already encrypted; if not, encrypts via `encryptCredentials()`
   - Stores encrypted blob in `MigrationJob.fieldMappings.credentials`

2. **Token refresh** (`refreshQboToken` in credentials.ts):
   - After OAuth refresh, encrypt updated tokens
   - Write encrypted blob back to source (Integration or MigrationJob)

### Reading (Decryption)

All credential reads use `readCredentials(raw)`:
- **Encrypted blob** (v: 1, iv, tag, data) → decrypts and returns plaintext
- **Plain object** → returns as-is, logs WARNING for migration tracking
- **null/undefined** → returns null

This auto-detection ensures backwards compatibility with existing plaintext rows.

### Audit Trail

Every credential decryption emits an audit event:
```
action: "migration.credentials.decrypted"
metadata: {
  migrationJobId?: string,
  integrationId?: string,
  reason: "import" | "refresh" | "validate"
}
```

Tracks which users accessed encrypted material and when.

## Key Rotation

### When to Rotate

- Suspected key compromise
- Employee departure with credential access
- Compliance/audit requirements
- Scheduled annual rotation

### Rotation Process (Manual Steps)

**Step 1: Generate new key**

```bash
NEW_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
echo $NEW_KEY
```

**Step 2: Update environment**

Set `CREDENTIALS_ENCRYPTION_KEY` to new key in your hosting platform.

**Step 3: Re-encrypt existing rows**

The following script re-encrypts all credential rows in the database. **Run this script once, after deploying the new key.**

```bash
# scripts/rotate-credentials-key.js
const { db } = require('@/lib/db');
const { readCredentials, encryptCredentials, isEncryptedCredentials } = require('@/lib/secure/credentials');

(async () => {
  console.log('Starting credential re-encryption with new key...');

  // Re-encrypt MigrationJob.fieldMappings.credentials
  const migrationJobs = await db.migrationJob.findMany({
    select: { id: true, fieldMappings: true },
  });

  let jobCount = 0;
  for (const job of migrationJobs) {
    if (job.fieldMappings && typeof job.fieldMappings === 'object') {
      const fm = job.fieldMappings;
      if (fm.credentials) {
        // Decrypt with old key, re-encrypt with new key
        const decrypted = readCredentials(fm.credentials);
        if (decrypted && Object.keys(decrypted).length > 0) {
          const reencrypted = encryptCredentials(decrypted);
          await db.migrationJob.update({
            where: { id: job.id },
            data: {
              fieldMappings: {
                ...fm,
                credentials: reencrypted,
              },
            },
          });
          jobCount++;
        }
      }
    }
  }

  // Re-encrypt Integration.credentials
  const integrations = await db.integration.findMany({
    select: { id: true, credentials: true },
  });

  let integCount = 0;
  for (const integ of integrations) {
    if (integ.credentials) {
      const decrypted = readCredentials(integ.credentials);
      if (decrypted && Object.keys(decrypted).length > 0) {
        const reencrypted = encryptCredentials(decrypted);
        await db.integration.update({
          where: { id: integ.id },
          data: { credentials: reencrypted },
        });
        integCount++;
      }
    }
  }

  console.log(`Re-encrypted ${jobCount} MigrationJob and ${integCount} Integration rows.`);
})();
```

**Step 4: Deploy & verify**

- Deploy the rotation script and run it in production
- Monitor logs for completion
- Verify a sample Integration and MigrationJob still work

**Step 5: Retire old key**

Remove the old key from your key management system.

## Backwards Compatibility

Existing unencrypted rows (created before encryption was added):
- Load successfully via `readCredentials(raw)` — auto-detects plaintext
- Logs WARNING on read to track migration progress
- Can be re-encrypted by running the rotation script

**No data loss on upgrade.** Plaintext rows remain readable until rotated.

## Live-Sync Integration.credentials (Out of Scope)

The live-sync QBO client (`src/lib/integrations/quickbooks/qbo-client.ts`) reads `Integration.credentials` directly. **This is not encrypted yet.**

**TODO (future sprint):**
- Encrypt credentials written to Integration via QBO OAuth callback
- Decrypt in qbo-client before use
- Similar rotation script for live-sync integration rows

For now, `Integration.credentials` remains plaintext in the live-sync path.

## Testing

### Unit Tests

```bash
npm test -- src/lib/secure/credentials.test.ts
```

Tests:
- Encrypt/decrypt roundtrip
- Type guard (`isEncryptedCredentials`)
- Plaintext backwards compat via `readCredentials`
- Key derivation (dev vs prod)
- Missing key in production (should throw)

### Integration Tests

```bash
npm test -- src/app/api/migrations/\[id\]/mapping.integration.test.ts
```

Tests:
- Credentials encrypted on mapping save
- Token refresh encrypts before DB write
- `readCredentials` auto-detects on read

## Troubleshooting

### "CREDENTIALS_ENCRYPTION_KEY is required in production"

- Missing env var in production
- Solution: Set the env var in your hosting platform

### "Failed to decrypt credentials"

- Key mismatch (wrong key in env)
- Corrupted ciphertext
- Solution: Verify the key, check database for invalid blobs

### "Reading plaintext credentials; consider encrypting"

- Old unencrypted row detected
- Solution: Run the rotation script to re-encrypt

## Security Notes

- The encryption key is never logged or exposed
- All credential fields are encrypted together as a JSON blob
- IV is random per encryption (no deterministic encryption)
- GCM tag provides integrity + authenticity checks
- No key material in code; only environment-based derivation

## References

- `src/lib/secure/credentials.ts` — encryption module
- `src/lib/migrations/quickbooks-online/credentials.ts` — QBO token refresh
- `src/app/api/migrations/[id]/mapping/route.ts` — mapping save endpoint
- Adapters: `cin7/adapter.ts`, `sos-inventory/adapter.ts`, `inflow-api/adapter.ts`
