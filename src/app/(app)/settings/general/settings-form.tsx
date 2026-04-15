"use client";

import { useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { updateOrgSettingsAction } from "./actions";
import { useActionState } from "react";
import { toast } from "sonner";

interface GeneralSettingsFormProps {
  settings: {
    id: string;
    organizationId: string;
    transferNumberPrefix: string;
    transferNumberSequence: number;
    salesOrderPrefix: string;
    salesOrderSequence: number;
    assetTagPrefix: string;
    assetTagSequence: number;
    batchNumberPrefix: string;
    batchNumberSequence: number;
    requireCountApproval: boolean;
    varianceThreshold: { toString: () => string } | string | number;
    recountOnThreshold: boolean;
    defaultCountMethodology: string;
    allowNegativeStock: boolean;
    defaultStockStatus: string;
    dateFormat: string;
    currencySymbol: string;
  };
  organizationId: string;
}

export function GeneralSettingsForm({ settings }: GeneralSettingsFormProps) {
  const [state, formAction] = useActionState(updateOrgSettingsAction, { ok: false } as any);

  const [formData, setFormData] = useState({
    transferNumberPrefix: settings.transferNumberPrefix,
    salesOrderPrefix: settings.salesOrderPrefix,
    assetTagPrefix: settings.assetTagPrefix,
    batchNumberPrefix: settings.batchNumberPrefix,
    requireCountApproval: settings.requireCountApproval,
    varianceThreshold: String(settings.varianceThreshold),
    recountOnThreshold: settings.recountOnThreshold,
    defaultCountMethodology: settings.defaultCountMethodology,
    allowNegativeStock: settings.allowNegativeStock,
    defaultStockStatus: settings.defaultStockStatus,
    dateFormat: settings.dateFormat,
    currencySymbol: settings.currencySymbol,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formInput = {
      transferNumberPrefix: formData.transferNumberPrefix,
      salesOrderPrefix: formData.salesOrderPrefix,
      assetTagPrefix: formData.assetTagPrefix,
      batchNumberPrefix: formData.batchNumberPrefix,
      requireCountApproval: formData.requireCountApproval,
      varianceThreshold: parseFloat(formData.varianceThreshold),
      recountOnThreshold: formData.recountOnThreshold,
      defaultCountMethodology: formData.defaultCountMethodology as any,
      allowNegativeStock: formData.allowNegativeStock,
      defaultStockStatus: formData.defaultStockStatus as any,
      dateFormat: formData.dateFormat as any,
      currencySymbol: formData.currencySymbol,
    };

    const result = await updateOrgSettingsAction(formInput);
    if (result.ok) {
      toast.success("Settings saved successfully");
    } else {
      toast.error(result.error || "Failed to save settings");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Numbering Section */}
      <Card>
        <CardHeader>
          <CardTitle>Numbering Prefixes</CardTitle>
          <CardDescription>Configure prefixes for document numbers. Sequences auto-increment.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="transferNumberPrefix">Transfer Prefix</Label>
              <div className="flex gap-2">
                <Input
                  id="transferNumberPrefix"
                  value={formData.transferNumberPrefix}
                  onChange={(e) =>
                    setFormData({ ...formData, transferNumberPrefix: e.target.value.toUpperCase() })
                  }
                  placeholder="TRF"
                  maxLength={10}
                  className="flex-1"
                />
                <Input
                  readOnly
                  value={`#${settings.transferNumberSequence}`}
                  className="w-20 bg-muted"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="salesOrderPrefix">Sales Order Prefix</Label>
              <div className="flex gap-2">
                <Input
                  id="salesOrderPrefix"
                  value={formData.salesOrderPrefix}
                  onChange={(e) =>
                    setFormData({ ...formData, salesOrderPrefix: e.target.value.toUpperCase() })
                  }
                  placeholder="SO"
                  maxLength={10}
                  className="flex-1"
                />
                <Input
                  readOnly
                  value={`#${settings.salesOrderSequence}`}
                  className="w-20 bg-muted"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assetTagPrefix">Asset Tag Prefix</Label>
              <div className="flex gap-2">
                <Input
                  id="assetTagPrefix"
                  value={formData.assetTagPrefix}
                  onChange={(e) =>
                    setFormData({ ...formData, assetTagPrefix: e.target.value.toUpperCase() })
                  }
                  placeholder="FA"
                  maxLength={10}
                  className="flex-1"
                />
                <Input
                  readOnly
                  value={`#${settings.assetTagSequence}`}
                  className="w-20 bg-muted"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="batchNumberPrefix">Batch Prefix</Label>
              <div className="flex gap-2">
                <Input
                  id="batchNumberPrefix"
                  value={formData.batchNumberPrefix}
                  onChange={(e) =>
                    setFormData({ ...formData, batchNumberPrefix: e.target.value.toUpperCase() })
                  }
                  placeholder="LOT"
                  maxLength={10}
                  className="flex-1"
                />
                <Input
                  readOnly
                  value={`#${settings.batchNumberSequence}`}
                  className="w-20 bg-muted"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Counting Workflow Section */}
      <Card>
        <CardHeader>
          <CardTitle>Counting Workflow</CardTitle>
          <CardDescription>Configure default counting behavior and approval workflow.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="defaultCountMethodology">Default Counting Methodology</Label>
            <Select value={formData.defaultCountMethodology} onValueChange={(value) =>
              setFormData({ ...formData, defaultCountMethodology: value })
            }>
              <SelectTrigger id="defaultCountMethodology">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FULL">Full Inventory Count</SelectItem>
                <SelectItem value="CYCLE">Cycle Count</SelectItem>
                <SelectItem value="SPOT">Spot Count</SelectItem>
                <SelectItem value="BLIND">Blind Count</SelectItem>
                <SelectItem value="DOUBLE_BLIND">Double Blind Count</SelectItem>
                <SelectItem value="DIRECTED">Directed Count</SelectItem>
                <SelectItem value="PARTIAL">Partial Count</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="requireCountApproval" className="cursor-pointer">
              Require Approval for Counts
            </Label>
            <Switch
              id="requireCountApproval"
              checked={formData.requireCountApproval}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, requireCountApproval: checked })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="varianceThreshold">Variance Threshold (%)</Label>
            <Input
              id="varianceThreshold"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={formData.varianceThreshold}
              onChange={(e) => setFormData({ ...formData, varianceThreshold: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Trigger alerts when variance exceeds this percentage
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="recountOnThreshold" className="cursor-pointer">
              Request Recount on Threshold
            </Label>
            <Switch
              id="recountOnThreshold"
              checked={formData.recountOnThreshold}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, recountOnThreshold: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Stock Management Section */}
      <Card>
        <CardHeader>
          <CardTitle>Stock Management</CardTitle>
          <CardDescription>Configure stock handling and default statuses.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="allowNegativeStock" className="cursor-pointer">
              Allow Negative Stock
            </Label>
            <Switch
              id="allowNegativeStock"
              checked={formData.allowNegativeStock}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, allowNegativeStock: checked })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="defaultStockStatus">Default Stock Status</Label>
            <Select value={formData.defaultStockStatus} onValueChange={(value) =>
              setFormData({ ...formData, defaultStockStatus: value })
            }>
              <SelectTrigger id="defaultStockStatus">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AVAILABLE">Available</SelectItem>
                <SelectItem value="HOLD">On Hold</SelectItem>
                <SelectItem value="DAMAGED">Damaged</SelectItem>
                <SelectItem value="QUARANTINE">Quarantine</SelectItem>
                <SelectItem value="EXPIRED">Expired</SelectItem>
                <SelectItem value="IN_TRANSIT">In Transit</SelectItem>
                <SelectItem value="RESERVED">Reserved</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Display Section */}
      <Card>
        <CardHeader>
          <CardTitle>Display Preferences</CardTitle>
          <CardDescription>Set default date and currency formats for your organization.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="dateFormat">Date Format</Label>
              <Select value={formData.dateFormat} onValueChange={(value) =>
                setFormData({ ...formData, dateFormat: value })
              }>
                <SelectTrigger id="dateFormat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (US)</SelectItem>
                  <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (International)</SelectItem>
                  <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (ISO)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currencySymbol">Currency Symbol</Label>
              <Input
                id="currencySymbol"
                value={formData.currencySymbol}
                onChange={(e) => setFormData({ ...formData, currencySymbol: e.target.value })}
                placeholder="$"
                maxLength={5}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error/Success Messages */}
      {state && !state.ok && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-sm text-red-700">{state.error}</p>
            {state.fieldErrors && Object.entries(state.fieldErrors).length > 0 && (
              <ul className="mt-2 list-inside list-disc text-xs text-red-600">
                {Object.entries(state.fieldErrors).map(([field, errors]) => (
                  <li key={field}>
                    {field}: {errors.join(", ")}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Button type="submit" size="lg">
        Save Settings
      </Button>
    </form>
  );
}
