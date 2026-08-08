"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { RefreshCw, Presentation, TriangleAlert } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { AdminBundle } from "@/components/admin/types";
import { PptForgeOverviewCards } from "@/components/admin/pptforge-overview-cards";
import { FeatureUsageChart } from "@/components/admin/feature-usage-chart";
import { PoolCard } from "@/components/admin/groq-monitor";
import { ActivityFeed } from "@/components/admin/activity-feed";
import { PptForgeTopStatistics } from "@/components/admin/pptforge-top-statistics";
import { ErrorLogs } from "@/components/admin/error-logs";
import { ServerHealthPanel } from "@/components/admin/server-health-panel";

const PPTFORGE_EVENT_TYPES = new Set(["pptforge.generate"]);

const fadeIn = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: "easeOut" as const },
};

export function PptForgeAdminPanel({
  data,
  onChanged,
}: {
  data: AdminBundle;
  onChanged: () => void;
}) {
  const [refreshing, setRefreshing] = React.useState(false);
  const [autoRefresh, setAutoRefresh] = React.useState(true);

  const pool = data.groq.pools.find((p) => p.pool === "pptforge");
  const pptLabels = data.featureLabels.filter((l) => l.startsWith("PPT: "));
  const pptActivity = data.activity.filter((e) => PPTFORGE_EVENT_TYPES.has(e.eventType));
  const pptErrors = data.errors.filter((e) => PPTFORGE_EVENT_TYPES.has(e.eventType));

  const [enabled, setEnabled] = React.useState(data.settings.pptforgeEnabled);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => setEnabled(data.settings.pptforgeEnabled), [data.settings.pptforgeEnabled]);

  const refresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await onChanged();
    } finally {
      setRefreshing(false);
    }
  }, [onChanged]);

  React.useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(refresh, 20_000);
    return () => clearInterval(id);
  }, [autoRefresh, refresh]);

  async function toggleEnabled(value: boolean) {
    setEnabled(value);
    setPending(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pptforgeEnabled: value }),
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
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Presentation className="h-5 w-5 text-accent" />
            <h2 className="font-display text-xl font-semibold tracking-tight">PPTForge</h2>
          </div>
          <p className="mt-1 text-sm text-text-muted">
            Topic-to-.pptx deck generation — its own Groq fallback pool, streamed straight to the
            browser with no server-side deck storage.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-faint">
            Updated {new Date(data.generatedAt).toLocaleTimeString()}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setAutoRefresh((v) => !v)}
          >
            {autoRefresh ? "Auto-refresh on" : "Auto-refresh off"}
          </Button>
          <Button variant="secondary" size="sm" className="gap-1.5" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {pool && !pool.configured && (
        <div className="flex items-start gap-2 rounded-md border border-brass/40 bg-brass/10 px-4 py-3 text-sm text-brass">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            No <code className="font-mono">PPTFORGE_GROQ_API_KEY_1..N</code> (or shared{" "}
            <code className="font-mono">GROQ_API_KEY_1..N</code>) environment variables are set —
            PPTForge can&apos;t generate decks until a Groq key is configured. Unlike StudyForge/CodeForge
            there is no local fallback, since a real .pptx needs a real model call.
          </span>
        </div>
      )}

      <motion.div {...fadeIn}>
        <PptForgeOverviewCards overview={data.pptforgeOverview} health={data.health} />
      </motion.div>

      <Tabs defaultValue="usage" className="w-full">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="usage">Feature Usage</TabsTrigger>
          <TabsTrigger value="groq">Groq Monitor</TabsTrigger>
          <TabsTrigger value="activity">Live Activity</TabsTrigger>
          <TabsTrigger value="top">Top Stats</TabsTrigger>
          <TabsTrigger value="errors">
            Error Logs
            {pptErrors.length > 0 && (
              <Badge variant="danger" className="ml-1.5">
                {pptErrors.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="health">Server Health</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="usage">
          <motion.div {...fadeIn} className="space-y-6 pt-2">
            <FeatureUsageChart series={data.featureUsageDaily} labels={pptLabels} />
          </motion.div>
        </TabsContent>

        <TabsContent value="groq">
          <motion.div {...fadeIn} className="pt-2">
            {pool ? (
              <div className="grid grid-cols-1 gap-6">
                <PoolCard pool={pool} />
              </div>
            ) : (
              <p className="text-sm text-text-muted">No PPTForge Groq pool data yet.</p>
            )}
          </motion.div>
        </TabsContent>

        <TabsContent value="activity">
          <motion.div {...fadeIn} className="pt-2">
            <ActivityFeed
              events={pptActivity}
              title="PPTForge activity"
              description="Most recent PPTForge deck generations."
            />
          </motion.div>
        </TabsContent>

        <TabsContent value="top">
          <motion.div {...fadeIn} className="pt-2">
            <PptForgeTopStatistics stats={data.pptforgeTopStats} />
          </motion.div>
        </TabsContent>

        <TabsContent value="errors">
          <motion.div {...fadeIn} className="pt-2">
            <ErrorLogs events={pptErrors} />
          </motion.div>
        </TabsContent>

        <TabsContent value="health">
          <motion.div {...fadeIn} className="pt-2">
            <ServerHealthPanel health={data.health} />
          </motion.div>
        </TabsContent>

        <TabsContent value="settings">
          <motion.div {...fadeIn} className="pt-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
                <div>
                  <CardTitle className="text-base">PPTForge enabled</CardTitle>
                  <CardDescription>
                    Turns deck generation on or off app-wide, instantly. For maintenance mode and other
                    platform-wide toggles, see the PromptForge tab&apos;s Settings.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-text-muted">{enabled ? "On" : "Off"}</Label>
                  <Switch checked={enabled} disabled={pending} onCheckedChange={toggleEnabled} />
                </div>
              </CardHeader>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
