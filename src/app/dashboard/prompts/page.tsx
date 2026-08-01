import { Suspense } from "react";
import { PromptsBrowser } from "@/components/prompts/prompts-browser";

export const metadata = { title: "Prompts" };

export default function PromptsPage() {
  return (
    <Suspense fallback={null}>
      <PromptsBrowser
        title="Prompts"
        description="Every prompt in your workspace — search, filter, and sort to find what you need."
      />
    </Suspense>
  );
}
