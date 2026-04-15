# OneAce Gap Analysis Report

**Date:** 2026-04-12
**Scope:** Design-spec vs production deployment comparison
**Deployment:** https://oneace-next-local.vercel.app
**Status:** ANALYSIS ONLY — no code changes made

---

## Executive Summary

4 parallel analysis agents examined onboarding, sidebar/IA, inventory operations, and role-based access against the 11-file design-spec. The app has **56 routes and a working build** but significant gaps exist between spec intent and deployed reality.

**Key metrics:**
- Sidebar: 13 items vs spec's 8 MVP items (62% over budget)
- Onboarding: ~40% built (Path A partial, Path B missing)
- Empty states: All list pages have basic empty states ✅
- Role gating: Zero permission-based nav filtering
- POST-MVP features shipped early: Categories, Suppliers, Purchase Orders

---

## 1. SIDEBAR / NAVIGATION (spec: 04-information-architecture.md)

### Current State (sidebar.tsx lines 53-67)

| # | Current Item | Icon | Spec Status | Action |
|---|-------------|------|-------------|--------|
| 1 | Dashboard | LayoutDashboard | Not in sidebar spec | REMOVE (home is `/`, not nav item) |
| 2 | Items | Package | MVP ✅ | KEEP |
| 3 | Categories | FolderTree | POST-MVP | REMOVE |
| 4 | Warehouses | Warehouse | MVP but wrong name/icon | RENAME → "Locations", icon → MapPin |
| 5 | Stock counts | ClipboardList | MVP ✅ | KEEP |
| 6 | Scan | ScanLine | Mobile-only per spec | REMOVE from web |
| 7 | Movements | ArrowLeftRight | MVP ✅ | KEEP |
| 8 | Suppliers | Truck | POST-MVP | REMOVE |
| 9 | Purchase orders | ShoppingCart | POST-MVP | REMOVE |
| 10 | Reports | BarChart3 | MVP ✅ | KEEP |
| 11 | Users | Users | Admin sub-item | MOVE under Admin |
| 12 | Audit | History | Admin sub-item | MOVE under Admin |
| 13 | Settings | Settings | Admin sub-item | MOVE under Admin |

### Target Structure (per spec)

```
Core
  Items
  Locations        (currently "Warehouses")
  Movements
  Stock counts

Analytics
  Reports

Admin              (collapsed group)
  Members          (currently "Users")
  Audit
  Settings
```

### Missing Features
- ❌ No permission-based nav filtering (all items visible to all roles)
- ❌ No visual grouping/sections
- ❌ No collapse-to-icon-rail mode

---

## 2. ONBOARDING (spec: 05-onboarding-activation.md)

### Path A: Owner Signup

| Step | Spec Requirement | Status | Evidence |
|------|-----------------|--------|----------|
| 1 | Register form (email + password) | ✅ BUILT | register-form.tsx:64 |
| 2 | Create organization + default warehouse | ✅ BUILT | route.ts:64-75 |
| 3 | Redirect to `/items` empty state | ❌ MISSING | Redirects to `/dashboard` (onboarding-form.tsx:41) |
| 4 | "Add your first item" CTA on empty items | ❌ MISSING | No spec-compliant empty-state component |
| 5 | Activation tips card on dashboard | ❌ MISSING | Not implemented anywhere |

**Actual redirect chain:** `register → /onboarding → /dashboard` (should be `→ /items`)

### Path B: Invitee Flow

| Step | Spec Requirement | Status | Evidence |
|------|-----------------|--------|----------|
| 1 | Invite email with magic link | ⚠️ PARTIAL | invite-form.tsx exists, but... |
| 2 | `/invite/:token` acceptance page | ⚠️ PARTIAL | Page exists but flow untested |
| 3 | Role-appropriate home landing | ❌ MISSING | All users land on `/dashboard` |

### Activation Tips Card (spec lines 93-118)

**Completely unimplemented.** Spec requires a dismissible card on dashboard with 5 data-driven tips:

| Tip | Condition | Status |
|-----|-----------|--------|
| Add at least one item | `items.count > 1` | ❌ |
| Add a second location | `locations.count > 1` | ❌ |
| Log a movement | `movements.count > 0` | ❌ |
| Run a count | any count `state='completed'` | ❌ |
| Invite a teammate | `memberships.count > 1` | ❌ |

---

## 3. INVENTORY & OPERATIONS (specs: 06, 07, 08)

### Empty States Audit

| Page | Has Empty State | Has CTA | Matches Spec Copy |
|------|----------------|---------|-------------------|
| `/items` | ✅ (Package icon) | ✅ "Create item" | ⚠️ Missing "or import a CSV" |
| `/warehouses` | ✅ (Warehouse icon) | ✅ "Create warehouse" | ⚠️ Should say "Add location" |
| `/movements` | ✅ (Transfer icon) | ✅ "Create movement" | ⚠️ Should say "Log adjustment" |
| `/stock-counts` | ✅ (Clipboard icon) | ✅ "Create count" | ⚠️ Should say "Start a new one" |
| `/categories` | ✅ (FolderTree icon) | ❌ No CTA | POST-MVP, acceptable |
| `/suppliers` | ✅ (Truck icon) | ✅ "Create supplier" | POST-MVP |
| `/purchase-orders` | ✅ (ShoppingCart icon) | ✅ "Create PO" | POST-MVP |

### Create Flows

| Flow | Working | Notes |
|------|---------|-------|
| Items → /items/new | ✅ | Full form with categories, suppliers, initial stock |
| Warehouses → /warehouses/new | ✅ | Simple form, no prerequisites |
| Movements → /movements/new | ✅ | Gated: requires item + warehouse first (friendly block) |
| Stock counts → /stock-counts/new | ✅ | Gated: requires item + warehouse (friendly block) |
| Stock count detail → entries → reconcile | ✅ | Full state machine: OPEN → IN_PROGRESS → COMPLETED |

### Stock Counting Workflow (THE MOAT)
- ✅ 6 methodologies: CYCLE, FULL, SPOT, BLIND, DOUBLE_BLIND, DIRECTED
- ✅ State machine: OPEN → IN_PROGRESS → COMPLETED / CANCELLED
- ✅ Append-only entries
- ✅ Reconcile with variance display
- ✅ Cancel dialog with reason

### Scanner (spec: 07-scanner-and-offline.md)
- Spec says: "Scanner is device-native, not web. Mobile only."
- Web `/scan` page exists but spec says it shouldn't be in sidebar
- Barcode field exists in data model ✅

### CSV Import/Export
- ✅ `/items/import` exists and works
- ✅ `/items/export`, `/movements/export`, `/purchase-orders/export` exist
- ❌ Import not discoverable from items empty state (only in header)

---

## 4. ROLE-BASED ACCESS (spec: 09-role-based-access.md)

### Spec Permission Matrix (23 keys × 5 roles)

| Permission | OWNER | ADMIN | MANAGER | MEMBER | VIEWER |
|-----------|-------|-------|---------|--------|--------|
| item.read | ✅ | ✅ | ✅ | ✅ | ✅ |
| item.write | ✅ | ✅ | ✅ | ✅ | ❌ |
| item.delete | ✅ | ✅ | ❌ | ❌ | ❌ |
| stockcount.reconcile | ✅ | ✅ | ❌ | ❌ | ❌ |
| member.manage | ✅ | ✅ | ❌ | ❌ | ❌ |
| org.admin | ✅ | ❌ | ❌ | ❌ | ❌ |

### Implementation Status

| Feature | Status | Evidence |
|---------|--------|----------|
| Page-level permission gate wrapper | ❌ MISSING | Only `/audit` has inline role check |
| `usePermission()` client hook | ❌ MISSING | Not in codebase |
| Permission-denied branded screen | ❌ MISSING | Only inline "forbidden" text |
| Nav filtering by permission | ❌ MISSING | All 13 items visible to all users |
| Hardcoded role checks | ⚠️ Anti-pattern | `membership.role === "OWNER"` used instead of permission keys |
| MANAGER role permissions | ❌ UNDEFINED | Role exists in Prisma but unmapped to permission keys |

---

## 5. I18N STATUS

- ✅ All pages use `getMessages()` from `src/lib/i18n/messages/en.ts`
- ✅ 8 locales scaffolded (en, tr, de, fr, es, pt, ar, zh)
- ✅ Empty state messages exist for all list pages
- ⚠️ Role descriptions in i18n don't exactly match spec copy
- ❌ No activation tips i18n keys

---

## 6. PRIORITIZED FIX PLAN

### P0 — CRITICAL (Blocks first-use experience)

| # | Fix | Effort | Files |
|---|-----|--------|-------|
| 1 | Sidebar prune: remove 6 items, add grouping | 1 day | sidebar.tsx |
| 2 | Onboarding redirect: `/dashboard` → `/items` | 30 min | onboarding-form.tsx, register-form.tsx |
| 3 | Items empty state: add "Import CSV" secondary CTA | 30 min | items/page.tsx, en.ts |

### P1 — HIGH (First-week experience)

| # | Fix | Effort | Files |
|---|-----|--------|-------|
| 4 | Activation tips card on dashboard | 2 days | dashboard/page.tsx, en.ts, new component |
| 5 | Empty state copy: match spec language | 1 day | all list pages, en.ts |
| 6 | Warehouses → Locations rename | 1 day | sidebar, pages, en.ts, routes |

### P2 — MEDIUM (Role-based access)

| # | Fix | Effort | Files |
|---|-----|--------|-------|
| 7 | Permission-based nav filtering | 2 days | sidebar.tsx, session.ts |
| 8 | Permission-denied component | 1 day | new component, en.ts |
| 9 | Replace hardcoded role checks with permission keys | 2 days | all action files |

### P3 — LOW (Polish)

| # | Fix | Effort | Files |
|---|-----|--------|-------|
| 10 | Role-appropriate landing for invitees | 1 day | middleware.ts, session.ts |
| 11 | MANAGER role permission mapping | 1 day | session.ts, new permissions module |
| 12 | Audit log for sign-in/out | 1 day | auth.ts, audit.ts |

---

## 7. WHAT NOT TO TOUCH

These are POST-MVP features already shipped. Do NOT remove the code — just hide from navigation:

- Categories (full CRUD works)
- Suppliers (full CRUD works)
- Purchase Orders (full CRUD works)
- Scan page (barcode detection works)

The code stays, only sidebar visibility changes.

---

## Next Steps

**Awaiting approval** to proceed with P0 fixes (sidebar prune + onboarding redirect + items empty state CTA). These are the minimum changes to make the first-use experience match the design spec without breaking any existing functionality.
