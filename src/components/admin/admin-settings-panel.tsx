"use client";

import * as React from "react";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { SystemSettings } from "@/lib/admin/store";

const TOGGLES: { key: keyof SystemSettings; label: string; description: string }[] = [
  { key: "forgeAiEnabled", label: "Forge AI", description: "The floating chat panel in the prompt editor." },
  { key: "recipeForgeEnabled", label: "Recipe Forge", description: "Curated recipe catalog and insertion." },
  { key: "criticEnabled", label: "AI Prompt Critic", description: "Prompt quality scoring and auto-fix." },
];

export function AdminSettingsPanel({
  settings,
  onChanged,
}: {
  settings: SystemSettings;
  onChanged: () => void;
}) {
  const [local, setLocal] = React.useState(settings);
  const [pending, setPending] = React.useState<keyof SystemSettings | null>(null);

  React.useEffect(() => setLocal(settings), [settings]);

  async function toggle(key: keyof SystemSettings, value: boolean) {
    setLocal((prev) => ({ ...prev, [key]: value }));
    setPending(key);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) throw new Error("Request failed");
      toast.success("Settings updated");
      onChanged();
    } catch {
      setLocal((prev) => ({ ...prev, [key]: !value }));
      toast.error("Couldn't update settings");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Feature toggles</CardTitle>
          <CardDescription>Turn individual AI features on or off app-wide, instantly.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {TOGGLES.map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-4">
              <div>
                <Label className="text-sm font-medium">{item.label}</Label>
                <p className="text-xs text-text-muted">{item.description}</p>
              </div>
              <Switch
                checked={local[item.key]}
                disabled={pending === item.key}
                onCheckedChange={(v) => toggle(item.key, v)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-danger/30">
        <CardHeader>
          <CardTitle className="text-danger">Maintenance mode</CardTitle>
          <CardDescription>
            Blocks Improve/Rewrite/Expand/Shorten/Critique and Forge AI for everyone (falls back to the
            local simulation is also disabled — requests are rejected outright).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Separator className="mb-4" />
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-sm font-medium">Enable maintenance mode</Label>
              <p className="text-xs text-text-muted">Use this during incidents or planned Groq key rotation.</p>
            </div>
            <Switch
              checked={local.maintenanceMode}
              disabled={pending === "maintenanceMode"}
              onCheckedChange={(v) => toggle("maintenanceMode", v)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
