# OneAce Backup & Recovery Strategy

## Overview

This document outlines the backup, recovery, and disaster response procedures for OneAce. Our strategy covers database backups, application state recovery, environment variable protection, and operational runbooks for common failure scenarios.

---

## Database (Neon Postgres)

### Automatic Backups

Neon Postgres provides built-in point-in-time recovery (PITR) for all database plans:

- **Free Plan**: PITR recovery window up to 7 days
- **Pro Plan**: PITR recovery window up to 30 days
- **Automatic**: No configuration needed—enabled by default
- **Zero RPO**: Continuous incremental backups, no snapshot lag

#### Key Benefits

- Restore to any timestamp within the recovery window
- No manual snapshot management required
- Neon handles backup compression and storage

#### Verify PITR Status

In Neon console:
1. Navigate to your project
2. Check **Settings** → **Backups**
3. Confirm PITR is enabled and recovery window is shown

### Manual Backups

For long-term archival or migration, create manual database dumps:

```bash
# Full database dump in custom format (most reliable for restore)
pg_dump "$DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-acls \
  > backup-$(date +%Y%m%d-%H%M%S).dump

# Alternative: Plain SQL format (text-based, human-readable)
pg_dump "$DATABASE_URL" \
  --format=plain \
  --no-owner \
  > backup-$(date +%Y%m%d).sql

# Compressed backup (saves disk space)
pg_dump "$DATABASE_URL" \
  --format=custom \
  --compress=9 \
  --no-owner \
  > backup-$(date +%Y%m%d).dump.gz
```

#### Restore from Manual Backup

```bash
# Restore from custom format dump
pg_restore \
  --no-owner \
  --dbname="$DATABASE_URL" \
  backup-20260415.dump

# Restore from plain SQL format
psql "$DATABASE_URL" < backup-20260415.sql
```

### Scheduled Exports

For critical application data (inventory, items, movements), schedule weekly CSV exports:

```bash
#!/bin/bash
# Export items by organization
psql "$DATABASE_URL" \
  --no-align \
  --tuples-only \
  -c "COPY (
    SELECT id, name, sku, \"categoryId\", created_at, updated_at 
    FROM \"Item\" 
    WHERE \"organizationId\" = 'ORG_ID'
  ) TO STDOUT WITH CSV HEADER" \
  > items-export-$(date +%Y%m%d).csv

# Export movements (transaction history)
psql "$DATABASE_URL" \
  -c "COPY (
    SELECT id, \"itemId\", quantity, \"movementType\", notes, created_at 
    FROM \"Movement\" 
    WHERE \"organizationId\" = 'ORG_ID'
  ) TO STDOUT WITH CSV HEADER" \
  > movements-export-$(date +%Y%m%d).csv
```

#### Automate with Cron

Add to your crontab to run weekly on Sunday at 2 AM:

```bash
0 2 * * 0 /path/to/backup-exports.sh
```

Store exports in a secure, off-site location (cloud storage, external drive).

---

## Application Data

### Vercel Deployments

Every git push to main creates an immutable, timestamped deployment:

- **Immutability**: Each deployment snapshot is preserved and accessible
- **Automatic Versioning**: Deployments are labeled with commit hash and timestamp
- **No Manual Export**: All source code is in git; deployments are just built artifacts

#### Access Previous Deployments

```bash
# List recent deployments
vercel list --limit 20

# View specific deployment
vercel inspect <deployment-url>

# Promote previous deployment to production
vercel promote <deployment-url>
```

#### Rollback to Previous Version

```bash
# Rollback to a specific deployment
vercel rollback <deployment-url>

# Via git: revert the problematic commit
git revert <commit-hash>
git push origin main
# Vercel will auto-deploy the reverted code
```

### Environment Variables

Environment variables are encrypted at rest in Vercel and stored securely:

#### Backup Environment Variables

```bash
# Pull all env vars to local file (SENSITIVE — handle carefully)
vercel env pull .env.local

# Store securely (consider encrypted storage, not git)
# Never commit .env files to version control
```

#### Critical Environment Variables to Preserve

| Variable | Purpose | Backup Method |
|----------|---------|---|
| `DATABASE_URL` | Neon Postgres connection | Vault/SecureEnv |
| `BETTER_AUTH_SECRET` | Session encryption key | Vault/SecureEnv |
| `STRIPE_SECRET_KEY` | Payment processing | Vault/SecureEnv |
| `STRIPE_WEBHOOK_SECRET` | Payment webhook verification | Vault/SecureEnv |
| `NEXT_PUBLIC_*` | Public config (safe) | Git (committed) |

#### Restore Environment Variables

```bash
# Push env vars back to Vercel
vercel env push .env.local

# Verify they're set
vercel env list
```

---

## User Data (GDPR Compliance)

### Data Export (Right to Data Portability)

Users can request and download all their personal data:

#### User-Initiated Export

1. User navigates to **Settings** → **Privacy** → **Export Data**
2. System prepares JSON export with:
   - User profile (name, email, organizations)
   - All organization records (items, movements, purchase orders)
   - Audit logs and activity history
3. Download link provided (valid 7 days)
4. Export format: Structured JSON

#### API Endpoint (for automation)

```bash
# Request user data export (requires auth)
curl -H "Authorization: Bearer <token>" \
  https://oneace.example.com/api/account/export \
  -o user-data-export.json
```

### Data Deletion (Right to be Forgotten)

Users can request full account deletion from **Settings** → **Privacy** → **Delete Account**:

#### Deletion Process

1. User explicitly types confirmation phrase: **"DELETE MY ACCOUNT"**
2. System verifies user owns no organizations (must transfer ownership first)
3. System deletes:
   - User profile
   - Session tokens
   - Organization memberships
4. System preserves:
   - Organization data (items, movements, stock counts)
   - Items created by user (ownership unchanged)
   - Audit logs (anonymized)

#### Ownership Transfer

Before deletion, user must transfer any owned organizations:

```
1. Settings → Organizations → [Org Name]
2. Click "Transfer Ownership"
3. Select new owner from members
4. Confirm transfer
5. Now user can delete account
```

---

## Disaster Recovery Playbook

### Scenario 1: Database Corruption Detected

**Symptoms**: Query failures, data integrity errors, constraint violations

**Recovery Steps**:

1. **Identify corruption timestamp** (check error logs)
   ```bash
   # View recent errors
   vercel logs <project-id> --tail
   ```

2. **Create recovery database from Neon PITR**
   - Go to Neon console → Project → Branches
   - Create "recovery" branch at timestamp before corruption
   - Test data integrity on recovery branch

3. **Validate with Prisma**
   ```bash
   npx prisma db pull --schema=./recovery-branch-url
   npx prisma validate
   ```

4. **Promote recovery database to production**
   - In Neon: swap the branch endpoint
   - Update `DATABASE_URL` in Vercel env vars
   - Monitor application for errors

5. **Investigate root cause**
   - Review migration logs
   - Check for buggy update scripts
   - Implement safeguards

### Scenario 2: Accidental Data Deletion

**Symptoms**: Users report missing items, movements, or organizations

**Recovery Steps**:

1. **Assess scope**
   - Was it single item? Single org? Bulk operation?
   - When did deletion occur?

2. **Use Neon branching for recovery**
   ```bash
   # Create recovery branch from before deletion
   neon_branch_id=$(curl -s -X POST \
     https://console.neon.tech/api/v2/projects/<project-id>/branches \
     -H "Authorization: Bearer $NEON_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "branch": {
         "parent_id": "<main-branch-id>",
         "name": "recovery-deleted-data"
       }
     }' | jq -r '.branch.id')
   ```

3. **Extract data from recovery branch**
   ```sql
   -- Connect to recovery branch database
   SELECT * FROM "Item" WHERE id IN ('item-1', 'item-2');
   
   -- Export to CSV for manual re-import
   COPY (SELECT * FROM "Movement" WHERE created_at > '2026-04-10'::date)
     TO '/tmp/movements-recovery.csv' WITH CSV HEADER;
   ```

4. **Re-import into production**
   - Use application UI or API to re-create records
   - Or: INSERT from recovery branch (if schema hasn't changed)

5. **Verify completeness**
   - Run data consistency checks
   - Alert affected users

6. **Clean up recovery branch**
   ```bash
   # Delete recovery branch after data restored
   curl -X DELETE \
     https://console.neon.tech/api/v2/projects/<project-id>/branches/<recovery-branch-id> \
     -H "Authorization: Bearer $NEON_API_KEY"
   ```

### Scenario 3: Application Deployment Failure

**Symptoms**: App won't start, 500 errors on all pages, build fails

**Recovery Steps**:

1. **Check Vercel deployment status**
   ```bash
   # View build logs
   vercel list --limit 5
   vercel inspect <latest-deployment-url>
   ```

2. **If build error**
   - Review most recent git commit
   - Fix the error and push again
   - Vercel will auto-rebuild

3. **If runtime error**
   - Rollback to last known-good deployment
   ```bash
   vercel rollback <good-deployment-url>
   ```

4. **If database connection error**
   - Verify `DATABASE_URL` in Vercel env vars
   - Check Neon database status
   - Ensure IP allowlist includes Vercel IPs

5. **Monitor recovery**
   ```bash
   # Tail logs until stable
   vercel logs <project-id> --tail --follow
   ```

### Scenario 4: Compromised Credentials

**Symptoms**: Unauthorized API access, suspicious database activity, payment fraud

**Immediate Actions**:

1. **Rotate BETTER_AUTH_SECRET** (Session encryption)
   ```bash
   # All existing sessions invalidated
   # Users must log in again
   vercel env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
   vercel deployments promote <latest-deployment>
   ```

2. **Rotate STRIPE_SECRET_KEY**
   - Generate new key in Stripe dashboard
   ```bash
   vercel env set STRIPE_SECRET_KEY "<new-key>"
   ```
   - Update Stripe webhook endpoint signing secret
   - Monitor for webhook delivery issues

3. **Rotate DATABASE_URL** (if database password compromised)
   ```bash
   # In Neon: reset password
   # Then update in Vercel
   vercel env set DATABASE_URL "<new-database-url>"
   ```

4. **Force password reset for all users** (if password database leaked)
   - Mark all users as `emailVerificationRequired`
   - Send "Verify your email" email with reset link
   - Users must set new passwords on next login

5. **Review audit logs**
   ```bash
   # Check for unauthorized API access
   SELECT * FROM "AuditLog" 
   WHERE created_at > now() - interval '1 hour'
   ORDER BY created_at DESC;
   ```

6. **Notify users** (per data breach policy)
   - If PII was exposed, notify via email
   - Document incident for legal/compliance

---

## Monitoring & Alerting

### Sentry Error Tracking

Sentry monitors application errors in production:

- **Setup**: Configured in Next.js middleware
- **Alerts**: Configured for error spikes
- **Dashboard**: https://sentry.io/organizations/oneace/issues/

#### Key Metrics to Monitor

- Error rate (%) — target < 0.1%
- Database connection errors — target 0
- 5xx response rate — target < 0.1%
- Payment processing errors — target 0

### Vercel Analytics

Vercel provides performance and uptime metrics:

- **Uptime**: Status dashboard at status.vercel.com
- **Performance**: Real user monitoring (RUM)
- **Build times**: Deployment frequency and duration
- **Logs**: Streaming access to deployment logs

#### Access Logs

```bash
# Tail live logs
vercel logs <project-id> --tail --follow

# View function logs
vercel logs <project-id> --function=api/items
```

### Neon Database Monitoring

In Neon console under **Monitoring**:

- **Query performance**: Slow query log
- **Connection count**: Active connections vs. limit
- **Disk usage**: Monitor growth rate
- **Replication lag**: For read replicas (if enabled)

---

## Backup Schedule & Retention

| Component | Backup Type | Frequency | Retention | Owner |
|-----------|-------------|-----------|-----------|-------|
| **Database (PITR)** | Point-in-time | Continuous | 7–30 days | Neon (auto) |
| **Database (manual)** | Custom dump | Weekly | 4 weeks | DevOps |
| **CSV exports** | Data extract | Weekly | 12 weeks | DevOps |
| **Environment vars** | Local vault | On change | Permanent | DevOps |
| **Deployments** | Built artifacts | Every push | Unlimited | Vercel |
| **Source code** | Git repo | Every commit | Unlimited | GitHub |

---

## Runbook: Weekly Backup Checklist

**Every Sunday**:

- [ ] Run database export script
- [ ] Verify exports uploaded to cold storage
- [ ] Check Neon dashboard for PITR status
- [ ] Review Sentry error logs for trends
- [ ] Verify no disk space warnings

**Monthly**:

- [ ] Test restore from backup (recovery branch)
- [ ] Review disaster recovery playbook for updates
- [ ] Audit environment variable vault
- [ ] Check Vercel deployment history

**Quarterly**:

- [ ] Full disaster recovery drill (simulate outage)
- [ ] Update this documentation
- [ ] Review GDPR compliance for data deletion/export

---

## Compliance & Legal

### Data Residency

- **Database**: Hosted on Neon in **US-East** region
- **Application**: Deployed via Vercel (multi-region CDN)
- **Backups**: Stored in **US-East** region (Neon managed)

### GDPR Data Subject Rights

- **Right of Access**: User data export (see "Data Export" section)
- **Right to be Forgotten**: Account deletion (see "Data Deletion" section)
- **Right to Data Portability**: JSON/CSV export formats
- **Audit Trail**: All deletes logged with timestamp

### Compliance Validation

```sql
-- Verify all deleted accounts are purged
SELECT COUNT(*) FROM "User" WHERE "deletedAt" IS NOT NULL;

-- Verify exports are available
SELECT COUNT(*) FROM "DataExportRequest" 
  WHERE status = 'ready' 
  AND created_at > now() - interval '7 days';

-- Audit logs of deletions
SELECT user_id, action, created_at FROM "AuditLog" 
  WHERE action = 'account_deleted'
  ORDER BY created_at DESC;
```

---

## Contact & Escalation

- **On-call**: Check #on-call Slack channel
- **Database emergency**: Neon support at https://neon.tech/support
- **Application emergency**: Vercel support at https://vercel.com/support
- **Data breach**: Legal team + GDPR DPO
