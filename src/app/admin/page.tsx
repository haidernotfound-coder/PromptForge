import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAdminSession } from "@/lib/admin/session";
import { getAdminOverviewBundle } from "@/lib/admin/overview";
import { getServerHealth } from "@/lib/admin/health";
import { PlatformAdminDashboard } from "@/components/admin/platform-admin-dashboard";
import { isAdminConfigured } from "@/lib/admin/config";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function PlatformAdminPage() {
  const admin = await getAdminSession();
  if (!admin.isAdmin) {
    notFound();
  }

  const [bundle, health] = await Promise.all([getAdminOverviewBundle(), getServerHealth()]);

  return (
    <div className="container py-10">
      <PlatformAdminDashboard
        initialData={{ ...bundle, health }}
        adminEmailConfigured={isAdminConfigured()}
      />
    </div>
  );
}
