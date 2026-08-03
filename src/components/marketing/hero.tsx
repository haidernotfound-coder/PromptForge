"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PromptConsole } from "@/components/marketing/prompt-console";

export function Hero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-40 h-[480px] bg-[radial-gradient(ellipse_at_top,hsl(var(--accent)/0.16),transparent_65%)]"
      />
      <div className="container relative py-20 md:py-28 grid lg:grid-cols-2 gap-14 items-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          <div className="temper-line w-24 mb-6" />
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-text-faint">
            by NexPrompt
          </p>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.4rem] font-semibold tracking-tight leading-[1.05] text-balance">
            Every prompt you write, worth writing once.
          </h1>
          <p className="mt-6 text-lg text-text-muted leading-relaxed max-w-lg">
            NexPrompt is where prompt engineers keep their real toolkit — organized, tempered by AI, versioned, and ready across ChatGPT, Claude, Gemini, and Grok.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row gap-3">
            <Button size="lg" asChild>
              <Link href={signedIn ? "/promptforge" : "/signup"}>
                {signedIn ? "Go to dashboard" : "Start forging"} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/#features">See what&apos;s inside</Link>
            </Button>
          </div>
          <p className="mt-6 text-xs text-text-faint">
            No credit card required · Free tier included
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
          className="flex justify-center lg:justify-end"
        >
          <PromptConsole />
        </motion.div>
      </div>
    </section>
  );
}
