export const metadata = {
  title: "About",
  description:
    "NexPrompt is building the future of AI productivity — powerful yet simple AI tools, starting with PromptForge, under one platform.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div className="container py-20 max-w-2xl">
      <h1 className="font-display text-4xl font-semibold tracking-tight">About NexPrompt</h1>
      <p className="mt-6 text-text-muted leading-relaxed">
        NexPrompt is building the future of AI productivity. We create powerful yet simple AI
        tools that help people work smarter, create faster, and achieve more.
      </p>
      <p className="mt-4 text-text-muted leading-relaxed">
        Starting with PromptForge, our goal is to build an ecosystem of AI applications for
        creators, developers, students, and businesses—all under one platform.
      </p>
    </div>
  );
}
