import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AdminEvent } from "@/lib/admin/store";

export function ErrorLogs({ events }: { events: AdminEvent[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Error logs</CardTitle>
        <CardDescription>API failures, rate limits, and Groq provider errors.</CardDescription>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-text-muted">No errors recorded — everything&apos;s healthy.</p>
        ) : (
          <ul className="divide-y divide-border">
            {events.map((event) => {
              const reason = (event.metadata.reason as string) ?? "unknown";
              const action = (event.metadata.action as string) ?? event.eventType;
              return (
                <li key={event.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm truncate">
                      <span className="font-medium">{action}</span>{" "}
                      <span className="text-text-muted">— {event.userLabel ?? "anonymous"}</span>
                    </p>
                    <p className="text-xs text-text-faint">{new Date(event.createdAt).toLocaleString()}</p>
                  </div>
                  <Badge variant={reason === "rate_limited" ? "brass" : "danger"}>
                    {reason.replace("_", " ")}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
