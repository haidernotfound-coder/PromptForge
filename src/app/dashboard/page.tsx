import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";
import { RecentPrompts } from "@/components/dashboard/recent-prompts";
import { getAppSession } from "@/lib/session";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await getAppSession();
  const firstName = session.name.split(" ")[0];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Welcome, {firstName}
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Here&apos;s what&apos;s happening in your demo workspace.
        </p>
      </div>

      <DashboardStats />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentPrompts />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>About this workspace</CardTitle>
            <CardDescription>Phase 4 — AI Features</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-text-muted space-y-2">
            <p>
              Prompts, folders, and tags persist locally in your browser —
              create, edit, favorite, and organize freely.
            </p>
            <p>
              Every prompt now has an AI assist panel (improve, rewrite,
              expand, shorten) and a template gallery to start from. It runs
              locally in demo mode — a real model provider is wired up in a
              later phase.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
