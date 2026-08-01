import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shared prompt",
  description: "A prompt shared from PromptForge.",
};

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
