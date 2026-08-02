import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Hero } from "@/components/marketing/hero";
import { FeatureGrid } from "@/components/marketing/feature-grid";
import { WorkflowSection } from "@/components/marketing/workflow-section";
import { CtaSection } from "@/components/marketing/cta-section";
import { Button } from "@/components/ui/button";
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
      <div className="container flex items-center justify-between pt-8">
        <Link
          href="/"
          className="group inline-flex items-center gap-1.5 text-sm font-medium text-text-faint transition-colors hover:text-text"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
          NexPrompt
        </Link>
        {session && (
          <Button size="sm" variant="outline" asChild>
            <Link href="/promptforge" className="gap-1.5">
              Go to dashboard <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        )}
      </div>
      <Hero signedIn={!!session} />
      <FeatureGrid />
      <WorkflowSection />
      <CtaSection signedIn={!!session} />
    </>
  );
}
