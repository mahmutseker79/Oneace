// Phase 4.1 — Multi-step onboarding wizard page.
// God-Mode Design v1 — Premium onboarding with visual guidance.

import type { Metadata } from "next";

import { db } from "@/lib/db";
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg">
        {/* Brand header */}
        <div className="mb-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-lg font-bold shadow-sm mb-4">
            O
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Welcome to OneAce</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Let&apos;s get your workspace set up in under a minute.
          </p>
        </div>

        {/* Premium card wrapper */}
        <div className="rounded-2xl border bg-card p-6 sm:p-8 shadow-[var(--shadow-elevated)]">
          <OnboardingForm labels={{}} />
        </div>

        {/* Trust signals */}
        <div className="mt-6 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
          <span>256-bit encryption</span>
          <span className="text-border">•</span>
          <span>No credit card required</span>
          <span className="text-border">•</span>
          <span>Free forever plan</span>
        </div>
      </div>
    </div>
  );
}
