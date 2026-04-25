"use client";

import { Webhook } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { IntegrationWebhookEvent } from "@/generated/prisma";
import { Play, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  createWebhookEventAction,
  deleteWebhookEventAction,
  testWebhookAction,
  toggleWebhookEventAction,
} from "../actions";

interface WebhookEventsPanelProps {
  integrationId: string;
  events: IntegrationWebhookEvent[];
}

export function WebhookEventsPanel({ integrationId, events }: WebhookEventsPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);

  const [formData, setFormData] = useState({
    eventType: "",
    endpointUrl: "",
    secret: "",
  });

  const handleDelete = async (eventId: string) => {
    if (!confirm("Delete this webhook event?")) return;

    setIsLoading(true);
    const result = await deleteWebhookEventAction(eventId);
    setIsLoading(false);

    if (result.ok) {
      toast.success("Webhook event deleted");
    } else {
      toast.error(result.error || "Failed to delete event");
    }
  };

  const handleToggle = async (eventId: string) => {
    setIsLoading(true);
    const result = await toggleWebhookEventAction(eventId);
    setIsLoading(false);

    if (result.ok) {
      toast.success("Webhook event toggled");
    } else {
      toast.error(result.error || "Failed to toggle event");
    }
  };

  const handleTest = async (eventId: string) => {
    setIsLoading(true);
    const result = await testWebhookAction(eventId);
    setIsLoading(false);

    if (result.ok) {
      toast.success("Webhook test sent successfully");
    } else {
      toast.error(result.error || "Webhook test failed");
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsLoading(true);
    const result = await createWebhookEventAction({
      integrationId,
      eventType: formData.eventType,
      endpointUrl: formData.endpointUrl,
      secret: formData.secret || undefined,
    });
    setIsLoading(false);

    if (result.ok) {
      toast.success("Webhook event created");
      setFormData({
        eventType: "",
        endpointUrl: "",
        secret: "",
      });
      setShowDialog(false);
    } else {
      toast.error(result.error || "Failed to create event");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Webhook Events</CardTitle>
            <CardDescription>
              Register webhook endpoints to receive real-time notifications.
            </CardDescription>
          </div>
          <Button onClick={() => setShowDialog(true)} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Webhook
          </Button>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <EmptyState
              bare
              icon={Webhook}
              title="No webhook events configured"
              description="Subscribe to events to fire webhooks when data changes upstream."
            />
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h4 className="font-medium">{event.eventType}</h4>
                      {event.isActive ? (
                        <Badge variant="success" className="text-xs">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground break-all">{event.endpointUrl}</p>
                    {event.lastTriggeredAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Last triggered: {new Date(event.lastTriggeredAt).toLocaleString()}
                        {event.failCount > 0 && ` (${event.failCount} recent failures)`}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTest(event.id)}
                      disabled={isLoading || !event.isActive}
                      title="Send test ping"
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                    <Button
                      variant={event.isActive ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => handleToggle(event.id)}
                      disabled={isLoading}
                    >
                      {event.isActive ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(event.id)}
                      disabled={isLoading}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Webhook Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Webhook Event</DialogTitle>
            <DialogDescription>
              Register a webhook endpoint to receive notifications when data is synced.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="eventType">Event Type</Label>
              <Input
                id="eventType"
                placeholder="e.g., item.synced, order.created"
                value={formData.eventType}
                onChange={(e) => setFormData({ ...formData, eventType: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endpointUrl">Endpoint URL</Label>
              <Input
                id="endpointUrl"
                type="url"
                placeholder="https://example.com/webhooks/sync"
                value={formData.endpointUrl}
                onChange={(e) => setFormData({ ...formData, endpointUrl: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="secret">Secret (optional)</Label>
              <Input
                id="secret"
                type="password"
                placeholder="Shared secret for HMAC validation"
                value={formData.secret}
                onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Optional secret sent as X-Webhook-Secret header for authentication.
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Creating..." : "Create Webhook"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
