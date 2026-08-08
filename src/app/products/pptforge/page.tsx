import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Presentation, BarChart3, Palette, LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAppSessionOrNull } from "@/lib/session";

export const metadata: Metadata = {
  title: "PPTForge",
  description:
    "PPTForge is NexPrompt's AI presentation workspace — turn a topic into a polished, downloadable .pptx deck with varied layouts, charts, tables, and a choice of styles.",
  alternates: { canonical: "/products/pptforge" },
};

const FEATURES = [
  {
    icon: Presentation,
    title: "Real, downloadable .pptx",
    description: "Not a preview — a genuine PowerPoint file you can open, edit, and present immediately.",
  },
  {
    icon: LayoutTemplate,
    title: "Varied, professional layouts",
    description: "Title, section breaks, two-column, comparison, image, quote, and closing slides — chosen automatically.",
  },
  {
    icon: BarChart3,
    title: "Charts & tables built in",
    description: "Numeric or comparative content becomes a real chart or table, not a wall of bullet points.",
  },
  {
    icon: Palette,
    title: "Five style presets",
    description: "Professional, Modern, Minimal, Bold, or Academic — pick the look that fits the room.",
  },
];

export default async function PptForgeProductPage() {
  const session = await getAppSessionOrNull();
  return (
    <>
      <div className="container flex items-center justify-between pt-8">
        <Link
          href="/"
          className="group inline-flex items-center gap-1.5 text-sm font-medium text-text-faint transition-colors hover:text-text"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
          NexPrompt
        </Link>
        {session && (
          <Button size="sm" variant="outline" asChild>
            <Link href="/pptforge" className="gap-1.5">
              Go to PPTForge <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        )}
      </div>

      <section className="container pt-14 pb-16 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-orange-500 text-white">
          <Presentation className="h-7 w-7" />
        </div>
        <h1 className="mt-6 font-display text-4xl sm:text-5xl font-semibold tracking-tight text-balance">
          Type a topic. Get a deck.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-text-muted">
          PPTForge turns a topic into a structured, genuinely presentable slide deck — real .pptx file,
          varied layouts, charts and tables where they help, no overcrowded slides.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button size="lg" asChild>
            <Link href={session ? "/pptforge" : "/login?next=/pptforge"} className="gap-1.5">
              {session ? "Open PPTForge" : "Sign in to try it"} <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="container pb-24">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-lg border border-border p-5">
              <f.icon className="h-5 w-5 text-orange-500" />
              <h3 className="mt-3 font-display text-sm font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-text-muted">{f.description}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
