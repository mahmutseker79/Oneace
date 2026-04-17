import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MigrationProgress } from "@/components/ui/migration-progress";
import { PageHeader } from "@/components/ui/page-header";
import type { MigrationStatus } from "@/generated/prisma";
import { db } from "@/lib/db";
import { requireActiveMembership } from "@/lib/session";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Migration Details",
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

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MigrationDetailPage(props: PageProps) {
  const params = await props.params;
  const { membership } = await requireActiveMembership();

  const job = await db.migrationJob.findFirst({
    where: {
      id: params.id,
      organizationId: membership.organizationId,
    },
    include: { createdBy: { select: { name: true } } },
  });

  if (!job) {
    notFound();
  }

  const statusBadge = STATUS_BADGES[job.status];
  const sourceLabel = SOURCE_LABELS[job.sourcePlatform] || job.sourcePlatform;

  const importResults = job.importResults as {
    phases?: any[];
    totals?: Record<string, number>;
  } | null;
  const phases = importResults?.phases ?? [];

  const validationReport = job.validationReport as {
    issues?: any[];
  } | null;
  const issues = validationReport?.issues ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        title={`${sourceLabel} Göçü`}
        description={`Başlayan: ${job.createdBy?.name || "Bilinmiyen"} · ${job.createdAt.toLocaleString("tr-TR")}`}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6 space-y-2">
            <p className="text-xs text-muted-foreground">Kaynak</p>
            <p className="text-lg font-semibold">{sourceLabel}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 space-y-2">
            <p className="text-xs text-muted-foreground">Durum</p>
            <Badge variant={statusBadge.variant} className="w-fit">
              {statusBadge.label}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 space-y-2">
            <p className="text-xs text-muted-foreground">Başlatıldı</p>
            <p className="text-sm font-medium">
              {job.startedAt ? job.startedAt.toLocaleString("tr-TR") : "Henüz başlanmadı"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 space-y-2">
            <p className="text-xs text-muted-foreground">Tamamlandı</p>
            <p className="text-sm font-medium">
              {job.completedAt ? job.completedAt.toLocaleString("tr-TR") : "Henüz tamamlanmadı"}
            </p>
          </CardContent>
        </Card>
      </div>

      {job.status === "IMPORTING" && (
        <Card>
          <CardContent className="pt-6 space-y-6">
            <h3 className="font-semibold">İçe Aktarma İlerlemesi</h3>
            <MigrationProgress phases={phases} currentPhase={null} isImporting={true} />
          </CardContent>
        </Card>
      )}

      {phases.length > 0 && job.status !== "IMPORTING" && (
        <Card>
          <CardContent className="pt-6 space-y-6">
            <h3 className="font-semibold">Aşama Özeti</h3>
            <MigrationProgress phases={phases} currentPhase={null} isImporting={false} />
          </CardContent>
        </Card>
      )}

      {issues.length > 0 && (
        <Card className="border-destructive/50">
          <CardContent className="pt-6 space-y-4">
            <h3 className="font-semibold text-destructive">Hatalar ve Uyarılar</h3>
            <div className="space-y-2">
              {issues.slice(0, 10).map((issue: any, i: number) => (
                <div key={i} className="text-sm border-l-2 border-destructive/50 pl-3 py-1">
                  <p className="font-medium">{issue.entity}</p>
                  <p className="text-muted-foreground">{issue.message}</p>
                </div>
              ))}
            </div>
            {issues.length > 10 && (
              <p className="text-xs text-muted-foreground">+{issues.length - 10} daha...</p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        {job.status === "IMPORTING" && <Button variant="destructive">Durdur</Button>}
        {job.status === "COMPLETED" && <Button variant="outline">Geri Al</Button>}
        {(job.status === "FAILED" || job.status === "CANCELLED") && <Button>Yeniden Dene</Button>}
      </div>
    </div>
  );
}
