// Phase 17 — skeleton loading state for PO receive form.
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
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="divide-y rounded-md border">
            <div className="flex gap-4 px-4 py-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="ml-auto h-4 w-20" />
            </div>
            <div className="flex gap-4 px-4 py-3">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="ml-auto h-4 w-20" />
            </div>
            <div className="flex gap-4 px-4 py-3">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="ml-auto h-4 w-20" />
            </div>
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
