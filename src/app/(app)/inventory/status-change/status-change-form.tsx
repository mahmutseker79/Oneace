"use client";

import { Button } from "@/components/ui/button";
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
import { ArrowRight } from "lucide-react";
import { useActionState, useEffect } from "react";
import { useForm } from "react-hook-form";

import type { ReasonCategory } from "@/generated/prisma";
import {
  type ChangeStockStatusInput,
  changeStockStatusSchema,
  stockStatusEnum,
} from "@/lib/validation/stock-status";
import { changeStockStatusAction } from "./actions";

type StatusChangeFormProps = {
  items: Array<{ id: string; label: string }>;
  warehouses: Array<{ id: string; label: string }>;
  reasonCodes: Array<{ id: string; label: string; category: ReasonCategory }>;
};

export function StatusChangeForm({ items, warehouses, reasonCodes }: StatusChangeFormProps) {
  const form = useForm({
    resolver: zodResolver(changeStockStatusSchema),
    defaultValues: {
      itemId: "",
      warehouseId: "",
      binId: null,
      fromStatus: "AVAILABLE" as const,
      toStatus: "DAMAGED" as const,
      quantity: 0,
      reasonCodeId: "",
      note: "",
    },
  });

  const [state, formAction, isPending] = useActionState(
    (prevState: unknown, formData: FormData) =>
      changeStockStatusAction(Object.fromEntries(formData)),
    { ok: false, error: "" },
  );

  useEffect(() => {
    if (state.ok) {
      form.reset();
    }
  }, [state.ok, form]);

  useEffect(() => {
    if (state.ok === false && state.fieldErrors) {
      for (const [key, errors] of Object.entries(state.fieldErrors)) {
        const fieldKey = key as
          | "itemId"
          | "warehouseId"
          | "binId"
          | "fromStatus"
          | "toStatus"
          | "quantity"
          | "reasonCodeId"
          | "note";
        form.setError(fieldKey, { message: errors?.[0] ?? "" });
      }
    }
  }, [state, form]);

  async function onSubmit(data: ChangeStockStatusInput) {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== "") {
        formData.append(key, String(value));
      }
    });
    await formAction(formData);
  }

  const statusOptions = stockStatusEnum.options;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <FormField
          control={form.control}
          name="itemId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Item</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger disabled={isPending}>
                    <SelectValue placeholder="Select an item" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.label}
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
          name="warehouseId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Warehouse</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger disabled={isPending}>
                    <SelectValue placeholder="Select a warehouse" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="rounded-lg border border-dashed border-info bg-info-light p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <FormField
              control={form.control}
              name="fromStatus"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">From Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger disabled={isPending} className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {statusOptions.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <ArrowRight className="h-5 w-5 text-info mt-6" />

          <div className="flex-1">
            <FormField
              control={form.control}
              name="toStatus"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm">To Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger disabled={isPending} className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {statusOptions.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
      </div>

      <FormField
        control={form.control}
        name="quantity"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Quantity to Move</FormLabel>
            <FormControl>
              <Input type="number" placeholder="0" {...field} disabled={isPending} />
            </FormControl>
            <FormDescription>Number of units to change status</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="reasonCodeId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Reason Code</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger disabled={isPending}>
                  <SelectValue placeholder="Select a reason code" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {reasonCodes.map((code) => (
                  <SelectItem key={code.id} value={code.id}>
                    {code.label} ({code.category})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormDescription>Reason for the status change</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="note"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Notes (Optional)</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Additional details about this status change"
                className="resize-none"
                disabled={isPending}
                {...field}
              />
            </FormControl>
            <FormDescription>Additional context (max 1000 characters)</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {state.ok === false && state.error && (
        <div className="rounded-md bg-destructive-light p-3 text-sm text-destructive">
          {state.error}
        </div>
      )}

      {state.ok === true && (
        <div className="rounded-md bg-success-light p-3 text-sm text-success">
          Stock status changed successfully! ({state.updatedQuantity} units)
        </div>
      )}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Processing..." : "Change Stock Status"}
      </Button>
      </form>
    </Form>
  );
}
