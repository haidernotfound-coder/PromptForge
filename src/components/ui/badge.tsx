import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-accent-soft text-accent",
        outline: "border-border text-text-muted",
        brass: "border-transparent bg-brass-soft text-brass",
        success: "border-transparent bg-success/15 text-success",
        danger: "border-transparent bg-danger/15 text-danger",
        slate: "border-transparent bg-surface text-text-muted border-border",
        sky: "border-transparent bg-sky-500/15 text-sky-600 dark:text-sky-400",
        violet: "border-transparent bg-accent-soft text-accent",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
