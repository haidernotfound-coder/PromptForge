import Link from "next/link";
import { Presentation, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
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

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      <header className="flex items-center justify-between border-b border-border px-5 py-3">
        <Link href="/pptforge" className="flex items-center gap-2 font-display text-sm font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-orange-500 text-white">
            <Presentation className="h-4 w-4" />
          </span>
          PPTForge
        </Link>
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
              We&apos;re making some updates. AI features are temporarily unavailable — please check back shortly.
            </p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
