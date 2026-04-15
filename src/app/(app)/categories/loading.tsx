// Phase 15.1 — skeleton loading state for categories page.
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const SKELETON_ROWS = ["r0", "r1", "r2", "r3"];

export default function CategoriesLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>

      {/* Inline create form skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>

      {/* Category list table skeleton */}
      <Card>
        <CardContent className="p-0">
          {SKELETON_ROWS.map((id) => (
            <div key={id} className="flex items-center gap-4 border-b px-6 py-3 last:border-b-0">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="ml-auto h-4 w-12" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
