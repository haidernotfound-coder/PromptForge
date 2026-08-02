"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  Archive,
  Download,
  History,
  Laptop,
  LogOut,
  Moon,
  RefreshCw,
  RotateCcw,
  Sun,
  Trash2,
  Upload,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { getDemoSessionClient, loginDemo, logoutDemo } from "@/lib/demo-auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import {
  buildExportPayload,
  downloadJson,
  ImportValidationError,
  parseImportPayload,
  readFileAsText,
} from "@/lib/data-transfer";
import { createBackup, deleteBackup, listBackups, type BackupSnapshot } from "@/lib/backup";
import { ConfirmDialog } from "@/components/prompts/confirm-dialog";

export function SettingsPanel() {
  return (
    <Tabs defaultValue="account" className="w-full">
      <TabsList>
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="appearance">Appearance</TabsTrigger>
        <TabsTrigger value="sync">Sync</TabsTrigger>
        <TabsTrigger value="data">Data</TabsTrigger>
      </TabsList>
      <TabsContent value="account" className="mt-5">
        <AccountTab />
      </TabsContent>
      <TabsContent value="appearance" className="mt-5">
        <AppearanceTab />
      </TabsContent>
      <TabsContent value="sync" className="mt-5">
        <SyncTab />
      </TabsContent>
      <TabsContent value="data" className="mt-5">
        <DataTab />
      </TabsContent>
    </Tabs>
  );
}

function AccountTab() {
  const router = useRouter();
  const backendConfigured = isSupabaseConfigured();
  const [demoSession, setDemoSession] = React.useState<{ name: string; email: string } | null>(null);
  const [user, setUser] = React.useState<User | null>(null);
  const [name, setName] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (backendConfigured) {
      const supabase = getSupabaseBrowserClient();
      supabase?.auth.getUser().then(({ data }) => {
        setUser(data.user);
        setName((data.user?.user_metadata?.full_name as string) ?? "");
      });
      return;
    }
    const s = getDemoSessionClient();
    setDemoSession(s);
    setName(s?.name ?? "");
  }, [backendConfigured]);

  if (backendConfigured) {
    const email = user?.email ?? "";
    return (
      <Card className="max-w-lg space-y-4 p-5">
        <div>
          <h2 className="font-display text-base font-semibold">Account</h2>
          <p className="mt-1 text-sm text-text-muted">
            You&apos;re signed in with a real NexPrompt account. Your prompts, folders, tags, and
            collections are synced to your account and available on any device you sign into.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="account-name">Display name</Label>
          <div className="flex gap-2">
            <Input id="account-name" value={name} onChange={(e) => setName(e.target.value)} />
            <Button
              variant="outline"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                const supabase = getSupabaseBrowserClient();
                const { error } = (await supabase?.auth.updateUser({ data: { full_name: name } })) ?? {};
                setSaving(false);
                if (error) {
                  toast.error(error.message);
                } else {
                  toast.success("Display name updated");
                  router.refresh();
                }
              }}
            >
              Save
            </Button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <p className="text-sm text-text-muted">{email}</p>
        </div>
        <Button
          variant="outline"
          className="gap-1.5 text-danger hover:text-danger"
          onClick={async () => {
            const supabase = getSupabaseBrowserClient();
            await supabase?.auth.signOut();
            router.push("/");
            router.refresh();
          }}
        >
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </Button>
      </Card>
    );
  }

  return (
    <Card className="max-w-lg space-y-4 p-5">
      <div>
        <h2 className="font-display text-base font-semibold">Demo account</h2>
        <p className="mt-1 text-sm text-text-muted">
          This build is running in demo mode (no <code>NEXT_PUBLIC_SUPABASE_URL</code> configured), so
          there&apos;s no real account system yet. Your display name is stored in a local session
          cookie only.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="account-name">Display name</Label>
        <div className="flex gap-2">
          <Input id="account-name" value={name} onChange={(e) => setName(e.target.value)} />
          <Button
            variant="outline"
            onClick={() => {
              const updated = loginDemo({ name, email: demoSession?.email });
              setDemoSession(updated);
              toast.success("Display name updated");
              router.refresh();
            }}
          >
            Save
          </Button>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Email</Label>
        <p className="text-sm text-text-muted">{demoSession?.email ?? "demo@nexprompt.app"}</p>
      </div>
      <Button
        variant="outline"
        className="gap-1.5 text-danger hover:text-danger"
        onClick={() => {
          logoutDemo();
          router.push("/");
          router.refresh();
        }}
      >
        <LogOut className="h-3.5 w-3.5" /> Sign out
      </Button>
    </Card>
  );
}

function AppearanceTab() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const options = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Laptop },
  ] as const;

  return (
    <Card className="max-w-lg space-y-4 p-5">
      <div>
        <h2 className="font-display text-base font-semibold">Theme</h2>
        <p className="mt-1 text-sm text-text-muted">Applies immediately and persists across visits.</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {options.map((opt) => {
          const active = mounted && theme === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTheme(opt.value)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-md border px-3 py-4 text-sm transition-colors",
                active ? "border-accent bg-accent-soft text-accent" : "border-border text-text-muted hover:bg-surface"
              )}
            >
              <opt.icon className="h-4 w-4" />
              {opt.label}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function SyncTab() {
  const lastSyncedAt = useStore((s) => s.lastSyncedAt);
  const hasHydrated = useStore((s) => s.hasHydrated);
  const backendConfigured = isSupabaseConfigured();

  return (
    <Card className="max-w-lg space-y-3 p-5">
      <div className="flex items-center gap-2">
        <RefreshCw className="h-4 w-4 text-accent" />
        <h2 className="font-display text-base font-semibold">
          {backendConfigured ? "Account sync" : "Cross-tab sync"}
        </h2>
      </div>
      {backendConfigured ? (
        <p className="text-sm text-text-muted">
          Changes save to your account a moment after you make them, and are available on any
          device you sign into with the same account.
        </p>
      ) : (
        <p className="text-sm text-text-muted">
          NexPrompt saves to this browser&apos;s local storage on every change, and mirrors it live
          to any other NexPrompt tab open in the same browser — try it by opening{" "}
          <span className="font-medium text-text">/dashboard/prompts</span> in a second tab and editing
          a prompt in each.
        </p>
      )}
      <p className="text-sm text-text-faint">
        {hasHydrated
          ? lastSyncedAt
            ? `Last write synced ${new Date(lastSyncedAt).toLocaleTimeString()}.`
            : "No changes yet this session."
          : "Loading…"}
      </p>
      <p className="text-xs text-text-faint">
        Multi-device sync needs a real backend, which is scoped to Phase 7 (&ldquo;Backend &amp; API
        Integration&rdquo;) in the roadmap.
      </p>
    </Card>
  );
}

function DataTab() {
  const exportSnapshot = useStore((s) => s.exportSnapshot);
  const importSnapshot = useStore((s) => s.importSnapshot);
  const resetWorkspace = useStore((s) => s.resetWorkspace);
  const prompts = useStore((s) => s.prompts);
  const folders = useStore((s) => s.folders);
  const tags = useStore((s) => s.tags);
  const collections = useStore((s) => s.collections);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [backups, setBackups] = React.useState<BackupSnapshot[]>([]);
  const [confirmReset, setConfirmReset] = React.useState(false);
  const [confirmRestore, setConfirmRestore] = React.useState<BackupSnapshot | null>(null);

  React.useEffect(() => {
    setBackups(listBackups());
  }, [prompts, folders, tags, collections]);

  function handleExport() {
    const payload = buildExportPayload(exportSnapshot());
    downloadJson(payload, `nexprompt-export-${new Date().toISOString().slice(0, 10)}.json`);
    toast.success("Export downloaded");
  }

  async function handleImportFile(file: File) {
    try {
      const text = await readFileAsText(file);
      const data = parseImportPayload(text);
      importSnapshot(data, "merge");
      toast.success("Import complete");
    } catch (err) {
      if (err instanceof ImportValidationError) {
        toast.error(err.message);
      } else {
        toast.error("Couldn't import that file");
      }
    }
  }

  return (
    <div className="max-w-lg space-y-5">
      <Card className="space-y-3 p-5">
        <div className="flex items-center gap-2">
          <Download className="h-4 w-4 text-accent" />
          <h2 className="font-display text-base font-semibold">Import &amp; export</h2>
        </div>
        <p className="text-sm text-text-muted">
          Export your prompts, folders, tags, and collections as a JSON file — useful as a portable
          backup or to move your workspace to another browser. Importing merges by ID; anything with
          a matching ID is overwritten, everything else is kept.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-1.5" onClick={handleExport}>
            <Download className="h-3.5 w-3.5" /> Export as JSON
          </Button>
          <Button variant="outline" className="gap-1.5" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" /> Import JSON
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportFile(file);
              e.target.value = "";
            }}
          />
        </div>
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex items-center gap-2">
          <Archive className="h-4 w-4 text-accent" />
          <h2 className="font-display text-base font-semibold">Backups</h2>
        </div>
        <p className="text-sm text-text-muted">
          Manual, point-in-time snapshots kept in this browser (up to 10). Restoring replaces your
          current workspace with the snapshot.
        </p>
        <Button
          variant="outline"
          className="gap-1.5"
          onClick={() => {
            createBackup(exportSnapshot());
            setBackups(listBackups());
            toast.success("Backup created");
          }}
        >
          <Archive className="h-3.5 w-3.5" /> Create backup now
        </Button>

        <div className="space-y-1.5 pt-1">
          {backups.length === 0 && <p className="text-xs text-text-faint">No backups yet.</p>}
          {backups.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{b.label}</p>
                <p className="text-xs text-text-faint">{new Date(b.createdAt).toLocaleString()}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label="Restore backup"
                  onClick={() => setConfirmRestore(b)}
                >
                  <History className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-danger hover:text-danger"
                  aria-label="Delete backup"
                  onClick={() => {
                    deleteBackup(b.id);
                    setBackups(listBackups());
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="space-y-3 border-danger/30 p-5">
        <div className="flex items-center gap-2">
          <RotateCcw className="h-4 w-4 text-danger" />
          <h2 className="font-display text-base font-semibold">Reset workspace</h2>
        </div>
        <p className="text-sm text-text-muted">
          Wipes your prompts, folders, tags, and collections and restores the original demo data.
          Consider exporting or creating a backup first.
        </p>
        <Button variant="destructive" className="gap-1.5 w-fit" onClick={() => setConfirmReset(true)}>
          <RotateCcw className="h-3.5 w-3.5" /> Reset to demo data
        </Button>
      </Card>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Reset workspace?"
        description="This replaces everything with the original demo data. This can't be undone."
        confirmLabel="Reset workspace"
        onConfirm={() => {
          resetWorkspace();
          toast.success("Workspace reset");
        }}
      />
      <ConfirmDialog
        open={confirmRestore !== null}
        onOpenChange={(o) => !o && setConfirmRestore(null)}
        title={`Restore "${confirmRestore?.label}"?`}
        description="This replaces your current prompts, folders, tags, and collections with the backup's contents."
        confirmLabel="Restore backup"
        destructive={false}
        onConfirm={() => {
          if (!confirmRestore) return;
          importSnapshot(confirmRestore.data, "replace");
          toast.success("Backup restored");
        }}
      />
    </div>
  );
}
