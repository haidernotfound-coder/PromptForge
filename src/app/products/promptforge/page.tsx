import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Hero } from "@/components/marketing/hero";
import { FeatureGrid } from "@/components/marketing/feature-grid";
import { WorkflowSection } from "@/components/marketing/workflow-section";
import { CtaSection } from "@/components/marketing/cta-section";
import { getAppSessionOrNull } from "@/lib/session";

export const metadata: Metadata = {
  title: "PromptForge",
  description:
    "PromptForge is NexPrompt's prompt workspace — write, tag, version, and share prompts for ChatGPT, Claude, Gemini, and Grok in one forge.",
  alternates: { canonical: "/products/promptforge" },
};

export default async function PromptForgeProductPage() {
  const session = await getAppSessionOrNull();
  return (
    <>
      <div className="container pt-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted hover:text-text transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to NexPrompt
        </Link>
      </div>
      <Hero signedIn={!!session} />
      <FeatureGrid />
      <WorkflowSection />
      <CtaSection signedIn={!!session} />
    </>
  );
}
