import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: `${t.bins.printLabels} — ${t.bins.heading}` };
}

/**
 * Print-optimized page for bin labels. Opens in a new tab — the user
 * hits Ctrl+P / Cmd+P to send to the printer.
 *
 * Layout: 3-column grid of 2.5″ × 1″ labels (Avery 5160 compatible).
 * Each label shows the bin code in large text, the optional label below,
 * and the warehouse code for context.
 */
export default async function BinLabelPrintPage({ params }: PageProps) {
  const { id: warehouseId } = await params;
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  const warehouse = await db.warehouse.findFirst({
    where: { id: warehouseId, organizationId: membership.organizationId },
    select: { id: true, name: true, code: true },
  });

  if (!warehouse) {
    notFound();
  }

  const bins = await db.bin.findMany({
    where: { warehouseId, isArchived: false },
    orderBy: { code: "asc" },
    select: { id: true, code: true, label: true },
  });

  return (
    <html lang="en">
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @media print {
                @page {
                  size: letter;
                  margin: 0.5in 0.19in;
                }
                body { margin: 0; }
                .no-print { display: none !important; }
              }
              @media screen {
                body {
                  max-width: 8.5in;
                  margin: 0 auto;
                  padding: 1rem;
                  font-family: system-ui, sans-serif;
                }
                .no-print { margin-bottom: 1rem; }
              }
              .label-grid {
                display: grid;
                grid-template-columns: repeat(3, 2.625in);
                gap: 0;
                justify-content: center;
              }
              .label {
                width: 2.625in;
                height: 1in;
                padding: 0.125in 0.2in;
                box-sizing: border-box;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                justify-content: center;
                border: 1px dashed #ddd;
              }
              @media print {
                .label { border: none; }
              }
              .label-code {
                font-family: monospace;
                font-size: 16pt;
                font-weight: bold;
                line-height: 1.1;
                letter-spacing: 0.5px;
              }
              .label-name {
                font-size: 8pt;
                color: #666;
                margin-top: 2px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              }
              .label-warehouse {
                font-size: 7pt;
                color: #999;
                margin-top: 1px;
              }
            `,
          }}
        />
      </head>
      <body>
        <div className="no-print">
          <p style={{ fontSize: "0.875rem", color: "#666" }}>
            {t.bins.printLabelsDescription} ({bins.length} {t.bins.heading.toLowerCase()})
          </p>
          <button
            type="button"
            onClick={() => {}}
            style={{
              padding: "0.5rem 1rem",
              background: "#000",
              color: "#fff",
              border: "none",
              borderRadius: "0.375rem",
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
            data-print
          >
            {t.bins.printLabels}
          </button>
          <script
            dangerouslySetInnerHTML={{
              __html: `document.querySelector('[data-print]').onclick=()=>window.print()`,
            }}
          />
        </div>

        <div className="label-grid">
          {bins.map((bin) => (
            <div key={bin.id} className="label">
              <div className="label-code">{bin.code}</div>
              {bin.label ? <div className="label-name">{bin.label}</div> : null}
              <div className="label-warehouse">{warehouse.code} — {warehouse.name}</div>
            </div>
          ))}
        </div>
      </body>
    </html>
  );
}
