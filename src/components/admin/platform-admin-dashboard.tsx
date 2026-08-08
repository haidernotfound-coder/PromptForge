"use client";

import * as React from "react";
import { ShieldCheck, Sparkles, GraduationCap, Code2, Presentation, Lock, RefreshCw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AdminBundle } from "@/components/admin/types";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { CodeForgeAdminPanel } from "@/components/admin/codeforge-admin-panel";
import { StudyForgeAdminPanel } from "@/components/admin/studyforge-admin-panel";
import { PptForgeAdminPanel } from "@/components/admin/pptforge-admin-panel";

const COMING_SOON_PRODUCTS: { slug: string; name: string; icon: typeof Lock }[] = [];

export function PlatformAdminDashboard({
  initialData,
  adminEmailConfigured,
}: {
  initialData: AdminBundle;
  adminEmailConfigured: boolean;
}) {
  const [data, setData] = React.useState<AdminBundle>(initialData);
  const [refreshing, setRefreshing] = React.useState(false);

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

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-accent" />
          <h1 className="font-display text-2xl font-semibold tracking-tight">NexPrompt Admin</h1>
        </div>
        <p className="mt-1 text-sm text-text-muted">
          One console for the whole platform — pick a product to see its live stats.
        </p>
      </div>

      <Tabs defaultValue="promptforge" className="w-full">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="promptforge" className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> PromptForge
          </TabsTrigger>
          <TabsTrigger value="codeforge" className="gap-1.5">
            <Code2 className="h-3.5 w-3.5" /> CodeForge
          </TabsTrigger>
          <TabsTrigger value="studyforge" className="gap-1.5">
            <GraduationCap className="h-3.5 w-3.5" /> StudyForge
          </TabsTrigger>
          <TabsTrigger value="pptforge" className="gap-1.5">
            <Presentation className="h-3.5 w-3.5" /> PPTForge
          </TabsTrigger>
          {COMING_SOON_PRODUCTS.map((p) => (
            <TabsTrigger key={p.slug} value={p.slug} disabled className="gap-1.5 opacity-50">
              <p.icon className="h-3.5 w-3.5" /> {p.name}
              <Badge variant="slate" className="ml-1 gap-1 text-[10px]">
                <Lock className="h-2.5 w-2.5" /> Soon
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="promptforge">
          <div className="pt-4">
            <AdminDashboard
              initialData={data}
              adminEmailConfigured={adminEmailConfigured}
              showHeader={false}
            />
          </div>
        </TabsContent>

        <TabsContent value="codeforge">
          <div className="pt-4 space-y-4">
            <div className="flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                className="gap-1.5"
                onClick={refresh}
                disabled={refreshing}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
            <CodeForgeAdminPanel data={data} onChanged={refresh} />
          </div>
        </TabsContent>

        <TabsContent value="studyforge">
          <div className="pt-4 space-y-4">
            <div className="flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                className="gap-1.5"
                onClick={refresh}
                disabled={refreshing}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
            <StudyForgeAdminPanel data={data} onChanged={refresh} />
          </div>
        </TabsContent>

        <TabsContent value="pptforge">
          <div className="pt-4 space-y-4">
            <div className="flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                className="gap-1.5"
                onClick={refresh}
                disabled={refreshing}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
            <PptForgeAdminPanel data={data} onChanged={refresh} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
