import type { Metadata } from "next";
import { ChatApp } from "@/components/chat/chat-app";
import { getAppSession } from "@/lib/session";
import { getAdminSession } from "@/lib/admin/session";
import { getSystemSettings } from "@/lib/admin/store";

export const metadata: Metadata = {
  title: "AI Chat",
  robots: { index: false, follow: false },
};

// The unified chat is a self-contained app shell (its own sidebar, its own
// header, its own account footer) rather than a page rendered inside the
// generic dashboard/Forge chrome, so this layout fetches session/settings
// once server-side and mounts `<ChatApp />` directly. `children` (the
// route's page.tsx) is intentionally unused -- everything the route needs
// to render lives in the client shell, the same way a real chat app's
// route tree is just "the app", not a page nested inside site chrome.
export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const session = await getAppSession();
  const [admin, settings] = await Promise.all([getAdminSession(), getSystemSettings()]);

  const disabledReason =
    settings.maintenanceMode && !admin.isAdmin
      ? "We're making some updates. AI features are temporarily unavailable -- please check back shortly."
      : !settings.forgeAiEnabled && !admin.isAdmin
      ? "An admin has switched AI Chat off for now. Please check back shortly."
      : undefined;

  return (
    <>
      <ChatApp session={session} disabledReason={disabledReason} />
      {children}
    </>
  );
}
