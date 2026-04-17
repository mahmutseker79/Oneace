import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Integrations",
};

/**
 * Legacy redirect: /settings/integrations → /integrations
 * Integrations now has its own standalone section in the main navigation.
 */
export default function SettingsIntegrationsRedirect() {
  redirect("/integrations");
}
