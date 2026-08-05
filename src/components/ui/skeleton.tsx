import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("relative overflow-hidden rounded-md bg-surface-raised before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer before:bg-shimmer", className)}
      {...props}
    />
  );
}

export { Skeleton };
