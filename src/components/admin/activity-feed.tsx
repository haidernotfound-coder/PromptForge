import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  MessageSquareText,
  BookOpen,
  Copy,
  FilePlus2,
  AlertCircle,
  Code2,
  Bug,
  Gauge,
  BookMarked,
  Languages,
  FlaskConical,
  FileText,
  ClipboardCheck,
} from "lucide-react";
import type { AdminEvent } from "@/lib/admin/store";

const EVENT_META: Record<string, { label: string; icon: typeof Sparkles }> = {
  "prompt.improved": { label: "improved a prompt", icon: Sparkles },
  "prompt.rewritten": { label: "rewrote a prompt", icon: Sparkles },
  "prompt.expanded": { label: "expanded a prompt", icon: Sparkles },
  "prompt.shortened": { label: "shortened a prompt", icon: Sparkles },
  "prompt.critiqued": { label: "ran the Critic", icon: Sparkles },
  "forge_ai.chat": { label: "chatted with Forge AI", icon: MessageSquareText },
  "recipe.used": { label: "used a Recipe Forge recipe", icon: BookOpen },
  "prompt.copied": { label: "copied a prompt", icon: Copy },
  "prompt.created": { label: "created a prompt", icon: FilePlus2 },
  "ai.error": { label: "hit an AI provider error", icon: AlertCircle },
  "codeforge.generate": { label: "generated code in CodeForge", icon: Code2 },
  "codeforge.fix": { label: "fixed a bug in CodeForge", icon: Bug },
  "codeforge.optimize": { label: "optimized code in CodeForge", icon: Gauge },
  "codeforge.explain": { label: "explained code in CodeForge", icon: BookMarked },
  "codeforge.convert": { label: "converted code in CodeForge", icon: Languages },
  "codeforge.tests": { label: "generated unit tests in CodeForge", icon: FlaskConical },
  "codeforge.docs": { label: "generated docs in CodeForge", icon: FileText },
  "codeforge.review": { label: "reviewed code in CodeForge", icon: ClipboardCheck },
  "codeforge.chat": { label: "chatted with CodeForge AI", icon: MessageSquareText },
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.max(0, Math.round(diffMs / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.round(hr / 24)}d ago`;
}

export function ActivityFeed({
  events,
  title = "Live activity",
  description = "Most recent user actions across the app.",
}: {
  events: AdminEvent[];
  title?: string;
  description?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-text-muted">No activity recorded yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {events.map((event) => {
              const meta = EVENT_META[event.eventType] ?? { label: event.eventType, icon: Sparkles };
              const Icon = meta.icon;
              return (
                <li key={event.id} className="flex items-center gap-3 py-2.5">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                      event.success ? "bg-accent-soft text-accent" : "bg-danger/15 text-danger"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">
                      <span className="font-medium">{event.userLabel ?? "Anonymous"}</span>{" "}
                      <span className="text-text-muted">{meta.label}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!event.success && <Badge variant="danger">failed</Badge>}
                    <span className="text-xs text-text-faint">{timeAgo(event.createdAt)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
