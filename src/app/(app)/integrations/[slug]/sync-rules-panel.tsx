"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import type { IntegrationSyncRule } from "@/generated/prisma";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { createSyncRuleAction, deleteSyncRuleAction } from "../actions";

interface SyncRulesPanelProps {
  integrationId: string;
  rules: IntegrationSyncRule[];
}

const ACTION_COLORS: Record<
  string,
  "default" | "secondary" | "success" | "destructive" | "warning"
> = {
  SYNC: "success",
  SKIP: "secondary",
  TRANSFORM: "default",
  FLAG_REVIEW: "warning",
  CREATE_ONLY: "default",
  UPDATE_ONLY: "default",
};

export function SyncRulesPanel({ integrationId, rules }: SyncRulesPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    entityType: "ITEM",
    condition: "",
    action: "SYNC",
    priority: "0",
  });

  const handleDelete = async (ruleId: string) => {
    if (!confirm("Delete this sync rule?")) return;

    setIsLoading(true);
    const result = await deleteSyncRuleAction(ruleId);
    setIsLoading(false);

    if (result.ok) {
      toast.success("Sync rule deleted");
    } else {
      toast.error(result.error || "Failed to delete rule");
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    let conditionJson: Record<string, unknown> = {};
    if (formData.condition) {
      try {
        conditionJson = JSON.parse(formData.condition);
      } catch {
        toast.error("Invalid JSON in condition");
        return;
      }
    }

    setIsLoading(true);
    const result = await createSyncRuleAction({
      integrationId,
      name: formData.name,
      entityType: formData.entityType,
      condition: conditionJson,
      action: formData.action,
      priority: Number.parseInt(formData.priority),
    });
    setIsLoading(false);

    if (result.ok) {
      toast.success("Sync rule created");
      setFormData({
        name: "",
        entityType: "ITEM",
        condition: "",
        action: "SYNC",
        priority: "0",
      });
      setShowDialog(false);
    } else {
      toast.error(result.error || "Failed to create rule");
    }
  };

  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Sync Rules</CardTitle>
            <CardDescription>
              Define conditional rules to control sync behavior for specific records.
            </CardDescription>
          </div>
          <Button onClick={() => setShowDialog(true)} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Rule
          </Button>
        </CardHeader>
        <CardContent>
          {sortedRules.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">No sync rules configured.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedRules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-medium">{rule.name}</h4>
                      <Badge variant="secondary" className="text-xs">
                        {rule.entityType}
                      </Badge>
                      <Badge variant={ACTION_COLORS[rule.action]} className="text-xs">
                        {rule.action}
                      </Badge>
                      {!rule.isActive && (
                        <Badge variant="destructive" className="text-xs">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">Priority: {rule.priority}</p>
                    {typeof rule.condition === "object" && (
                      <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto">
                        {JSON.stringify(rule.condition, null, 2)}
                      </pre>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(rule.id)}
                    disabled={isLoading}
                    className="ml-4"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Rule Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Sync Rule</DialogTitle>
            <DialogDescription>
              Create a rule to control how specific records are synchronized.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Rule Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Skip discontinued items"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="entity">Entity Type</Label>
                <Select
                  value={formData.entityType}
                  onValueChange={(value) => setFormData({ ...formData, entityType: value })}
                >
                  <SelectTrigger id="entity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ITEM">Item</SelectItem>
                    <SelectItem value="STOCK_LEVEL">Stock Level</SelectItem>
                    <SelectItem value="SUPPLIER">Supplier</SelectItem>
                    <SelectItem value="PURCHASE_ORDER">Purchase Order</SelectItem>
                    <SelectItem value="CATEGORY">Category</SelectItem>
                    <SelectItem value="WAREHOUSE">Warehouse</SelectItem>
                    <SelectItem value="CUSTOMER">Customer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="action">Action</Label>
                <Select
                  value={formData.action}
                  onValueChange={(value) => setFormData({ ...formData, action: value })}
                >
                  <SelectTrigger id="action">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SYNC">Sync</SelectItem>
                    <SelectItem value="SKIP">Skip</SelectItem>
                    <SelectItem value="TRANSFORM">Transform</SelectItem>
                    <SelectItem value="FLAG_REVIEW">Flag for review</SelectItem>
                    <SelectItem value="CREATE_ONLY">Create only</SelectItem>
                    <SelectItem value="UPDATE_ONLY">Update only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Input
                  id="priority"
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="condition">Condition (JSON)</Label>
              <Textarea
                id="condition"
                placeholder={`{\n  "discontinued": true,\n  "status": "inactive"\n}`}
                value={formData.condition}
                onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                className="font-mono text-sm"
                rows={6}
              />
              <p className="text-xs text-muted-foreground">
                Define the condition as JSON. The rule applies when all conditions match.
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Creating..." : "Create Rule"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
