"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, Check, ExternalLink, X } from "lucide-react";
import Link from "next/link";

import {
  dismissAlertAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/app/(app)/notifications/actions";

export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  href: string | null;
  alertId: string | null;
  readAt: string | null;
  createdAt: string;
};

export type NotificationCenterLabels = {
  heading: string;
  empty: string;
  markAllRead: string;
  dismiss: string;
};

type NotificationCenterProps = {
  notifications: NotificationItem[];
  unreadCount: number;
  labels: NotificationCenterLabels;
  bellLabel: string;
};

export function NotificationCenter({
  notifications,
  unreadCount,
  labels,
  bellLabel,
}: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleMarkRead(notificationId: string) {
    startTransition(async () => {
      await markNotificationReadAction(notificationId);
    });
  }

  function handleMarkAllRead() {
    startTransition(async () => {
      await markAllNotificationsReadAction();
    });
  }

  function handleDismissAlert(alertId: string) {
    startTransition(async () => {
      await dismissAlertAction(alertId);
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={bellLabel} className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">{labels.heading}</h3>
          {unreadCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs"
              onClick={handleMarkAllRead}
              disabled={isPending}
            >
              <Check className="mr-1 h-3 w-3" />
              {labels.markAllRead}
            </Button>
          ) : null}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">{labels.empty}</p>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex gap-3 px-4 py-3 text-sm transition-colors ${
                    n.readAt ? "opacity-60" : "bg-accent/30"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-tight">{n.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground leading-snug">{n.message}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      {n.href ? (
                        <Link
                          href={n.href}
                          onClick={() => {
                            if (!n.readAt) handleMarkRead(n.id);
                            setOpen(false);
                          }}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View
                        </Link>
                      ) : null}
                      {n.alertId ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (n.alertId) handleDismissAlert(n.alertId);
                          }}
                          disabled={isPending}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3 w-3" />
                          {labels.dismiss}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {!n.readAt ? (
                    <div className="flex shrink-0 items-start pt-1">
                      <button
                        type="button"
                        onClick={() => handleMarkRead(n.id)}
                        disabled={isPending}
                        className="rounded-full p-0.5 text-primary hover:bg-accent"
                        aria-label="Mark as read"
                      >
                        <div className="h-2 w-2 rounded-full bg-primary" />
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
