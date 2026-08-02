"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { DashboardSidebarNav, DashboardBrand } from "@/components/dashboard/sidebar-nav";
import { FolderTree } from "@/components/dashboard/folder-tree";
import { TagSidebarList } from "@/components/dashboard/tag-sidebar-list";
import { CollectionSidebarList } from "@/components/dashboard/collection-sidebar-list";

export function DashboardMobileNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open dashboard menu" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="left-0 top-0 h-full max-w-[280px] translate-x-0 translate-y-0 overflow-y-auto rounded-none border-r data-[state=open]:animate-fade-in">
        <DialogTitle className="sr-only">Dashboard menu</DialogTitle>
        <DialogDescription className="sr-only">Dashboard navigation</DialogDescription>
        <div className="flex flex-col gap-6" onClick={() => setOpen(false)}>
          <DashboardBrand />
          <DashboardSidebarNav isAdmin={isAdmin} />
          <Button asChild size="sm" className="gap-1.5">
            <Link href="/dashboard/prompts/new">
              <Plus className="h-4 w-4" /> New prompt
            </Link>
          </Button>
          <Separator />
          <FolderTree />
          <Separator />
          <TagSidebarList />
          <Separator />
          <CollectionSidebarList />
        </div>
      </DialogContent>
    </Dialog>
  );
}
