# Production Rollback Runbook

**Audience:** Anyone on-call for OneAce prod — primary oncall, secondary, and whoever inherits this project five years from now.
**Scope:** What to do when production is broken and the shortest path to green is reverting. If you're debugging forward (symptom is fixable in code inside 15 minutes), this is not the runbook for you.
**Audit reference:** v1.3 §5.50 F-06. This document exists because the 2026-04-18 dependabot-burn incident was recovered from working memory, and the exact same outage next year would cost the same hour of rediscovery.

---

## 0. First 60 seconds — is this actually a rollback?

Answer all three before touching anything:

1. **Is it the deploy?** Check Vercel `/oneace-next-local/deployments` — is the current production deployment newer than the reported breakage? If yes → rollback is on the table. If no → it's probably data/infra/upstream, different runbook.
2. **Is there a green predecessor?** `cat docs/runbooks/.last-known-good.json` — the `vercelDeploymentId` in there is your promote target. If it's empty or older than two weeks, skip to Path C (manual redeploy from a good tag).
3. **Is rollback safe?** Check `prisma/migrations/` — did the broken deploy include a migration? If yes, a rollback to a pre-migration deploy will hit schema drift. Read §5 ("Rollback with migrations") before promoting anything.

If the answer to any of those is "I don't know", **page the secondary and STOP**. A bad rollback is worse than a 10-minute longer outage.

---

## 1. Known-good ledger

Single source of truth for "where do I roll back to": `docs/runbooks/.last-known-good.json`.

```json
{
  "tag": "v1.5.13",
  "commit": "5d8f7a2",
  "vercelDeploymentId": "dpl_cTbSr4k95E1Sgt37oWbQsss8UTqe",
  "verifiedAt": "2026-04-18T18:10:00Z",
  "verifiedBy": "manual-incident-response",
  "notes": "...",
  "history": [ ... ]
}
```

**Who writes to it:** `scripts/update-last-known-good.sh` — called manually after every verified prod promote. Not a pre-commit hook, because a commit on `main` is not proof that the deploy is healthy; only a human-verified promote is.

**How to update after a healthy promote:**

```bash
# After you've verified the new prod is green (health check + a real user flow):
./scripts/update-last-known-good.sh dpl_YOUR_NEW_DEPLOYMENT_ID

# This rolls the current record into history[] (capped at 20) and writes
# the new tag/commit/deploymentId to the top. Stage + commit the diff:
git add docs/runbooks/.last-known-good.json
git commit -m "chore: bump last-known-good to $(git tag --list --sort=-v:refname | head -1)"
```

**How to read it during an incident:**

```bash
jq -r '.vercelDeploymentId' docs/runbooks/.last-known-good.json
# → dpl_cTbSr4k95E1Sgt37oWbQsss8UTqe (your promote target)

jq -r '.history[] | [.tag, .vercelDeploymentId, .verifiedAt] | @tsv' docs/runbooks/.last-known-good.json
# → rolling audit trail if the current LKG is also broken
```

---

## 2. Path A — Dashboard promote (expected default)

Use this when: there is a green `vercelDeploymentId` in the ledger, quota is not exhausted, and the Vercel dashboard is reachable.

**Budget:** ~5 min cached / ~3 min uncached.

1. Open `https://vercel.com/mahmutseker79s-projects/oneace-next-local/deployments`.
2. Find the deployment ID from the ledger (search by `dpl_...` or by the short commit SHA).
3. Hover → ⋯ menu → **Promote to Production**.
4. Confirm. Vercel serves the existing build immediately from cache — no new build, no quota spend.
5. Verify:
    ```bash
    curl -sS https://oneace-next-local.vercel.app/api/health | jq '.commit'
    # → Expect the short commit from the ledger ("5d8f7a2").
    ```
6. Walk one real user flow (signup or sign-in + list items) before declaring recovered.
7. Update the ledger's `notes`/`verifiedAt` by running `./scripts/update-last-known-good.sh` — the promote reset the active deployment, so the ledger now needs its `verifiedAt` stamp refreshed.

---

## 3. Path B — Promote blocked by quota

Use this when: Path A is the right call but the Vercel Hobby **daily-deploy quota (100/UTC-day)** is exhausted and "Promote to Production" also queues a build. This is what happened on 2026-04-18 — the v1.5.13 hotfix preview was `READY` but could not be promoted because every "promote" attempt also triggered a build, and builds were refused.

**Budget:** ~10 min + waiting until UTC 00:00 if quota is truly gone.

1. Check `/api/cron/platform-quota-health` (or its last log line tagged `platform-quota.exceeded`) to confirm the quota is the blocker. If the cron is silent, don't assume — the webhook sentinel (§5.45 F-01) could also be down; check the tag `platform-webhook.silent` too. (Faz 2 rename: the legacy `vercel-quota-health` / `webhook-health.*` tags are gone as of v1.5.32.)
2. Kill the burn source first — otherwise you'll be back here in an hour:
    - `vercel.json` should have `"git.deploymentEnabled": { "dependabot/*": false }` as of v1.5.17. Verify it's still there: `jq '.git.deploymentEnabled' vercel.json`.
    - Close or stack any other PRs that are firing preview builds.
3. Wait for UTC 00:00 OR upgrade to Vercel Pro (1000/day) OR — **if the outage is user-visible and bad** — use Path C.
4. When the quota resets, the promote in §2 goes through.

If you upgraded to Pro during an incident, create a follow-up ticket to evaluate whether the upgrade should stick. Don't silently eat the monthly charge.

---

## 4. Path C — Manual deployment (webhook silent OR quota impossible)

Use this when: the GitHub → Vercel webhook is dead (last push did not create a new deployment — symptom is also tagged `webhook-health.silent` by §5.45 F-01), OR you need to ship a specific commit that is not a prior deployment, OR Path B's wait is unacceptable.

**Budget:** ~10–15 min.

1. Check out the target ref locally:
    ```bash
    git fetch origin
    git checkout v1.5.13                    # or `git checkout <short-sha>`
    ```
2. Trigger a manual deployment from the Vercel dashboard:
    - `Deployments` → **Create Deployment** (top-right).
    - Upload / point at the target ref.
    - Promote to Production when build reports `Ready`.
3. If the webhook is also dead (both prod and preview builds stopped firing on push), reconnect it:
    - Vercel project → Settings → Git → Disconnect → Reconnect GitHub App.
    - Confirm the next `git push` creates a new deployment.
    - Open a follow-up note in the incident doc — webhook reconnect is the trigger condition the `webhook-health.silent` alarm should catch first.
4. Same verification steps as Path A (§2).

---

## 5. Rollback with migrations

If the broken deploy shipped a Prisma migration, rolling to a pre-migration deployment creates schema drift. Two safe patterns:

### 5a. Migration was additive (new column, new table, new index)

Additive migrations are **backwards-compatible** — a pre-migration deploy will simply not use the new column. Rollback is safe. After rollback, leave the migration applied in the DB; the next forward deploy will use it.

### 5b. Migration was destructive (DROP, RENAME, NOT NULL on existing column)

**Do not rollback code without also reverting the migration.** Either:

- **Preferred** — write a reverse-migration and deploy forward. Skip the rollback path.
- **If outage is bad** — run the reverse-migration SQL by hand against Neon, in a transaction, with a DBA on the call. Then promote the pre-migration deploy. This is the "break-glass" path; document the exact SQL in the incident doc.

If you don't know whether the migration was additive or destructive, read the migration's `.sql` file before promoting anything. Prisma generates them under `prisma/migrations/<timestamp>__<name>/`.

---

## 6. Deployment Protection bypass

Our prod and preview deployments sit behind Vercel Deployment Protection (SSO wall). During incident response you may need to give a non-Vercel-member reviewer a look at a `READY` preview without adding them to the team:

1. Vercel dashboard → the preview deployment → **Share** button (top-right).
2. Generates a signed URL of the form:
    ```
    https://<preview>.vercel.app/?_vercel_share=<signature>
    ```
3. TTL is **23 hours**. Don't paste into a permanent channel — the signature in the URL is effectively a bearer token.
4. On expiry, re-generate; don't hand out longer-lived bypasses.

Do not use this to dodge a protection block on a deployment that is supposed to be locked. If you can't promote through the normal flow because of Deployment Protection, fix the protection config (Settings → Deployment Protection), don't work around it.

---

## 7. Post-rollback checklist

Within 15 minutes of declaring recovered:

- [ ] `./scripts/update-last-known-good.sh [dpl_id]` reflects the currently-active prod.
- [ ] Incident doc captures: start time, detection mechanism, rollback path taken, root cause (even if partial), action items.
- [ ] If Path B or Path C was used, open a follow-up ticket to make Path A work next time (quota headroom, webhook monitoring, whatever was broken).
- [ ] If a migration was rolled back by hand (§5b), note the exact SQL and whoever ran it.

Within 48 hours:

- [ ] Blameless postmortem (template: `docs/DR-drill-log.md` if pattern continues).
- [ ] Update this runbook if you hit a case it didn't cover. Every undocumented case costs the next person an hour.

---

## 8. Related runbooks + monitors

- `/api/cron/platform-webhook-health` (§5.45 F-01, Faz 2 rename v1.5.32) — fires `platform-webhook.silent` when GitHub main HEAD is past the live prod commit by > 30 min. Log payload carries `platform: "vercel" | "netlify"` so alerts can split by host during the cutover window.
- `/api/cron/platform-quota-health` (§5.48 F-04, Faz 2 rename v1.5.32) — fires `platform-quota.warn` at ≥ 80% of ceiling, `platform-quota.exceeded` at ≥ 100%. The ceiling is platform-specific: Vercel Hobby is 100 deploys / UTC-day; Netlify Free is 300 build-minutes / month.
- `docs/DR-drill-log.md` — DR exercise log; add an entry after any rollback-class incident.
- `docs/MONITORING.md` — catalog of logger tags / alert routes. If a new alarm fires and you don't recognize the tag, it's indexed there.
- `vercel.json` `git.deploymentEnabled` — the v1.5.17 gate that blocks `dependabot/*` from burning quota.

---

## 9. What this runbook will never say

- "Just force-push main." No. If the rollback target is a prior commit, use Path A or C; force-pushing `main` loses forward fixes that are already merged.
- "Skip the verification step." No. "I promoted it" is not the same as "prod is healthy." Always hit `/api/health` and walk a real flow.
- "Edit the database without a second pair of eyes." No. §5b is explicit — DBA on the call, in a transaction.
