export const metadata = {
  title: "About",
  description:
    "PromptForge is built for people who write prompts often enough that a notes app stopped being enough — a dedicated workspace for drafting and organizing prompts.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div className="container py-20 max-w-2xl">
      <h1 className="font-display text-4xl font-semibold tracking-tight">About PromptForge</h1>
      <p className="mt-6 text-text-muted leading-relaxed">
        PromptForge is built for people who write prompts often enough that a notes app stopped being enough. It&apos;s a dedicated workspace for drafting, refining, and organizing prompts across every major AI model — with the structure of a real tool, not another folder buried in a notes app.
      </p>
      <p className="mt-4 text-text-muted leading-relaxed">
        We&apos;re a small team building in the open, shipping in phases, and treating every prompt as an asset worth keeping in good shape.
      </p>
    </div>
  );
}
