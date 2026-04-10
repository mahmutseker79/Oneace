import { getMessages } from "@/lib/i18n";
import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.auth.login.metaTitle };
}

export default async function LoginPage() {
  const t = await getMessages();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{t.auth.login.title}</h1>
        <p className="text-sm text-muted-foreground">{t.auth.login.subtitle}</p>
      </div>

      <LoginForm
        labels={{
          email: t.auth.login.email,
          emailPlaceholder: t.auth.login.emailPlaceholder,
          password: t.auth.login.password,
          passwordPlaceholder: t.auth.login.passwordPlaceholder,
          forgot: t.auth.login.forgot,
          submit: t.auth.login.submit,
          error: t.auth.login.error,
        }}
      />

      <div className="text-center text-sm text-muted-foreground">
        {t.auth.login.noAccount}{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">
          {t.auth.login.register}
        </Link>
      </div>
    </div>
  );
}
