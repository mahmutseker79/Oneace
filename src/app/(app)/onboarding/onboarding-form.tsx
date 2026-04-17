"use client";

// Phase 4.1 — Multi-step onboarding wizard.
//
// Replaces the single-field org-name form with a 3-step flow:
//   Step 1: Name your workspace (existing org creation API)
//   Step 2: What do you primarily track? (contextual, no DB write)
//   Step 3: Invite your team (optional, uses invitation API)
//
// Design rules:
//   - Step 2 and 3 can be skipped without consequence.
//   - Org is created at step 1; subsequent steps are additive.
//   - All steps show a visual progress indicator.
//   - "Skip" is always visible on steps 2 and 3.

import {
  Box,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Package,
  ShoppingBag,
  Truck,
  Utensils,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ---------------------------------------------------------------------------
// Types + constants
// ---------------------------------------------------------------------------

type TrackType = "electronics" | "food" | "clothing" | "general" | "manufacturing" | null;

const TRACK_OPTIONS: Array<{
  id: TrackType & string;
  label: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: "general",
    label: "General merchandise",
    description: "Mixed products, retail, or anything else",
    Icon: Package,
  },
  {
    id: "electronics",
    label: "Electronics & hardware",
    description: "Components, devices, parts",
    Icon: Box,
  },
  {
    id: "food",
    label: "Food & beverage",
    description: "Perishables, dry goods, ingredients",
    Icon: Utensils,
  },
  {
    id: "clothing",
    label: "Clothing & apparel",
    description: "Garments, accessories, textiles",
    Icon: ShoppingBag,
  },
  {
    id: "manufacturing",
    label: "Manufacturing / raw materials",
    description: "Components, assemblies, work-in-progress",
    Icon: Truck,
  },
];

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------

function StepProgress({ current, total }: { current: number; total: number }) {
  return (
    <div className="mb-8 space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Step {current} of {total}
        </span>
        <span>{Math.round((current / total) * 100)}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${(current / total) * 100}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Org name
// ---------------------------------------------------------------------------

function Step1({
  onSuccess,
}: {
  onSuccess: (orgId: string, orgName: string) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await fetch("/api/onboarding/organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        setError(body.message ?? "Failed to create workspace. Please try again.");
        return;
      }

      const data = (await res.json()) as {
        organization?: { id: string; name: string };
      };
      onSuccess(data.organization?.id ?? "", name);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Name your workspace</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This is how your team will identify your organization in OneAce.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="org-name">Workspace name</Label>
          <Input
            id="org-name"
            type="text"
            placeholder="e.g. Acme Warehouse, Main Store, My Business"
            required
            minLength={2}
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Can be your company name, store name, or any label that makes sense for your team.
          </p>
        </div>

        {error ? (
          <div
            role="alert"
            className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </div>
        ) : null}
      </div>

      <Button type="submit" className="w-full" disabled={isPending || name.trim().length < 2}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Continue
        <ChevronRight className="h-4 w-4" />
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Track type
// ---------------------------------------------------------------------------

function Step2({
  onContinue,
  onSkip,
}: {
  onContinue: (trackType: TrackType) => void;
  onSkip: () => void;
}) {
  const [selected, setSelected] = useState<TrackType>(null);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">What do you primarily track?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Helps us tailor suggestions to your workflow. You can change this later.
        </p>
      </div>

      <div className="grid gap-2">
        {TRACK_OPTIONS.map((opt) => {
          const Icon = opt.Icon;
          const isSelected = selected === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSelected(isSelected ? null : opt.id)}
              className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                isSelected
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-border hover:border-foreground/30 hover:bg-accent/30"
              }`}
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                  isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <span className="font-medium">{opt.label}</span>
                <span className="ml-2 text-xs text-muted-foreground">{opt.description}</span>
              </div>
              {isSelected ? <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /> : null}
            </button>
          );
        })}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onSkip}>
          Skip for now
        </Button>
        <Button
          className="flex-1"
          disabled={!selected}
          onClick={() => selected && onContinue(selected)}
        >
          Continue
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Invite team
// ---------------------------------------------------------------------------

function Step3({
  orgName,
  onFinish,
}: {
  orgName: string;
  onFinish: () => void;
}) {
  const [emails, setEmails] = useState("");
  const [isPending, startTransition] = useTransition();
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSent, setInviteSent] = useState(false);

  function handleInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setInviteError(null);

    const emailList = emails
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (emailList.length === 0) {
      onFinish();
      return;
    }

    startTransition(async () => {
      // Fire invitations in parallel — best-effort.
      // Failures are noted but don't block finishing onboarding.
      const results = await Promise.allSettled(
        emailList.map((email) =>
          fetch("/api/invitations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, role: "MEMBER" }),
          }),
        ),
      );
      const anyFailed = results.some((r) => r.status === "rejected");
      if (anyFailed) {
        setInviteError(
          "Some invitations could not be sent. You can invite teammates later from Settings → Members.",
        );
      }
      setInviteSent(true);
    });
  }

  if (inviteSent) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
            <CheckCircle2 className="h-6 w-6 text-success" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">{orgName} is ready!</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Invitations sent. Your teammates will receive an email with a link to join.
            </p>
          </div>
          {inviteError ? <p className="text-xs text-warning">{inviteError}</p> : null}
        </div>
        <Button className="w-full" onClick={onFinish}>
          Open your dashboard
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleInvite} className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Invite your team</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add teammates to <strong>{orgName}</strong>. Separate multiple emails with commas.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="invite-emails">Email addresses</Label>
        <Input
          id="invite-emails"
          type="text"
          placeholder="alice@company.com, bob@company.com"
          value={emails}
          onChange={(e) => setEmails(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Teammates will be invited as Members. You can adjust roles in Settings → Members.
        </p>
      </div>

      {inviteError ? <p className="text-xs text-warning">{inviteError}</p> : null}

      <div className="flex gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={onFinish}>
          Skip for now
        </Button>
        <Button type="submit" className="flex-1" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {emails.trim() ? "Send invites" : "Finish setup"}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main wizard component
// ---------------------------------------------------------------------------

export function OnboardingForm(_props: { labels: unknown }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [, setOrgId] = useState("");
  const [orgName, setOrgName] = useState("");

  function finish() {
    router.push("/items");
    router.refresh();
  }

  return (
    <div>
      <StepProgress current={step} total={3} />

      {step === 1 && (
        <Step1
          onSuccess={(id, name) => {
            setOrgId(id);
            setOrgName(name);
            setStep(2);
          }}
        />
      )}

      {step === 2 && (
        <Step2
          onContinue={(_trackType) => {
            // Track type stored client-side; no DB write needed for now.
            setStep(3);
          }}
          onSkip={() => setStep(3)}
        />
      )}

      {step === 3 && <Step3 orgName={orgName} onFinish={finish} />}
    </div>
  );
}
