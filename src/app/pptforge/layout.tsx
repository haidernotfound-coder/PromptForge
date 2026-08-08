import type { Metadata } from "next";
import { TriangleAlert } from "lucide-react";
import { PptForgeSidebarNav, PptForgeBrand } from "@/components/pptforge/sidebar-nav";
import { PptForgeMobileNav } from "@/components/pptforge/mobile-nav";
import { DashboardUserMenu } from "@/components/dashboard/user-menu";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { getAppSession } from "@/lib/session";
import { getAdminSession } from "@/lib/admin/session";
import { getSystemSettings } from "@/lib/admin/store";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function PptForgeLayout({ children }: { children: React.ReactNode }) {
  const session = await getAppSession();
  const [admin, settings] = await Promise.all([getAdminSession(), getSystemSettings()]);
  const maintenanceBlocked = settings.maintenanceMode && !admin.isAdmin;
  const pptforgeDisabled = !settings.pptforgeEnabled && !admin.isAdmin;

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <aside className="hidden md:flex w-64 shrink-0 flex-col gap-6 border-r border-border p-5 overflow-y-auto">
        <PptForgeBrand />
        <PptForgeSidebarNav isAdmin={admin.isAdmin} />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <PptForgeMobileNav isAdmin={admin.isAdmin} />
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
          ) : pptforgeDisabled ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-24 text-center">
              <TriangleAlert className="h-8 w-8 text-brass" />
              <h2 className="font-display text-lg font-semibold">PPTForge is temporarily disabled</h2>
              <p className="max-w-sm text-sm text-text-muted">
                An admin has switched PPTForge off for now. Please check back shortly.
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
