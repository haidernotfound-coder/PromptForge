import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KeyRound, Layers } from "lucide-react";
import type { GroqMonitorData, GroqPoolStatus } from "@/lib/admin/overview";
import { cn } from "@/lib/utils";

function usageTone(percentUsed: number): string {
  if (percentUsed >= 90) return "bg-danger";
  if (percentUsed >= 70) return "bg-brass";
  return "bg-accent";
}

const POOL_TITLES: Record<GroqPoolStatus["pool"], string> = {
  ai: "Prompt AI actions",
  forge_ai: "Forge AI chat",
  codeforge: "CodeForge tools + chat",
  studyforge: "StudyForge tools + chat",
  pptforge: "PPTForge generation",
};

export function PoolCard({ pool }: { pool: GroqPoolStatus }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base">{POOL_TITLES[pool.pool]}</CardTitle>
          <CardDescription>{pool.name}</CardDescription>
        </div>
        <Badge variant={pool.configured ? "success" : "slate"}>
          {pool.configured ? `${pool.keys.length} key${pool.keys.length === 1 ? "" : "s"}` : "Not configured"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {pool.keys.length === 0 && (
          <p className="text-sm text-text-muted">
            No keys configured for this pool — it falls back to the local simulation.
          </p>
        )}
        {pool.keys.map((key) => (
          <div key={key.label} className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 font-mono text-xs">
                <KeyRound className="h-3.5 w-3.5 text-text-faint" />
                {key.masked}
                {key.isActive && (
                  <Badge variant="default" className="ml-1">
                    active
                  </Badge>
                )}
              </span>
              <span className="text-text-muted text-xs">
                {key.requestCount} / {key.limit} req today
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface overflow-hidden border border-border">
              <div
                className={cn("h-full rounded-full transition-all", usageTone(key.percentUsed))}
                style={{ width: `${key.percentUsed}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-text-faint">
              <span>
                {key.successCount} ok · {key.failureCount} failed
              </span>
              <span>{Math.max(0, key.limit - key.requestCount)} remaining (est.)</span>
            </div>
          </div>
        ))}
        <div className="pt-2 border-t border-border flex items-center justify-between text-sm">
          <span className="text-text-muted">Pool total</span>
          <span className="font-medium">
            {pool.totalRequests} requests · {pool.totalSuccess} ok · {pool.totalFailure} failed
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function GroqMonitor({ data }: { data: GroqMonitorData }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <Layers className="h-4 w-4 text-accent" />
          <div>
            <CardTitle className="text-base">Combined across all fallback pools</CardTitle>
            <CardDescription>
              Prompt AI actions, Forge AI chat, CodeForge, and StudyForge each use fully independent key pools —
              this is their sum.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-2xl font-display font-semibold">{data.combined.totalKeys}</p>
            <p className="text-xs text-text-muted mt-1">Configured keys</p>
          </div>
          <div>
            <p className="text-2xl font-display font-semibold">{data.combined.totalRequests}</p>
            <p className="text-xs text-text-muted mt-1">Requests today</p>
          </div>
          <div>
            <p className="text-2xl font-display font-semibold text-success">{data.combined.totalSuccess}</p>
            <p className="text-xs text-text-muted mt-1">Successful</p>
          </div>
          <div>
            <p className="text-2xl font-display font-semibold text-danger">{data.combined.totalFailure}</p>
            <p className="text-xs text-text-muted mt-1">Failed / rate-limited</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
        {data.pools.map((pool) => (
          <PoolCard key={pool.pool} pool={pool} />
        ))}
      </div>
    </div>
  );
}
