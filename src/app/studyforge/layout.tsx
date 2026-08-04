import Link from "next/link";
import { MessagesSquare, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { StudyForgeSidebarNav, StudyForgeBrand } from "@/components/studyforge/sidebar-nav";
import { StudyForgeMobileNav } from "@/components/studyforge/mobile-nav";
import { DashboardUserMenu } from "@/components/dashboard/user-menu";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { getAppSession } from "@/lib/session";
import { getAdminSession } from "@/lib/admin/session";
import { getSystemSettings } from "@/lib/admin/store";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function StudyForgeLayout({ children }: { children: React.ReactNode }) {
  const session = await getAppSession();
  const [admin, settings] = await Promise.all([getAdminSession(), getSystemSettings()]);
  const maintenanceBlocked = settings.maintenanceMode && !admin.isAdmin;
  const studyforgeDisabled = !settings.studyforgeEnabled && !admin.isAdmin;

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <aside className="hidden md:flex w-64 shrink-0 flex-col gap-6 border-r border-border p-5 overflow-y-auto">
        <StudyForgeBrand />
        <StudyForgeSidebarNav isAdmin={admin.isAdmin} />
        <Button asChild size="sm" className="gap-1.5">
          <Link href="/studyforge/chat">
            <MessagesSquare className="h-4 w-4" /> AI Study Chat
          </Link>
        </Button>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <StudyForgeMobileNav isAdmin={admin.isAdmin} />
          <div className="hidden md:block" />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <DashboardUserMenu session={session} />
          </div>
        </header>
        <div className="flex-1 p-6">
          {maintenanceBlocked ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-24 text-center">
              <TriangleAlert className="h-8 w-8 text-brass" />
              <h2 className="font-display text-lg font-semibold">NexPrompt is in maintenance mode</h2>
              <p className="max-w-sm text-sm text-text-muted">
                We&apos;re making some updates. AI features are temporarily unavailable — please check back
                shortly.
              </p>
            </div>
          ) : studyforgeDisabled ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-24 text-center">
              <TriangleAlert className="h-8 w-8 text-brass" />
              <h2 className="font-display text-lg font-semibold">StudyForge is temporarily disabled</h2>
              <p className="max-w-sm text-sm text-text-muted">
                An admin has switched StudyForge off for now. Please check back shortly.
              </p>
            </div>
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
}
