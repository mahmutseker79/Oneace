---
name: oneace-release-gate
description: Run a production release gate for OneAce before merge or deployment.
---

# OneAce Release Gate Skill

Use this skill before:
- major merges
- production deploys
- schema migrations
- billing changes
- permission changes
- dashboard rewrites
- stock/inventory workflow changes
- reporting changes
- onboarding changes
- releases with cross-module impact

## Mission
Decide whether a change is safe to release, what must be fixed before release, what can be deferred, and what rollback protections are required.

## Release Gate Participants
Must include:
- Frontend Architect
- Backend/API Architect
- Database & Performance Engineer
- QA/Reliability Engineer
- Security Engineer
- DevOps/Deployment Engineer
- ERP Domain Architect

Include SaaS Product Strategist when billing, plans, or onboarding are affected.

## Temporary Specialist Escalation
Call in temporary specialists if release risk depends on niche expertise:
- Migration Specialist
- Stripe/Billing Specialist
- Observability Specialist
- Search Specialist
- Queue/Worker Specialist
- Reporting Specialist
- CSV/Export Specialist
- Mobile UX Specialist

## Release Gate Checklist

### A. Functional Safety
- does the intended feature work
- do existing critical flows still work
- are role-gated flows correct
- are edge cases handled

### B. ERP Integrity
- stock correctness preserved
- movement correctness preserved
- count correctness preserved
- transaction/order integrity preserved

### C. Database / Migration Safety
- migration sequence safe
- backfill plan defined if needed
- rollback implications known
- indexes / locks / runtime impact understood

### D. Security Safety
- no new permission leak
- no tenant boundary issue
- no exposed internal data
- no unsafe webhook / upload / payload behavior

### E. Performance Safety
- large table handling acceptable
- query behavior acceptable
- pagination/sorting/filtering not degraded
- render performance acceptable

### F. UX Release Safety
- no visual inconsistency
- no navigation break
- no dead ends
- empty/error/loading states preserved

### G. Operational Safety
- logs adequate
- monitoring adequate
- alerts identifiable
- feature flag or rollback path available if needed

## Release Decision Categories
- APPROVED
- APPROVED WITH CONDITIONS
- BLOCKED
- BLOCKED – CRITICAL FIXES REQUIRED

## Required Output Structure

1. Release Scope Summary
2. Cross-Functional Review
3. Specialist Escalation
4. Critical Risks
5. Must-Fix Before Release
6. Can Defer Until Next Sprint
7. Rollback Strategy
8. Final Release Decision

## Rules
- Do not approve risky releases casually
- Be explicit about blockers
- Distinguish critical fixes from nice-to-haves
- Protect production stability above delivery speed
