"use client";

import * as React from "react";
import { toast } from "sonner";
import { Code2, TriangleAlert } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { AdminBundle } from "@/components/admin/types";
import { PoolCard } from "@/components/admin/groq-monitor";
import { FeatureUsageChart } from "@/components/admin/feature-usage-chart";
import { ActivityFeed } from "@/components/admin/activity-feed";

const CODEFORGE_EVENT_TYPES = new Set([
  "codeforge.generate",
  "codeforge.fix",
  "codeforge.optimize",
  "codeforge.explain",
  "codeforge.convert",
  "codeforge.tests",
  "codeforge.docs",
  "codeforge.review",
  "codeforge.chat",
]);

export function CodeForgeAdminPanel({
  data,
  onChanged,
}: {
  data: AdminBundle;
  onChanged: () => void;
}) {
  const pool = data.groq.pools.find((p) => p.pool === "codeforge");
  const cfLabels = data.featureLabels.filter((l) => l.startsWith("CF: "));
  const cfActivity = data.activity.filter((e) => CODEFORGE_EVENT_TYPES.has(e.eventType));
  const cfErrors = data.errors.filter((e) => CODEFORGE_EVENT_TYPES.has(e.eventType));

  const [enabled, setEnabled] = React.useState(data.settings.codeforgeEnabled);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => setEnabled(data.settings.codeforgeEnabled), [data.settings.codeforgeEnabled]);

  async function toggleEnabled(value: boolean) {
    setEnabled(value);
    setPending(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codeforgeEnabled: value }),
      });
      if (!res.ok) throw new Error("Request failed");
      toast.success("Settings updated");
      onChanged();
    } catch {
      setEnabled((prev) => !prev);
      toast.error("Couldn't update settings");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Code2 className="h-5 w-5 text-accent" />
        <h2 className="font-display text-xl font-semibold tracking-tight">CodeForge</h2>
      </div>
      <p className="-mt-3 text-sm text-text-muted">
        Generate, Fix Bugs, Optimize, Explain, Convert, Unit Tests, Documentation, Review, and AI
        Coding Chat — all running on their own 7-key Groq fallback pool, fully isolated from
        PromptForge&apos;s and Forge AI&apos;s pools.
      </p>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-base">CodeForge enabled</CardTitle>
            <CardDescription>
              Turns all 9 CodeForge tools on or off app-wide, instantly.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-text-muted">{enabled ? "On" : "Off"}</Label>
            <Switch checked={enabled} disabled={pending} onCheckedChange={toggleEnabled} />
          </div>
        </CardHeader>
      </Card>

      {pool && !pool.configured && (
        <div className="flex items-start gap-2 rounded-md border border-brass/40 bg-brass/10 px-4 py-3 text-sm text-brass">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            No <code className="font-mono">CODEFORGE_GROQ_API_KEY_1..7</code> environment
            variables are set yet — CodeForge is running on its local zero-setup fallback until
            keys are added.
          </span>
        </div>
      )}

      {pool && (
        <div className="grid grid-cols-1 gap-6">
          <PoolCard pool={pool} />
        </div>
      )}

      <FeatureUsageChart series={data.featureUsageDaily} labels={cfLabels} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActivityFeed
          events={cfActivity}
          title="CodeForge activity"
          description="Most recent CodeForge tool and chat runs."
        />
        <ActivityFeed
          events={cfErrors}
          title="CodeForge errors"
          description="Failed CodeForge requests, most recent first."
        />
      </div>
    </div>
  );
}
