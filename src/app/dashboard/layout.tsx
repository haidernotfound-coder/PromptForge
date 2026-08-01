import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
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
import { CloudSyncBoot } from "@/components/dashboard/cloud-sync-boot";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getAppSession();

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <CloudSyncBoot />
      <aside className="hidden md:flex w-64 shrink-0 flex-col gap-6 border-r border-border p-5 overflow-y-auto">
        <DashboardBrand />
        <DashboardSidebarNav />
        <Button asChild size="sm" className="gap-1.5">
          <Link href="/dashboard/prompts/new">
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
          <DashboardMobileNav />
          <div className="hidden md:block" />
          <div className="flex items-center gap-2">
            <SyncIndicator />
            <ThemeToggle />
            <DashboardUserMenu session={session} />
          </div>
        </header>
        <div className="flex-1 p-6">{children}</div>
      </div>
    </div>
  );
}
