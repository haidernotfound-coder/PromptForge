"use client";

import { ShieldCheck, Sparkles, GraduationCap, Code2, ImageIcon, Lock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import type { AdminBundle } from "@/components/admin/types";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

const OTHER_PRODUCTS = [
  { slug: "studyforge", name: "StudyForge", icon: GraduationCap },
  { slug: "codeforge", name: "CodeForge", icon: Code2 },
  { slug: "imageforge", name: "ImageForge", icon: ImageIcon },
];

export function PlatformAdminDashboard({
  initialData,
  adminEmailConfigured,
}: {
  initialData: AdminBundle;
  adminEmailConfigured: boolean;
}) {
  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-accent" />
          <h1 className="font-display text-2xl font-semibold tracking-tight">NexPrompt Admin</h1>
        </div>
        <p className="mt-1 text-sm text-text-muted">
          One console for the whole platform — pick a product to see its live stats.
        </p>
      </div>

      <Tabs defaultValue="promptforge" className="w-full">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="promptforge" className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> PromptForge
          </TabsTrigger>
          {OTHER_PRODUCTS.map((p) => (
            <TabsTrigger key={p.slug} value={p.slug} disabled className="gap-1.5 opacity-50">
              <p.icon className="h-3.5 w-3.5" /> {p.name}
              <Badge variant="slate" className="ml-1 gap-1 text-[10px]">
                <Lock className="h-2.5 w-2.5" /> Soon
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="promptforge">
          <div className="pt-4">
            <AdminDashboard
              initialData={initialData}
              adminEmailConfigured={adminEmailConfigured}
              showHeader={false}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
