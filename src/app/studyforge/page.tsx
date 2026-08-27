import {
  GraduationCap,
  Sparkles,
  Zap,
  ShieldCheck,
  Lightbulb,
  NotebookPen,
  Layers,
  ListChecks,
  PencilLine,
  CalendarClock,
  FileText,
  ScrollText,
  MessagesSquare,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ProductHero } from "@/components/dashboard/product-hero";
import { ToolGrid, type ToolGridItem } from "@/components/dashboard/tool-grid";
import { getAppSession } from "@/lib/session";
import { isStudyForgeConfigured } from "@/lib/supabase/config";
import { STUDYFORGE_TOOLS } from "@/lib/studyforge";

export const metadata = { title: "StudyForge" };

const TOOL_VISUALS: Record<string, { icon: typeof Lightbulb; accent: ToolGridItem["accent"] }> = {
  explain: { icon: Lightbulb, accent: "violet" },
  notes: { icon: NotebookPen, accent: "blue" },
  flashcards: { icon: Layers, accent: "emerald" },
  quiz: { icon: ListChecks, accent: "amber" },
  homework: { icon: PencilLine, accent: "pink" },
  planner: { icon: CalendarClock, accent: "cyan" },
  summarize: { icon: FileText, accent: "teal" },
  exam: { icon: ScrollText, accent: "indigo" },
};

export default async function StudyForgeOverviewPage() {
  const session = await getAppSession();
  const firstName = session.name.split(" ")[0];
  const configured = isStudyForgeConfigured();

  const items: ToolGridItem[] = [
    ...STUDYFORGE_TOOLS.map((tool) => ({
      id: tool.id,
      label: tool.label,
      description: tool.description,
      href: tool.href,
      icon: TOOL_VISUALS[tool.id]?.icon ?? Lightbulb,
      accent: TOOL_VISUALS[tool.id]?.accent ?? "violet",
    })),
    {
      id: "chat",
      label: "AI Chat",
      description: "A free-form chat for anything study-related.",
      href: "/chat",
      icon: MessagesSquare,
      accent: "rose",
      badge: "New",
    },
  ];

  return (
    <div className="space-y-8">
      <ProductHero
        title="Welcome to StudyForge, "
        highlight={firstName}
        description={
          configured
            ? "Nine AI-assisted tools for learning, reviewing, and testing yourself — running on a real model provider."
            : "Nine AI-assisted tools for learning, reviewing, and testing yourself — currently running in demo mode."
        }
        icon={GraduationCap}
        stats={[
          { icon: Sparkles, label: "AI Tools", value: "9" },
          { icon: Zap, label: "Model Provider", value: "Groq" },
          { icon: ShieldCheck, label: "Private & Secure", value: "100%" },
        ]}
      />

      <ToolGrid items={items} />

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
