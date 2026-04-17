// Create kit page
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createKitAction } from "../actions";

export default function NewKitPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = await createKitAction(formData);

    if (result.ok) {
      router.push(`/kits/${result.id}`);
    } else {
      setError(result.error);
    }
    setIsLoading(false);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-3xl font-bold">Create Kit</h1>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white rounded-lg border p-6">
        {error && (
          <div className="rounded bg-destructive-light p-4 text-sm text-destructive">{error}</div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Parent Item *</label>
          <Input name="parentItemId" placeholder="Item ID" required />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Kit Name *</label>
          <Input name="name" placeholder="e.g., Premium Bundle" required />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Type *</label>
          <select name="type" defaultValue="KIT" className="w-full px-3 py-2 border rounded-md">
            <option value="BUNDLE">Bundle</option>
            <option value="KIT">Kit</option>
            <option value="ASSEMBLY">Assembly</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <Textarea name="description" placeholder="Kit description..." rows={4} />
        </div>

        <div className="flex gap-4">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Creating..." : "Create Kit"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
