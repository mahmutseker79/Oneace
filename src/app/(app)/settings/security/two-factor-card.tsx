"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AnalyticsEvents } from "@/lib/analytics/events";
import { track } from "@/lib/instrumentation";
import { Lock, RefreshCw, Unlock } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import {
  disableTwoFactorAction,
  getTwoFactorStatusAction,
  regenerateBackupCodesAction,
} from "./actions";
import { TwoFactorSetup } from "./two-factor-setup";

// v1.3 §5.54 F-10 — recovery-code rotation advised window.
// After this many days the UI surfaces a "Refresh your recovery codes"
// banner so users act on a predictable cadence rather than
// remembering on their own. Kept as a named constant so the pinned
// test can assert the cadence without binding to a magic number.
const ROTATION_ADVISED_AFTER_DAYS = 365;

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

type ViewMode = "status" | "setup" | "disable" | "regenerate";

export function TwoFactorCard({ userId: _userId, labels }: TwoFactorCardProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("status");
  const [isEnabled, setIsEnabled] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  // v1.3 §5.54 F-10 — rotation flow state.
  // `regenerateCode` is the TOTP input in the rotate form.
  // `newRecoveryCodes` is populated ONLY on success and rendered
  // one-time — we never store these in any state that survives the
  // view switch, so a user who navigates away cannot re-read the
  // codes (they have to write them down from this single render).
  const [regenerateCode, setRegenerateCode] = useState("");
  const [newRecoveryCodes, setNewRecoveryCodes] = useState<string[] | null>(null);
  // `createdAt` drives the rotation-advised banner so a user sees the
  // prompt without us having to run a separate query. Populated
  // alongside `isEnabled` on mount.
  const [createdAt, setCreatedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Check initial status
  const [statusLoaded, setStatusLoaded] = useState(false);

  // Load 2FA status once on mount.
  // IMPORTANT: Do NOT call startTransition during render — that causes React
  // error #419 ("suspended input") because the async setState fires while
  // React is still committing, creating an infinite re-render loop.
  //
  // `labels.error` is derived from static i18n at build time — the
  // reference is stable across renders so re-running the effect would
  // be a wasteful refetch. The directives below suppress both Biome
  // and react-hooks' exhaustive-deps warnings for this one effect.
  // biome-ignore lint/correctness/useExhaustiveDependencies: i18n label object is stable, effect must run once on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await getTwoFactorStatusAction();
        if (cancelled) return;
        setIsEnabled(status.enabled);
        setCreatedAt(status.createdAt ? new Date(status.createdAt) : null);
        setStatusLoaded(true);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : labels.error);
        setStatusLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // v1.3 §5.54 F-10 — rotation-advised window check.
  // Returns true when the setup is old enough that we should prompt
  // the user to rotate. Computed off `createdAt` (setup timestamp)
  // rather than verifiedAt so a disabled-and-re-enabled account
  // still gets a fresh clock. Returns false when createdAt is null
  // so the first-mount skeleton doesn't flash the banner.
  function isRotationAdvised(): boolean {
    if (!createdAt) return false;
    const ageMs = Date.now() - createdAt.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    return ageDays >= ROTATION_ADVISED_AFTER_DAYS;
  }

  async function handleRegenerate() {
    if (!regenerateCode) {
      setError("Please enter your TOTP code");
      return;
    }
    setError(null);
    setSuccess(null);
    // Remember whether we entered this flow via the banner (advised)
    // or via the manual button. Captured BEFORE the async call so the
    // track() payload reflects the user's intent at click time, not
    // the state after rotation (which clears the banner).
    const source: "advised" | "manual" = isRotationAdvised() ? "advised" : "manual";

    startTransition(async () => {
      try {
        const result = await regenerateBackupCodesAction(regenerateCode);
        if (!result) {
          setError("Invalid TOTP code. Please check and try again.");
          return;
        }
        // v1.3 §5.54 F-10 — rotation visibility event.
        // Fires AFTER the server confirms the rotation wrote, so a
        // failed verify doesn't inflate the success counter. Payload
        // is intentionally minimal — no codes, no userId (posthog
        // attaches distinct_id for signed-in users automatically).
        track(AnalyticsEvents.RECOVERY_CODES_ROTATED, {
          codesIssued: result.length,
          source,
        });
        setNewRecoveryCodes(result);
        setRegenerateCode("");
        // Reset createdAt so the advised banner stops showing
        // immediately — the server will return the fresh createdAt
        // next mount, but this gives correct optimistic UI.
        setCreatedAt(new Date());
      } catch (err) {
        setError(err instanceof Error ? err.message : labels.error);
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

  if (viewMode === "regenerate") {
    // v1.3 §5.54 F-10 — rotation flow view. Two states sharing one
    // render: (a) input the TOTP code, (b) one-time display of the
    // new codes after success. We split by `newRecoveryCodes !== null`
    // rather than pushing to a new viewMode so the user can't route
    // back to the TOTP input after seeing the codes (which would
    // otherwise let them re-render the same codes from state).
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" /> {labels.regenerateButton}
          </CardTitle>
          <CardDescription>
            Rotating invalidates your existing recovery codes. Save the new codes somewhere safe —
            you won't see them again.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {newRecoveryCodes ? (
            <>
              <output className="block rounded-md border border-success/50 bg-success/10 px-3 py-2 text-sm text-success">
                {labels.regenerateSuccess}
              </output>
              <div
                data-testid="new-recovery-codes"
                className="rounded-md border bg-muted/50 px-3 py-3 font-mono text-sm"
              >
                <ul className="grid grid-cols-2 gap-1">
                  {newRecoveryCodes.map((code) => (
                    <li key={code}>{code}</li>
                  ))}
                </ul>
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  // Clear the codes from state before leaving so they
                  // can't be recovered via back/forward browser nav.
                  setNewRecoveryCodes(null);
                  setViewMode("status");
                  setSuccess(labels.regenerateSuccess);
                }}
              >
                Done — I've saved these codes
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="regenerate-code">{labels.disableCodeLabel}</Label>
                <Input
                  id="regenerate-code"
                  type="text"
                  inputMode="numeric"
                  placeholder={labels.disableCodePlaceholder}
                  value={regenerateCode}
                  onChange={(e) => setRegenerateCode(e.target.value)}
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
                  onClick={handleRegenerate}
                  disabled={isPending || !regenerateCode}
                  className="flex-1"
                >
                  {labels.regenerateButton}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setViewMode("status");
                    setRegenerateCode("");
                    setError(null);
                  }}
                  disabled={isPending}
                >
                  Cancel
                </Button>
              </div>
            </>
          )}
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
                  <Lock className="h-5 w-5 text-success" />
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
            <Badge variant="outline" className="text-success border-success">
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
            className="rounded-md border border-success/50 bg-success/10 px-3 py-2 text-sm text-success"
          >
            {success}
          </div>
        ) : null}

        {/*
          v1.3 §5.54 F-10 — rotation-advised banner.
          Renders only when 2FA is on AND setup is older than the
          ROTATION_ADVISED_AFTER_DAYS window. Stays out of the way
          for freshly-enabled setups so we're not nagging users on
          day one; the moment they cross the window the banner
          surfaces and the "Regenerate backup codes" CTA below
          inherits the attention.
         */}
        {isEnabled && isRotationAdvised() ? (
          <output
            data-testid="rotation-advised-banner"
            className="block rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning-foreground"
          >
            Your recovery codes are over a year old. Rotate them to keep account recovery safe.
          </output>
        ) : null}

        <div className="flex gap-2 flex-wrap">
          {isEnabled ? (
            <>
              <Button
                variant="destructive"
                onClick={() => setViewMode("disable")}
                disabled={isPending}
              >
                {labels.disable}
              </Button>
              {/*
                v1.3 §5.54 F-10 — regenerate CTA. Always rendered
                when 2FA is on, even before the advised banner kicks
                in — a user who knows their codes are compromised
                must be able to rotate immediately, not just after
                the 365-day window.
               */}
              <Button
                variant="outline"
                data-testid="regenerate-backup-codes-button"
                onClick={() => {
                  setViewMode("regenerate");
                  setError(null);
                  setSuccess(null);
                }}
                disabled={isPending}
              >
                <RefreshCw className="h-4 w-4 mr-1" /> {labels.regenerateButton}
              </Button>
            </>
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
