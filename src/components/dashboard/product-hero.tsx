import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProductHeroStat {
  icon: LucideIcon;
  label: string;
  value: string;
}

export interface ProductHeroProps {
  title: string;
  highlight?: string;
  description: string;
  stats?: ProductHeroStat[];
  icon: LucideIcon;
  className?: string;
}

/**
 * Gradient banner used at the top of each product's overview page
 * (StudyForge / CodeForge / PromptForge). Purely presentational —
 * mirrors the mesh-gradient hero + stat-pill + floating-icon pattern
 * across all three products for a consistent dashboard feel.
 */
export function ProductHero({ title, highlight, description, stats, icon: Icon, className }: ProductHeroProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-surface-raised bg-gradient-mesh p-6 sm:p-8",
        className
      )}
    >
      <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xl">
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">
            {title}
            {highlight ? <span className="text-accent">{highlight}</span> : null}
          </h1>
          <p className="mt-2 text-sm text-text-muted">{description}</p>

          {stats && stats.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-3">
              {stats.map((stat, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-lg border border-border bg-surface/80 px-3 py-2 backdrop-blur-sm"
                >
                  <stat.icon className="h-4 w-4 text-accent shrink-0" />
                  <div className="leading-tight">
                    <div className="text-sm font-semibold text-text">{stat.value}</div>
                    <div className="text-[11px] text-text-muted">{stat.label}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="hidden sm:flex items-center justify-center shrink-0">
          <div className="relative flex h-32 w-32 items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-accent/20 blur-2xl" />
            <div className="absolute inset-3 rounded-full border border-accent/20 animate-pulse-soft" />
            <div className="relative flex h-20 w-20 animate-float items-center justify-center rounded-2xl bg-gradient-accent shadow-glow">
              <Icon className="h-9 w-9 text-accent-foreground" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
