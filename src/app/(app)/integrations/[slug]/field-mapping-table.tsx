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
import type { IntegrationFieldMapping } from "@/generated/prisma";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { createFieldMappingAction, deleteFieldMappingAction } from "../actions";

interface FieldMappingTableProps {
  integrationId: string;
  mappings: IntegrationFieldMapping[];
}

export function FieldMappingTable({ integrationId, mappings }: FieldMappingTableProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<string>("ITEM");

  const [formData, setFormData] = useState({
    localField: "",
    remoteField: "",
    direction: "BIDIRECTIONAL",
    transformRule: "",
    defaultValue: "",
    isRequired: false,
  });

  const handleDelete = async (mappingId: string) => {
    if (!confirm("Delete this field mapping?")) return;

    setIsLoading(true);
    const result = await deleteFieldMappingAction(mappingId);
    setIsLoading(false);

    if (result.ok) {
      toast.success("Field mapping deleted");
    } else {
      toast.error(result.error || "Failed to delete mapping");
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const result = await createFieldMappingAction({
      integrationId,
      entityType: selectedEntity,
      ...formData,
    });

    setIsLoading(false);

    if (result.ok) {
      toast.success("Field mapping created");
      setFormData({
        localField: "",
        remoteField: "",
        direction: "BIDIRECTIONAL",
        transformRule: "",
        defaultValue: "",
        isRequired: false,
      });
      setShowDialog(false);
    } else {
      toast.error(result.error || "Failed to create mapping");
    }
  };

  const groupedMappings = mappings.reduce(
    (acc, mapping) => {
      if (!acc[mapping.entityType]) {
        acc[mapping.entityType] = [];
      }
      (acc[mapping.entityType] as typeof mappings).push(mapping);
      return acc;
    },
    {} as Record<string, IntegrationFieldMapping[]>,
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Field Mappings</CardTitle>
            <CardDescription>
              Map local fields to remote fields for each entity type.
            </CardDescription>
          </div>
          <Button onClick={() => setShowDialog(true)} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Mapping
          </Button>
        </CardHeader>
        <CardContent>
          {Object.entries(groupedMappings).length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">No field mappings yet.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedMappings).map(([entityType, entityMappings]) => (
                <div key={entityType}>
                  <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                    {entityType}
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3 font-medium">Local Field</th>
                          <th className="text-left py-2 px-3 font-medium">Remote Field</th>
                          <th className="text-left py-2 px-3 font-medium">Direction</th>
                          <th className="text-left py-2 px-3 font-medium">Required</th>
                          <th className="text-left py-2 px-3 font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(entityMappings as typeof mappings).map((mapping) => (
                          <tr key={mapping.id} className="border-b hover:bg-muted/50">
                            <td className="py-2 px-3 font-medium">{mapping.localField}</td>
                            <td className="py-2 px-3 text-muted-foreground">
                              {mapping.remoteField}
                            </td>
                            <td className="py-2 px-3">
                              <Badge variant="secondary" className="text-xs">
                                {mapping.direction}
                              </Badge>
                            </td>
                            <td className="py-2 px-3">
                              {mapping.isRequired ? (
                                <Badge variant="success" className="text-xs">
                                  Required
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">Optional</span>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(mapping.id)}
                                disabled={isLoading}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Mapping Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Field Mapping</DialogTitle>
            <DialogDescription>
              Map a local field to a remote field for data synchronization.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="entity">Entity Type</Label>
              <Select value={selectedEntity} onValueChange={setSelectedEntity}>
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

            <div className="space-y-2">
              <Label htmlFor="localField">Local Field</Label>
              <Input
                id="localField"
                placeholder="e.g., sku, name, description"
                value={formData.localField}
                onChange={(e) => setFormData({ ...formData, localField: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="remoteField">Remote Field</Label>
              <Input
                id="remoteField"
                placeholder="e.g., product_id, title, body_html"
                value={formData.remoteField}
                onChange={(e) => setFormData({ ...formData, remoteField: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="direction">Sync Direction</Label>
              <Select
                value={formData.direction}
                onValueChange={(value) => setFormData({ ...formData, direction: value })}
              >
                <SelectTrigger id="direction">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INBOUND">Inbound only</SelectItem>
                  <SelectItem value="OUTBOUND">Outbound only</SelectItem>
                  <SelectItem value="BIDIRECTIONAL">Bidirectional</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="transformRule">Transform Rule (optional)</Label>
              <Input
                id="transformRule"
                placeholder="e.g., parseFloat, toUpperCase"
                value={formData.transformRule}
                onChange={(e) => setFormData({ ...formData, transformRule: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultValue">Default Value (optional)</Label>
              <Input
                id="defaultValue"
                placeholder="Default value if field is empty"
                value={formData.defaultValue}
                onChange={(e) => setFormData({ ...formData, defaultValue: e.target.value })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="isRequired">Mark as required</Label>
              <input
                id="isRequired"
                type="checkbox"
                checked={formData.isRequired}
                onChange={(e) => setFormData({ ...formData, isRequired: e.target.checked })}
                className="w-4 h-4"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Creating..." : "Create Mapping"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
