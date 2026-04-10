import { FolderTree } from "lucide-react";
import type { Metadata } from "next";

import { DeleteButton } from "@/components/shell/delete-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { requireActiveMembership } from "@/lib/session";

import { deleteCategoryAction } from "./actions";
import { CategoryCreateForm, type CategoryCreateFormLabels } from "./category-create-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages();
  return { title: t.categories.metaTitle };
}

export default async function CategoriesPage() {
  const { membership } = await requireActiveMembership();
  const t = await getMessages();

  const categories = await db.category.findMany({
    where: { organizationId: membership.organizationId },
    include: {
      parent: { select: { id: true, name: true } },
      _count: { select: { items: true } },
    },
    orderBy: { name: "asc" },
  });

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t.categories.heading}</h1>
        <p className="text-muted-foreground">{t.categories.subtitle}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.categories.newCategory}</CardTitle>
        </CardHeader>
        <CardContent>
          <CategoryCreateForm labels={labels} parents={categories} />
        </CardContent>
      </Card>

      {categories.length === 0 ? (
        <Card>
          <CardHeader className="items-center text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <FolderTree className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle>{t.categories.emptyTitle}</CardTitle>
            <CardDescription>{t.categories.emptyBody}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.categories.columnName}</TableHead>
                  <TableHead>{t.categories.columnParent}</TableHead>
                  <TableHead className="text-right">{t.categories.columnItems}</TableHead>
                  <TableHead className="w-24 text-right">{t.categories.columnActions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.parent?.name ?? t.common.none}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{c._count.items}</TableCell>
                    <TableCell className="text-right">
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
