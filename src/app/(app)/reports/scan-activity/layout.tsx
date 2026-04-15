// Metadata for the client-rendered scan-activity report.
// The page itself is "use client" (Dexie-backed), so metadata
// lives here in the layout instead.
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Scan activity — Reports — OneAce",
};

export default function ScanActivityLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
