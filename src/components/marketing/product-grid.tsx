"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, GraduationCap, Code2, ImageIcon, Sparkles, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Product {
  slug: string;
  name: string;
  tagline: string;
  icon: React.ComponentType<{ className?: string }>;
  status: "available" | "soon";
  href: string;
  color: string;
}

const PRODUCTS: Product[] = [
  {
    slug: "promptforge",
    name: "PromptForge",
    tagline: "Write, organize, refine, and share prompts for ChatGPT, Claude, Gemini, and Grok.",
    icon: Sparkles,
    status: "available",
    href: "/products/promptforge",
    color: "bg-accent text-accent-foreground",
  },
  {
    slug: "studyforge",
    name: "StudyForge",
    tagline: "Turn notes and readings into flashcards, quizzes, and study guides.",
    icon: GraduationCap,
    status: "available",
    href: "/products/studyforge",
    color: "bg-emerald-500 text-white",
  },
  {
    slug: "codeforge",
    name: "CodeForge",
    tagline: "Generate, fix, optimize, explain, convert, test, document, and review code — plus AI coding chat.",
    icon: Code2,
    status: "available",
    href: "/products/codeforge",
    color: "bg-blue-500 text-white",
  },
  {
    slug: "imageforge",
    name: "ImageForge",
    tagline: "Prompt, generate, and organize AI image assets in one workspace.",
    icon: ImageIcon,
    status: "soon",
    href: "#",
    color: "bg-surface text-text-faint",
  },
];

export function ProductGrid() {
  return (
    <section id="products" className="container py-20 scroll-mt-16">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="mx-auto max-w-2xl text-center"
      >
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-text-faint">
          The NexPrompt platform
        </p>
        <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-balance">
          One account. A growing suite of AI-powered tools.
        </h2>
        <p className="mt-4 text-text-muted leading-relaxed">
          Sign in once and unlock every tool as it ships — PromptForge, CodeForge, and StudyForge are available now.
        </p>
      </motion.div>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {PRODUCTS.map((product, i) => {
          const Icon = product.icon;
          const available = product.status === "available";

          const cardInner = (
            <>
              <div className="flex items-start justify-between">
                <span
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-md transition-transform group-hover:scale-105",
                    available ? product.color : "bg-surface text-text-faint"
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide",
                    available
                      ? "bg-success/15 text-success"
                      : "bg-surface text-text-faint"
                  )}
                >
                  {available ? "Available" : "Coming soon"}
                </span>
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold tracking-tight">
                {product.name}
              </h3>
              <p className="mt-2 text-sm text-text-muted leading-relaxed">{product.tagline}</p>
              <div
                className={cn(
                  "mt-5 flex items-center gap-1.5 text-sm font-medium",
                  available ? "text-accent" : "text-text-faint"
                )}
              >
                {available ? (
                  <>
                    Open {product.name} <ArrowRight className="h-3.5 w-3.5" />
                  </>
                ) : (
                  <>
                    Notify me <Lock className="h-3.5 w-3.5" />
                  </>
                )}
              </div>
            </>
          );

          const cardClasses = cn(
            "group relative flex flex-col rounded-lg border p-5",
            available
              ? "card-interactive border-border bg-surface-raised hover:border-accent/50"
              : "border-border/60 bg-surface/40 cursor-not-allowed"
          );

          return (
            <motion.div
              key={product.slug}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, ease: "easeOut", delay: i * 0.06 }}
            >
              {available ? (
                <Link href={product.href} className={cardClasses}>
                  {cardInner}
                </Link>
              ) : (
                <div className={cardClasses} aria-disabled="true">
                  {cardInner}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
