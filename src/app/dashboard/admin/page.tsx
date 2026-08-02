import { notFound } from "next/navigation";
import { getAdminSession } from "@/lib/admin/session";
import { getAdminOverviewBundle } from "@/lib/admin/overview";
import { getServerHealth } from "@/lib/admin/health";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { isAdminConfigured } from "@/lib/admin/config";

export const metadata = { title: "Admin Dashboard" };

export default async function AdminPage() {
  const admin = await getAdminSession();
  if (!admin.isAdmin) {
    notFound();
  }

  const [bundle, health] = await Promise.all([getAdminOverviewBundle(), getServerHealth()]);

  return (
    <AdminDashboard
      initialData={{ ...bundle, health }}
      adminEmailConfigured={isAdminConfigured()}
    />
  );
}
