---
name: oneace-security-audit
description: Run a deep security, authorization, tenant-isolation, and abuse-surface audit on OneAce.
---

# OneAce Security Audit Skill

Use this skill when the task touches:
- authentication
- authorization
- roles / RBAC
- tenant isolation
- API security
- file uploads
- secrets handling
- audit logging
- abuse prevention
- sensitive workflows
- billing and identity
- data privacy
- compliance-sensitive changes

## Mission
Detect security weaknesses, abuse paths, data exposure risks, permission leaks, tenant boundary failures, unsafe defaults, and operational blind spots.

## Required Core Participants
At minimum include:
- Security Engineer
- Backend/API Architect
- Database & Performance Engineer
- QA/Reliability Engineer
- DevOps/Deployment Engineer

Include others when relevant.

## Temporary Specialist Escalation
Add temporary specialists when needed:
- Auth/Identity Specialist
- RBAC Specialist
- JWT/Session Specialist
- File Upload Security Specialist
- GDPR/Compliance Specialist
- Billing/Stripe Specialist
- Audit Logging Specialist
- Infra/Secrets Specialist

## Audit Scope
Analyze as applicable:

### 1. Authentication
- session handling
- token lifecycle
- password / magic link / OAuth flows
- expiration and refresh behavior
- logout correctness

### 2. Authorization
- route protection
- API protection
- action-level permissions
- role drift
- privilege escalation paths

### 3. Tenant Isolation
- tenant-aware queries
- tenant leakage in APIs
- multi-tenant caching risks
- row ownership validation
- background job tenant correctness

### 4. Input / Payload Safety
- server-side validation
- unsafe parsing
- injection surfaces
- malformed payload handling

### 5. Upload / Attachment Safety
- file type validation
- content-type spoofing
- size restrictions
- malware/vector risks
- object access controls

### 6. Sensitive Data Exposure
- logs
- client payloads
- debugging leaks
- stack traces
- internal IDs / secrets exposure

### 7. Billing / Identity Risk
- plan escalation abuse
- webhook trust boundaries
- customer identity mismatches
- replay risk
- stale permission state

### 8. Operational Hardening
- rate limiting
- audit logs
- anomaly visibility
- alerting surfaces
- secure defaults

## Severity Model
Classify findings as:
- LOW
- MEDIUM
- HIGH
- CRITICAL

## Required Output Structure

1. Security Scope Detected
2. Attack Surface Summary
3. Core Security Discussion
4. Specialist Escalation
5. Findings by Severity
6. Likely Exploit / Failure Scenarios
7. Recommended Fix Strategy
8. Regression / Rollout Risk
9. Validation / Retest Plan

## Rules
- Never hand-wave security concerns
- Always consider both accidental and malicious misuse
- Always check tenant isolation and permission boundaries
- Always propose realistic fixes, not theory only
