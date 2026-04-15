"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOut } from "better-auth/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type DeleteAccountFormProps = {
  isDisabled?: boolean;
  labels: {
    confirmPhrase: string;
    confirmPlaceholder: string;
    button: string;
    cancel: string;
  };
};

const CONFIRMATION_PHRASE = "DELETE MY ACCOUNT";

export function DeleteAccountForm({ isDisabled = false, labels }: DeleteAccountFormProps) {
  const router = useRouter();
  const [phrase, setPhrase] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const isConfirmed = phrase === CONFIRMATION_PHRASE;

  const handleDelete = async () => {
    if (!isConfirmed) {
      toast.error("Please type the confirmation phrase correctly");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: CONFIRMATION_PHRASE }),
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || "Failed to delete account");
        setIsLoading(false);
        return;
      }

      toast.success("Account deleted successfully");

      // Sign out and redirect
      await signOut();
      router.push("/login");
    } catch (err) {
      console.error("Delete account error:", err);
      toast.error("An error occurred while deleting your account");
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="delete-confirmation">{labels.confirmPhrase}</Label>
        <Input
          id="delete-confirmation"
          type="text"
          placeholder={labels.confirmPlaceholder}
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          disabled={isDisabled || isLoading}
          className="mt-2"
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Type <span className="font-mono font-semibold">{CONFIRMATION_PHRASE}</span> to confirm
        </p>
      </div>

      <div className="flex gap-3">
        <Button
          variant="destructive"
          onClick={handleDelete}
          disabled={!isConfirmed || isDisabled || isLoading}
          loading={isLoading}
        >
          {isLoading ? "Deleting..." : labels.button}
        </Button>
        <Button
          variant="outline"
          onClick={() => setPhrase("")}
          disabled={isLoading}
        >
          {labels.cancel}
        </Button>
      </div>
    </div>
  );
}
