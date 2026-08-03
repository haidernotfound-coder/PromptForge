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
import { getAdminSession } from "@/lib/admin/session";

export const metadata: Metadata = {
  title: {
    default: "NexPrompt — AI tools for prompts and code",
    template: "%s · NexPrompt",
  },
  description:
    "NexPrompt is the workspace for AI power users: PromptForge for writing, tagging, versioning, and sharing prompts, and CodeForge for generating, fixing, and optimizing code — all in one platform.",
  metadataBase: new URL("https://nexprompt.app"),
  openGraph: {
    title: "NexPrompt — AI tools for prompts and code",
    description:
      "One platform, two forges: craft prompts with PromptForge and ship code with CodeForge, all under one account.",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getAppSessionOrNull();
  const isAdmin = session ? (await getAdminSession()).isAdmin : false;
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
          <Navbar session={session} isAdmin={isAdmin} />
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
