"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Code2, GraduationCap, MessagesSquare, Zap, ShieldCheck, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";

const PRODUCT_TILES = [
  { name: "PromptForge", tagline: "Write & organize prompts", icon: Sparkles, color: "bg-accent/15 text-accent" },
  { name: "CodeForge", tagline: "Generate & fix code", icon: Code2, color: "bg-blue-500/15 text-blue-400" },
  { name: "StudyForge", tagline: "Flashcards & quizzes", icon: GraduationCap, color: "bg-emerald-500/15 text-emerald-400" },
  { name: "AI Chat", tagline: "One assistant, every task", icon: MessagesSquare, color: "bg-orange-500/15 text-orange-400" },
];

export function PlatformHero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-40 h-[480px] bg-[radial-gradient(ellipse_at_top,hsl(var(--accent)/0.16),transparent_65%)]"
      />
      <div className="container relative py-20 md:py-24 grid lg:grid-cols-2 gap-14 items-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="text-center lg:text-left"
        >
          <div className="temper-line w-24 mx-auto lg:mx-0 mb-6" />
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-text-faint">
            by Haider Labs
          </p>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05] text-balance">
            One platform for the AI tools you actually use.
          </h1>
          <p className="mt-6 text-lg text-text-muted leading-relaxed max-w-lg mx-auto lg:mx-0">
            A single account across every tool NexPrompt ships. PromptForge, CodeForge,
            StudyForge, and AI Chat are available today — more tools are on the way.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row flex-wrap gap-3 justify-center lg:justify-start">
            {signedIn ? (
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
                <Button size="lg" variant="outline" asChild>
                  <Link href="/chat">
                    Open AI Chat <ArrowRight className="h-4 w-4" />
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
                  <Link href="#products">Explore the platform</Link>
                </Button>
              </>
            )}
          </div>
          <p className="mt-6 text-xs text-text-faint">
            No credit card required · Free tier included
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
          className="relative flex justify-center lg:justify-end"
        >
          <div className="pointer-events-none absolute -top-8 right-4 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />
          <div className="w-full max-w-sm rounded-xl border border-border bg-surface-raised shadow-lg overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <Layers className="h-3.5 w-3.5 text-text-faint" />
              <span className="font-mono text-[11px] text-text-faint">nexprompt.app</span>
            </div>
            <div className="p-3 space-y-2">
              {PRODUCT_TILES.map((tile, i) => (
                <motion.div
                  key={tile.name}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.35 + i * 0.1, ease: "easeOut" }}
                  className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 transition-transform hover:-translate-y-0.5"
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tile.color}`}>
                    <tile.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text">{tile.name}</p>
                    <p className="truncate text-xs text-text-muted">{tile.tagline}</p>
                  </div>
                </motion.div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <span className="flex items-center gap-1.5 text-[11px] text-text-faint">
                <Zap className="h-3 w-3 text-accent" /> Groq-powered
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-text-faint">
                <ShieldCheck className="h-3 w-3 text-success" /> Private & secure
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
