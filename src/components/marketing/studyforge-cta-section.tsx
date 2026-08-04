import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function StudyForgeCtaSection({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="container py-24">
      <div className="rounded-lg border border-border bg-surface px-8 py-16 text-center relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent"
        />
        <h2 className="font-display text-3xl md:text-4xl font-semibold tracking-tight text-balance max-w-xl mx-auto">
          Stop juggling five different study tools
        </h2>
        <p className="mt-4 text-text-muted max-w-md mx-auto">
          Explain, summarize, generate flashcards, and study smarter from one workspace.
        </p>
        <div className="mt-8 flex justify-center">
          <Button size="lg" asChild>
            <Link href={signedIn ? "/studyforge" : "/signup"}>
              {signedIn ? "Go to dashboard" : "Start studying"} <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
