import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/session";
import { getAdminOverviewBundle } from "@/lib/admin/overview";
import { getServerHealth } from "@/lib/admin/health";

export const runtime = "nodejs";

export async function GET() {
  const admin = await getAdminSession();
  if (!admin.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [bundle, health] = await Promise.all([getAdminOverviewBundle(), getServerHealth()]);
  return NextResponse.json({ ...bundle, health });
}
