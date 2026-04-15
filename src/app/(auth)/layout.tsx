import { getMessages } from "@/lib/i18n";
import Link from "next/link";

export default async function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const t = await getMessages();
  const headlineLines = t.auth.brand.headline.split("\n");

  return (
    <div className="min-h-screen flex">
      {/* Left: brand panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-primary text-primary-foreground p-12">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-foreground/20 text-xl font-bold">
            O
          </div>
          <span className="text-2xl font-semibold">{t.app.name}</span>
        </Link>
        <div className="space-y-6">
          <h1 className="text-4xl font-semibold leading-tight">
            {headlineLines.map((line, idx) => (
              <span key={line} className="block">
                {line}
                {idx < headlineLines.length - 1 ? <br /> : null}
              </span>
            ))}
          </h1>
          <p className="text-primary-foreground/80 max-w-md">{t.auth.brand.subhead}</p>
          <div className="flex gap-4 text-sm text-primary-foreground/70">
            <span>✓ {t.auth.brand.featureOffline}</span>
            <span>✓ {t.auth.brand.featureBarcodes}</span>
            <span>✓ {t.auth.brand.featureI18n}</span>
          </div>
        </div>
        <div className="text-sm text-primary-foreground/60">
          © {new Date().getFullYear()} {t.app.name}. {t.auth.brand.rights}
        </div>
      </div>

      {/* Right: form area */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
