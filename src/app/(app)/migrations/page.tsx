import { WrapperTabs } from "@/components/shell/wrapper-tabs";
import { SETTINGS_TAB_SPECS, resolveWrapperTabs } from "@/components/shell/wrapper-tabs-config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import type { MigrationStatus } from "@/generated/prisma";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";
import { History } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Migrations",
};

const STATUS_BADGES: Record<MigrationStatus, { variant: any; label: string }> = {
  PENDING: { variant: "secondary", label: "Beklemede" },
  FILES_UPLOADED: { variant: "info", label: "Dosyalar Yüklendi" },
  MAPPING_REVIEW: { variant: "info", label: "Eşleme İncelemesi" },
  VALIDATING: { variant: "info", label: "Doğrulanıyor" },
  VALIDATED: { variant: "info", label: "Doğrulandı" },
  IMPORTING: { variant: "processing", label: "İçe Aktarılıyor" },
  COMPLETED: { variant: "success", label: "Tamamlandı" },
  FAILED: { variant: "destructive", label: "Başarısız" },
  CANCELLED: { variant: "outline", label: "İptal Edildi" },
};

const SOURCE_LABELS: Record<string, string> = {
  SORTLY: "Sortly",
  INFLOW: "inFlow",
  FISHBOWL: "Fishbowl",
  CIN7: "Cin7 Core",
  SOS_INVENTORY: "SOS Inventory",
};

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}g önce`;
  if (hours > 0) return `${hours}s önce`;
  if (minutes > 0) return `${minutes}d önce`;
  return "şimdi";
}

export default async function MigrationsPage() {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  const jobs = await db.migrationJob.findMany({
    where: { organizationId: membership.organizationId },
    orderBy: { updatedAt: "desc" },
    include: { createdBy: { select: { name: true } } },
  });

  if (jobs.length === 0) {
    return (
      <div className="space-y-8">
        <WrapperTabs
          tabs={resolveWrapperTabs(SETTINGS_TAB_SPECS, t)}
          ariaLabel="Settings sections"
        />
        <PageHeader title="Göç / Migrations" description="Rakipten veri taşıyın ve yönetin" />
        <EmptyState
          icon={History}
          title="Hiç göç yapılmamış"
          description="Sortly, inFlow, Fishbowl, Cin7 Core, SOS Inventory, QuickBooks Online veya QuickBooks Desktop'tan veri aktarabilirsiniz."
          actions={[
            {
              label: "Yeni Göç Başlat",
              href: "/migrations/new",
            },
          ]}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <WrapperTabs tabs={resolveWrapperTabs(SETTINGS_TAB_SPECS, t)} ariaLabel="Settings sections" />
      <div className="flex items-center justify-between">
        <PageHeader title="Göç / Migrations" description="Rakipten veri taşıyın ve yönetin" />
        <Link href="/migrations/new">
          <Button>Yeni Göç Başlat</Button>
        </Link>
      </div>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Başlatılan Göçler</h2>
        <div className="space-y-3">
          {jobs.map((job) => {
            const statusBadge = STATUS_BADGES[job.status];
            const sourceLabel = SOURCE_LABELS[job.sourcePlatform] || job.sourcePlatform;

            const importResults = job.importResults as {
              totals?: Record<string, number>;
            } | null;
            const itemsImported = importResults?.totals?.items ?? 0;

            return (
              <div
                key={job.id}
                className="border rounded-lg p-4 flex items-center justify-between hover:bg-muted/50 transition"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{sourceLabel}</Badge>
                    <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {job.createdBy?.name || "Bilinmiyen kullanıcı"} · {formatTimeAgo(job.createdAt)}{" "}
                    · {itemsImported} ürün
                  </p>
                </div>

                <div className="flex gap-2">
                  <Link href={`/migrations/${job.id}`}>
                    <Button variant="outline" size="sm">
                      Görüntüle
                    </Button>
                  </Link>
                  {job.status === "IMPORTING" && (
                    <Button variant="destructive" size="sm">
                      Durdur
                    </Button>
                  )}
                  {job.status === "COMPLETED" && (
                    <Button variant="outline" size="sm">
                      Geri Al
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
