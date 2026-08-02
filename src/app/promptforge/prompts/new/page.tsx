import Link from "next/link";
import { LayoutTemplate } from "lucide-react";
import { PromptEditor } from "@/components/prompts/prompt-editor";

export const metadata = { title: "New prompt" };

export default function NewPromptPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-end">
        <Link
          href="/promptforge/templates"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
        >
          <LayoutTemplate className="h-3.5 w-3.5" /> Start from a template instead
        </Link>
      </div>
      <PromptEditor />
    </div>
  );
}
