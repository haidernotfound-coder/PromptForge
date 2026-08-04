import Link from "next/link";
import { ArrowRight, MessagesSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getAppSession } from "@/lib/session";
import { isStudyForgeConfigured } from "@/lib/supabase/config";
import { STUDYFORGE_TOOLS } from "@/lib/studyforge";

export const metadata = { title: "StudyForge" };

export default async function StudyForgeOverviewPage() {
  const session = await getAppSession();
  const firstName = session.name.split(" ")[0];
  const configured = isStudyForgeConfigured();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Welcome to StudyForge, {firstName}</h1>
        <p className="mt-1 text-sm text-text-muted">
          {configured
            ? "Nine AI-assisted tools for learning, reviewing, and testing yourself — running on a real model provider."
            : "Nine AI-assisted tools for learning, reviewing, and testing yourself — currently running in demo mode."}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {STUDYFORGE_TOOLS.map((tool) => (
          <Link key={tool.id} href={tool.href} className="group">
            <Card className="h-full transition-colors group-hover:border-accent/50">
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  {tool.label}
                  <ArrowRight className="h-4 w-4 text-text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
                </CardTitle>
                <CardDescription>{tool.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
        <Link href="/studyforge/chat" className="group">
          <Card className="h-full border-accent/30 transition-colors group-hover:border-accent/60">
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <MessagesSquare className="h-4 w-4 text-accent" /> AI Study Chat
                </span>
                <ArrowRight className="h-4 w-4 text-text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
              </CardTitle>
              <CardDescription>A free-form chat for anything study-related.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>About StudyForge</CardTitle>
          <CardDescription>{session.isReal ? "Synced account" : "Local demo account"}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-text-muted space-y-2">
          <p>
            StudyForge is the third product on the NexPrompt platform, built with the same account, billing, and
            admin console as PromptForge and CodeForge — but with its own dedicated AI provider key pool, so
            traffic on one product never competes with or rate-limits the others.
          </p>
          <p>
            {configured
              ? "Every tool here runs against a real model provider (Groq)."
              : "It runs locally in demo mode — set STUDYFORGE_GROQ_API_KEY_1 (up to _10 for automatic fallback) to wire up a real model provider."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
