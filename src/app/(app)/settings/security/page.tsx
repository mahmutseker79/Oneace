import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";
import { TwoFactorCard } from "./two-factor-card";

export default async function SecuritySettingsPage() {
  const { session } = await requireActiveMembership();
  const t = await getMessages();

  // These labels would come from i18n, but since we haven't added them yet,
  // we'll provide defaults. In the next step, these would be replaced with
  // actual i18n values from t.settings.security.*
  const labels = {
    heading: "Security",
    subtitle: "Manage your account security settings",
    twoFactor: {
      title: "Two-Factor Authentication",
      subtitle: "Add an extra layer of security to your account",
      enabled: "2FA is enabled",
      disabled: "2FA is not enabled",
      enable: "Enable 2FA",
      disable: "Disable 2FA",
      disablingReason:
        "2FA is not currently enabled for your account. Enable it to secure your login.",
      step1Title: "Scan with authenticator app",
      step1Description:
        "Use an authenticator app like Google Authenticator, Authy, or Microsoft Authenticator to scan this code.",
      step1ManualEntry: "Or enter this code manually",
      step1BackupCodes: "Backup codes",
      step1BackupWarning:
        "Save these codes in a safe place. You can use them to access your account if you lose access to your authenticator app.",
      step1NextButton: "I've saved my codes",
      step2Title: "Verify the code",
      step2Description:
        "Enter the 6-digit code from your authenticator app to verify that 2FA is set up correctly.",
      step2CodeLabel: "Code",
      step2CodePlaceholder: "000000",
      step2VerifyButton: "Verify",
      step3Title: "2FA is now enabled",
      step3Description:
        "Your account is now protected with two-factor authentication. You will need to enter a code from your authenticator app when signing in.",
      step3SuccessButton: "Done",
      copySuccess: "Copied to clipboard",
      disableCodeLabel: "Code",
      disableCodePlaceholder: "000000 or backup code",
      disableButton: "Disable 2FA",
      regenerateButton: "Regenerate codes",
      regenerateSuccess: "Backup codes regenerated",
      error: "An error occurred. Please try again.",
    },
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{labels.heading}</h1>
        <p className="text-muted-foreground">{labels.subtitle}</p>
      </div>

      <div className="max-w-2xl">
        <TwoFactorCard userId={session.user.id} labels={labels.twoFactor} />
      </div>
    </div>
  );
}
