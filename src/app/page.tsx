import type { Metadata } from "next";
import { PlatformHero } from "@/components/marketing/platform-hero";
import { ProductGrid } from "@/components/marketing/product-grid";
import { Hero } from "@/components/marketing/hero";
import { FeatureGrid } from "@/components/marketing/feature-grid";
import { WorkflowSection } from "@/components/marketing/workflow-section";
import { CtaSection } from "@/components/marketing/cta-section";
import { getAppSessionOrNull } from "@/lib/session";

export const metadata: Metadata = {
  description:
    "NexPrompt is a platform of AI-powered tools. PromptForge — write, tag, version, and share prompts for ChatGPT, Claude, Gemini, and Grok — is available now, with more tools on the way.",
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const session = await getAppSessionOrNull();
  return (
    <>
      <PlatformHero signedIn={!!session} />
      <ProductGrid />

      <div className="border-t border-border">
        <div className="container pt-16">
          <p className="text-center text-xs font-medium uppercase tracking-wider text-text-faint">
            Available now
          </p>
        </div>
        <Hero signedIn={!!session} />
        <FeatureGrid />
        <WorkflowSection />
        <CtaSection signedIn={!!session} />
      </div>
    </>
  );
}
