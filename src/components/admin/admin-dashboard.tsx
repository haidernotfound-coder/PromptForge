"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { AdminBundle } from "@/components/admin/types";
import { OverviewCards } from "@/components/admin/overview-cards";
import { FeatureUsageChart } from "@/components/admin/feature-usage-chart";
import { GroqMonitor } from "@/components/admin/groq-monitor";
import { ActivityFeed } from "@/components/admin/activity-feed";
import { TopStatistics } from "@/components/admin/top-statistics";
import { ErrorLogs } from "@/components/admin/error-logs";
import { ServerHealthPanel } from "@/components/admin/server-health-panel";
import { AdminSettingsPanel } from "@/components/admin/admin-settings-panel";

const REFRESH_INTERVAL_MS = 20_000;

const fadeIn = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: "easeOut" as const },
};

export function AdminDashboard({
  initialData,
  adminEmailConfigured,
}: {
  initialData: AdminBundle;
  adminEmailConfigured: boolean;
}) {
  const [data, setData] = React.useState<AdminBundle>(initialData);
  const [refreshing, setRefreshing] = React.useState(false);
  const [autoRefresh, setAutoRefresh] = React.useState(true);

  const refresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/overview", { cache: "no-store" });
      if (res.ok) {
        const next = (await res.json()) as AdminBundle;
        setData(next);
      }
    } catch {
      // Keep showing the last good snapshot — a failed poll shouldn't
      // blank the dashboard.
    } finally {
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [autoRefresh, refresh]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-accent" />
            <h1 className="font-display text-2xl font-semibold tracking-tight">Admin Dashboard</h1>
          </div>
          <p className="mt-1 text-sm text-text-muted">
            Live usage, Groq key health, and system controls for NexPrompt.
          </p>
          {!adminEmailConfigured && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-brass">
              <TriangleAlert className="h-3.5 w-3.5" />
              You&apos;re viewing this via a database <code className="font-mono">is_admin</code> flag — no{" "}
              <code className="font-mono">ADMIN_EMAILS</code> env var is set.
            </p>
          )}
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

      <motion.div {...fadeIn}>
        <OverviewCards overview={data.overview} health={data.health} />
      </motion.div>

      <Tabs defaultValue="usage" className="w-full">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="usage">Feature Usage</TabsTrigger>
          <TabsTrigger value="groq">Groq Monitor</TabsTrigger>
          <TabsTrigger value="activity">Live Activity</TabsTrigger>
          <TabsTrigger value="top">Top Stats</TabsTrigger>
          <TabsTrigger value="errors">
            Error Logs
            {data.errors.length > 0 && (
              <Badge variant="danger" className="ml-1.5">
                {data.errors.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="health">Server Health</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="usage">
          <motion.div {...fadeIn} className="space-y-6 pt-2">
            <FeatureUsageChart series={data.featureUsageDaily} labels={data.featureLabels} />
          </motion.div>
        </TabsContent>

        <TabsContent value="groq">
          <motion.div {...fadeIn} className="pt-2">
            <GroqMonitor data={data.groq} />
          </motion.div>
        </TabsContent>

        <TabsContent value="activity">
          <motion.div {...fadeIn} className="pt-2">
            <ActivityFeed events={data.activity} />
          </motion.div>
        </TabsContent>

        <TabsContent value="top">
          <motion.div {...fadeIn} className="pt-2">
            <TopStatistics stats={data.topStats} />
          </motion.div>
        </TabsContent>

        <TabsContent value="errors">
          <motion.div {...fadeIn} className="pt-2">
            <ErrorLogs events={data.errors} />
          </motion.div>
        </TabsContent>

        <TabsContent value="health">
          <motion.div {...fadeIn} className="pt-2">
            <ServerHealthPanel health={data.health} />
          </motion.div>
        </TabsContent>

        <TabsContent value="settings">
          <motion.div {...fadeIn} className="pt-2">
            <AdminSettingsPanel settings={data.settings} onChanged={refresh} />
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
