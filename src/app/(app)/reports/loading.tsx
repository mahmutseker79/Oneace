import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const CARDS = ["c0", "c1", "c2", "c3", "c4"];

export default function ReportsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6" />
          <Skeleton className="h-7 w-36" />
        </div>
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Report cards grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {CARDS.map((id) => (
          <Card key={id} className="opacity-60">
            <CardHeader className="pb-2">
              <div className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 rounded-md" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-9 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
