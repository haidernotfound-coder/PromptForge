"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import type { DailyFeatureUsage } from "@/lib/admin/overview";

const COLORS = [
  "bg-accent",
  "bg-brass",
  "bg-sky-500",
  "bg-success",
  "bg-danger",
  "bg-violet-500",
  "bg-text-faint",
];

export function FeatureUsageChart({
  series,
  labels,
}: {
  series: DailyFeatureUsage[];
  labels: string[];
}) {
  const maxTotal = Math.max(
    1,
    ...series.map((day) => Object.values(day.counts).reduce((s, n) => s + n, 0))
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Feature usage (last 14 days)</CardTitle>
        <CardDescription>Improve, Forge AI, Critic, Recipe Forge, Rewrite, Expand, and more.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2 h-48">
          {series.map((day) => {
            const total = Object.values(day.counts).reduce((s, n) => s + n, 0);
            const heightPct = Math.max(total > 0 ? 4 : 0, (total / maxTotal) * 100);
            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1.5 group">
                <div className="w-full flex-1 flex items-end">
                  <div
                    className="w-full flex flex-col-reverse rounded-sm overflow-hidden transition-all"
                    style={{ height: `${heightPct}%` }}
                    title={`${day.date}: ${total} event${total === 1 ? "" : "s"}`}
                  >
                    {labels.map((label, i) => {
                      const count = day.counts[label] ?? 0;
                      if (count === 0 || total === 0) return null;
                      return (
                        <div
                          key={label}
                          className={COLORS[i % COLORS.length]}
                          style={{ height: `${(count / total) * 100}%` }}
                        />
                      );
                    })}
                  </div>
                </div>
                <span className="text-[10px] text-text-faint">{day.date.slice(5)}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2">
          {labels.map((label, i) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-text-muted">
              <span className={`h-2.5 w-2.5 rounded-sm ${COLORS[i % COLORS.length]}`} />
              {label}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
