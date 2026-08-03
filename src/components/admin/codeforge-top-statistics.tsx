import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import type { ScopedTopStats } from "@/lib/admin/overview";

function RankList({ entries, empty }: { entries: { label: string; count: number }[]; empty: string }) {
  if (entries.length === 0) {
    return <p className="text-sm text-text-muted">{empty}</p>;
  }
  const max = Math.max(...entries.map((e) => e.count));
  return (
    <ul className="space-y-2.5">
      {entries.map((entry, i) => (
        <li key={entry.label} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="truncate flex items-center gap-2">
              <span className="text-text-faint text-xs w-4">{i + 1}.</span>
              <span className="truncate">{entry.label}</span>
            </span>
            <span className="text-text-muted text-xs shrink-0">{entry.count}</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface overflow-hidden">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${Math.max(6, (entry.count / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function CodeForgeTopStatistics({ stats }: { stats: ScopedTopStats }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Most used tools</CardTitle>
          <CardDescription>Across all 9 CodeForge tools + AI Coding Chat.</CardDescription>
        </CardHeader>
        <CardContent>
          <RankList entries={stats.topTools} empty="No CodeForge tool runs yet." />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Most active users</CardTitle>
          <CardDescription>By total tracked CodeForge actions.</CardDescription>
        </CardHeader>
        <CardContent>
          <RankList entries={stats.mostActiveUsers} empty="No CodeForge activity yet." />
        </CardContent>
      </Card>
    </div>
  );
}
