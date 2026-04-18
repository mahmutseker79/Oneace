// Phase 4.1 — Multi-step onboarding wizard page.
// God-Mode Design v1 — Premium onboarding with visual guidance.
//
// God-Mode v2 §4 — Phase 4 — page chrome copy moved into the i18n
// catalog (`auth.onboarding.wizard`). Before this change the page
// rendered "Welcome to OneAce" + the trust signals as string literals
// and called `<OnboardingForm labels={{}} />` with an empty labels
// object, making the README's multilingual claim hollow for anyone
// who landed on the onboarding screen. Catalog-sourced strings keep
// a new locale from silently falling back to English here.

import type { Metadata } from "next";

import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { requireSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = {
  title: "Set up your workspace — OneAce",
};

export default async function OnboardingPage() {
  const session = await requireSession();

  // If the user already has a membership, send them straight to the dashboard.
  const existing = await db.membership.findFirst({
    where: { userId: session.user.id },
  });
  if (existing) {
    redirect("/dashboard");
  }

  const t = await getMessages();
  const wizard = t.auth.onboarding.wizard;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg">
        {/* Brand header */}
        <div className="mb-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-lg font-bold shadow-sm mb-4">
            O
          </div>
          <h1 className="text-xl font-semibold tracking-tight">{wizard.welcomeTitle}</h1>
          <p className="text-sm text-muted-foreground mt-1">{wizard.welcomeSubtitle}</p>
        </div>

        {/* Premium card wrapper */}
        <div className="rounded-2xl border bg-card p-6 sm:p-8 shadow-[var(--shadow-elevated)]">
          <OnboardingForm labels={{}} />
        </div>

        {/* Trust signals */}
        <div className="mt-6 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
          <span>{wizard.trustEncryption}</span>
          <span className="text-border">•</span>
          <span>{wizard.trustNoCard}</span>
          <span className="text-border">•</span>
          <span>{wizard.trustFreePlan}</span>
        </div>
      </div>
    </div>
  );
}
