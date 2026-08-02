import { NextResponse } from "next/server";
import { getSystemSettings, updateSystemSettings } from "@/lib/admin/store";
import { getAdminSession } from "@/lib/admin/session";

export const runtime = "nodejs";

/** Public: lets the client know which features are currently switched on
 *  (Forge AI / Recipe Forge / Critic) and whether maintenance mode is
 *  active, so the UI can hide/disable those panels accordingly. */
export async function GET() {
  const settings = await getSystemSettings();
  return NextResponse.json(settings);
}

/** Admin-only: flips a feature toggle. */
export async function POST(request: Request) {
  const admin = await getAdminSession();
  if (!admin.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    forgeAiEnabled?: boolean;
    recipeForgeEnabled?: boolean;
    criticEnabled?: boolean;
    maintenanceMode?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: Partial<Record<string, boolean>> = {};
  for (const key of ["forgeAiEnabled", "recipeForgeEnabled", "criticEnabled", "maintenanceMode"] as const) {
    if (typeof body[key] === "boolean") patch[key] = body[key];
  }

  const settings = await updateSystemSettings(patch);
  return NextResponse.json(settings);
}
