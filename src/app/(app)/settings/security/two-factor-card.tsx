"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useTransition } from "react";
import { getTwoFactorStatusAction, disableTwoFactorAction } from "./actions";
import { TwoFactorSetup } from "./two-factor-setup";
import { Lock, Unlock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TwoFactorCardProps {
  userId: string;
  labels: {
    title: string;
    subtitle: string;
    enabled: string;
    disabled: string;
    enable: string;
    disable: string;
    disablingReason: string;
    step1Title: string;
    step1Description: string;
    step1ManualEntry: string;
    step1BackupCodes: string;
    step1BackupWarning: string;
    step1NextButton: string;
    step2Title: string;
    step2Description: string;
    step2CodeLabel: string;
    step2CodePlaceholder: string;
    step2VerifyButton: string;
    step3Title: string;
    step3Description: string;
    step3SuccessButton: string;
    copySuccess: string;
    disableCodeLabel: string;
    disableCodePlaceholder: string;
    disableButton: string;
    regenerateButton: string;
    regenerateSuccess: string;
    error: string;
  };
}

type ViewMode = "status" | "setup" | "disable";

export function TwoFactorCard({ userId, labels }: TwoFactorCardProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("status");
  const [isEnabled, setIsEnabled] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Check initial status
  const [statusLoaded, setStatusLoaded] = useState(false);

  if (!statusLoaded) {
    startTransition(async () => {
      try {
        const status = await getTwoFactorStatusAction();
        setIsEnabled(status.enabled);
        setStatusLoaded(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : labels.error);
        setStatusLoaded(true);
      }
    });
  }

  async function handleDisable() {
    if (!disableCode) {
      setError("Please enter your TOTP code or backup code");
      return;
    }

    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        const result = await disableTwoFactorAction(disableCode);
        if (!result) {
          setError("Invalid code. Please check and try again.");
          return;
        }

        setIsEnabled(false);
        setViewMode("status");
        setDisableCode("");
        setSuccess("2FA has been disabled");
      } catch (err) {
        setError(err instanceof Error ? err.message : labels.error);
      }
    });
  }

  if (viewMode === "setup") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{labels.title}</CardTitle>
          <CardDescription>{labels.subtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <TwoFactorSetup labels={labels} />
          <Button
            variant="ghost"
            className="w-full mt-4"
            onClick={() => {
              setViewMode("status");
              setError(null);
            }}
          >
            Cancel
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (viewMode === "disable") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{labels.disable}</CardTitle>
          <CardDescription>Enter your authenticator code to disable 2FA</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="disable-code">{labels.disableCodeLabel}</Label>
            <Input
              id="disable-code"
              type="text"
              placeholder={labels.disableCodePlaceholder}
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value)}
              disabled={isPending}
            />
          </div>

          {error ? (
            <div
              role="alert"
              className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </div>
          ) : null}

          <div className="flex gap-2">
            <Button
              onClick={handleDisable}
              disabled={isPending || !disableCode}
              variant="destructive"
              className="flex-1"
            >
              {labels.disableButton}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setViewMode("status");
                setDisableCode("");
                setError(null);
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Status view
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {isEnabled ? (
                <>
                  <Lock className="h-5 w-5 text-green-600" />
                  {labels.title}
                </>
              ) : (
                <>
                  <Unlock className="h-5 w-5 text-muted-foreground" />
                  {labels.title}
                </>
              )}
            </CardTitle>
            <CardDescription>{labels.subtitle}</CardDescription>
          </div>
          {isEnabled ? (
            <Badge variant="outline" className="text-green-600 border-green-600">
              Enabled
            </Badge>
          ) : (
            <Badge variant="outline">Disabled</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {isEnabled ? labels.enabled : labels.disablingReason}
        </p>

        {error ? (
          <div
            role="alert"
            className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </div>
        ) : null}

        {success ? (
          <div
            role="alert"
            className="rounded-md border border-green-500/50 bg-green-500/10 px-3 py-2 text-sm text-green-700"
          >
            {success}
          </div>
        ) : null}

        <div className="flex gap-2">
          {isEnabled ? (
            <Button
              variant="destructive"
              onClick={() => setViewMode("disable")}
              disabled={isPending}
            >
              {labels.disable}
            </Button>
          ) : (
            <Button onClick={() => setViewMode("setup")} disabled={isPending}>
              {labels.enable}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
