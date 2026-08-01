"use client";

import { motion } from "framer-motion";

const STEPS = [
  {
    n: "01",
    title: "Draft",
    description: "Write the prompt in the editor, with live token counts and model targeting.",
  },
  {
    n: "02",
    title: "Temper",
    description: "Run it through Improve, Expand, or Shorten to sharpen intent and cut fluff.",
  },
  {
    n: "03",
    title: "Organize",
    description: "File it into a folder, tag it, and mark it a favorite if it earns a spot.",
  },
  {
    n: "04",
    title: "Reuse",
    description: "Pull it back up across any project — version history keeps every prior take.",
  },
];

export function WorkflowSection() {
  return (
    <section id="workflow" className="border-y border-border bg-surface/50 scroll-mt-16">
      <div className="container py-24">
        <div className="max-w-2xl">
          <span className="font-mono text-xs uppercase tracking-widest text-brass">
            The process
          </span>
          <h2 className="mt-3 font-display text-3xl md:text-4xl font-semibold tracking-tight text-balance">
            From first draft to go-to prompt
          </h2>
        </div>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-4 gap-8">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.n}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="relative"
            >
              <span className="font-display text-4xl font-semibold text-accent/25">
                {step.n}
              </span>
              <h3 className="mt-3 font-display text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-text-muted leading-relaxed">{step.description}</p>
              {i < STEPS.length - 1 && (
                <div className="hidden md:block absolute top-5 left-full w-8 h-px bg-border-strong" />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
