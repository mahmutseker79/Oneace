// Phase 4.1 — Multi-step onboarding wizard page.
// The single org-name form is replaced by a 3-step wizard (OnboardingForm).
// Route protection and existing-membership redirect are unchanged.

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
    <div className="mx-auto max-w-md py-12">
      <div className="mb-6 space-y-1">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary font-bold text-primary-foreground">
            O
          </div>
          <span className="text-lg font-semibold">OneAce</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Let&apos;s get your workspace set up in under a minute.
        </p>
      </div>

      {/* OnboardingForm manages its own step/label state internally */}
      <OnboardingForm labels={{}} />
    </div>
  );
}
