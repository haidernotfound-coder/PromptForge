import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shared prompt",
  description: "A prompt shared from NexPrompt.",
};

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
