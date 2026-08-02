import Link from "next/link";
import { Suspense } from "react";
import { Plus, TriangleAlert } from "lucide-react";
import { DashboardSidebarNav, DashboardBrand } from "@/components/dashboard/sidebar-nav";
import { DashboardMobileNav } from "@/components/dashboard/mobile-nav";
import { DashboardUserMenu } from "@/components/dashboard/user-menu";
import { SyncIndicator } from "@/components/dashboard/sync-indicator";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { FolderTree } from "@/components/dashboard/folder-tree";
import { TagSidebarList } from "@/components/dashboard/tag-sidebar-list";
import { CollectionSidebarList } from "@/components/dashboard/collection-sidebar-list";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getAppSession } from "@/lib/session";
import { getAdminSession } from "@/lib/admin/session";
import { getSystemSettings } from "@/lib/admin/store";
import { CloudSyncBoot } from "@/components/dashboard/cloud-sync-boot";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getAppSession();
  const [admin, settings] = await Promise.all([getAdminSession(), getSystemSettings()]);
  const maintenanceBlocked = settings.maintenanceMode && !admin.isAdmin;

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <CloudSyncBoot />
      <aside className="hidden md:flex w-64 shrink-0 flex-col gap-6 border-r border-border p-5 overflow-y-auto">
        <DashboardBrand />
        <DashboardSidebarNav isAdmin={admin.isAdmin} />
        <Button asChild size="sm" className="gap-1.5">
          <Link href="/promptforge/prompts/new">
            <Plus className="h-4 w-4" /> New prompt
          </Link>
        </Button>
        <Separator />
        <Suspense fallback={null}>
          <FolderTree />
        </Suspense>
        <Separator />
        <Suspense fallback={null}>
          <TagSidebarList />
        </Suspense>
        <Separator />
        <Suspense fallback={null}>
          <CollectionSidebarList />
        </Suspense>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <DashboardMobileNav isAdmin={admin.isAdmin} />
          <div className="hidden md:block" />
          <div className="flex items-center gap-2">
            <SyncIndicator />
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
                We&apos;re making some updates. AI features and the workspace are temporarily unavailable —
                please check back shortly.
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
