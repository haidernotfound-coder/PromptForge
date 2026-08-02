import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NexPrompt — AI-powered tools",
    short_name: "NexPrompt",
    description:
      "NexPrompt is a platform of AI-powered tools, starting with PromptForge — write, organize, refine, and share prompts for ChatGPT, Claude, Gemini, and Grok from one workspace.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0b0f",
    theme_color: "#7c3aed",
  };
}
