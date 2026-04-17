export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="bg-muted h-7 w-48 rounded" />
          <div className="bg-muted h-4 w-72 rounded" />
        </div>
        <div className="bg-muted h-10 w-32 rounded-md" />
      </div>
      <div className="border-border bg-card rounded-lg border p-6">
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-muted h-5 rounded" style={{ width: `${80 - i * 5}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
