import { FolderTree } from "lucide-react";
import type { Metadata } from "next";

import { PicklistCacheSync } from "@/components/offline/picklist-cache-sync";
import { AdvancedFeatureBanner } from "@/components/shell/advanced-feature-banner";
import { DeleteButton } from "@/components/shell/delete-button";
import { WrapperTabs } from "@/components/shell/wrapper-tabs";
import { INVENTORY_TAB_SPECS, resolveWrapperTabs } from "@/components/shell/wrapper-tabs-config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/i18n";
import type { CategorySnapshotRow } from "@/lib/offline/categories-cache";
import { hasCapability } from "@/lib/permissions";
import { requireActiveMembership } from "@/lib/session";

import { deleteCategoryAction } from "./actions";
import { CategoryCreateForm, type CategoryCreateFormLabels } from "./category-create-form";
import { CategoryRenameDialog, type CategoryRenameDialogLabels } from "./category-rename-dialog";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.categories.metaTitle };
}

export default async function CategoriesPage() {
  const { membership, session } = await requireActiveMembership();
  const t = await getMessages();

  // P10.1 — capability flags for conditional UI rendering
  const canCreate = hasCapability(membership.role, "categories.create");
  const canEdit = hasCapability(membership.role, "categories.edit");
  const canDelete = hasCapability(membership.role, "categories.delete");
  const orgPlan = membership.organization.plan as "FREE" | "PRO" | "BUSINESS";

  const categories = await db.category.findMany({
    where: { organizationId: membership.organizationId },
    include: {
      parent: { select: { id: true, name: true } },
      _count: { select: { items: true } },
    },
    orderBy: { name: "asc" },
  });

  // Serializable snapshot for the Dexie picklist cache. Parent id
  // is the only relational field we keep — the tree structure is
  // rebuilt client-side from the parentId pointers.
  const cacheScope = {
    orgId: membership.organizationId,
    userId: session.user.id,
  };
  const cacheRows: CategorySnapshotRow[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    parentId: c.parentId,
  }));

  const labels: CategoryCreateFormLabels = {
    fields: t.categories.fields,
    common: {
      save: t.common.save,
      optional: t.common.optional,
      none: t.common.none,
    },
    newCategory: t.categories.newCategory,
    error: t.categories.errors.createFailed,
  };

  const renameLabels: CategoryRenameDialogLabels = {
    trigger: t.categories.rename.trigger,
    title: t.categories.rename.title,
    body: t.categories.rename.body,
    nameLabel: t.categories.rename.nameLabel,
    cancel: t.categories.rename.cancel,
    submit: t.categories.rename.submit,
  };

  return (
    <div className="space-y-6">
      <WrapperTabs
        tabs={resolveWrapperTabs(INVENTORY_TAB_SPECS, t)}
        ariaLabel="Inventory sections"
      />
      <AdvancedFeatureBanner labels={t.advancedFeature} plan={orgPlan} />

      <PageHeader title={t.categories.heading} description={t.categories.subtitle} />

      {canCreate ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.categories.newCategory}</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryCreateForm labels={labels} parents={categories} />
          </CardContent>
        </Card>
      ) : null}

      {/* Phase 7.5 — use EmptyState component (was inline Card) */}
      {categories.length === 0 ? (
        <EmptyState
          icon={FolderTree}
          title={t.categories.emptyTitle}
          description={t.categories.emptyBody}
          actions={
            canCreate
              ? [
                  {
                    label: t.categories.createFirst ?? "Create a category",
                    href: "#create-form",
                  },
                ]
              : undefined
          }
        />
      ) : (
        <>
          {/* Phase 19 — mobile cards (below md) */}
          <div className="space-y-2 md:hidden">
            {categories.map((c) => (
              <Card key={c.id}>
                <CardContent className="flex items-center justify-between py-3 px-4">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{c.name}</p>
                    {c.parent ? (
                      <p className="text-xs text-muted-foreground">{c.parent.name}</p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {c._count.items} {t.categories.columnItems.toLowerCase()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {canEdit ? (
                      <CategoryRenameDialog
                        categoryId={c.id}
                        currentName={c.name}
                        labels={renameLabels}
                      />
                    ) : null}
                    {canDelete ? (
                      <DeleteButton
                        labels={{
                          trigger: t.common.delete,
                          title: t.categories.deleteConfirmTitle,
                          body: t.categories.deleteConfirmBody,
                          cancel: t.common.cancel,
                          confirm: t.common.delete,
                        }}
                        action={deleteCategoryAction.bind(null, c.id)}
                        iconOnly
                      />
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop table (hidden below md) */}
          <Card className="hidden md:block">
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.categories.columnName}</TableHead>
                    <TableHead>{t.categories.columnParent}</TableHead>
                    <TableHead className="text-right">{t.categories.columnItems}</TableHead>
                    <TableHead className="w-32 text-right">{t.categories.columnActions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((c) => (
                    <TableRow key={c.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.parent?.name ?? t.common.none}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{c._count.items}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canEdit ? (
                            <CategoryRenameDialog
                              categoryId={c.id}
                              currentName={c.name}
                              labels={renameLabels}
                            />
                          ) : null}
                          {canDelete ? (
                            <DeleteButton
                              labels={{
                                trigger: t.common.delete,
                                title: t.categories.deleteConfirmTitle,
                                body: t.categories.deleteConfirmBody,
                                cancel: t.common.cancel,
                                confirm: t.common.delete,
                              }}
                              action={deleteCategoryAction.bind(null, c.id)}
                              iconOnly
                            />
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <PicklistCacheSync table="categories" scope={cacheScope} rows={cacheRows} />
    </div>
  );
}
