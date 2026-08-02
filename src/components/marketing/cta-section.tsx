import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CtaSection({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="container py-24">
      <div className="rounded-lg border border-border bg-surface px-8 py-16 text-center relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent"
        />
        <h2 className="font-display text-3xl md:text-4xl font-semibold tracking-tight text-balance max-w-xl mx-auto">
          Stop losing your best prompts in a notes app
        </h2>
        <p className="mt-4 text-text-muted max-w-md mx-auto">
          Bring them into a workspace built for exactly this.
        </p>
        <div className="mt-8 flex justify-center">
          <Button size="lg" asChild>
            <Link href={signedIn ? "/promptforge" : "/signup"}>
              {signedIn ? "Go to dashboard" : "Start forging"} <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
