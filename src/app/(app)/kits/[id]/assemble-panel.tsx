"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { assembleKitAction, disassembleKitAction } from "../actions";

interface Props {
  kitId: string;
  kitName: string;
  warehouses: Array<{ id: string; name: string; code: string }>;
  canAssemble: boolean;
  canDisassemble: boolean;
}

export function AssembleDisassemblePanel({
  kitId,
  kitName,
  warehouses,
  canAssemble,
  canDisassemble,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleAssemble(formData: FormData) {
    formData.set("kitId", kitId);
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await assembleKitAction(formData);
      if (result.ok) {
        setSuccess(`Successfully assembled ${formData.get("quantity")} kit(s)`);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function handleDisassemble(formData: FormData) {
    formData.set("kitId", kitId);
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await disassembleKitAction(formData);
      if (result.ok) {
        setSuccess(`Successfully disassembled ${formData.get("quantity")} kit(s)`);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {canAssemble && (
        <Card>
          <CardHeader>
            <CardTitle>Assemble</CardTitle>
            <CardDescription>
              Combine components into {kitName}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={handleAssemble} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="assemble-warehouse">Warehouse</Label>
                <Select name="warehouseId" required>
                  <SelectTrigger id="assemble-warehouse">
                    <SelectValue placeholder="Select warehouse..." />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((wh) => (
                      <SelectItem key={wh.id} value={wh.id}>
                        {wh.code} — {wh.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="assemble-qty">Quantity</Label>
                <Input
                  id="assemble-qty"
                  name="quantity"
                  type="number"
                  min="1"
                  defaultValue="1"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="assemble-note">Note (optional)</Label>
                <Textarea
                  id="assemble-note"
                  name="note"
                  placeholder="Optional assembly note..."
                  rows={2}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? "Assembling..." : "Assemble Kit"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {canDisassemble && (
        <Card>
          <CardHeader>
            <CardTitle>Disassemble</CardTitle>
            <CardDescription>
              Break {kitName} back into components
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={handleDisassemble} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="disassemble-warehouse">Warehouse</Label>
                <Select name="warehouseId" required>
                  <SelectTrigger id="disassemble-warehouse">
                    <SelectValue placeholder="Select warehouse..." />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((wh) => (
                      <SelectItem key={wh.id} value={wh.id}>
                        {wh.code} — {wh.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="disassemble-qty">Quantity</Label>
                <Input
                  id="disassemble-qty"
                  name="quantity"
                  type="number"
                  min="1"
                  defaultValue="1"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="disassemble-note">Note (optional)</Label>
                <Textarea
                  id="disassemble-note"
                  name="note"
                  placeholder="Optional disassembly note..."
                  rows={2}
                />
              </div>

              <Button type="submit" variant="outline" className="w-full" disabled={isPending}>
                {isPending ? "Disassembling..." : "Disassemble Kit"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {(error || success) && (
        <div className="md:col-span-2">
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3">
              {error}
            </p>
          )}
          {success && (
            <p className="text-sm text-success bg-success/10 rounded-lg px-4 py-3">
              {success}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
