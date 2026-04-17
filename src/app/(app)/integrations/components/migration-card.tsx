"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { MigrationSource } from "@/generated/prisma";
import {
  Boxes,
  Factory,
  FileSpreadsheet,
  HardDrive,
  Package,
  Receipt,
  Warehouse,
} from "lucide-react";
import Link from "next/link";

interface MigrationCardProps {
  source: MigrationSource;
  lastJob?: {
    completedAt: Date;
    itemsImported: number;
  } | null;
  canStart: boolean;
}

const MIGRATION_SOURCES: Partial<
  Record<MigrationSource, { name: string; icon: React.ComponentType<{ className?: string }> }>
> = {
  SORTLY: { name: "Sortly", icon: Package },
  INFLOW: { name: "inFlow", icon: Boxes },
  FISHBOWL: { name: "Fishbowl", icon: Warehouse },
  CIN7: { name: "Cin7 Core", icon: Factory },
  SOS_INVENTORY: { name: "SOS Inventory", icon: Receipt },
  QUICKBOOKS_ONLINE: { name: "QuickBooks Online", icon: FileSpreadsheet },
  QUICKBOOKS_DESKTOP: { name: "QuickBooks Desktop", icon: HardDrive },
};

function daysAgo(date: Date): number {
  return Math.floor((new Date().getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

export function MigrationCard({ source, lastJob, canStart }: MigrationCardProps) {
  const sourceInfo = MIGRATION_SOURCES[source];
  if (!sourceInfo) return null;
  const Icon = sourceInfo.icon;

  return (
    <Card className="relative overflow-hidden border-l-4 border-l-accent">
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">{sourceInfo.name}</h3>
            <p className="text-xs text-muted-foreground">Migration</p>
          </div>
        </div>

        {lastJob ? (
          <div className="rounded-lg bg-success/5 p-3 text-sm">
            <p className="text-muted-foreground">
              Son göç: <span className="font-medium">{daysAgo(lastJob.completedAt)}</span> gün önce
              · {lastJob.itemsImported} ürün taşındı
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Rakipten veri taşıyın — ürünleri, kütüphaneleri ve stok seviyelerini getirin.
          </p>
        )}

        <div className="flex gap-2">
          {canStart && (
            <Link href={`/migrations/new?source=${source}`} className="flex-1">
              <Button size="sm" className="w-full">
                {lastJob ? "Yeni Göç" : "Rakipten Taşı"}
              </Button>
            </Link>
          )}
          {lastJob && (
            <Link href={"/migrations"} className="flex-1">
              <Button variant="outline" size="sm" className="w-full">
                Geçmiş
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
