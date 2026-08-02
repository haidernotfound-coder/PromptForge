import type { Metadata } from "next";
import { Hero } from "@/components/marketing/hero";
import { FeatureGrid } from "@/components/marketing/feature-grid";
import { WorkflowSection } from "@/components/marketing/workflow-section";
import { CtaSection } from "@/components/marketing/cta-section";
import { getAppSessionOrNull } from "@/lib/session";

export const metadata: Metadata = {
  description:
    "NexPrompt is the workspace for prompt engineers: write, tag, version, and share prompts for ChatGPT, Claude, Gemini, and Grok in one forge.",
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const session = await getAppSessionOrNull();
  return (
    <>
      <Hero signedIn={!!session} />
      <FeatureGrid />
      <WorkflowSection />
      <CtaSection signedIn={!!session} />
    </>
  );
}
