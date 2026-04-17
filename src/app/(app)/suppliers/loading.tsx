// Phase 17 — skeleton loading state for suppliers list page.
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const ROWS = ["r0", "r1", "r2", "r3", "r4"];

export default function SuppliersLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <Card>
        <CardContent className="p-0">
          {ROWS.map((id) => (
            <div key={id} className="flex items-center gap-4 border-b px-6 py-3 last:border-b-0">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="ml-auto h-4 w-24" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
