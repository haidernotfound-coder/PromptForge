export const metadata = {
  title: "About",
  description:
    "NexPrompt is building the future of AI productivity — powerful yet simple AI tools, with PromptForge, CodeForge, StudyForge, and PPTForge under one platform.",
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
        With PromptForge, CodeForge, StudyForge, and PPTForge live today, our goal is to build an
        ecosystem of AI applications for creators, developers, students, and businesses—all under
        one platform.
      </p>
      <ul className="mt-6 space-y-3 text-text-muted leading-relaxed">
        <li>
          <span className="font-medium text-text">PromptForge</span> — write, organize, refine,
          and share prompts for ChatGPT, Claude, Gemini, and Grok.
        </li>
        <li>
          <span className="font-medium text-text">CodeForge</span> — generate, fix, optimize,
          explain, convert, test, document, and review code, plus an AI coding chat.
        </li>
        <li>
          <span className="font-medium text-text">StudyForge</span> — turn notes and readings
          into flashcards, quizzes, summaries, and other study tools.
        </li>
        <li>
          <span className="font-medium text-text">PPTForge</span> — turn a topic into a polished,
          downloadable slide deck, with layouts, charts, and tables included.
        </li>
      </ul>
    </div>
  );
}
