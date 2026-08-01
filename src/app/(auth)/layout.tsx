import Link from "next/link";
import { Sparkles } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in or create a free PromptForge account to start organizing your prompts.",
  robots: { index: false, follow: true },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container flex min-h-[calc(100vh-8rem)] items-center justify-center py-16">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-8 flex items-center justify-center gap-2 font-display text-lg font-semibold"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <Sparkles className="h-4 w-4" />
          </span>
          PromptForge
        </Link>
        {children}
      </div>
    </div>
  );
}
