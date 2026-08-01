"use client";

/**
 * Thin fetch wrapper around /api/workspace, used by store.ts to push/pull
 * the workspace snapshot when Supabase is configured and the visitor is
 * signed in with a real account. No-ops (via 501/401 responses) are treated
 * as "stay in local/demo mode" rather than errors.
 */

export interface WorkspaceSnapshot {
  prompts: unknown[];
  folders: unknown[];
  tags: unknown[];
  collections: unknown[];
}

export async function pullWorkspace(): Promise<WorkspaceSnapshot | null> {
  try {
    const res = await fetch("/api/workspace", { method: "GET" });
    if (!res.ok) return null;
    const json = await res.json();
    return (json?.workspace as WorkspaceSnapshot) ?? null;
  } catch {
    return null;
  }
}

export async function pushWorkspace(snapshot: WorkspaceSnapshot): Promise<boolean> {
  try {
    const res = await fetch("/api/workspace", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot),
    });
    return res.ok;
  } catch {
    return false;
  }
}
