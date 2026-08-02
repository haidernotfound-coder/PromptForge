import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingTemplates() {
  return (
    <div className="container py-8 space-y-6" aria-busy="true" aria-live="polite">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-10 w-full" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-36 w-full" />
        ))}
      </div>
      <span className="sr-only">Loading templates…</span>
    </div>
  );
}
