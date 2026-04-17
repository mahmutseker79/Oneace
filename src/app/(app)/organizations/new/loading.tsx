// Phase 20 — skeleton loading state for new organization page.
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <Skeleton className="h-7 w-48 mx-auto" />
          <Skeleton className="h-4 w-64 mx-auto" />
        </div>
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
            <Skeleton className="h-9 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
