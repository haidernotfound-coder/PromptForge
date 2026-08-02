"use client";

import { motion } from "framer-motion";
import {
  Bot,
  BookOpen,
  FolderTree,
  Gauge,
  History,
  SearchCode,
  Share2,
  Sparkles,
  Tags,
} from "lucide-react";

const FEATURES = [
  {
    icon: FolderTree,
    title: "Folders that hold their shape",
    description:
      "Nest prompts into folders and collections that mirror how you actually work — by project, client, or model.",
  },
  {
    icon: Tags,
    title: "Tag once, find instantly",
    description:
      "Color-coded tags and saved filters mean you're never scrolling through a wall of prompts to find the right one.",
  },
  {
    icon: Sparkles,
    title: "AI-assisted tempering",
    description:
      "Improve, expand, shorten, or rewrite any prompt in one click — powered by the models you already trust.",
  },
  {
    icon: Gauge,
    title: "AI Prompt Critic",
    description:
      "Score any prompt from 0–100 with concrete strengths, weaknesses, and suggestions — then apply a guaranteed improvement in one click.",
  },
  {
    icon: BookOpen,
    title: "Recipe Forge",
    description:
      "Browse professionally structured prompt recipes across Writing, Business, Coding, Creative, Education, and Content — favorite the ones you reuse, and drop them straight into the editor.",
  },
  {
    icon: Bot,
    title: "Forge AI",
    description:
      "A draggable, resizable chat panel that lives alongside your prompt — talk through changes, then Apply the result straight into the editor. Remembers the conversation per prompt.",
  },
  {
    icon: History,
    title: "Full version history",
    description:
      "Every edit is kept. Roll back, compare, or branch a prompt without losing the version that worked.",
  },
  {
    icon: SearchCode,
    title: "Search that understands prompts",
    description:
      "Full-text search across titles, bodies, and tags, with instant filtering by folder, model, or favorite status.",
  },
  {
    icon: Share2,
    title: "Share what's worth sharing",
    description:
      "Publish a prompt or collection with a public link, or keep everything private to your forge.",
  },
];

export function FeatureGrid() {
  return (
    <section id="features" className="container py-24 scroll-mt-16">
      <div className="max-w-2xl">
        <span className="font-mono text-xs uppercase tracking-widest text-brass">
          The forge
        </span>
        <h2 className="mt-3 font-display text-3xl md:text-4xl font-semibold tracking-tight text-balance">
          Everything a serious prompt library needs
        </h2>
        <p className="mt-4 text-text-muted text-base leading-relaxed">
          PromptForge treats prompts like the assets they are — versioned, organized, and easy to reach for exactly when you need them.
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
