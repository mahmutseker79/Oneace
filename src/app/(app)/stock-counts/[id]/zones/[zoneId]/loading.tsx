export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="bg-muted h-7 w-48 rounded" />
        <div className="bg-muted h-4 w-72 rounded" />
      </div>
      <div className="border-border bg-card space-y-4 rounded-lg border p-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1">
            <div className="bg-muted h-4 w-24 rounded" />
            <div className="bg-muted h-10 w-full rounded-md" />
          </div>
        ))}
        <div className="bg-muted h-10 w-32 rounded-md" />
      </div>
    </div>
  );
}
