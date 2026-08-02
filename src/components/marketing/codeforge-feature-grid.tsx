"use client";

import { motion } from "framer-motion";
import {
  Code2,
  Bug,
  Gauge,
  BookMarked,
  Languages,
  FlaskConical,
  FileText,
  ClipboardCheck,
  MessageSquareText,
} from "lucide-react";

const FEATURES = [
  {
    icon: Code2,
    title: "Generate Code",
    description: "Describe what you need in plain language and get working code back, in the language of your choice.",
  },
  {
    icon: Bug,
    title: "Fix Bugs",
    description: "Paste code that isn't working and get a fix along with a clear explanation of what went wrong.",
  },
  {
    icon: Gauge,
    title: "Optimize Code",
    description: "Improve performance and readability without changing behavior.",
  },
  {
    icon: BookMarked,
    title: "Explain Code",
    description: "Get a clear, plain-language walkthrough of what unfamiliar code actually does.",
  },
  {
    icon: Languages,
    title: "Convert Languages",
    description: "Translate code from one language to another while preserving behavior.",
  },
  {
    icon: FlaskConical,
    title: "Generate Unit Tests",
    description: "Get a thorough test suite for existing code, covering the edge cases you'd otherwise miss.",
  },
  {
    icon: FileText,
    title: "Generate Documentation",
    description: "Add doc comments and a usage example to code that doesn't have any yet.",
  },
  {
    icon: ClipboardCheck,
    title: "Review Code",
    description: "A senior-engineer-style review: correctness, style, and security, in one pass.",
  },
  {
    icon: MessageSquareText,
    title: "AI Coding Chat",
    description: "Talk through a problem with a chat panel that remembers the conversation as you work.",
  },
];

export function CodeForgeFeatureGrid() {
  return (
    <section id="features" className="container py-24 scroll-mt-16">
      <div className="max-w-2xl">
        <span className="font-mono text-xs uppercase tracking-widest text-brass">
          The forge
        </span>
        <h2 className="mt-3 font-display text-3xl md:text-4xl font-semibold tracking-tight text-balance">
          Nine tools, one coding workspace
        </h2>
        <p className="mt-4 text-text-muted text-base leading-relaxed">
          CodeForge treats every step of writing code — not just the first draft — as something
          worth having AI help with.
        </p>
      </div>

      <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-lg overflow-hidden border border-border">
        {FEATURES.map((feature, i) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.4, delay: (i % 3) * 0.08 }}
            className="bg-surface-raised p-6 flex flex-col gap-3"
          >
            <feature.icon className="h-5 w-5 text-accent" strokeWidth={1.75} />
            <h3 className="font-display text-base font-semibold">{feature.title}</h3>
            <p className="text-sm text-text-muted leading-relaxed">{feature.description}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
