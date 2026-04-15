import { getMessages } from "@/lib/i18n";
import Link from "next/link";

export default async function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const t = await getMessages();
  const headlineLines = t.auth.brand.headline.split("\n");

  return (
    <div className="min-h-screen flex">
      {/* Left: brand panel — premium gradient with depth */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-1/2 flex-col justify-between p-10 xl:p-14 relative overflow-hidden" style={{ background: "var(--gradient-primary)" }}>
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "40px 40px" }} />

        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-white text-lg font-bold backdrop-blur-sm border border-white/10 group-hover:bg-white/20 transition-colors">
              O
            </div>
            <span className="text-xl font-semibold text-white tracking-tight">{t.app.name}</span>
          </Link>
        </div>

        <div className="relative z-10 space-y-6">
          <h1 className="text-3xl xl:text-4xl font-semibold text-white leading-tight tracking-tight">
            {headlineLines.map((line, idx) => (
              <span key={line} className="block">
                {line}
                {idx < headlineLines.length - 1 ? <br /> : null}
              </span>
            ))}
          </h1>
          <p className="text-white/70 max-w-md text-base leading-relaxed">{t.auth.brand.subhead}</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/60">
            <span className="flex items-center gap-1.5">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[10px]">✓</span>
              {t.auth.brand.featureOffline}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[10px]">✓</span>
              {t.auth.brand.featureBarcodes}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[10px]">✓</span>
              {t.auth.brand.featureI18n}
            </span>
          </div>
        </div>

        <div className="relative z-10 text-xs text-white/40">
          © {new Date().getFullYear()} {t.app.name}. {t.auth.brand.rights}
        </div>
      </div>

      {/* Right: form area — clean, centered */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-10 xl:p-16 bg-background">
        <div className="w-full max-w-[420px]">{children}</div>
      </div>
    </div>
  );
}
