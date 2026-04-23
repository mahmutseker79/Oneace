# Branch Protection — main + stable

**Status:** Enforced.
**Source of truth:** `scripts/setup-branch-protection.sh`
**Ref:** GOD MODE roadmap 2026-04-23 §P1-05.

---

## Policy

`main` and `stable` are protected. The rule:

- **Required status checks** (must pass on a fresh commit):
  - `Lint · Typecheck`
  - `Vitest`
  - `Prisma Validate`
  - `Prisma Migrations (scratch Postgres)` — the P1-04 gate: every
    migration is applied to a scratch Postgres + re-applied
    idempotently.
- **Required approving reviews:** 1.
- **Linear history:** yes (no merge bubbles from forks).
- **Force-push:** no.
- **Branch deletion:** no.
- **Conversation resolution:** required before merge.

## Applying the rule

```bash
bash scripts/setup-branch-protection.sh
```

Idempotent. Re-running after a ci.yml job-name change is the
correct way to sync the required-checks list.

## Adding a new required check

1. Add the job to `.github/workflows/ci.yml` with an explicit
   `name:` field.
2. Append the exact `name:` to `REQUIRED_CHECKS` in
   `scripts/setup-branch-protection.sh`.
3. Re-run the script.

Both steps must land in the same commit so CI and protection never
drift out of sync.

## Emergency override (use sparingly)

```bash
# Drop protection for a hotfix window.
gh api -X DELETE repos/mahmutseker79/Oneace/branches/main/protection

# Land the hotfix on main directly.

# Re-apply protection.
bash scripts/setup-branch-protection.sh
```

Overriding protection without re-applying after the hotfix is the
single most common way to silently lose CI gating. A follow-up
audit should scan for branches whose protection timestamp is older
than the main HEAD commit — open a ticket if that drift exceeds
48h.
