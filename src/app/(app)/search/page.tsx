import { ChevronRight, Package, Search as SearchIcon, Truck, Warehouse } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";
import { format, getMessages } from "@/lib/i18n";
import { requireActiveMembership } from "@/lib/session";

/**
 * Global search — unified query across items, suppliers, and warehouses
 * scoped to the caller's active organization.
 *
 * Why a server component with ?q= in the URL (rather than a client-side
 * popover): search results are shareable, linkable, and survive refresh;
 * the result surface can be as rich as we like without fighting React
 * Suspense for hover-state UX; and we avoid shipping a client bundle for
 * what is fundamentally a stateless page. The header input is the only
 * client piece, and all it does is `router.push("/search?q=...")`.
 *
 * Minimum query length is two characters — anything shorter produces too
 * much noise against a real inventory and would bloat the initial result
 * table. Each section caps at 25 results; a truncation notice tells the
 * user when they're seeing a cap so they can refine the query.
 */

const SECTION_LIMIT = 25;
const MIN_QUERY_LENGTH = 2;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.search.metaTitle };
}

type SearchPageProps = {
  searchParams: Promise<{ q?: string | string[] }>;
};

function normalizeQuery(raw: string | string[] | undefined): string {
  if (Array.isArray(raw)) return (raw[0] ?? "").trim();
  return (raw ?? "").trim();
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();
  const params = await searchParams;
  const query = normalizeQuery(params.q);
  const hasQuery = query.length >= MIN_QUERY_LENGTH;

  const [items, suppliers, warehouses] = hasQuery
    ? await Promise.all([
        db.item.findMany({
          where: {
            organizationId: membership.organizationId,
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { sku: { contains: query, mode: "insensitive" } },
              { barcode: { contains: query, mode: "insensitive" } },
              { description: { contains: query, mode: "insensitive" } },
            ],
          },
          select: {
            id: true,
            sku: true,
            name: true,
            barcode: true,
            status: true,
            category: { select: { name: true } },
            stockLevels: { select: { quantity: true } },
          },
          orderBy: { updatedAt: "desc" },
          take: SECTION_LIMIT,
        }),
        db.supplier.findMany({
          where: {
            organizationId: membership.organizationId,
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { code: { contains: query, mode: "insensitive" } },
              { contactName: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
            ],
          },
          select: {
            id: true,
            name: true,
            code: true,
            contactName: true,
            email: true,
          },
          orderBy: { name: "asc" },
          take: SECTION_LIMIT,
        }),
        db.warehouse.findMany({
          where: {
            organizationId: membership.organizationId,
            isArchived: false,
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { code: { contains: query, mode: "insensitive" } },
              { city: { contains: query, mode: "insensitive" } },
            ],
          },
          select: {
            id: true,
            name: true,
            code: true,
            city: true,
            isDefault: true,
          },
          orderBy: { name: "asc" },
          take: SECTION_LIMIT,
        }),
      ])
    : [[], [], []];

  const totalCount = items.length + suppliers.length + warehouses.length;

  return (
    <div className="space-y-6">
      {/* Sprint 4 PR #1 (UX/UI audit Apr-25) — Migrate inline search
          header to canonical PageHeader. The leading SearchIcon is
          dropped; PageHeader's spacing handles the visual rhythm. */}
      <PageHeader title={t.search.heading} description={t.search.subtitle} />

      {!hasQuery ? (
        <Card>
          <CardHeader className="items-center text-center">
            <div className="bg-muted mx-auto flex h-12 w-12 items-center justify-center rounded-full">
              <SearchIcon className="text-muted-foreground h-6 w-6" />
            </div>
            <CardTitle>{t.search.emptyQueryTitle}</CardTitle>
            <CardDescription>{t.search.emptyQueryBody}</CardDescription>
          </CardHeader>
        </Card>
      ) : totalCount === 0 ? (
        <Card>
          <CardHeader className="items-center text-center">
            <div className="bg-muted mx-auto flex h-12 w-12 items-center justify-center rounded-full">
              <SearchIcon className="text-muted-foreground h-6 w-6" />
            </div>
            <CardTitle>{t.search.noResultsTitle}</CardTitle>
            <CardDescription>{format(t.search.noResultsBody, { query })}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <p className="text-muted-foreground text-sm">
            {format(t.search.resultsCount, { count: String(totalCount), query })}
          </p>

          <Card>
            <CardHeader className="flex flex-row items-center gap-3">
              <Package className="text-muted-foreground h-5 w-5" />
              <div>
                <CardTitle className="text-base">{t.search.sectionItems}</CardTitle>
                <CardDescription>
                  {items.length === SECTION_LIMIT
                    ? format(t.search.truncatedNotice, { limit: String(SECTION_LIMIT) })
                    : null}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-0 p-0">
              {items.length === 0 ? (
                <p className="text-muted-foreground px-6 pb-6 text-sm">{t.search.sectionEmpty}</p>
              ) : (
                <ul className="divide-y">
                  {items.map((item) => {
                    const onHand = item.stockLevels.reduce((acc, s) => acc + s.quantity, 0);
                    return (
                      <li key={item.id}>
                        <Link
                          href={`/items/${item.id}`}
                          className="hover:bg-muted/40 flex items-center justify-between gap-4 px-6 py-3"
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{item.name}</span>
                              <span className="text-muted-foreground font-mono text-xs">
                                {item.sku}
                              </span>
                              {item.status !== "ACTIVE" ? (
                                <Badge variant="secondary" className="text-[10px]">
                                  {item.status === "DRAFT" ? t.common.draft : t.common.archived}
                                </Badge>
                              ) : null}
                            </div>
                            <div className="text-muted-foreground flex flex-wrap gap-3 text-xs">
                              <span>
                                {format(t.search.itemMetaOnHand, { qty: String(onHand) })}
                              </span>
                              {item.barcode ? (
                                <span>
                                  {format(t.search.itemMetaBarcode, { barcode: item.barcode })}
                                </span>
                              ) : null}
                              {item.category ? (
                                <span>
                                  {format(t.search.itemMetaCategory, {
                                    category: item.category.name,
                                  })}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-3">
              <Truck className="text-muted-foreground h-5 w-5" />
              <div>
                <CardTitle className="text-base">{t.search.sectionSuppliers}</CardTitle>
                <CardDescription>
                  {suppliers.length === SECTION_LIMIT
                    ? format(t.search.truncatedNotice, { limit: String(SECTION_LIMIT) })
                    : null}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-0 p-0">
              {suppliers.length === 0 ? (
                <p className="text-muted-foreground px-6 pb-6 text-sm">{t.search.sectionEmpty}</p>
              ) : (
                <ul className="divide-y">
                  {suppliers.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`/suppliers/${s.id}`}
                        className="hover:bg-muted/40 flex items-center justify-between gap-4 px-6 py-3"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{s.name}</span>
                            {s.code ? (
                              <span className="text-muted-foreground font-mono text-xs">
                                {s.code}
                              </span>
                            ) : null}
                          </div>
                          {s.contactName || s.email ? (
                            <p className="text-muted-foreground text-xs">
                              {format(t.search.supplierMetaContact, {
                                contact: [s.contactName, s.email].filter(Boolean).join(" · "),
                              })}
                            </p>
                          ) : null}
                        </div>
                        <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-3">
              <Warehouse className="text-muted-foreground h-5 w-5" />
              <div>
                <CardTitle className="text-base">{t.search.sectionWarehouses}</CardTitle>
                <CardDescription>
                  {warehouses.length === SECTION_LIMIT
                    ? format(t.search.truncatedNotice, { limit: String(SECTION_LIMIT) })
                    : null}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-0 p-0">
              {warehouses.length === 0 ? (
                <p className="text-muted-foreground px-6 pb-6 text-sm">{t.search.sectionEmpty}</p>
              ) : (
                <ul className="divide-y">
                  {warehouses.map((w) => (
                    <li key={w.id}>
                      <Link
                        href={`/warehouses/${w.id}`}
                        className="hover:bg-muted/40 flex items-center justify-between gap-4 px-6 py-3"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{w.name}</span>
                            {w.isDefault ? (
                              <Badge variant="outline" className="text-[10px]">
                                {t.search.warehouseDefaultBadge}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-muted-foreground text-xs">
                            {format(t.search.warehouseMetaCode, { code: w.code })}
                            {w.city ? ` · ${w.city}` : ""}
                          </p>
                        </div>
                        <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
