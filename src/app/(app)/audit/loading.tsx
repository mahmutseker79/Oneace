import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const ROWS = ["r0", "r1", "r2", "r3", "r4", "r5", "r6", "r7", "r8", "r9"];

export default function AuditLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Audit table */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-3 w-56" />
        </CardHeader>
        <CardContent className="p-0">
          {ROWS.map((id) => (
            <div key={id} className="flex items-center gap-4 border-b px-6 py-3 last:border-b-0">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="ml-auto h-4 w-40" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
