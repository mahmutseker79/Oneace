import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { requireSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const session = await requireSession();
  const t = await getMessages();

  // If the user already has a membership, send them straight to the dashboard.
  const existing = await db.membership.findFirst({
    where: { userId: session.user.id },
  });
  if (existing) {
    redirect("/dashboard");
  }

  return (
    <div className="max-w-md mx-auto py-12">
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">{t.auth.onboarding.title}</h1>
          <p className="text-sm text-muted-foreground">{t.auth.onboarding.subtitle}</p>
        </div>
        <OnboardingForm
          labels={{
            label: t.auth.onboarding.organizationLabel,
            placeholder: t.auth.onboarding.organizationPlaceholder,
            helper: t.auth.onboarding.helper,
            submit: t.auth.onboarding.submit,
            error: t.auth.onboarding.error,
          }}
        />
      </div>
    </div>
  );
}
