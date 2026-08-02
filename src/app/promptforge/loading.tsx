import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingDashboard() {
  return (
    <div className="container py-8 space-y-6" aria-busy="true" aria-live="polite">
      <Skeleton className="h-8 w-52" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
      <span className="sr-only">Loading dashboard…</span>
    </div>
  );
}
