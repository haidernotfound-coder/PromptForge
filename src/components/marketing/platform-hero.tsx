"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PlatformHero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-40 h-[420px] bg-[radial-gradient(ellipse_at_top,hsl(var(--accent)/0.16),transparent_65%)]"
      />
      <div className="container relative py-20 md:py-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="mx-auto max-w-2xl"
        >
          <div className="temper-line w-24 mx-auto mb-6" />
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-text-faint">
            NexPrompt
          </p>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05] text-balance">
            One platform for the AI tools you actually use.
          </h1>
          <p className="mt-6 text-lg text-text-muted leading-relaxed">
            A single account across every tool NexPrompt ships. Start with PromptForge,
            available today — more tools are on the way.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" asChild>
              <Link href={signedIn ? "/products/promptforge" : "/signup"}>
                {signedIn ? "Go to PromptForge" : "Get started free"} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="#products">Explore the platform</Link>
            </Button>
          </div>
          <p className="mt-6 text-xs text-text-faint">
            No credit card required · Free tier included
          </p>
        </motion.div>
      </div>
    </section>
  );
}
