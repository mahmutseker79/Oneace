# OneAce Beta Smoke-Test Matrix

**Purpose:** Repeatable verification checklist for beta readiness, stakeholder demos, and pre-release validation.

**How to use:** Run through each section manually before any significant release. Mark ✅ pass or ❌ fail with a short note.

**Test environments needed:**
- A FREE org (no payment method)
- A PRO org (active Stripe subscription for PRO price)
- A BUSINESS org (active Stripe subscription for BUSINESS price)
- A Stripe test account with webhook forwarding enabled (`stripe listen --forward-to localhost:3000/api/billing/webhook`)

---

## 1. Account Setup & Authentication

| # | Test | Expected | Result |
|---|------|----------|--------|
| 1.1 | Register new account at `/register` | Creates org with FREE plan, redirects to onboarding | |
| 1.2 | Log in at `/login` with valid credentials | Redirects to `/dashboard` | |
| 1.3 | Visit `/login` while logged in | Redirects to `/dashboard` | |
| 1.4 | Visit `/pricing` while logged out | Public pricing page renders, no auth redirect | |
| 1.5 | Visit `/docs` while logged out | Public docs page renders | |
| 1.6 | Visit `/dashboard` while logged out | Redirects to `/login` with `?redirect=/dashboard` | |

---

## 2. FREE Plan — Core Features

| # | Test | Expected | Result |
|---|------|----------|--------|
| 2.1 | Create first item | Succeeds (count: 1/100) | |
| 2.2 | Create 99 more items (total: 100) | All succeed | |
| 2.3 | Create item 101 | **Blocked** — error: "up to 100 items… Upgrade to Pro" | |
| 2.4 | Import CSV with 5 items when at limit | **Blocked** — same limit error | |
| 2.5 | Items page at limit | Amber warning banner "approaching/reached limit" visible | |
| 2.6 | Create first warehouse | Succeeds | |
| 2.7 | Create second warehouse | **Blocked** — error: "1 warehouse location… Upgrade to Pro" | |
| 2.8 | Invite 3rd team member (with owner = 1, admin = 1, = total 3) | Succeeds (fills limit) | |
| 2.9 | Invite 4th member | **Blocked** — error: "up to 3 team members…" | |
| 2.10 | Stock count creation | Succeeds | |
| 2.11 | Barcode scanning at `/scan` | Succeeds (FREE feature) | |
| 2.12 | Record stock movement (Receipt/Issue/Adjustment) | Succeeds (FREE feature) | |

---

## 3. FREE Plan — Blocked Features

| # | Test | Expected | Result |
|---|------|----------|--------|
| 3.1 | Navigate to `/purchase-orders` | Shows UpgradePrompt "card" (not the PO list) | |
| 3.2 | Navigate to `/movements/transfers/new` | Shows plan gate message before wizard | |
| 3.3 | Try to access `/audit` | Shows "Audit log is available on the Business plan" message | |
| 3.4 | GET `/items/export` directly | Returns HTTP 403 with JSON error | |
| 3.5 | GET `/movements/export` directly | Returns HTTP 403 | |
| 3.6 | GET `/reports/stock-value/export` directly | Returns HTTP 403 | |
| 3.7 | Navigate to `/warehouses/[id]/bins` | Bins exist if already created; can view; creating new bin blocked ("Pro plan") | |
| 3.8 | Export button on `/reports/stock-value` | Button absent OR clicking returns 403 message | |

---

## 4. PRO Plan — Feature Access

| # | Test | Expected | Result |
|---|------|----------|--------|
| 4.1 | Create 101st item | Succeeds (unlimited on PRO) | |
| 4.2 | Create 2nd warehouse | Succeeds (unlimited on PRO) | |
| 4.3 | Navigate to `/purchase-orders` | Full PO list renders (no upgrade prompt) | |
| 4.4 | Create purchase order | Succeeds | |
| 4.5 | Run PO receiving flow | Succeeds with scan input | |
| 4.6 | Navigate to `/movements/transfers/new` | Transfer wizard loads | |
| 4.7 | Complete a transfer | Succeeds | |
| 4.8 | Navigate to `/warehouses/[id]/bins` | Bins page loads, can create bins | |
| 4.9 | Run putaway after receiving | Succeeds | |
| 4.10 | Download CSV export from `/items/export` | Returns CSV file (200) | |
| 4.11 | Navigate to `/reports/stock-value` | Report renders with Export button | |
| 4.12 | Download Excel export from report | Returns .xlsx file | |
| 4.13 | Navigate to `/audit` | **Blocked** — "Audit log is available on the Business plan" | |
| 4.14 | Invite 10th member | Succeeds (fills PRO limit) | |
| 4.15 | Invite 11th member | **Blocked** — "up to 10 team members… Upgrade to Business" | |

---

## 5. BUSINESS Plan — Full Access

| # | Test | Expected | Result |
|---|------|----------|--------|
| 5.1 | Navigate to `/audit` | Full audit log renders | |
| 5.2 | Audit log shows billing events | `billing.plan_upgraded` entries visible if plan was changed | |
| 5.3 | Invite unlimited members | No invite block (BUSINESS = unlimited) | |
| 5.4 | All PRO features | Work as in section 4 | |

---

## 6. Billing Lifecycle

| # | Test | Expected | Result |
|---|------|----------|--------|
| 6.1 | Visit `/settings/billing` on FREE org | Shows Free plan checklist, usage bars, "Upgrade to Pro" button | |
| 6.2 | Click "Upgrade to Pro" (Stripe test mode) | Redirects to Stripe Checkout | |
| 6.3 | Complete Stripe test checkout | Returns to `/settings/billing?success=1` with "may take a few moments" banner | |
| 6.4 | Wait 5–10 seconds, reload `/settings/billing` | Plan now shows "Pro" (webhook fired) | |
| 6.5 | Audit log shows `billing.plan_upgraded` | Entry visible to OWNER on BUSINESS, or check DB directly | |
| 6.6 | Simulate `customer.subscription.updated` with `status: past_due` | Plan reverts to FREE (verify in DB: `organization.plan = FREE`) | |
| 6.7 | Simulate `invoice.payment_failed` | Audit event `billing.payment_failed` recorded; plan unchanged | |
| 6.8 | Simulate `customer.subscription.deleted` | Plan reverts to FREE; `stripeSubscriptionId` set to null | |
| 6.9 | Cancel checkout (click "Go back") | Returns to `/settings/billing?cancelled=1` with "Checkout was cancelled" message; plan unchanged | |
| 6.10 | Visit `/settings/billing` on PRO org | Shows Pro plan features, usage bars (PRO shows members max 10), "Manage billing" button | |
| 6.11 | Click "Manage billing" on PRO org | Opens Stripe billing portal | |

---

## 7. Reports & Exports

| # | Test | Expected | Result |
|---|------|----------|--------|
| 7.1 | `/reports` on FREE org | Shows Low Stock + Stock Value cards only (no movement/bin report until data exists) | |
| 7.2 | `/reports` on PRO org with movements | Shows movement history + bin inventory cards if applicable | |
| 7.3 | Low stock report on empty catalog | "Everything is stocked" empty state | |
| 7.4 | Stock value report with stock | KPI cards + per-warehouse table | |
| 7.5 | Bin inventory report with bins | Per-warehouse → bin → items hierarchy | |
| 7.6 | Movement history with date filter | Filtered results + KPI strip update | |

---

## 8. Public Pages

| # | Test | Expected | Result |
|---|------|----------|--------|
| 8.1 | `/` landing page | All sections render, no console errors | |
| 8.2 | `/pricing` competitor table | Sortly prices shown, "Best value" badge on Pro | |
| 8.3 | `/docs` index | 7 topic cards render | |
| 8.4 | `/docs/getting-started` | Sub-page renders (Phase 14.3) | |
| 8.5 | Sitemap at `/sitemap.xml` | Returns XML with all public pages | |
| 8.6 | Robots at `/robots.txt` | Allows public pages, disallows app routes | |
| 8.7 | Social share preview (og:image) | og:image tag present in `<head>` | |

---

## 9. Offline & PWA

| # | Test | Expected | Result |
|---|------|----------|--------|
| 9.1 | Service worker registers | No console errors on first load | |
| 9.2 | Stock count while offline | Count entries queue, sync on reconnect | |
| 9.3 | Barcode scan while offline | Lookup succeeds from local cache | |

---

## 10. Security

| # | Test | Expected | Result |
|---|------|----------|--------|
| 10.1 | Access `/api/billing/webhook` without Stripe signature | Returns 400 "Missing signature" | |
| 10.2 | Access `/api/billing/webhook` with invalid signature | Returns 400 "Invalid signature" | |
| 10.3 | FREE user POST to `/api/billing/checkout` | Returns checkout URL (not plan upgrade) | |
| 10.4 | MEMBER role click "Manage billing" on billing page | Button not shown (canManageBilling = false for MEMBER) | |
| 10.5 | Cross-org data access attempt | Returns 404/403 (org-scoped queries) | |

---

## Known Limitations (Beta Notes)

- **og:image:** No custom og:image asset exists yet. Social unfurls show title/description only.
- **Docs sub-pages:** `/docs/getting-started` etc. may not exist yet (Phase 14.3).
- **Stripe env vars required:** Billing tests require `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`, `STRIPE_BUSINESS_PRICE_ID` in environment.
- **pnpm install required:** `stripe` package must be installed (`pnpm install`) before billing features compile cleanly.
- **Downgrade data:** If an org downgrades from PRO→FREE while having >100 items or >1 warehouse, existing data persists read-only. New creation blocked.

---

## Demo Flow (Founder/Investor Demo)

1. Show landing page at `/` — explain positioning vs Sortly
2. Register a new account → onboarding (5 minutes to first item)
3. Add 3 items → scan with barcode → create stock count
4. Show warehouse + bins → do a transfer between locations
5. Show purchase order → receive stock with scan
6. Show reports → stock value + movement history
7. Show `/settings/billing` — plan limits, upgrade path
8. Upgrade to Pro (Stripe test) → show feature unlock
9. Show audit log (Business plan)

**Expected demo time:** 15–20 minutes
