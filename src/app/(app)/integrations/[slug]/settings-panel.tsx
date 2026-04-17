"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { Integration } from "@/generated/prisma";
import { useState } from "react";
import { toast } from "sonner";
import { updateIntegrationSettingsAction } from "../actions";

interface SettingsPanelProps {
  integration: Integration;
}

export function SettingsPanel({ integration }: SettingsPanelProps) {
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    syncFrequency: integration.syncFrequency,
    syncDirection: integration.syncDirection,
    conflictPolicy: integration.conflictPolicy,
    retryPolicy: integration.retryPolicy,
    maxRetries: integration.maxRetries,
    rateLimitPerMin: integration.rateLimitPerMin,
    syncItems: integration.syncItems,
    syncOrders: integration.syncOrders,
    syncSuppliers: integration.syncSuppliers,
    syncCategories: integration.syncCategories,
    syncStockLevels: integration.syncStockLevels,
    syncPrices: integration.syncPrices,
    syncImages: integration.syncImages,
    syncCustomers: integration.syncCustomers,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const result = await updateIntegrationSettingsAction(integration.id, formData);
    setIsLoading(false);

    if (result.ok) {
      toast.success("Settings saved successfully");
    } else {
      toast.error(result.error || "Failed to save settings");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Sync Frequency */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sync Frequency</CardTitle>
          <CardDescription>How often should data be synchronized?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="syncFrequency">Frequency</Label>
            <Select
              value={formData.syncFrequency}
              onValueChange={(value) =>
                setFormData({ ...formData, syncFrequency: value as any })
              }
            >
              <SelectTrigger id="syncFrequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MANUAL">Manual only</SelectItem>
                <SelectItem value="REALTIME">Real-time</SelectItem>
                <SelectItem value="EVERY_5_MIN">Every 5 minutes</SelectItem>
                <SelectItem value="EVERY_15_MIN">Every 15 minutes</SelectItem>
                <SelectItem value="EVERY_30_MIN">Every 30 minutes</SelectItem>
                <SelectItem value="HOURLY">Hourly</SelectItem>
                <SelectItem value="EVERY_6_HOURS">Every 6 hours</SelectItem>
                <SelectItem value="DAILY">Daily</SelectItem>
                <SelectItem value="WEEKLY">Weekly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Sync Direction & Conflict Policy */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sync Direction & Conflict Resolution</CardTitle>
          <CardDescription>Control bidirectional sync and conflict handling.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="syncDirection">Direction</Label>
              <Select
                value={formData.syncDirection}
                onValueChange={(value) =>
                  setFormData({ ...formData, syncDirection: value as any })
                }
              >
                <SelectTrigger id="syncDirection">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INBOUND">Inbound only (external → OneAce)</SelectItem>
                  <SelectItem value="OUTBOUND">Outbound only (OneAce → external)</SelectItem>
                  <SelectItem value="BIDIRECTIONAL">Bidirectional</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="conflictPolicy">Conflict Policy</Label>
              <Select
                value={formData.conflictPolicy}
                onValueChange={(value) =>
                  setFormData({ ...formData, conflictPolicy: value as any })
                }
              >
                <SelectTrigger id="conflictPolicy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="REMOTE_WINS">Remote wins</SelectItem>
                  <SelectItem value="LOCAL_WINS">Local wins</SelectItem>
                  <SelectItem value="NEWEST_WINS">Newest wins</SelectItem>
                  <SelectItem value="MANUAL_REVIEW">Manual review</SelectItem>
                  <SelectItem value="SKIP">Skip conflicting records</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Retry Policy */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Retry Policy</CardTitle>
          <CardDescription>Configure failed sync retry behavior.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="retryPolicy">Retry Strategy</Label>
              <Select
                value={formData.retryPolicy}
                onValueChange={(value) =>
                  setFormData({ ...formData, retryPolicy: value as any })
                }
              >
                <SelectTrigger id="retryPolicy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">No retries</SelectItem>
                  <SelectItem value="LINEAR">Linear backoff</SelectItem>
                  <SelectItem value="EXPONENTIAL">Exponential backoff</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxRetries">Maximum Retries</Label>
              <input
                id="maxRetries"
                type="number"
                min="0"
                max="10"
                value={formData.maxRetries}
                onChange={(e) =>
                  setFormData({ ...formData, maxRetries: parseInt(e.target.value) })
                }
                className="px-3 py-2 border rounded-md w-full"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rate Limiting */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rate Limiting</CardTitle>
          <CardDescription>Control API rate limiting to avoid exceeding provider limits.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rateLimitPerMin">Requests per minute</Label>
            <input
              id="rateLimitPerMin"
              type="number"
              min="1"
              value={formData.rateLimitPerMin}
              onChange={(e) =>
                setFormData({ ...formData, rateLimitPerMin: parseInt(e.target.value) })
              }
              className="px-3 py-2 border rounded-md w-full"
            />
            <p className="text-xs text-muted-foreground">
              Maximum API requests to send per minute. Typical limit is 60.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Entity Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Entity Types to Sync</CardTitle>
          <CardDescription>Select which entity types should be synced.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-6">
            <div className="flex items-center justify-between">
              <Label htmlFor="syncItems">Items</Label>
              <Switch
                id="syncItems"
                checked={formData.syncItems}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, syncItems: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="syncOrders">Orders</Label>
              <Switch
                id="syncOrders"
                checked={formData.syncOrders}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, syncOrders: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="syncSuppliers">Suppliers</Label>
              <Switch
                id="syncSuppliers"
                checked={formData.syncSuppliers}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, syncSuppliers: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="syncCategories">Categories</Label>
              <Switch
                id="syncCategories"
                checked={formData.syncCategories}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, syncCategories: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="syncStockLevels">Stock Levels</Label>
              <Switch
                id="syncStockLevels"
                checked={formData.syncStockLevels}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, syncStockLevels: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="syncPrices">Prices</Label>
              <Switch
                id="syncPrices"
                checked={formData.syncPrices}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, syncPrices: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="syncImages">Images</Label>
              <Switch
                id="syncImages"
                checked={formData.syncImages}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, syncImages: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="syncCustomers">Customers</Label>
              <Switch
                id="syncCustomers"
                checked={formData.syncCustomers}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, syncCustomers: checked })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={isLoading}>
        {isLoading ? "Saving..." : "Save Settings"}
      </Button>
    </form>
  );
}
