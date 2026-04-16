import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Card, CardContent } from "@/components/ui/card";import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";

import { ReceiveForm } from "./receive-form";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata(_props: PageProps): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.transfers?.receive?.metaTitle || "Receive Transfer" };
}

export default async function ReceivePage({ params }: PageProps) {
  const { id } = await params;
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  // Verify transfer exists and is IN_TRANSIT
  const transfer = await db.stockTransfer.findFirst({
    where: { id, organizationId: membership.organizationId },
    include: {
      fromWarehouse: { select: { name: true } },
      toWarehouse: { select: { name: true } },
      lines: {
        include: {
          item: { select: { id: true, sku: true, name: true } },
        },
      },
    },
  });

  if (!transfer) {
    notFound();
  }

  const transferLabel = transfer.transferNumber;

  if (transfer.status !== "IN_TRANSIT") {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t.transfers?.receive?.heading || "Receive Transfer"}
          description={t.transfers?.receive?.subtitle || ""}
          backHref={`/transfers/${id}`}
          breadcrumb={[
            { label: t.nav?.transfers ?? "Transfers", href: "/transfers" },
            { label: transferLabel },
            { label: t.transfers?.receive?.heading || "Receive Transfer" },
          ]}
        />
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <p className="text-sm text-orange-800">
              You can only receive transfers that are in IN_TRANSIT status.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.transfers?.receive?.heading || "Receive Transfer"}
        description={`From ${transfer.fromWarehouse.name} to ${transfer.toWarehouse.name}`}
        backHref={`/transfers/${id}`}
        breadcrumb={[
          { label: t.nav?.transfers ?? "Transfers", href: "/transfers" },
          { label: transferLabel },
          { label: t.transfers?.receive?.heading || "Receive Transfer" },
        ]}
      />

      <Card>
        <CardContent className="pt-6">
          <ReceiveForm transferId={id} lines={transfer.lines} />
        </CardContent>
      </Card>
    </div>
  );
}
