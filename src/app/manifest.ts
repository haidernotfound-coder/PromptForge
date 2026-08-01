import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PromptForge — AI Prompt Management",
    short_name: "PromptForge",
    description:
      "Write, organize, refine, and share prompts for ChatGPT, Claude, Gemini, and Grok — all from one workspace.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0b0b0f",
    theme_color: "#7c3aed",
  };
}
