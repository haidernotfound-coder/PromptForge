import type { Metadata } from "next";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Toaster } from "sonner";
import { getAppSessionOrNull } from "@/lib/session";

export const metadata: Metadata = {
  title: {
    default: "NexPrompt — Craft, organize, and refine your AI prompts",
    template: "%s · NexPrompt",
  },
  description:
    "NexPrompt is the workspace for prompt engineers: write, tag, version, and share prompts for ChatGPT, Claude, Gemini, and Grok in one forge.",
  metadataBase: new URL("https://nexprompt.app"),
  openGraph: {
    title: "NexPrompt — Craft, organize, and refine your AI prompts",
    description:
      "The workspace for prompt engineers. Write, tag, version, and share prompts across every model.",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getAppSessionOrNull();
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-body antialiased min-h-screen flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <a href="#main-content" className="skip-link">
            Skip to content
          </a>
          <Navbar session={session} />
          <main id="main-content" className="flex-1">
            {children}
          </main>
          <Footer />
          <Toaster richColors position="top-right" theme="system" />
        </ThemeProvider>
      </body>
    </html>
  );
}
