import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingCollections() {
  return (
    <div className="container py-8 space-y-6" aria-busy="true" aria-live="polite">
      <Skeleton className="h-8 w-44" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
      <span className="sr-only">Loading collections…</span>
    </div>
  );
}
