import {
  Terminal,
  Sparkles,
  Zap,
  ShieldCheck,
  Code2,
  Wrench,
  Gauge,
  BookOpenText,
  Repeat,
  FlaskConical,
  FileText,
  ClipboardCheck,
  MessagesSquare,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ProductHero } from "@/components/dashboard/product-hero";
import { ToolGrid, type ToolGridItem } from "@/components/dashboard/tool-grid";
import { getAppSession } from "@/lib/session";
import { isCodeForgeConfigured } from "@/lib/supabase/config";
import { CODEFORGE_TOOLS } from "@/lib/codeforge";

export const metadata = { title: "CodeForge" };

const TOOL_VISUALS: Record<string, { icon: typeof Code2; accent: ToolGridItem["accent"] }> = {
  generate: { icon: Code2, accent: "violet" },
  fix: { icon: Wrench, accent: "amber" },
  optimize: { icon: Gauge, accent: "emerald" },
  explain: { icon: BookOpenText, accent: "blue" },
  convert: { icon: Repeat, accent: "cyan" },
  tests: { icon: FlaskConical, accent: "pink" },
  docs: { icon: FileText, accent: "teal" },
  review: { icon: ClipboardCheck, accent: "indigo" },
};

export default async function CodeForgeOverviewPage() {
  const session = await getAppSession();
  const firstName = session.name.split(" ")[0];
  const configured = isCodeForgeConfigured();

  const items: ToolGridItem[] = [
    ...CODEFORGE_TOOLS.map((tool) => ({
      id: tool.id,
      label: tool.label,
      description: tool.description,
      href: tool.href,
      icon: TOOL_VISUALS[tool.id]?.icon ?? Code2,
      accent: TOOL_VISUALS[tool.id]?.accent ?? "violet",
    })),
    {
      id: "chat",
      label: "AI Chat",
      description: "A free-form chat for anything code-related.",
      href: "/chat",
      icon: MessagesSquare,
      accent: "rose",
      badge: "New",
    },
  ];

  return (
    <div className="space-y-8">
      <ProductHero
        title="Welcome to CodeForge, "
        highlight={firstName}
        description={
          configured
            ? "Nine AI-assisted tools for writing, fixing, and understanding code — running on a real model provider."
            : "Nine AI-assisted tools for writing, fixing, and understanding code — currently running in demo mode."
        }
        icon={Terminal}
        stats={[
          { icon: Sparkles, label: "AI Tools", value: "9" },
          { icon: Zap, label: "Model Provider", value: "Groq" },
          { icon: ShieldCheck, label: "Private & Secure", value: "100%" },
        ]}
      />

      <ToolGrid items={items} />

      <Card>
        <CardHeader>
          <CardTitle>About CodeForge</CardTitle>
          <CardDescription>{session.isReal ? "Synced account" : "Local demo account"}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-text-muted space-y-2">
          <p>
            CodeForge is the second product on the NexPrompt platform, built with the same account, billing, and
            admin console as PromptForge — but with its own dedicated AI provider key pool, so traffic on one
            product never competes with or rate-limits the other.
          </p>
          <p>
            {configured
              ? "Every tool here runs against a real model provider (Groq)."
              : "It runs locally in demo mode — set CODEFORGE_GROQ_API_KEY_1 (up to _7 for automatic fallback) to wire up a real model provider."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
