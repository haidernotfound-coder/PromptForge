"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";

const FLASHCARD_STACK = [
  { front: "What is the mitochondria?", back: "The powerhouse of the cell." },
  { front: "Define Newton's Second Law", back: "F = m × a" },
  { front: "What year did WWII end?", back: "1945" },
];

export function StudyForgeHero({ signedIn }: { signedIn: boolean }) {
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
            Study smarter, not longer.
          </h1>
          <p className="mt-6 text-lg text-text-muted leading-relaxed max-w-lg">
            StudyForge explains concepts, generates notes, flashcards, quizzes, and exam
            practice, helps with homework, plans your study schedule, and summarizes readings —
            plus a full AI Study Chat — all in the same NexPrompt account.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row gap-3">
            <Button size="lg" asChild>
              <Link href={signedIn ? "/studyforge" : "/signup"}>
                {signedIn ? "Go to dashboard" : "Start studying"} <ArrowRight className="h-4 w-4" />
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
              <span className="ml-2 font-mono text-[11px] text-text-faint flex items-center gap-1">
                <GraduationCap className="h-3 w-3" /> flashcards.deck
              </span>
            </div>
            <div className="p-5 space-y-3">
              {FLASHCARD_STACK.map((card, i) => (
                <div
                  key={i}
                  className="rounded-md border border-border bg-surface px-4 py-3"
                  style={{ opacity: 1 - i * 0.18 }}
                >
                  <p className="text-sm font-medium text-text">{card.front}</p>
                  <p className="mt-1 text-xs text-text-muted">{card.back}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
