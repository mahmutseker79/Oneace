-- Phase 12.3 — Stripe billing foundation
-- Adds stripeCustomerId and stripeSubscriptionId to Organization.
-- Both are nullable (no Stripe customer until org initiates checkout).
-- Both are unique so a rogue duplicate webhook can't overwrite two orgs.

ALTER TABLE "Organization"
  ADD COLUMN "stripeCustomerId" TEXT,
  ADD COLUMN "stripeSubscriptionId" TEXT;

CREATE UNIQUE INDEX "Organization_stripeCustomerId_key"
  ON "Organization"("stripeCustomerId");

CREATE UNIQUE INDEX "Organization_stripeSubscriptionId_key"
  ON "Organization"("stripeSubscriptionId");
