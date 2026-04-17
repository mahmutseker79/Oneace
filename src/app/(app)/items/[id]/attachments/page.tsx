import { Download } from "lucide-react";import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DeleteButton } from "@/components/shell/delete-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { getMessages, getRegion } from "@/lib/i18n";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";

import { deleteAttachmentAction } from "./actions";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.items.attachments?.metaTitle || "Attachments" };
}

export default async function AttachmentsPage({ params }: PageProps) {
  const { id: itemId } = await params;
  const { membership } = await requireActiveMembership();
  const t = await getMessages();
  const region = await getRegion();

  const canDeleteAttachment = hasCapability(membership.role, "items.attachments.delete");

  const item = await db.item.findFirst({
    where: { id: itemId, organizationId: membership.organizationId },
    select: { id: true, name: true, sku: true },
  });

  if (!item) {
    notFound();
  }

  const itemLabel = item.name;

  const attachments = await db.itemAttachment.findMany({
    where: { itemId: item.id },
    include: {
      uploadedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { sortOrder: "asc" },
  });

  const dateFormatter = new Intl.DateTimeFormat(region.numberLocale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  function getFileIcon(type: string) {
    if (type === "IMAGE") return "🖼️";
    if (type === "DATASHEET") return "📋";
    if (type === "CERTIFICATE") return "📜";
    if (type === "DOCUMENT") return "📄";
    return "📎";
  }

  function formatFileSize(bytes: number) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.items.attachments?.heading || "Attachments"}
        description={t.items.attachments?.subtitle || "Documents and media files"}
        backHref={`/items/${item.id}`}
        breadcrumb={[
          { label: t.nav?.items ?? "Items", href: "/items" },
          { label: itemLabel },
          { label: t.items.attachments?.heading || "Attachments" },
        ]}
      />

      {attachments.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center">
            <CardTitle>{t.items.attachments?.emptyTitle || "No attachments"}</CardTitle>
            <CardDescription>
              {t.items.attachments?.emptyBody || "Upload files to attach to this item"}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex flex-col gap-3 rounded-lg border p-4 hover:bg-muted/50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{getFileIcon(attachment.fileType)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-sm">{attachment.fileName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(attachment.fileSize)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      {attachment.uploadedBy?.name ||
                        attachment.uploadedBy?.email ||
                        "Unknown user"}
                    </div>
                    {canDeleteAttachment && (
                      <DeleteButton
                        labels={{
                          trigger: "Delete",
                          title: t.items.attachments?.deleteConfirmTitle || "Delete attachment?",
                          body: t.items.attachments?.deleteConfirmBody || "This cannot be undone",
                          cancel: t.common.cancel,
                          confirm: t.common.delete,
                        }}
                        action={deleteAttachmentAction.bind(null, itemId, attachment.id)}
                        iconOnly
                      />
                    )}
                  </div>

                  <div className="text-xs text-muted-foreground">
                    {dateFormatter.format(attachment.createdAt)}
                  </div>

                  <a
                    href={attachment.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs font-medium text-primary hover:underline"
                  >
                    <Download className="h-3 w-3" />
                    Download
                  </a>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
