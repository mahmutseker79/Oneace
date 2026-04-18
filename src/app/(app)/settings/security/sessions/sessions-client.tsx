"use client";

// v1.2 P2 §5.39 — client half of the sessions page.
//
// Calls the three API routes:
//   - GET  /api/account/sessions                 (refresh)
//   - POST /api/account/sessions/[id]/revoke     (one)
//   - POST /api/account/sessions/revoke-all      (everything else)
//
// We keep state locally and re-render optimistically; on API error
// we restore the previous list so the UI never lies about revocation.

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Monitor, ShieldOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export interface ClientSession {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  current: boolean;
}

interface Props {
  sessions: ClientSession[];
}

function formatAbs(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function summariseAgent(ua: string | null): string {
  if (!ua) return "Unknown device";
  // Rough heuristic, enough to orient the user without dragging in a
  // full UA parser. "Chrome on macOS", "Safari on iOS", etc.
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Macintosh|Mac OS X/.test(ua)
      ? "macOS"
      : /Android/.test(ua)
        ? "Android"
        : /iPhone|iPad|iPod/.test(ua)
          ? "iOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "Unknown OS";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Safari\//.test(ua)
        ? "Safari"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : "Browser";
  return `${browser} on ${os}`;
}

export function SessionsClient({ sessions: initial }: Props) {
  const router = useRouter();
  const [sessions, setSessions] = useState<ClientSession[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function revokeOne(id: string) {
    setError(null);
    const prev = sessions;
    setSessions(sessions.filter((s) => s.id !== id));
    try {
      const res = await fetch(`/api/account/sessions/${encodeURIComponent(id)}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setSessions(prev);
        setError(body.error ?? "Failed to revoke session.");
        return;
      }
      startTransition(() => router.refresh());
    } catch (err) {
      setSessions(prev);
      setError(err instanceof Error ? err.message : "Failed to revoke session.");
    }
  }

  async function revokeAll() {
    setError(null);
    const prev = sessions;
    setSessions(sessions.filter((s) => s.current));
    try {
      const res = await fetch("/api/account/sessions/revoke-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setSessions(prev);
        setError(body.error ?? "Failed to revoke sessions.");
        return;
      }
      startTransition(() => router.refresh());
    } catch (err) {
      setSessions(prev);
      setError(err instanceof Error ? err.message : "Failed to revoke sessions.");
    }
  }

  const others = sessions.filter((s) => !s.current);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active sessions</CardTitle>
        <CardDescription>
          If you see a device you don't recognise, revoke it and change your password.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div
            className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
            role="alert"
          >
            {error}
          </div>
        )}

        <ul className="divide-y divide-border">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-start justify-between gap-4 py-3">
              <div className="flex gap-3">
                <Monitor className="mt-0.5 h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{summariseAgent(s.userAgent)}</p>
                    {s.current && <Badge variant="success">This device</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {s.ipAddress ?? "IP unknown"} · Last active {formatAbs(s.updatedAt)}
                  </p>
                  <p className="text-xs text-muted-foreground">Expires {formatAbs(s.expiresAt)}</p>
                </div>
              </div>
              <div className="shrink-0">
                {s.current ? (
                  <Button variant="outline" size="sm" disabled>
                    Current
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => revokeOne(s.id)}
                    disabled={isPending}
                    aria-label={`Revoke ${summariseAgent(s.userAgent)}`}
                  >
                    Revoke
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>

        {others.length > 0 && (
          <div className="flex justify-end border-t pt-4">
            <Button
              variant="destructive"
              onClick={revokeAll}
              disabled={isPending}
              className="gap-2"
            >
              <ShieldOff className="h-4 w-4" aria-hidden="true" />
              Revoke all other sessions
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
