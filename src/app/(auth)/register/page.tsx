import { getMessages } from "@/lib/i18n";
import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "./register-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.auth.register.metaTitle };
}

export default async function RegisterPage() {
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
