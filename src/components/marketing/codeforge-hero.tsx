"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const SNIPPET = [
  { t: "// Debounce a function by N milliseconds", c: "text-text-faint" },
  { t: "function debounce(fn, ms) {", c: "text-text" },
  { t: "  let timer;", c: "text-text-muted" },
  { t: "  return (...args) => {", c: "text-text" },
  { t: "    clearTimeout(timer);", c: "text-accent" },
  { t: "    timer = setTimeout(() => fn(...args), ms);", c: "text-accent" },
  { t: "  };", c: "text-text" },
  { t: "}", c: "text-text" },
];

export function CodeForgeHero({ signedIn }: { signedIn: boolean }) {
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
            by Haider Labs
          </p>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.4rem] font-semibold tracking-tight leading-[1.05] text-balance">
            Your whole coding workflow, one forge.
          </h1>
          <p className="mt-6 text-lg text-text-muted leading-relaxed max-w-lg">
            CodeForge generates, fixes, optimizes, explains, converts, tests, documents, and
            reviews code — plus a full AI coding chat — all in the same NexPrompt account.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row gap-3">
            <Button size="lg" asChild>
              <Link href={signedIn ? "/codeforge" : "/signup"}>
                {signedIn ? "Go to dashboard" : "Start building"} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="#features">See what&apos;s inside</Link>
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
          <div className="w-full max-w-md rounded-lg border border-border bg-surface-raised shadow-lg overflow-hidden">
            <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-danger/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-brass/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
              <span className="ml-2 font-mono text-[11px] text-text-faint">generate.ts</span>
            </div>
            <pre className="p-5 font-mono text-[13px] leading-relaxed overflow-x-auto">
              {SNIPPET.map((line, i) => (
                <div key={i} className={line.c}>
                  {line.t || "\u00A0"}
                </div>
              ))}
            </pre>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
