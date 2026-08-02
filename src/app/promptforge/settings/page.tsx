import { SettingsPanel } from "@/components/dashboard/settings-panel";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="space-y-1">
      <div className="mb-5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-text-muted">
          Manage your demo account, appearance, sync, and workspace data.
        </p>
      </div>
      <SettingsPanel />
    </div>
  );
}
