// Phase 17 — skeleton loading state for new PO form.
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-52" />
      </div>
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-20 w-full" />
          </div>
          <div className="flex justify-end gap-3 border-t pt-6">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-28" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
