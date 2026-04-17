"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Copy, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import {
  enableTwoFactorAction,

  verifyAndActivateTwoFactorAction,
} from "./actions";

interface TwoFactorSetupProps {
  labels: {
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
    error: string;
  };
}

type SetupStep = "step1" | "step2" | "step3";

export function TwoFactorSetup({ labels }: TwoFactorSetupProps) {
  const [step, setStep] = useState<SetupStep>("step1");
  const [secret, setSecret] = useState<string>("");
  const [, setUri] = useState<string>("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleStep1() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await enableTwoFactorAction();
        setSecret(result.secret);
        setUri(result.uri);
        setBackupCodes(result.backupCodes);
        setStep("step2");
      } catch (err) {
        setError(err instanceof Error ? err.message : labels.error);
      }
    });
  }

  async function handleStep2() {
    if (!code) {
      setError("Please enter the 6-digit code from your authenticator app");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const verified = await verifyAndActivateTwoFactorAction(code);
        if (!verified) {
          setError("Invalid code. Please check your authenticator app and try again.");
          return;
        }
        setStep("step3");
      } catch (err) {
        setError(err instanceof Error ? err.message : labels.error);
      }
    });
  }

  async function copyToClipboard(text: string, index: number) {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  }

  if (step === "step1") {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">{labels.step1Title}</h3>
          <p className="text-sm text-muted-foreground">{labels.step1Description}</p>
        </div>

        <div className="space-y-2">
          <Label>{labels.step1ManualEntry}</Label>
          <div className="rounded-md bg-muted p-4 font-mono text-sm break-all">{secret}</div>
        </div>

        {error ? (
          <div
            role="alert"
            className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </div>
        ) : null}

        <Button onClick={handleStep1} disabled={isPending} className="w-full">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {labels.step1NextButton}
        </Button>
      </div>
    );
  }

  if (step === "step2") {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">{labels.step2Title}</h3>
          <p className="text-sm text-muted-foreground">{labels.step2Description}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="totp-code">{labels.step2CodeLabel}</Label>
          <Input
            id="totp-code"
            type="text"
            inputMode="numeric"
            placeholder={labels.step2CodePlaceholder}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            maxLength={6}
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

        <Button onClick={handleStep2} disabled={isPending || code.length !== 6} className="w-full">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {labels.step2VerifyButton}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">{labels.step3Title}</h3>
        <p className="text-sm text-muted-foreground">{labels.step3Description}</p>
      </div>

      <div className="space-y-2">
        <Label>{labels.step1BackupCodes}</Label>
        <p className="text-xs text-muted-foreground">{labels.step1BackupWarning}</p>
        <div className="grid gap-2 max-h-64 overflow-y-auto rounded-md border p-4 bg-muted">
          {backupCodes.map((code, index) => (
            <div key={index} className="flex items-center justify-between gap-2 font-mono text-sm">
              <span>{code}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(code, index)}
                className="text-muted-foreground hover:text-foreground"
                title={labels.copySuccess}
              >
                {copiedIndex === index ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      <Button onClick={() => setStep("step1")} className="w-full" variant="outline">
        Done
      </Button>
    </div>
  );
}
