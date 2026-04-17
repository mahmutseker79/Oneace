"use client";

import { ChevronLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createZoneAction, listZonesAction, updateZoneAction } from "./actions";

interface ZoneFormProps {
  countId: string;
  zoneId?: string;
  initialData?: {
    name: string;
    description: string | null;
    color: string | null;
    barcodeValue: string | null;
    barcodeFormat: string;
    parentZoneId: string | null;
    promoteToBin: boolean;
  };
  labels: {
    heading: string;
    nameLabel: string;
    namePlaceholder: string;
    descriptionLabel: string;
    descriptionPlaceholder: string;
    colorLabel: string;
    barcodeLabel: string;
    barcodePlaceholder: string;
    barcodeFormatLabel: string;
    parentZoneLabel: string;
    parentZonePlaceholder: string;
    promoteLabel: string;
    promoteHelp: string;
    createButton: string;
    updateButton: string;
    cancelButton: string;
    createSuccess: string;
    updateSuccess: string;
    errors: {
      createFailed: string;
      updateFailed: string;
    };
  };
}

export function ZoneForm({
  countId,
  zoneId,
  initialData,
  labels,
}: ZoneFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [color, setColor] = useState(initialData?.color ?? "#3B82F6");
  const [barcodeValue, setBarcodeValue] = useState(initialData?.barcodeValue ?? "");
  const [barcodeFormat, setBarcodeFormat] = useState(initialData?.barcodeFormat ?? "QR");
  const [parentZoneId, setParentZoneId] = useState(initialData?.parentZoneId ?? "");
  const [promoteToBin, setPromoteToBin] = useState(initialData?.promoteToBin ?? false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [parentZones, setParentZones] = useState<
    Array<{ id: string; name: string }>
  >([]);

  // Load available parent zones when component mounts
  useEffect(() => {
    startTransition(async () => {
      const result = await listZonesAction(countId);
      if (result.ok && result.zones) {
        setParentZones(
          result.zones
            .filter((z) => z.id !== zoneId) // Don't show current zone as its own parent
            .map((z) => ({ id: z.id, name: z.name })),
        );
      }
    });
  }, [countId, zoneId]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      setError(labels.errors.createFailed);
      return;
    }

    startTransition(async () => {
      const payload = {
        name: trimmedName,
        description: description.trim() || null,
        color: color || null,
        barcodeValue: barcodeValue.trim() || null,
        barcodeFormat,
        parentZoneId: parentZoneId || null,
        promoteToBin,
        stockCountId: countId,
      };

      const result = zoneId
        ? await updateZoneAction(zoneId, payload)
        : await createZoneAction(countId, payload);

      if (!result.ok) {
        setError(result.error || labels.errors.createFailed);
        return;
      }

      const successMessage = zoneId ? labels.updateSuccess : labels.createSuccess;
      // Navigate back to zones list with success message (you can use a toast here)
      router.push(`/stock-counts/${countId}/zones`);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/stock-counts/${countId}/zones`}>
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4 mr-1" />
            {labels.cancelButton}
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">{labels.heading}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{labels.heading}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name Field */}
            <div className="space-y-2">
              <Label htmlFor="name">{labels.nameLabel}</Label>
              <Input
                id="name"
                type="text"
                placeholder={labels.namePlaceholder}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isPending}
                required
                minLength={1}
                maxLength={160}
              />
            </div>

            {/* Description Field */}
            <div className="space-y-2">
              <Label htmlFor="description">{labels.descriptionLabel}</Label>
              <Textarea
                id="description"
                placeholder={labels.descriptionPlaceholder}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isPending}
                maxLength={500}
                rows={3}
              />
            </div>

            {/* Color Field */}
            <div className="space-y-2">
              <Label htmlFor="color">{labels.colorLabel}</Label>
              <div className="flex gap-2">
                <Input
                  id="color"
                  type="text"
                  placeholder="#FF0000"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  disabled={isPending}
                  maxLength={7}
                  className="font-mono"
                />
                <div
                  className="w-10 h-10 rounded border border-gray-300 flex-shrink-0"
                  style={{ backgroundColor: color || "#ffffff" }}
                />
              </div>
            </div>

            {/* Barcode Value Field */}
            <div className="space-y-2">
              <Label htmlFor="barcodeValue">{labels.barcodeLabel}</Label>
              <Input
                id="barcodeValue"
                type="text"
                placeholder={labels.barcodePlaceholder}
                value={barcodeValue}
                onChange={(e) => setBarcodeValue(e.target.value)}
                disabled={isPending}
                maxLength={64}
              />
              <p className="text-xs text-muted-foreground">
                {barcodeValue ? `Current: ${barcodeValue}` : labels.barcodePlaceholder}
              </p>
            </div>

            {/* Barcode Format Field */}
            <div className="space-y-2">
              <Label htmlFor="barcodeFormat">{labels.barcodeFormatLabel}</Label>
              <select
                id="barcodeFormat"
                value={barcodeFormat}
                onChange={(e) => setBarcodeFormat(e.target.value)}
                disabled={isPending}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="QR">QR Code</option>
                <option value="CODE128">Code 128</option>
                <option value="EAN13">EAN-13</option>
                <option value="CODE39">Code 39</option>
                <option value="UPC_A">UPC-A</option>
                <option value="ITF14">ITF-14</option>
              </select>
            </div>

            {/* Parent Zone Field */}
            {parentZones.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="parentZoneId">{labels.parentZoneLabel}</Label>
                <select
                  id="parentZoneId"
                  value={parentZoneId}
                  onChange={(e) => setParentZoneId(e.target.value)}
                  disabled={isPending}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">{labels.parentZonePlaceholder}</option>
                  {parentZones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Promote to Bin Checkbox */}
            <div className="flex items-start gap-2">
              <input
                id="promoteToBin"
                type="checkbox"
                checked={promoteToBin}
                onChange={(e) => setPromoteToBin(e.target.checked)}
                disabled={isPending}
                className="mt-1"
              />
              <div className="flex-1">
                <Label htmlFor="promoteToBin" className="font-normal cursor-pointer">
                  {labels.promoteLabel}
                </Label>
                <p className="text-xs text-muted-foreground mt-1">{labels.promoteHelp}</p>
              </div>
            </div>

            {/* Error Display */}
            {error ? (
              <div
                role="alert"
                className="border-destructive/50 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
              >
                {error}
              </div>
            ) : null}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button type="submit" disabled={isPending || name.trim().length < 1}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isPending
                  ? (zoneId ? labels.updateButton : labels.createButton)
                  : (zoneId ? labels.updateButton : labels.createButton)}
              </Button>
              <Link href={`/stock-counts/${countId}/zones`}>
                <Button type="button" variant="outline">
                  {labels.cancelButton}
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
