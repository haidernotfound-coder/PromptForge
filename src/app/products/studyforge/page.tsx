import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAppSessionOrNull } from "@/lib/session";
import { StudyForgeHero } from "@/components/marketing/studyforge-hero";
import { StudyForgeFeatureGrid } from "@/components/marketing/studyforge-feature-grid";
import { StudyForgeWorkflowSection } from "@/components/marketing/studyforge-workflow-section";
import { StudyForgeCtaSection } from "@/components/marketing/studyforge-cta-section";

export const metadata: Metadata = {
  title: "StudyForge",
  description:
    "StudyForge is NexPrompt's AI study workspace — explain concepts, generate notes, flashcards, quizzes, exam practice, and a study plan, get homework help, and summarize readings, plus a full AI Study Chat.",
  alternates: { canonical: "/products/studyforge" },
};

export default async function StudyForgeProductPage() {
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
            <Link href="/studyforge" className="gap-1.5">
              Go to dashboard <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        )}
      </div>
      <StudyForgeHero signedIn={!!session} />
      <StudyForgeFeatureGrid />
      <StudyForgeWorkflowSection />
      <StudyForgeCtaSection signedIn={!!session} />
    </>
  );
}
