import { Sparkles, Zap, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ProductHero } from "@/components/dashboard/product-hero";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";
import { RecentPrompts } from "@/components/dashboard/recent-prompts";
import { getAppSession } from "@/lib/session";
import { isAiConfigured } from "@/lib/supabase/config";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await getAppSession();
  const firstName = session.name.split(" ")[0];
  const aiConfigured = isAiConfigured();

  return (
    <div className="space-y-8">
      <ProductHero
        title="Welcome, "
        highlight={firstName}
        description={
          session.isReal
            ? "Here's what's happening in your workspace."
            : "Here's what's happening in your demo workspace."
        }
        icon={Sparkles}
        stats={[
          { icon: Sparkles, label: "AI Assist", value: "4x" },
          { icon: Zap, label: "Model Provider", value: "Groq" },
          { icon: ShieldCheck, label: "Private & Secure", value: "100%" },
        ]}
      />

      <DashboardStats />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentPrompts />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>About this workspace</CardTitle>
            <CardDescription>{session.isReal ? "Synced account" : "Local demo account"}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-text-muted space-y-2">
            <p>
              {session.isReal
                ? "Prompts, folders, and tags are synced to your account and available on any device you sign in from."
                : "Prompts, folders, and tags persist locally in your browser — create, edit, favorite, and organize freely."}
            </p>
            <p>
              Every prompt has an AI assist panel (improve, rewrite, expand,
              shorten) and a template gallery to start from.{" "}
              {aiConfigured
                ? "AI actions run against a real model provider (Groq)."
                : "It runs locally in demo mode — set GROQ_API_KEY to wire up a real model provider."}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
