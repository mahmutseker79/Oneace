import { env } from "@/lib/env";
import { getMessages } from "@/lib/i18n";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "./register-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.auth.register.metaTitle };
}

export default async function RegisterPage() {
  // Phase 7C: when registration is disabled, send the user to /login.
  // This is a server-side redirect so the register page never renders
  // at all — no flash, no client JS needed. The invitation flow is
  // unaffected because invite links go through /invite/[token], not
  // /register directly (Sprint 33's `?next=` param on /register is
  // still reachable via the invite page's "Create account" CTA, but
  // that CTA is only shown when the user is unauthenticated AND has
  // a valid invite — which implies the owner already exists and
  // registration was ON when the owner was created). When registration
  // is off and a new invitee needs to create an account, the invite
  // page should direct them to login instead — see the complementary
  // gate on the API route handler.
  if (!env.REGISTRATION_ENABLED) {
    redirect("/login");
  }

  const t = await getMessages();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{t.auth.register.title}</h1>
        <p className="text-sm text-muted-foreground">{t.auth.register.subtitle}</p>
      </div>

      <RegisterForm
        labels={{
          name: t.auth.register.name,
          namePlaceholder: t.auth.register.namePlaceholder,
          organization: t.auth.register.organization,
          organizationPlaceholder: t.auth.register.organizationPlaceholder,
          email: t.auth.register.email,
          emailPlaceholder: t.auth.register.emailPlaceholder,
          password: t.auth.register.password,
          passwordPlaceholder: t.auth.register.passwordPlaceholder,
          submit: t.auth.register.submit,
          error: t.auth.register.error,
          orgError: t.auth.register.orgError,
          terms: t.auth.register.terms,
          termsLink: t.auth.register.termsLink,
          and: t.auth.register.and,
          privacyLink: t.auth.register.privacyLink,
          termsSuffix: t.auth.register.termsSuffix,
          inviteeNotice: t.auth.register.inviteeNotice,
        }}
      />

      <div className="text-center text-sm text-muted-foreground">
        {t.auth.register.haveAccount}{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t.auth.register.login}
        </Link>
      </div>
    </div>
  );
}
