import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ServerHealth, HealthState } from "@/lib/admin/health";
import { cn } from "@/lib/utils";

const STATE_BADGE: Record<HealthState, { variant: "success" | "brass" | "danger" | "slate"; label: string }> = {
  operational: { variant: "success", label: "Operational" },
  degraded: { variant: "brass", label: "Degraded" },
  down: { variant: "danger", label: "Down" },
  not_configured: { variant: "slate", label: "Not configured" },
};

export function ServerHealthPanel({ health }: { health: ServerHealth }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Server health</CardTitle>
        <CardDescription>Supabase, Groq, and application runtime status.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {health.checks.map((check) => {
            const badge = STATE_BADGE[check.state];
            return (
              <li key={check.name} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className={cn("text-sm font-medium")}>{check.name}</p>
                  <p className="text-xs text-text-muted">{check.detail}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {check.latencyMs !== null && (
                    <span className="text-xs text-text-faint">{check.latencyMs}ms</span>
                  )}
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
