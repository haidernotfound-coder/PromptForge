import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PlatformHero } from "@/components/marketing/platform-hero";
import { ProductGrid } from "@/components/marketing/product-grid";
import { Button } from "@/components/ui/button";
import { getAppSessionOrNull } from "@/lib/session";

export const metadata: Metadata = {
  description:
    "NexPrompt is a platform of AI-powered tools. PromptForge (prompt writing and organization), CodeForge (generate, fix, and optimize code), and StudyForge (flashcards, quizzes, and study tools) are all available now, with more tools on the way.",
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const session = await getAppSessionOrNull();
  return (
    <>
      <PlatformHero signedIn={!!session} />
      <ProductGrid />

      <div className="border-t border-border">
        <div className="container py-20 text-center">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-balance">
            One account, signed in everywhere
          </h2>
          <p className="mt-3 text-text-muted max-w-lg mx-auto leading-relaxed">
            Sign in once to NexPrompt and you&apos;re signed in across every tool in the
            platform — PromptForge, CodeForge, and StudyForge included.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row flex-wrap gap-3 justify-center">
            {session ? (
              <>
                <Button size="lg" asChild>
                  <Link href="/products/promptforge">
                    Open PromptForge <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/products/codeforge">
                    Open CodeForge <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/products/studyforge">
                    Open StudyForge <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <Button size="lg" asChild>
                  <Link href="/signup">
                    Get started free <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="#products">Learn more about the platform</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
