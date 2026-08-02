import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAppSessionOrNull } from "@/lib/session";
import { CodeForgeHero } from "@/components/marketing/codeforge-hero";
import { CodeForgeFeatureGrid } from "@/components/marketing/codeforge-feature-grid";
import { CodeForgeWorkflowSection } from "@/components/marketing/codeforge-workflow-section";
import { CodeForgeCtaSection } from "@/components/marketing/codeforge-cta-section";

export const metadata: Metadata = {
  title: "CodeForge",
  description:
    "CodeForge is NexPrompt's AI coding workspace — generate, fix, optimize, explain, convert, test, document, and review code, plus a full AI coding chat.",
  alternates: { canonical: "/products/codeforge" },
};

export default async function CodeForgeProductPage() {
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
            <Link href="/codeforge" className="gap-1.5">
              Go to dashboard <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        )}
      </div>
      <CodeForgeHero signedIn={!!session} />
      <CodeForgeFeatureGrid />
      <CodeForgeWorkflowSection />
      <CodeForgeCtaSection signedIn={!!session} />
    </>
  );
}
