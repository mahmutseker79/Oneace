import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const MEMBER_ROWS = ["m0", "m1", "m2", "m3"];

export default function UsersLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-60" />
      </div>

      {/* Invite form card */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-3 w-56" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Skeleton className="h-9 flex-1" />
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-24" />
          </div>
        </CardContent>
      </Card>

      {/* Members table */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-28" />
        </CardHeader>
        <CardContent className="p-0">
          {MEMBER_ROWS.map((id) => (
            <div key={id} className="flex items-center gap-4 border-b px-6 py-3 last:border-b-0">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="ml-auto h-8 w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
