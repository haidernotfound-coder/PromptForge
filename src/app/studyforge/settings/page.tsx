import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAppSession } from "@/lib/session";
import { isStudyForgeConfigured } from "@/lib/supabase/config";
import { getSystemSettings } from "@/lib/admin/store";
import { STUDYFORGE_TOOLS } from "@/lib/studyforge";

export const metadata = { title: "Settings" };

export default async function StudyForgeSettingsPage() {
  const [session, settings] = await Promise.all([getAppSession(), getSystemSettings()]);
  const configured = isStudyForgeConfigured();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">StudyForge settings</h1>
        <p className="mt-1 text-sm text-text-muted">Status of this account and the StudyForge provider.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>{session.isReal ? "Synced account" : "Local demo account"}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-text-muted space-y-1">
          <p>{session.name}</p>
          <p>{session.email}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Provider status</CardTitle>
            <CardDescription>StudyForge&apos;s own Groq key pool (independent of PromptForge, Forge AI, and CodeForge).</CardDescription>
          </div>
          <Badge variant={configured ? "success" : "brass"}>{configured ? "Live" : "Demo mode"}</Badge>
        </CardHeader>
        <CardContent className="text-sm text-text-muted space-y-2">
          <p>
            {configured
              ? "A real model provider is configured — every tool and the AI Study Chat run against it."
              : "No STUDYFORGE_GROQ_API_KEY_* is configured yet, so every tool and the AI Study Chat run a local, deterministic demo fallback."}
          </p>
          <p>Set STUDYFORGE_GROQ_API_KEY_1 through _10 for automatic fallback across up to 10 keys.</p>
          {!settings.studyforgeEnabled && (
            <p className="text-brass">An admin has switched StudyForge off platform-wide for non-admins.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tools</CardTitle>
          <CardDescription>All 9 StudyForge features.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-text-muted">
            {STUDYFORGE_TOOLS.map((tool) => (
              <li key={tool.id}>{tool.label}</li>
            ))}
            <li>AI Study Chat</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
