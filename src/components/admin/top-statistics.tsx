import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import type { TopStatistics as TopStats } from "@/lib/admin/overview";

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

export function TopStatistics({ stats }: { stats: TopStats }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Most used recipes</CardTitle>
          <CardDescription>Recipe Forge insertions.</CardDescription>
        </CardHeader>
        <CardContent>
          <RankList entries={stats.topRecipes} empty="No recipes used yet." />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Most improved prompts</CardTitle>
          <CardDescription>By prompt ID (Improve action).</CardDescription>
        </CardHeader>
        <CardContent>
          <RankList entries={stats.mostImprovedPrompts} empty="No prompts improved yet." />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Most copied prompts</CardTitle>
          <CardDescription>By prompt ID.</CardDescription>
        </CardHeader>
        <CardContent>
          <RankList entries={stats.topCopiedPrompts} empty="No prompts copied yet." />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Most active users</CardTitle>
          <CardDescription>By total tracked actions.</CardDescription>
        </CardHeader>
        <CardContent>
          <RankList entries={stats.mostActiveUsers} empty="No user activity yet." />
        </CardContent>
      </Card>
    </div>
  );
}
