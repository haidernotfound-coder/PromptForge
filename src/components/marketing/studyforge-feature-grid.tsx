"use client";

import { motion } from "framer-motion";
import {
  Lightbulb,
  NotebookPen,
  Layers,
  ListChecks,
  HelpCircle,
  CalendarDays,
  FileStack,
  ClipboardCheck,
  MessageSquareText,
} from "lucide-react";

const FEATURES = [
  {
    icon: Lightbulb,
    title: "Explain Concepts",
    description: "Get a clear, plain-language breakdown of any topic, at whatever level you need.",
  },
  {
    icon: NotebookPen,
    title: "Notes Generator",
    description: "Turn a topic or reading into organized, well-structured study notes.",
  },
  {
    icon: Layers,
    title: "Flashcards",
    description: "Generate a ready-to-study flashcard deck from any material in seconds.",
  },
  {
    icon: ListChecks,
    title: "Quiz Generator",
    description: "Test yourself with auto-generated quizzes tuned to your subject and difficulty.",
  },
  {
    icon: HelpCircle,
    title: "Homework Helper",
    description: "Work through tricky homework problems with step-by-step guidance.",
  },
  {
    icon: CalendarDays,
    title: "Study Planner",
    description: "Get a realistic study schedule built around your deadlines and available time.",
  },
  {
    icon: FileStack,
    title: "Notes Summarizer",
    description: "Condense long notes or readings into the key points you actually need to remember.",
  },
  {
    icon: ClipboardCheck,
    title: "Exam Practice",
    description: "Practice with exam-style questions and get feedback on where you're still weak.",
  },
  {
    icon: MessageSquareText,
    title: "AI Study Chat",
    description: "Talk through a subject with a chat panel that remembers the conversation as you learn.",
  },
];

export function StudyForgeFeatureGrid() {
  return (
    <section id="features" className="container py-24 scroll-mt-16">
      <div className="max-w-2xl">
        <span className="font-mono text-xs uppercase tracking-widest text-brass">
          The forge
        </span>
        <h2 className="mt-3 font-display text-3xl md:text-4xl font-semibold tracking-tight text-balance">
          Eight tools, one study workspace
        </h2>
        <p className="mt-4 text-text-muted text-base leading-relaxed">
          StudyForge treats every step of learning — not just cramming the night before — as
          something worth having AI help with.
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
