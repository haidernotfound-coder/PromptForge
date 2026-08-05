import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type ToolAccent =
  | "violet"
  | "blue"
  | "emerald"
  | "amber"
  | "pink"
  | "cyan"
  | "indigo"
  | "rose"
  | "teal";

// Static class strings (not built dynamically) so Tailwind's compiler
// can see and keep every one of them.
const ACCENT_CLASSES: Record<ToolAccent, string> = {
  violet: "bg-violet-500/15 text-violet-400",
  blue: "bg-blue-500/15 text-blue-400",
  emerald: "bg-emerald-500/15 text-emerald-400",
  amber: "bg-amber-500/15 text-amber-400",
  pink: "bg-pink-500/15 text-pink-400",
  cyan: "bg-cyan-500/15 text-cyan-400",
  indigo: "bg-indigo-500/15 text-indigo-400",
  rose: "bg-rose-500/15 text-rose-400",
  teal: "bg-teal-500/15 text-teal-400",
};

export interface ToolGridItem {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  accent: ToolAccent;
  badge?: string;
}

export function ToolGrid({ items }: { items: ToolGridItem[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((tool) => (
        <Link key={tool.id} href={tool.href} className="group block">
          <Card className="card-interactive h-full">
            <CardHeader className="gap-3">
              <div className="flex items-start justify-between">
                <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", ACCENT_CLASSES[tool.accent])}>
                  <tool.icon className="h-5 w-5" />
                </div>
                <ArrowRight className="h-4 w-4 text-text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent mt-1" />
              </div>
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  {tool.label}
                  {tool.badge ? (
                    <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                      {tool.badge}
                    </span>
                  ) : null}
                </CardTitle>
                <CardDescription className="mt-1">{tool.description}</CardDescription>
              </div>
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  );
}
