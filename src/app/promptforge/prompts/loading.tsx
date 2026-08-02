import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingPrompts() {
  return (
    <div className="container py-8 space-y-6" aria-busy="true" aria-live="polite">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-28" />
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
      <span className="sr-only">Loading prompts…</span>
    </div>
  );
}
