"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { RefreshCw, BookOpen, TriangleAlert } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { AdminBundle } from "@/components/admin/types";
import { StudyForgeOverviewCards } from "@/components/admin/studyforge-overview-cards";
import { FeatureUsageChart } from "@/components/admin/feature-usage-chart";
import { PoolCard } from "@/components/admin/groq-monitor";
import { ActivityFeed } from "@/components/admin/activity-feed";
import { StudyForgeTopStatistics } from "@/components/admin/studyforge-top-statistics";
import { ErrorLogs } from "@/components/admin/error-logs";
import { ServerHealthPanel } from "@/components/admin/server-health-panel";

const CODEFORGE_EVENT_TYPES = new Set([
  "studyforge.generate",
  "studyforge.fix",
  "studyforge.optimize",
  "studyforge.explain",
  "studyforge.convert",
  "studyforge.tests",
  "studyforge.docs",
  "studyforge.review",
  "studyforge.chat",
]);

const fadeIn = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: "easeOut" as const },
};

export function StudyForgeAdminPanel({
  data,
  onChanged,
}: {
  data: AdminBundle;
  onChanged: () => void;
}) {
  const [refreshing, setRefreshing] = React.useState(false);
  const [autoRefresh, setAutoRefresh] = React.useState(true);

  const pool = data.groq.pools.find((p) => p.pool === "studyforge");
  const cfLabels = data.featureLabels.filter((l) => l.startsWith("CF: "));
  const cfActivity = data.activity.filter((e) => CODEFORGE_EVENT_TYPES.has(e.eventType));
  const cfErrors = data.errors.filter((e) => CODEFORGE_EVENT_TYPES.has(e.eventType));

  const [enabled, setEnabled] = React.useState(data.settings.studyforgeEnabled);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => setEnabled(data.settings.studyforgeEnabled), [data.settings.studyforgeEnabled]);

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
        body: JSON.stringify({ studyforgeEnabled: value }),
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
            <BookOpen className="h-5 w-5 text-accent" />
            <h2 className="font-display text-xl font-semibold tracking-tight">StudyForge</h2>
          </div>
          <p className="mt-1 text-sm text-text-muted">
            Explain Concepts, Notes Generator, Flashcards, Quiz Generator, Homework Helper, Study
            Planner, Notes Summarizer, Exam Practice, and AI Study Chat — all running on their own
            10-key Groq fallback pool.
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
            No <code className="font-mono">STUDYFORGE_GROQ_API_KEY_1..10</code> environment
            variables are set yet — StudyForge is running on its local zero-setup fallback until
            keys are added.
          </span>
        </div>
      )}

      <motion.div {...fadeIn}>
        <StudyForgeOverviewCards overview={data.studyforgeOverview} health={data.health} />
      </motion.div>

      <Tabs defaultValue="usage" className="w-full">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="usage">Feature Usage</TabsTrigger>
          <TabsTrigger value="groq">Groq Monitor</TabsTrigger>
          <TabsTrigger value="activity">Live Activity</TabsTrigger>
          <TabsTrigger value="top">Top Stats</TabsTrigger>
          <TabsTrigger value="errors">
            Error Logs
            {cfErrors.length > 0 && (
              <Badge variant="danger" className="ml-1.5">
                {cfErrors.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="health">Server Health</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="usage">
          <motion.div {...fadeIn} className="space-y-6 pt-2">
            <FeatureUsageChart series={data.featureUsageDaily} labels={cfLabels} />
          </motion.div>
        </TabsContent>

        <TabsContent value="groq">
          <motion.div {...fadeIn} className="pt-2">
            {pool ? (
              <div className="grid grid-cols-1 gap-6">
                <PoolCard pool={pool} />
              </div>
            ) : (
              <p className="text-sm text-text-muted">No StudyForge Groq pool data yet.</p>
            )}
          </motion.div>
        </TabsContent>

        <TabsContent value="activity">
          <motion.div {...fadeIn} className="pt-2">
            <ActivityFeed
              events={cfActivity}
              title="StudyForge activity"
              description="Most recent StudyForge tool and chat runs."
            />
          </motion.div>
        </TabsContent>

        <TabsContent value="top">
          <motion.div {...fadeIn} className="pt-2">
            <StudyForgeTopStatistics stats={data.studyforgeTopStats} />
          </motion.div>
        </TabsContent>

        <TabsContent value="errors">
          <motion.div {...fadeIn} className="pt-2">
            <ErrorLogs events={cfErrors} />
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
                  <CardTitle className="text-base">StudyForge enabled</CardTitle>
                  <CardDescription>
                    Turns all 8 StudyForge tools and AI Study Chat on or off app-wide, instantly.
                    For maintenance mode and other platform-wide toggles, see the PromptForge
                    tab&apos;s Settings.
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
