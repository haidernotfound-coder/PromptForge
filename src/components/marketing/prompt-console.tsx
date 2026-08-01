"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpRight, Sparkles } from "lucide-react";

const STAGES = [
  {
    label: "draft",
    text: "write a product description for wireless earbuds",
  },
  {
    label: "tempered",
    text: "Write a 120-word product description for wireless earbuds. Audience: runners. Tone: energetic, concrete. Highlight: sweat resistance, 8-hour battery, secure fit. End with a one-line CTA.",
  },
];

export function PromptConsole() {
  const [stageIndex, setStageIndex] = React.useState(0);
  const [displayed, setDisplayed] = React.useState("");
  const [phase, setPhase] = React.useState<"typing" | "pause" | "swap">("typing");

  React.useEffect(() => {
    const stage = STAGES[stageIndex];
    let i = 0;
    setDisplayed("");
    setPhase("typing");

    const typeInterval = setInterval(() => {
      i += 1;
      setDisplayed(stage.text.slice(0, i));
      if (i >= stage.text.length) {
        clearInterval(typeInterval);
        setPhase("pause");
        setTimeout(() => {
          setPhase("swap");
          setTimeout(() => {
            setStageIndex((s) => (s + 1) % STAGES.length);
          }, 500);
        }, 1600);
      }
    }, 18);

    return () => clearInterval(typeInterval);
  }, [stageIndex]);

  const isRefined = stageIndex === 1;

  return (
    <div
      className="relative w-full max-w-xl rounded-lg border border-border bg-surface-raised shadow-xl overflow-hidden transition-opacity duration-500"
      style={{ opacity: phase === "swap" ? 0.4 : 1 }}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-brass/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
        </div>
        <AnimatePresence mode="wait">
          <motion.span
            key={STAGES[stageIndex].label}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="font-mono text-[11px] uppercase tracking-wider text-text-faint"
          >
            {STAGES[stageIndex].label}
          </motion.span>
        </AnimatePresence>
      </div>

      <div className="p-5 min-h-[140px] flex flex-col justify-between">
        <p className="font-mono text-sm leading-relaxed text-text">
          {displayed}
          <motion.span
            aria-hidden="true"
            className="inline-block w-[2px] h-4 bg-accent ml-0.5 align-middle"
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.8, repeat: Infinity, repeatType: "reverse" }}
          />
        </p>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-text-faint">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            {isRefined ? "Tempered by PromptForge AI" : "Ready to temper"}
          </div>
          <button
            type="button"
            tabIndex={-1}
            className="pointer-events-none flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground"
          >
            Improve <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
