import { Card, CardContent } from "@/components/ui/card";
import { Users, Activity, Zap, FilePlus2, AlertTriangle } from "lucide-react";
import type { OverviewCounts } from "@/lib/admin/overview";
import type { ServerHealth } from "@/lib/admin/health";
import { cn } from "@/lib/utils";

const HEALTH_DOT: Record<ServerHealth["overall"], string> = {
  operational: "bg-success",
  degraded: "bg-brass",
  down: "bg-danger",
  not_configured: "bg-text-faint",
};

export function OverviewCards({ overview, health }: { overview: OverviewCounts; health: ServerHealth }) {
  const stats: { label: string; value: string | number; icon: typeof Users; tone?: "danger" }[] = [
    {
      label: "Total users",
      value: overview.totalUsers ?? "—",
      icon: Users,
    },
    { label: "Active today", value: overview.activeToday, icon: Activity },
    { label: "AI requests today", value: overview.aiRequestsToday, icon: Zap },
    { label: "Prompts created", value: overview.promptsCreatedToday, icon: FilePlus2 },
    {
      label: "Failed requests",
      value: overview.failedRequestsToday,
      icon: AlertTriangle,
      tone: overview.failedRequestsToday > 0 ? "danger" : undefined,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p
                className={cn(
                  "text-2xl font-display font-semibold",
                  stat.tone === "danger" && "text-danger"
                )}
              >
                {stat.value}
              </p>
              <p className="text-xs text-text-muted mt-1">{stat.label}</p>
            </div>
            <stat.icon className={cn("h-5 w-5", stat.tone === "danger" ? "text-danger" : "text-text-faint")} />
          </CardContent>
        </Card>
      ))}
      <Card className="col-span-2 lg:col-span-5">
        <CardContent className="pt-4 pb-4 flex items-center gap-2 text-xs text-text-muted">
          <span className={cn("h-2 w-2 rounded-full", HEALTH_DOT[health.overall])} />
          System status:{" "}
          <span className="font-medium text-text capitalize">{health.overall.replace("_", " ")}</span>
          <span className="text-text-faint">· see Server Health tab for details</span>
        </CardContent>
      </Card>
    </div>
  );
}
