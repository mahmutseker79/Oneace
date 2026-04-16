"use client";

import { useActionState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import type { ReasonCode } from "@/generated/prisma";
import {
  type CreateReasonCodeInput,
  createReasonCodeSchema,
  reasonCategoryEnum,
  updateReasonCodeSchema,
} from "@/lib/validation/reason-code";
import { createReasonCodeAction, updateReasonCodeAction } from "./actions";

type ReasonCodeFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reasonCode?: ReasonCode | null;
};

export function ReasonCodeForm({ open, onOpenChange, reasonCode }: ReasonCodeFormProps) {
  const isEditing = Boolean(reasonCode);
  const schema = isEditing ? updateReasonCodeSchema : createReasonCodeSchema;

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: reasonCode
      ? {
          code: reasonCode.code,
          name: reasonCode.name,
          category: reasonCode.category,
          description: reasonCode.description ?? "",
        }
      : {
          code: "",
          name: "",
          category: "VARIANCE" as const,
          description: "",
        },
  });

  const [state, formAction, isPending] = useActionState(
    isEditing
      ? (prevState: unknown, formData: FormData) =>
          updateReasonCodeAction(reasonCode?.id, Object.fromEntries(formData))
      : (prevState: unknown, formData: FormData) =>
          createReasonCodeAction(Object.fromEntries(formData)),
    { ok: false, error: "" },
  );

  useEffect(() => {
    if (state.ok) {
      form.reset();
      onOpenChange(false);
    }
  }, [state.ok, form, onOpenChange]);

  useEffect(() => {
    if (state.ok === false && state.fieldErrors) {
      for (const [key, errors] of Object.entries(state.fieldErrors)) {
        const fieldKey = key as "code" | "name" | "category" | "description";
        form.setError(fieldKey, { message: errors?.[0] ?? "" });
      }
    }
  }, [state, form]);

  async function onSubmit(data: unknown) {
    const formData = new FormData();
    Object.entries(data as Record<string, string>).forEach(([key, value]) => {
      formData.append(key, value);
    });
    await formAction(formData);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Reason Code" : "Add Reason Code"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the reason code details"
              : "Create a new reason code for your organization"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Code</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., DMG" {...field} disabled={isPending || isEditing} />
                </FormControl>
                <FormDescription>1-20 uppercase alphanumeric characters</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Damage" {...field} disabled={isPending} />
                </FormControl>
                <FormDescription>Human-readable name for this code</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger disabled={isPending}>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {reasonCategoryEnum.options.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description (Optional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Additional details about this reason code"
                    className="resize-none"
                    disabled={isPending}
                    {...field}
                  />
                </FormControl>
                <FormDescription>Up to 500 characters</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {state.ok === false && state.error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-900">{state.error}</div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : isEditing ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
