"use client";

import { Card, CardContent } from "@/components/ui/card";
import { FileText, Star, FolderTree, Tags } from "lucide-react";
import { useStore } from "@/lib/store";

export function DashboardStats() {
  const prompts = useStore((s) => s.prompts);
  const folders = useStore((s) => s.folders);
  const tags = useStore((s) => s.tags);
  const hasHydrated = useStore((s) => s.hasHydrated);

  const stats = [
    { label: "Prompts", value: prompts.length, icon: FileText },
    { label: "Favorites", value: prompts.filter((p) => p.isFavorite).length, icon: Star },
    { label: "Folders", value: folders.length, icon: FolderTree },
    { label: "Tags", value: tags.length, icon: Tags },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-2xl font-display font-semibold">{hasHydrated ? stat.value : "–"}</p>
              <p className="text-xs text-text-muted mt-1">{stat.label}</p>
            </div>
            <stat.icon className="h-5 w-5 text-text-faint" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
